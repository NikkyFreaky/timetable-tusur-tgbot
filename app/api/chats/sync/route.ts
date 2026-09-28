import { NextResponse } from "next/server"
import { upsertChat, type TelegramChatProfile } from "@/lib/chat-store"
import type { UserSettings } from "@/lib/schedule-types"
import { requireTelegramInitData } from "@/lib/telegram-auth"
import { getChatMemberRole } from "@/lib/chat-store"
import { getChat, isAdmin } from "@/lib/telegram-api"

export const runtime = "nodejs"

type SyncPayload = {
  chat?: TelegramChatProfile
  settings?: UserSettings | null
}

export async function POST(request: Request) {
  try {
    const auth = requireTelegramInitData(request)
    if ('response' in auth) return auth.response

    const payload = (await request.json()) as SyncPayload
    const chatId = Number(payload.chat?.id)

    if (!Number.isSafeInteger(chatId)) {
      return NextResponse.json({ error: "Missing chat" }, { status: 400 })
    }

    const role = await getChatMemberRole(chatId, auth.data.user.id)
    if (!role || !isAdmin(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: "BOT_TOKEN not configured" }, { status: 500 })
    }

    const telegramChat = await getChat(botToken, chatId)
    if (!telegramChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const stored = await upsertChat({
      chat: {
        id: telegramChat.id,
        type: telegramChat.type,
        title: telegramChat.title,
        username: telegramChat.username,
        photo_url: telegramChat.photo_url,
      },
      settings: payload.settings ?? null,
    })

    return NextResponse.json({ chat: stored })
  } catch (error) {
    console.error("Failed to sync chat:", error)
    return NextResponse.json({ error: "Failed to sync chat" }, { status: 500 })
  }
}
