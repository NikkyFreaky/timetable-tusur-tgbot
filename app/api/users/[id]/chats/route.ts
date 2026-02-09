import { NextResponse } from "next/server"
import { listUserChats } from "@/lib/chat-store"
import { getChat } from "@/lib/telegram-api"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
  _request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const { id } = await context.params
    const userId = Number(id)

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }

    const chats = await listUserChats(userId)
    const botToken = process.env.BOT_TOKEN

    if (!botToken || chats.length === 0) {
      return NextResponse.json({ chats })
    }

    const activeChats = []
    for (const chat of chats) {
      if (chat.type === "private") {
        activeChats.push(chat)
        continue
      }

      const telegramChat = await getChat(botToken, chat.id)
      if (telegramChat) {
        activeChats.push(chat)
      }
    }

    return NextResponse.json({ chats: activeChats })
  } catch (error) {
    console.error("Failed to load user chats:", error)
    return NextResponse.json({ error: "Failed to load user chats" }, { status: 500 })
  }
}
