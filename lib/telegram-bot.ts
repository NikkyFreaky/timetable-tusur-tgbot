type SendMessageOptions = {
  parseMode?: "HTML" | "MarkdownV2"
  disableWebPagePreview?: boolean
  replyMarkup?: Record<string, unknown>
  messageThreadId?: number
}

type TelegramResponse = {
  ok: boolean
  description?: string
}

const TELEGRAM_API = "https://api.telegram.org/bot"

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  options: SendMessageOptions = {}
) {
  const body: any = {
    chat_id: chatId,
    text,
  }

  if (options.parseMode) body.parse_mode = options.parseMode
  if (options.disableWebPagePreview) body.disable_web_page_preview = options.disableWebPagePreview
  if (options.replyMarkup) body.reply_markup = options.replyMarkup
  if (options.messageThreadId) body.message_thread_id = options.messageThreadId

  const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = (await response.json().catch(() => ({}))) as TelegramResponse
  if (!response.ok || !data.ok) {
    const description = data.description || `HTTP ${response.status}`
    throw new Error(`Telegram sendMessage failed: ${description}`)
  }
}

export function buildWebAppKeyboard(url: string) {
  return {
    inline_keyboard: [[{ text: "Открыть расписание", web_app: { url } }]],
  }
}
