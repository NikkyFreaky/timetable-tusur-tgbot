import { NextResponse } from "next/server"
import { listUserChats } from "@/lib/chat-store"
import { getChat } from "@/lib/telegram-api"
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
    const requestedUserId = Number(id)

    if (!Number.isSafeInteger(requestedUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }

    if (requestedUserId !== auth.data.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const chats = await listUserChats(auth.data.user.id)
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
