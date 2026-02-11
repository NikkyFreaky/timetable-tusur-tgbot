import { NextResponse } from "next/server"
import { DAY_NAMES, LESSON_TYPES, type DaySchedule, type UserSettings } from "@/lib/schedule-types"
import {
  SPECIAL_PERIODS,
  getDayIndex,
  getMondayOfWeek,
  getWeekType,
  isSpecialPeriod,
  formatDayDate,
} from "@/lib/schedule-data"
import { fetchWeekSchedule } from "@/lib/timetable"
import { sendTelegramMessage } from "@/lib/telegram-bot"
import type { NotificationState } from "@/lib/notification-state"
import { listUsersWithSettings, updateUsersNotificationState } from "@/lib/user-store"
import { listChatsWithSettings, updateChatsNotificationState } from "@/lib/chat-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TOMSK_TIMEZONE = "Asia/Tomsk"
const tomskDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TOMSK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

type Recipient = {
  kind: "user" | "chat"
  id: number
  label: string | null
  settings: UserSettings
  state: NotificationState
  topicId: number | null
}

type ScheduleCache = Map<string, Promise<{ weekType: "even" | "odd"; days: DaySchedule[] }>>

function getTomskNow(): Date {
  const parts = tomskDateTimeFormatter.formatToParts(new Date())
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
  const year = Number(getPart("year"))
  const month = Number(getPart("month")) - 1
  const day = Number(getPart("day"))
  const hour = Number(getPart("hour"))
  const minute = Number(getPart("minute"))
  const second = Number(getPart("second"))
  return new Date(year, month, day, hour, minute, second)
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseNotificationTime(value: string) {
  const [hourRaw, minuteRaw] = value.split(":")
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 7,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  }
}

function formatTimeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function formatDayName(date: Date): string {
  return DAY_NAMES[getDayIndex(date)] ?? ""
}

function formatLessonLine(lesson: DaySchedule["lessons"][number], index: number) {
  const typeLabel = LESSON_TYPES[lesson.type]?.label
  const lines: string[] = [
    `${index + 1}) ${lesson.time}–${lesson.timeEnd}`,
    `📚 ${lesson.subject}${typeLabel ? ` (${typeLabel})` : ""}`,
  ]

  if (lesson.room && lesson.room !== "—") {
    lines.push(`🏫 Ауд.: ${lesson.room}`)
  }

  if (lesson.instructor && lesson.instructor !== "—") {
    lines.push(`👨‍🏫 ${lesson.instructor}`)
  }

  return lines.join("\n")
}

function buildScheduleMessage(
  date: Date,
  schedule: DaySchedule,
  groupName: string | null,
  titlePrefix: string
) {
  const dateLabel = formatDayDate(date)
  const dayName = formatDayName(date)
  const emoji = titlePrefix === "Расписание на завтра" ? "⏭️" : "📅"
  const lines: string[] = [
    `${emoji} ${titlePrefix} — ${dateLabel} (${dayName})`,
  ]
  if (groupName) {
    lines.push(`👥 Группа: ${groupName}`)
  }
  if (schedule.lessons.length === 0) {
    lines.push("Пар нет.")
    return lines.join("\n")
  }
  lines.push("")
  schedule.lessons.forEach((lesson, index) => {
    lines.push(formatLessonLine(lesson, index))
    if (index < schedule.lessons.length - 1) {
      lines.push("")
    }
  })
  return lines.join("\n")
}

function buildNoLessonsMessage(
  nextDate: Date | null,
  nextSchedule: DaySchedule | null,
  groupName: string | null
) {
  const lines: string[] = ["😌 Сегодня пар нет."]
  if (!nextDate || !nextSchedule) {
    lines.push("Ближайшие занятия не найдены.")
    return lines.join("\n")
  }

  const dateLabel = formatDayDate(nextDate)
  const dayName = formatDayName(nextDate)
  lines.push(`📌 Ближайшие занятия — ${dateLabel} (${dayName})`)
  if (groupName) {
    lines.push(`👥 Группа: ${groupName}`)
  }
  if (nextSchedule.lessons.length === 0) {
    lines.push("Пар нет.")
    return lines.join("\n")
  }
  lines.push("")
  nextSchedule.lessons.forEach((lesson, index) => {
    lines.push(formatLessonLine(lesson, index))
    if (index < nextSchedule.lessons.length - 1) {
      lines.push("")
    }
  })
  return lines.join("\n")
}

