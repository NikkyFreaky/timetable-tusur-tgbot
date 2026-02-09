import { NextResponse } from "next/server"
import { getChatById, upsertChat } from "@/lib/chat-store"
import { getChat } from "@/lib/telegram-api"

export const runtime = "nodejs"

type Params = { id: string }

export async function POST(
  request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const { id } = await context.params
    const chatId = Number(id)

    console.log("=== POST /api/chats/[id]/sync-info ===", { chatId })

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: "BOT_TOKEN not configured" }, { status: 500 })
    }

    const telegramChat = await getChat(botToken, chatId)
    console.log("Telegram API chat info:", telegramChat)

    if (!telegramChat) {
      return NextResponse.json({ error: "Failed to get chat info from Telegram" }, { status: 500 })
    }

    const updatedChat = await upsertChat({
      chat: {
        id: chatId,
        type: telegramChat.type,
        title: telegramChat.title || undefined,
        username: telegramChat.username || undefined,
        photo_url: telegramChat.photo_url || undefined,
      },
      isForum: telegramChat.is_forum ?? false,
    })

    console.log("Chat synced:", updatedChat)

    return NextResponse.json({ chat: updatedChat })
  } catch (error) {
    console.error("Failed to sync chat info:", error)
    return NextResponse.json({ error: "Failed to sync chat info" }, { status: 500 })
  }
}
