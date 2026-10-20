import type { Lesson } from '@/lib/schedule-types'

export const WORKDAY_START = 9 * 60
export const WORKDAY_END = 18 * 60
export const LUNCH_START = 13 * 60
export const LUNCH_END = 14 * 60
export const TRAVEL_TIME = 20

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

const getLessonInterval = (lessons: Lesson[]): TimeInterval | null => {
  const intervals = lessons
    .filter((lesson) => !lesson.isCancelled)
    .map((lesson) => {
      const start = parseTime(lesson.time)
      const end = parseTime(lesson.timeEnd)
      if (start === null || end === null || end <= start || start >= WORKDAY_END) return null
      return { start: Math.max(start, WORKDAY_START), end }
    })
    .filter((interval): interval is TimeInterval => Boolean(interval && interval.end > interval.start))
    .sort((left, right) => left.start - right.start)

  if (intervals.length === 0) return null
  return {
    start: intervals[0].start,
    end: Math.max(...intervals.map((interval) => interval.end)),
  }
}

const excludeLunch = (intervals: TimeInterval[]): TimeInterval[] => intervals.flatMap((interval) => {
  if (interval.end <= LUNCH_START || interval.start >= LUNCH_END) return [interval]

  const result: TimeInterval[] = []
  if (interval.start < LUNCH_START) result.push({ start: interval.start, end: LUNCH_START })
  if (interval.end > LUNCH_END) result.push({ start: LUNCH_END, end: interval.end })
  return result
})

/** Рассчитывает рабочее время с учётом обеда, пар и дороги. */
export function getEmployeeAvailabilitySummary(lessons: Lesson[]): EmployeeAvailabilitySummary {
  const lessonInterval = getLessonInterval(lessons)
  const workIntervals = lessonInterval
    ? [
        { start: WORKDAY_START, end: Math.min(WORKDAY_END, lessonInterval.start - TRAVEL_TIME) },
        { start: Math.max(WORKDAY_START, lessonInterval.end + TRAVEL_TIME), end: WORKDAY_END },
      ]
    : [{ start: WORKDAY_START, end: WORKDAY_END }]

  return {
    lessonInterval,
    workIntervals: lessonInterval
      ? excludeLunch(workIntervals.filter((interval) => interval.end > interval.start))
      : workIntervals,
  }
}

export function getAvailableWorkIntervals(lessons: Lesson[]): TimeInterval[] {
  return getEmployeeAvailabilitySummary(lessons).workIntervals
}

export function shouldIncludeEmployeeAvailabilityReport(lessons: Lesson[]): boolean {
  const activeLessons = lessons.filter((lesson) => !lesson.isCancelled)
  if (activeLessons.length === 0) return true
  return !activeLessons.every((lesson) => {
    const start = parseTime(lesson.time)
    return start !== null && start >= WORKDAY_END
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

export function formatEmployeeAvailabilityReport(input: {
  fullName: string
  groupName: string
  lessons: Lesson[]
}): string {
  const summary = getEmployeeAvailabilitySummary(input.lessons)
  const lines = [
    `<b>• ${escapeHtml(input.fullName)} (${escapeHtml(input.groupName)}):</b>`,
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
