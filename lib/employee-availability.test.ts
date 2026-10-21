import { describe, expect, it } from 'vitest'
import {
  formatEmployeeAvailabilityReport,
  formatEmployeeAvailabilityReportTitle,
  formatAvailability,
  formatLessonAvailability,
  getEmployeeAvailabilitySummary,
  getAvailableWorkIntervals,
  shouldIncludeEmployeeAvailabilityReport,
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
  it('оставляет полный рабочий день без пар', () => {
    expect(getAvailableWorkIntervals([])).toEqual([{ start: 540, end: 1080 }])
  })

  it('не считает короткие перерывы между парами рабочим временем', () => {
    const summary = getEmployeeAvailabilitySummary([
      lesson('10:40', '12:15'),
      lesson('12:15', '13:50'),
      lesson('14:50', '16:25'),
      lesson('16:45', '18:20'),
    ])

    expect(formatAvailability(summary.workIntervals)).toBe('с 09:00 до 10:20')
    expect(formatLessonAvailability(summary.lessonInterval)).toBe('с 10:40 до 18:20')
  })

  it('учитывает длинный перерыв между парами с запасом на дорогу', () => {
    const summary = getEmployeeAvailabilitySummary([
      lesson('13:15', '15:00'),
      lesson('16:45', '18:20'),
    ])

    expect(formatAvailability(summary.workIntervals))
      .toBe('с 09:00 до 12:55 и с 15:20 до 16:25')
    expect(formatLessonAvailability(summary.lessonInterval)).toBe('с 13:15 до 18:20')
  })

  it('учитывает дорогу после последней пары', () => {
    const summary = getEmployeeAvailabilitySummary([
      lesson('10:40', '12:15'),
      lesson('12:15', '13:50'),
      lesson('14:50', '16:35'),
    ])

    expect(formatAvailability(summary.workIntervals)).toBe('с 09:00 до 10:20 и с 16:55 до 18:00')
    expect(formatLessonAvailability(summary.lessonInterval)).toBe('с 10:40 до 16:35')
  })

  it('игнорирует отменённые пары и пары после 18:00', () => {
    const intervals = getAvailableWorkIntervals([
      lesson('09:00', '10:20', true),
      lesson('18:10', '19:40'),
    ])

    expect(formatAvailability(intervals)).toBe('с 09:00 до 18:00')
  })

  it('не оставляет рабочее время после пары, пересекающей окончание дня', () => {
    const intervals = getAvailableWorkIntervals([lesson('17:20', '18:40')])
    expect(formatAvailability(intervals)).toBe('с 09:00 до 17:00')
  })

  it('сообщает о полной занятости', () => {
    const intervals = getAvailableWorkIntervals([lesson('08:00', '19:00')])
    expect(formatAvailability(intervals)).toBe('Нет свободного времени')
  })

  it('не разбивает рабочее время на обеденный перерыв', () => {
    const schedule = {
      workdayStart: '08:00',
      workdayEnd: '17:00',
      lunchStart: '12:00',
      lunchEnd: '12:30',
    }

    expect(getAvailableWorkIntervals([lesson('10:00', '11:00')], schedule))
      .toEqual([{ start: 480, end: 580 }, { start: 680, end: 1020 }])
    expect(shouldIncludeEmployeeAvailabilityReport([lesson('17:00', '18:00')], schedule)).toBe(false)
  })
})

describe('formatEmployeeAvailabilityReport', () => {
  it('формирует блок сотрудника с ФИО и группой', () => {
    expect(formatEmployeeAvailabilityReport({
      fullName: 'Виктор Головенко',
      groupName: '593-1',
      timetableUrl: 'https://timetable.tusur.ru/faculties/fvs/groups/593-1?week_id=846',
      lessons: [lesson('10:40', '18:20')],
    })).toBe([
      '<b>• Виктор Головенко (<a href="https://timetable.tusur.ru/faculties/fvs/groups/593-1?week_id=846">593-1</a>):</b>',
      '  – на работе: с 09:00 до 10:20',
      '  – на парах: с 10:40 до 18:20',
    ].join('\n'))
  })

  it('не упоминает пары при полном рабочем дне', () => {
    expect(formatEmployeeAvailabilityReport({
      fullName: 'Егор Мартыненко',
      groupName: '405-М',
      timetableUrl: 'https://timetable.tusur.ru/faculties/fvs/groups/405-m?week_id=846',
      lessons: [],
    })).toBe([
      '<b>• Егор Мартыненко (<a href="https://timetable.tusur.ru/faculties/fvs/groups/405-m?week_id=846">405-М</a>):</b>',
      '  – на работе: с 09:00 до 18:00',
    ].join('\n'))
  })

  it('формирует заголовок с датой', () => {
    expect(formatEmployeeAvailabilityReportTitle(new Date(2026, 9, 20)))
      .toBe('<b>Сводка рабочего времени сотрудников на 20.10.2026:</b>')
  })
})

describe('shouldIncludeEmployeeAvailabilityReport', () => {
  it('исключает сотрудника только с парами после рабочего дня', () => {
    expect(shouldIncludeEmployeeAvailabilityReport([
      lesson('18:00', '19:30'),
      lesson('19:40', '21:10'),
    ])).toBe(false)
  })

  it('включает сотрудника после изменения расписания', () => {
    expect(shouldIncludeEmployeeAvailabilityReport([
      lesson('16:45', '18:20'),
      lesson('19:40', '21:10'),
    ])).toBe(true)
  })

  it('исключает сотрудника без активных пар', () => {
    expect(shouldIncludeEmployeeAvailabilityReport([
      lesson('18:00', '19:30', true),
    ])).toBe(false)
  })

  it('включает пару, пересекающую начало рабочего дня', () => {
    expect(shouldIncludeEmployeeAvailabilityReport([
      lesson('08:30', '09:15'),
    ])).toBe(true)
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
