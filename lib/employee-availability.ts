import type { Lesson } from '@/lib/schedule-types'

export const TRAVEL_TIME = 20

export interface EmployeeAvailabilityWorkSchedule {
  workdayStart: string
  workdayEnd: string
  lunchStart: string
  lunchEnd: string
}

export const DEFAULT_EMPLOYEE_AVAILABILITY_WORK_SCHEDULE: EmployeeAvailabilityWorkSchedule = {
  workdayStart: '09:00',
  workdayEnd: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
}

export interface TimeInterval {
  start: number
  end: number
}

const parseTime = (value: string): number | null => {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export const formatWorkTime = (value: number): string => {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export interface EmployeeAvailabilitySummary {
  workIntervals: TimeInterval[]
  lessonInterval: TimeInterval | null
}

interface WorkScheduleMinutes {
  workdayStart: number
  workdayEnd: number
}

const getWorkScheduleMinutes = (
  schedule: EmployeeAvailabilityWorkSchedule
): WorkScheduleMinutes => ({
  workdayStart: parseTime(schedule.workdayStart) ?? 9 * 60,
  workdayEnd: parseTime(schedule.workdayEnd) ?? 18 * 60,
})

const getLessonInterval = (
  lessons: Lesson[],
  schedule: WorkScheduleMinutes
): TimeInterval | null => {
  const intervals = lessons
    .filter((lesson) => !lesson.isCancelled)
    .map((lesson) => {
      const start = parseTime(lesson.time)
      const end = parseTime(lesson.timeEnd)
      if (start === null || end === null || end <= start || start >= schedule.workdayEnd) return null
      return { start: Math.max(start, schedule.workdayStart), end }
    })
    .filter((interval): interval is TimeInterval => Boolean(interval && interval.end > interval.start))
    .sort((left, right) => left.start - right.start)

  if (intervals.length === 0) return null
  return {
    start: intervals[0].start,
    end: Math.max(...intervals.map((interval) => interval.end)),
  }
}

/** Рассчитывает рабочее время с учётом пар и дороги. */
export function getEmployeeAvailabilitySummary(
  lessons: Lesson[],
  workSchedule = DEFAULT_EMPLOYEE_AVAILABILITY_WORK_SCHEDULE
): EmployeeAvailabilitySummary {
  const schedule = getWorkScheduleMinutes(workSchedule)
  const lessonInterval = getLessonInterval(lessons, schedule)
  const workIntervals = lessonInterval
    ? [
        {
          start: schedule.workdayStart,
          end: Math.min(schedule.workdayEnd, lessonInterval.start - TRAVEL_TIME),
        },
        {
          start: Math.max(schedule.workdayStart, lessonInterval.end + TRAVEL_TIME),
          end: schedule.workdayEnd,
        },
      ]
    : [{ start: schedule.workdayStart, end: schedule.workdayEnd }]

  return {
    lessonInterval,
    workIntervals: workIntervals.filter((interval) => interval.end > interval.start),
  }
}

export function getAvailableWorkIntervals(
  lessons: Lesson[],
  workSchedule = DEFAULT_EMPLOYEE_AVAILABILITY_WORK_SCHEDULE
): TimeInterval[] {
  return getEmployeeAvailabilitySummary(lessons, workSchedule).workIntervals
}

export function shouldIncludeEmployeeAvailabilityReport(
  lessons: Lesson[],
  workSchedule = DEFAULT_EMPLOYEE_AVAILABILITY_WORK_SCHEDULE
): boolean {
  const schedule = getWorkScheduleMinutes(workSchedule)
  return lessons.some((lesson) => {
    if (lesson.isCancelled) return false
    const start = parseTime(lesson.time)
    const end = parseTime(lesson.timeEnd)
    return start !== null && end !== null && end > start
      && start < schedule.workdayEnd && end > schedule.workdayStart
  })
}

export function formatAvailability(intervals: TimeInterval[]): string {
  if (intervals.length === 0) return 'Нет свободного времени'
  return intervals
    .map((interval) => `с ${formatWorkTime(interval.start)} до ${formatWorkTime(interval.end)}`)
    .join(' и ')
}

export function formatLessonAvailability(interval: TimeInterval | null): string {
  if (!interval) return 'нет пар'
  return `с ${formatWorkTime(interval.start)} до ${formatWorkTime(interval.end)}`
}

export function formatEmployeeAvailabilityReportTitle(date: Date): string {
  const formattedDate = [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear()),
  ].join('.')
  return `<b>Сводка рабочего времени сотрудников на ${formattedDate}:</b>`
}

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const escapeHtmlAttribute = (value: string) => escapeHtml(value).replaceAll('"', '&quot;')

export function formatEmployeeAvailabilityReport(input: {
  fullName: string
  groupName: string
  timetableUrl: string
  lessons: Lesson[]
  workSchedule?: EmployeeAvailabilityWorkSchedule
}): string {
  const summary = getEmployeeAvailabilitySummary(input.lessons, input.workSchedule)
  const groupLink = `<a href="${escapeHtmlAttribute(input.timetableUrl)}">${escapeHtml(input.groupName)}</a>`
  const lines = [
    `<b>• ${escapeHtml(input.fullName)} (${groupLink}):</b>`,
    `  – на работе: ${formatAvailability(summary.workIntervals)}`,
  ]
  if (summary.lessonInterval) {
    lines.push(`  – на парах: ${formatLessonAvailability(summary.lessonInterval)}`)
  }
  return lines.join('\n')
}

export function splitTelegramMessage(lines: string[], maxLength = 4096, separator = '\n'): string[] {
  const messages: string[] = []
  let current = ''
  for (const line of lines) {
    if (!current) {
      current = line
      continue
    }
    if (current.length + line.length + separator.length <= maxLength) {
      current += `${separator}${line}`
    } else {
      messages.push(current)
      current = line
    }
  }
  if (current) messages.push(current)
  return messages
}
