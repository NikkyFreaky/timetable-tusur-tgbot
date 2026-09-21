import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram-bot'
import { getDayIndex, getMondayOfWeek, formatDayDate } from '@/lib/schedule-data'
import { DAY_NAMES, LESSON_TYPES } from '@/lib/schedule-types'
import { fetchWeekSchedule } from '@/lib/timetable'

export const runtime = 'nodejs'

type Target = { chatId: number; threadId?: number | null; kind: 'user' | 'chat' }
type RequestBody = { kind: 'text' | 'schedule'; text?: string; targets: Target[]; confirm?: boolean }

function buildScheduleMessage(schedule: Awaited<ReturnType<typeof fetchWeekSchedule>>, date: Date) {
  const day = schedule.days[getDayIndex(date)]
  const lines = [`📅 Расписание на ${formatDayDate(date)} (${DAY_NAMES[getDayIndex(date)]})`]
  if (!day?.lessons.length) return `${lines.join('\n')}\n\nПар нет.`
  lines.push('')
  day.lessons.forEach((lesson, index) => {
    const type = LESSON_TYPES[lesson.type]?.label
    lines.push(`${index + 1}) ${lesson.time}–${lesson.timeEnd}`)
    lines.push(`📚 ${lesson.isCancelled ? '❌ ' : ''}${lesson.subject}${type ? ` (${type})` : ''}`)
    if (lesson.room && lesson.room !== '—') lines.push(`🏫 Ауд.: ${lesson.room}`)
    if (lesson.instructor && lesson.instructor !== '—') lines.push(`👨‍🏫 ${lesson.instructor}`)
    if (index < day.lessons.length - 1) lines.push('')
  })
  return lines.join('\n')
}

function getRetryAfter(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const match = message.match(/retry after (\d+)/i)
  return match ? Number(match[1]) : null
}

async function sendWithRetry(botToken: string, target: Target, text: string) {
  try {
    await sendTelegramMessage(botToken, target.chatId, text, { messageThreadId: target.threadId ?? undefined })
  } catch (error) {
    const retryAfter = getRetryAfter(error)
    if (!retryAfter) throw error
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
    await sendTelegramMessage(botToken, target.chatId, text, { messageThreadId: target.threadId ?? undefined })
  }
}

export async function POST(request: Request) {
  const adminUser = await getAdminUser()
  if (!adminUser || adminUser.admin.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => null) as RequestBody | null
  if (!body?.confirm || !Array.isArray(body.targets) || body.targets.length === 0) {
    return NextResponse.json({ error: 'Выберите адресатов и подтвердите отправку' }, { status: 400 })
  }
  if (body.targets.length > 1000 || !['text', 'schedule'].includes(body.kind)) {
    return NextResponse.json({ error: 'Недопустимые параметры рассылки' }, { status: 400 })
  }
  if (body.kind === 'text' && (!body.text?.trim() || body.text.length > 4096)) {
    return NextResponse.json({ error: 'Текст должен содержать от 1 до 4096 символов' }, { status: 400 })
  }
  if (body.kind === 'schedule' && body.targets.length !== 1) {
    return NextResponse.json({ error: 'Для расписания выберите ровно одного адресата' }, { status: 400 })
  }

  const uniqueTargets = [...new Map(body.targets.map((target) => [
    `${target.chatId}:${target.threadId ?? ''}`, target,
  ])).values()].filter((target) => Number.isSafeInteger(target.chatId)
    && (target.threadId === undefined || target.threadId === null || Number.isSafeInteger(target.threadId)))
  if (!uniqueTargets.length) return NextResponse.json({ error: 'Недопустимые адресаты' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const verifiedTargets = (await Promise.all(uniqueTargets.map(async (target) => {
    const source = target.kind === 'user' ? 'users' : 'chats'
    let query = supabase.from(source).select('id').eq('id', target.chatId).eq('bot_active', true)
    if (source === 'chats') query = query.neq('type', 'private')
    const { data } = await query.maybeSingle()
    if (!data) return null
    if (target.threadId) {
      const { data: topic } = await supabase.from('chat_topics')
        .select('id').eq('chat_id', target.chatId).eq('id', target.threadId).maybeSingle()
      if (!topic) return null
    }
    return target
  }))).filter((target): target is Target => target !== null)
  if (verifiedTargets.length !== uniqueTargets.length) {
    return NextResponse.json({ error: 'Один или несколько адресатов больше недоступны' }, { status: 400 })
  }
  const { data: dispatch, error: dispatchError } = await supabase.from('bot_message_dispatches').insert({
    created_by: adminUser.id, kind: body.kind, text: body.kind === 'text' ? body.text!.trim() : null,
  }).select('id').single()
  if (dispatchError || !dispatch) return NextResponse.json({ error: 'Не удалось создать рассылку' }, { status: 500 })

  const botToken = process.env.BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: 'BOT_TOKEN missing' }, { status: 500 })
  let text = body.text?.trim() ?? ''
  if (body.kind === 'schedule') {
    const configured = await Promise.all(verifiedTargets.map(async (target) => {
      const source = target.kind === 'user' ? 'users' : 'chats'
      const { data } = await supabase.from(source).select('settings').eq('id', target.chatId).eq('bot_active', true).maybeSingle()
      return { target, settings: data?.settings as { facultySlug?: string; groupSlug?: string } | null }
    }))
    const first = configured.find((item) => item.settings?.facultySlug && item.settings?.groupSlug)
    if (!first?.settings?.facultySlug || !first.settings.groupSlug) {
      return NextResponse.json({ error: 'У выбранных адресатов нет настроенного расписания' }, { status: 400 })
    }
    const schedule = await fetchWeekSchedule(first.settings.facultySlug, first.settings.groupSlug, getMondayOfWeek(new Date()))
    text = buildScheduleMessage(schedule, new Date())
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: 'Расписание слишком длинное для одного сообщения Telegram' }, { status: 400 })
  }

  let sent = 0
  let failed = 0
  for (const target of verifiedTargets) {
    try {
      await sendWithRetry(botToken, target, text)
      sent += 1
      await supabase.from('bot_message_delivery_attempts').insert({ dispatch_id: dispatch.id, chat_id: target.chatId, message_thread_id: target.threadId ?? null, status: 'sent' })
    } catch (error) {
      failed += 1
      const errorText = error instanceof Error ? error.message : 'Unknown error'
      await supabase.from('bot_message_delivery_attempts').insert({ dispatch_id: dispatch.id, chat_id: target.chatId, message_thread_id: target.threadId ?? null, status: 'failed', error: errorText })
      if (/403|blocked|chat not found/i.test(errorText)) {
        const source = target.kind === 'user' ? 'users' : 'chats'
        await supabase.from(source).update({ bot_active: false }).eq('id', target.chatId)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 35))
  }
  await supabase.from('bot_message_dispatches').update({ sent_count: sent, failed_count: failed, completed_at: new Date().toISOString() }).eq('id', dispatch.id)
  return NextResponse.json({ ok: true, sent, failed })
}
