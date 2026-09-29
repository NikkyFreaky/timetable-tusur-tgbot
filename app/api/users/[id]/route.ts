import { NextResponse } from "next/server"
import { getUserById } from "@/lib/user-store"
import { requireTelegramInitData } from "@/lib/telegram-auth"
import { getAdminUser } from "@/lib/supabase-server"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
  request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const { id } = await context.params
    const requestedUserId = Number(id)

    if (!Number.isSafeInteger(requestedUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }

    const admin = await getAdminUser()
    const auth = requireTelegramInitData(request)
    if (!admin && 'response' in auth) return auth.response
    const telegramUserId = 'data' in auth ? auth.data.user.id : null

    if (!admin && requestedUserId !== telegramUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await getUserById(admin ? requestedUserId : telegramUserId!)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Failed to load user:", error)
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
  }
}
