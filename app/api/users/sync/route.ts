import { NextResponse } from "next/server"
import { upsertUser, type TelegramClientInfo, type TelegramUserProfile } from "@/lib/user-store"
import type { UserSettings } from "@/lib/schedule-types"

export const runtime = "nodejs"

type SyncPayload = {
  user?: TelegramUserProfile
  settings?: UserSettings | null
  device?: TelegramClientInfo | null
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SyncPayload
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      null

    const userId = Number(payload.user?.id)
    if (!Number.isFinite(userId) || !payload.user?.first_name) {
      return NextResponse.json({ error: "Missing user" }, { status: 400 })
    }

    const stored = await upsertUser({
      user: { ...payload.user, id: userId },
      settings: payload.settings ?? null,
      device: payload.device ?? null,
      ip,
    })

    return NextResponse.json({ user: stored })
  } catch (error) {
    console.error("Failed to sync user:", error)
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 })
  }
}
