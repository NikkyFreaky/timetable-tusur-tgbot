import { describe, expect, it } from 'vitest'
import {
  formatAvailability,
  getAvailableWorkIntervals,
  splitTelegramMessage,
} from '@/lib/employee-availability'
import type { Lesson } from '@/lib/schedule-types'

const lesson = (time: string, timeEnd: string, isCancelled = false): Lesson => ({
  id: `${time}-${timeEnd}`,
  time,
  timeEnd,
  subject: 'Тестовая пара',
  type: 'lecture',
  room: '—',
  instructor: '—',
  isCancelled,
})

describe('getAvailableWorkIntervals', () => {
  it('оставляет весь рабочий день свободным без пар', () => {
    expect(getAvailableWorkIntervals([])).toEqual([{ start: 540, end: 1080 }])
  })

  it('строит интервалы между несколькими парами', () => {
    const intervals = getAvailableWorkIntervals([
      lesson('10:20', '12:00'),
      lesson('14:00', '16:45'),
    ])

    expect(formatAvailability(intervals)).toBe('с 09:00 до 10:20 и с 12:00 до 14:00 и с 16:45 до 18:00')
  })

  it('игнорирует отменённые пары и пары после 18:00', () => {
    const intervals = getAvailableWorkIntervals([
      lesson('09:00', '10:20', true),
      lesson('18:10', '19:40'),
    ])

    expect(formatAvailability(intervals)).toBe('с 09:00 до 18:00')
  })

  it('обрезает пару, пересекающую окончание рабочего дня', () => {
    const intervals = getAvailableWorkIntervals([lesson('17:20', '18:40')])
    expect(formatAvailability(intervals)).toBe('с 09:00 до 17:20')
  })

  it('сообщает о полной занятости', () => {
    const intervals = getAvailableWorkIntervals([lesson('08:00', '19:00')])
    expect(formatAvailability(intervals)).toBe('Нет свободного времени')
  })
})

describe('splitTelegramMessage', () => {
  it('не разрывает строку сотрудника', () => {
    expect(splitTelegramMessage(['Иванов', 'Петров', 'Сидоров'], 13)).toEqual([
      'Иванов\nПетров',
      'Сидоров',
    ])
  })
})
