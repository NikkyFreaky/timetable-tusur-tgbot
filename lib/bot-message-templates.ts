import { createClient } from '@supabase/supabase-js'

export type BotCommand = 'start' | 'settings' | 'info'
export type BotAudience = 'private' | 'group'
export type BotMessageTemplate = {
  command: BotCommand
  audience: BotAudience
  text: string
}

const DEFAULT_TEMPLATES: BotMessageTemplate[] = [
  { command: 'start', audience: 'private', text: '⚙️ Чтобы настроить уведомления:\n1) Откройте веб-приложение\n2) Выберите группу\n3) Включите нужные рассылки' },
  { command: 'start', audience: 'group', text: '⚙️ Чтобы настроить уведомления:\n1) Откройте веб-приложение\n2) В группе выдайте боту права администратора' },
  { command: 'settings', audience: 'private', text: '⚙️ Настройка уведомлений\nОткройте веб-приложение, выберите группу и включите нужные рассылки.' },
  { command: 'settings', audience: 'group', text: '⚙️ Настройка уведомлений\nОткройте веб-приложение, выберите группу и включите нужные рассылки.' },
  { command: 'info', audience: 'private', text: '📚 Бот расписания ТУСУР. Откройте приложение, чтобы выбрать группу и настроить уведомления.' },
  { command: 'info', audience: 'group', text: '📚 Бот расписания ТУСУР. Откройте приложение, чтобы настроить расписание и уведомления для этого чата.' },
]

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function getBotMessageTemplates(): Promise<BotMessageTemplate[]> {
  const { data } = await getSupabase().from('bot_message_templates').select('command,audience,text')
  const saved = new Map((data ?? []).map((item: BotMessageTemplate) => [`${item.command}:${item.audience}`, item]))
  return DEFAULT_TEMPLATES.map((item) => saved.get(`${item.command}:${item.audience}`) ?? item)
}

export async function getBotMessageTemplate(command: BotCommand, audience: BotAudience) {
  const templates = await getBotMessageTemplates()
  return templates.find((item) => item.command === command && item.audience === audience)?.text
    ?? DEFAULT_TEMPLATES[0].text
}

export async function saveBotMessageTemplates(templates: BotMessageTemplate[]) {
  const now = new Date().toISOString()
  const { error } = await getSupabase().from('bot_message_templates').upsert(
    templates.map((template) => ({ ...template, updated_at: now })),
    { onConflict: 'command,audience' }
  )
  if (error) throw error
}
