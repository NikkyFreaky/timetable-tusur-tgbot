import type { Lesson } from '@/lib/schedule-types'

export const WORKDAY_START = 9 * 60
export const WORKDAY_END = 18 * 60

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

/** Возвращает интервалы работы вне активных пар. */
export function getAvailableWorkIntervals(lessons: Lesson[]): TimeInterval[] {
  const busy = lessons
    .filter((lesson) => !lesson.isCancelled)
    .map((lesson) => {
      const start = parseTime(lesson.time)
      const end = parseTime(lesson.timeEnd)
      if (start === null || end === null || end <= start || start >= WORKDAY_END) return null
      return { start: Math.max(start, WORKDAY_START), end: Math.min(end, WORKDAY_END) }
    })
    .filter((interval): interval is TimeInterval => Boolean(interval && interval.end > interval.start))
    .sort((left, right) => left.start - right.start)

  const merged: TimeInterval[] = []
  for (const interval of busy) {
    const previous = merged.at(-1)
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }

  const available: TimeInterval[] = []
  let cursor = WORKDAY_START
  for (const interval of merged) {
    if (cursor < interval.start) available.push({ start: cursor, end: interval.start })
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < WORKDAY_END) available.push({ start: cursor, end: WORKDAY_END })
  return available
}

export function formatAvailability(intervals: TimeInterval[]): string {
  if (intervals.length === 0) return 'Нет свободного времени'
  return intervals
    .map((interval) => `с ${formatWorkTime(interval.start)} до ${formatWorkTime(interval.end)}`)
    .join(' и ')
}

export function splitTelegramMessage(lines: string[], maxLength = 4096): string[] {
  const messages: string[] = []
  let current = ''
  for (const line of lines) {
    if (!current) {
      current = line
      continue
    }
    if (current.length + line.length + 1 <= maxLength) {
      current += `\n${line}`
    } else {
      messages.push(current)
      current = line
    }
  }
  if (current) messages.push(current)
  return messages
}
