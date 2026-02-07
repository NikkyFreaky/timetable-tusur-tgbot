import { NextResponse } from "next/server"
import { buildWebAppKeyboard, sendTelegramMessage } from "@/lib/telegram-bot"

export const runtime = "nodejs"

type TelegramUpdate = {
  message?: {
    message_id: number
    chat: { id: number; type: string; title?: string }
    text?: string
  }
  edited_message?: TelegramUpdate["message"]
}

function getCommand(text: string | undefined) {
  if (!text) return null
  const [command] = text.trim().split(/\s+/)
  if (!command) return null
  return command.split("@")[0] || null
}

export async function POST(request: Request) {
  const botToken = process.env.BOT_TOKEN
  const webAppUrl = process.env.WEBAPP_URL || process.env.NEXT_PUBLIC_WEBAPP_URL

  if (!botToken || !webAppUrl) {
    return NextResponse.json({ ok: false })
  }

  try {
    const update = (await request.json()) as TelegramUpdate
    const message = update.message ?? update.edited_message
    if (!message?.chat?.id) {
      return NextResponse.json({ ok: true })
    }

    const command = getCommand(message.text)
    if (!command) {
      return NextResponse.json({ ok: true })
    }

    if (command === "/start" || command === "/settings") {
      const text =
        "Откройте веб-приложение, чтобы выбрать группу и настроить уведомления."
      await sendTelegramMessage(botToken, message.chat.id, text, {
        replyMarkup: buildWebAppKeyboard(webAppUrl),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}
