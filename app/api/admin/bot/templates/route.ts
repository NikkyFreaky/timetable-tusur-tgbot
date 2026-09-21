import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/supabase-server'
import {
  getBotMessageTemplates,
  saveBotMessageTemplates,
  type BotMessageTemplate,
} from '@/lib/bot-message-templates'
import { setTelegramCommands } from '@/lib/telegram-bot'

export const runtime = 'nodejs'

const commands = new Set(['start', 'settings', 'info'])
const audiences = new Set(['private', 'group'])

export async function GET() {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ templates: await getBotMessageTemplates(), role: adminUser.admin.role })
}

export async function PUT(request: Request) {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { templates?: BotMessageTemplate[] } | null
  if (!body?.templates || body.templates.length !== 6) {
    return NextResponse.json({ error: 'Передайте все шесть шаблонов' }, { status: 400 })
  }

  const valid = body.templates.every((item) =>
    commands.has(item.command) && audiences.has(item.audience)
      && typeof item.text === 'string' && item.text.trim().length > 0 && item.text.length <= 4096
  )
  if (!valid) return NextResponse.json({ error: 'Недопустимый шаблон' }, { status: 400 })

  await saveBotMessageTemplates(body.templates.map((item) => ({ ...item, text: item.text.trim() })))
  const botToken = process.env.BOT_TOKEN
  if (botToken) await setTelegramCommands(botToken)
  return NextResponse.json({ ok: true })
}
