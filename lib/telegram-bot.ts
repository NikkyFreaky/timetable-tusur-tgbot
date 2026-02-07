type SendMessageOptions = {
  parseMode?: "HTML" | "MarkdownV2"
  disableWebPagePreview?: boolean
  replyMarkup?: Record<string, unknown>
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
  const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options.parseMode,
      disable_web_page_preview: options.disableWebPagePreview,
      reply_markup: options.replyMarkup,
    }),
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
