import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60

export type TelegramInitDataUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  added_to_attachment_menu?: boolean
  allows_write_to_pm?: boolean
  photo_url?: string
}

export type TelegramInitData = {
  user: TelegramInitDataUser
  chat?: {
    id: number
    type: string
    title?: string
    username?: string
    photo_url?: string
  }
}

function parseInitData(initData: string): TelegramInitData | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  const authDate = Number(params.get('auth_date'))
  const botToken = process.env.BOT_TOKEN

  if (!hash || !Number.isSafeInteger(authDate) || !botToken) return null

  const now = Math.floor(Date.now() / 1000)
  if (authDate > now + 60 || now - authDate > INIT_DATA_MAX_AGE_SECONDS) return null

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest()

  let receivedHash: Buffer
  try {
    receivedHash = Buffer.from(hash, 'hex')
  } catch {
    return null
  }

  if (receivedHash.length !== expectedHash.length || !timingSafeEqual(receivedHash, expectedHash)) {
    return null
  }

  const userValue = params.get('user')
  if (!userValue) return null

  try {
    const user = JSON.parse(userValue) as TelegramInitDataUser
    if (!Number.isSafeInteger(user.id) || !user.first_name) return null

    const chatValue = params.get('chat')
    const chat = chatValue ? (JSON.parse(chatValue) as TelegramInitData['chat']) : undefined
    if (chat && (!Number.isSafeInteger(chat.id) || !chat.type)) return null

    return { user, chat }
  } catch {
    return null
  }
}

export function getTelegramInitData(request: Request): TelegramInitData | null {
  const initData = request.headers.get('x-telegram-init-data')
  return initData ? parseInitData(initData) : null
}

export function requireTelegramInitData(request: Request):
  | { data: TelegramInitData }
  | { response: NextResponse } {
  const data = getTelegramInitData(request)
  if (data) return { data }

  return {
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}
