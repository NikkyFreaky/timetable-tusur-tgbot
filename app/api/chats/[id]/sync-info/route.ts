import { NextResponse } from "next/server"
import { getChatById, upsertChat } from "@/lib/chat-store"
import { getChat } from "@/lib/telegram-api"
import { limitTelegramMutation, requireTelegramInitData } from "@/lib/telegram-auth"
import { verifyChatAdmin } from '@/lib/chat-access'

export const runtime = "nodejs"

type Params = { id: string }

export async function POST(
  request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const auth = requireTelegramInitData(request)
    if ('response' in auth) return auth.response
    const rateLimit = limitTelegramMutation(request, auth.data.user.id)
    if (rateLimit) return rateLimit

    const { id } = await context.params
    const chatId = Number(id)

    console.log('Synchronizing chat information')

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const access = await verifyChatAdmin(chatId, auth.data.user.id)
    if (access === 'unavailable') {
      return NextResponse.json({ error: 'Unable to verify chat permissions' }, { status: 503 })
    }
    if (access !== 'authorized') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: "BOT_TOKEN not configured" }, { status: 500 })
    }

    const telegramChat = await getChat(botToken, chatId)
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

    console.log('Chat information synchronized')

    return NextResponse.json({ chat: updatedChat })
  } catch (error) {
    console.error("Failed to sync chat info:", error)
    return NextResponse.json({ error: "Failed to sync chat info" }, { status: 500 })
  }
}
