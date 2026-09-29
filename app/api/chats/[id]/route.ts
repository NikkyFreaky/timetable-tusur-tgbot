import { NextResponse } from "next/server"
import { getChatById } from "@/lib/chat-store"
import { getChatMemberRole } from "@/lib/chat-store"
import { requireTelegramInitData } from "@/lib/telegram-auth"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
  request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const auth = requireTelegramInitData(request)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const chatId = Number(id)

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const role = await getChatMemberRole(chatId, auth.data.user.id)
    if (!role || ['left', 'kicked'].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const chat = await getChatById(chatId)
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    return NextResponse.json({ chat })
  } catch (error) {
    console.error("Failed to load chat:", error)
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 })
  }
}