async function getScheduleForDate(
  facultySlug: string,
  groupSlug: string,
  date: Date,
  cache: ScheduleCache
): Promise<DaySchedule> {
  const monday = getMondayOfWeek(date)
  const cacheKey = `${facultySlug}|${groupSlug}|${formatDateKey(monday)}`
  let schedulePromise = cache.get(cacheKey)
  if (!schedulePromise) {
    schedulePromise = fetchWeekSchedule(facultySlug, groupSlug, monday)
    cache.set(cacheKey, schedulePromise)
  }

  const schedule = await schedulePromise
  const dayIndex = getDayIndex(date)
  return schedule.days[dayIndex] ?? {
    dayName: formatDayName(date),
    dayIndex,
    lessons: [],
  }
}

async function findNextLessons(
  facultySlug: string,
  groupSlug: string,
  startDate: Date,
  cache: ScheduleCache
) {
  for (let offset = 1; offset <= 60; offset += 1) {
    const date = addDays(startDate, offset)
    const schedule = await getScheduleForDate(facultySlug, groupSlug, date, cache)
    if (schedule.lessons.length > 0) {
      return { date, schedule }
    }
  }
  return { date: null, schedule: null }
}

function shouldSendForTime(now: Date, notificationTime: string) {
  const { hour, minute } = parseNotificationTime(notificationTime)
  return now.getHours() === hour && now.getMinutes() === minute
}

function buildWeekStartMessage(date: Date) {
  const weekType = getWeekType(date) === "even" ? "Чётная" : "Нечётная"
  const dateLabel = formatDayDate(date)
  return `🗓️ Начало недели — ${dateLabel}\n📊 ${weekType} неделя`
}

