import { NextResponse } from "next/server"
import { upsertChat, type TelegramChatProfile } from "@/lib/chat-store"
import type { UserSettings } from "@/lib/schedule-types"

export const runtime = "nodejs"

type SyncPayload = {
  chat?: TelegramChatProfile
  settings?: UserSettings | null
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SyncPayload
    const chatId = Number(payload.chat?.id)

    if (!Number.isFinite(chatId) || !payload.chat?.type) {
      return NextResponse.json({ error: "Missing chat" }, { status: 400 })
    }

    const stored = await upsertChat({
      chat: { ...payload.chat, id: chatId },
      settings: payload.settings ?? null,
    })

    return NextResponse.json({ chat: stored })
  } catch (error) {
    console.error("Failed to sync chat:", error)
    return NextResponse.json({ error: "Failed to sync chat" }, { status: 500 })
  }
}