export async function GET(request: Request) {
  const botToken = process.env.BOT_TOKEN
  const cronSecret = process.env.CRON_SECRET
  const requestUrl = new URL(request.url)

  if (cronSecret) {
    const auth = request.headers.get("authorization")
    const querySecret = requestUrl.searchParams.get("secret")
    if (auth !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!botToken) {
    return NextResponse.json({ error: "BOT_TOKEN missing" }, { status: 500 })
  }

  const now = getTomskNow()
  const todayKey = formatDateKey(now)
  const timeKey = formatTimeKey(now)

  const users = await listUsersWithSettings()
  const chats = await listChatsWithSettings()

  const recipients: Recipient[] = []
  for (const user of users) {
    if (!user.settings) continue
    recipients.push({
      kind: "user",
      id: user.id,
      label: user.settings.groupName ?? null,
      settings: user.settings,
      state: user.notificationState ?? {},
      topicId: null,
    })
  }
  for (const chat of chats) {
    if (!chat.settings) continue
    recipients.push({
      kind: "chat",
      id: chat.id,
      label: chat.settings.groupName ?? chat.title,
      settings: chat.settings,
      state: chat.notificationState ?? {},
      topicId: chat.topicId ?? null,
    })
  }

  const scheduleCache: ScheduleCache = new Map()
  const userStateUpdates: Array<{ id: number; state: Partial<NotificationState> }> = []
  const chatStateUpdates: Array<{ id: number; state: Partial<NotificationState> }> = []

  let sentCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const recipient of recipients) {
    const settings = recipient.settings
    if (!settings.notificationsEnabled) {
      skippedCount += 1
      continue
    }
    if (!settings.facultySlug || !settings.groupSlug) {
      skippedCount += 1
      continue
    }
    if (!shouldSendForTime(now, settings.notificationTime)) {
      skippedCount += 1
      continue
    }

    const dispatchKey = `${todayKey} ${timeKey}`
    if (recipient.state.lastDispatchKey === dispatchKey) {
      skippedCount += 1
      continue
    }

    try {
      const messages: string[] = []
      const stateUpdates: Partial<NotificationState> = { lastDispatchKey: dispatchKey }

      const todaySchedule = await getScheduleForDate(
        settings.facultySlug,
        settings.groupSlug,
        now,
        scheduleCache
      )

      if (settings.sendDayOf && todaySchedule.lessons.length > 0) {
        messages.push(
          buildScheduleMessage(
            now,
            todaySchedule,
            settings.groupName ?? recipient.label,
            "Расписание на сегодня"
          )
        )
        stateUpdates.lastDayOfDate = todayKey
      }

      if (settings.notifyNoLessons && todaySchedule.lessons.length === 0) {
        const { date: nextDate, schedule: nextSchedule } = await findNextLessons(
          settings.facultySlug,
          settings.groupSlug,
          now,
          scheduleCache
        )
        const nextKey = nextDate ? formatDateKey(nextDate) : "none"
        const noLessonsKey = nextKey
        if (recipient.state.lastNoLessonsKey !== noLessonsKey) {
          messages.push(
            buildNoLessonsMessage(
              nextDate,
              nextSchedule,
              settings.groupName ?? recipient.label
            )
          )
          stateUpdates.lastNoLessonsKey = noLessonsKey
        }
      }

      if (settings.sendDayBefore) {
        const tomorrow = addDays(now, 1)
        const tomorrowKey = formatDateKey(tomorrow)
        const tomorrowSchedule = await getScheduleForDate(
          settings.facultySlug,
          settings.groupSlug,
          tomorrow,
          scheduleCache
        )
        if (tomorrowSchedule.lessons.length > 0) {
          messages.push(
            buildScheduleMessage(
              tomorrow,
              tomorrowSchedule,
              settings.groupName ?? recipient.label,
              "Расписание на завтра"
            )
          )
          stateUpdates.lastDayBeforeDate = tomorrowKey
        }
      }

      if (settings.notifyWeekStart && getDayIndex(now) === 0) {
        if (recipient.state.lastWeekStartDate !== todayKey) {
          messages.unshift(buildWeekStartMessage(now))
          stateUpdates.lastWeekStartDate = todayKey
        }
      }

      const todaySpecial = isSpecialPeriod(now, SPECIAL_PERIODS)
      if (settings.notifyHolidayDay && todaySpecial?.type === "holiday") {
        if (recipient.state.lastHolidayDayDate !== todayKey) {
          messages.unshift(`🎉 Сегодня праздник: ${todaySpecial.name}`)
          stateUpdates.lastHolidayDayDate = todayKey
        }
      }

      const tomorrow = addDays(now, 1)
      const tomorrowKey = formatDateKey(tomorrow)
      const tomorrowSpecial = isSpecialPeriod(tomorrow, SPECIAL_PERIODS)

    if (
      settings.notifyHolidays &&
      tomorrowSpecial?.type === "holiday" &&
      tomorrowKey === tomorrowSpecial.startDate
    ) {
        const noticeKey = `${tomorrowSpecial.id}|${tomorrowKey}`
        if (recipient.state.lastHolidayNoticeKey !== noticeKey) {
          messages.unshift(`🎉 Завтра праздник: ${tomorrowSpecial.name}`)
          stateUpdates.lastHolidayNoticeKey = noticeKey
        }
      }

    if (
      settings.notifyVacations &&
      tomorrowSpecial?.type === "vacation" &&
      tomorrowKey === tomorrowSpecial.startDate
    ) {
        const noticeKey = `${tomorrowSpecial.id}|${tomorrowKey}`
        if (recipient.state.lastVacationNoticeKey !== noticeKey) {
          messages.unshift(`🏖️ Завтра начинаются каникулы: ${tomorrowSpecial.name}`)
          stateUpdates.lastVacationNoticeKey = noticeKey
        }
      }

      if (messages.length === 0) {
        skippedCount += 1
        continue
      }

      for (const message of messages) {
        await sendTelegramMessage(botToken, recipient.id, message, {
          disableWebPagePreview: true,
          messageThreadId: recipient.topicId ?? undefined,
        })
        sentCount += 1
      }
      if (recipient.kind === "user") {
        userStateUpdates.push({ id: recipient.id, state: stateUpdates })
      } else {
        chatStateUpdates.push({ id: recipient.id, state: stateUpdates })
      }
    } catch (error) {
      console.error(`Failed to process ${recipient.kind} ${recipient.id}:`, error)
      errorCount += 1
    }
  }

  await updateUsersNotificationState(userStateUpdates)
  await updateChatsNotificationState(chatStateUpdates)

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    sent: sentCount,
    skipped: skippedCount,
    errors: errorCount,
  })
}
