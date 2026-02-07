import type { SpecialPeriod } from "./schedule-types"

export const SPECIAL_PERIODS: SpecialPeriod[] = [
  { id: "ny2026", type: "holiday", name: "Новогодние каникулы", startDate: "2026-01-01", endDate: "2026-01-08" },
  { id: "feb23", type: "holiday", name: "День защитника Отечества", startDate: "2026-02-23", endDate: "2026-02-23" },
  { id: "mar8", type: "holiday", name: "Международный женский день", startDate: "2026-03-08", endDate: "2026-03-08" },
  { id: "may1", type: "holiday", name: "Праздник Весны и Труда", startDate: "2026-05-01", endDate: "2026-05-01" },
  { id: "may9", type: "holiday", name: "День Победы", startDate: "2026-05-09", endDate: "2026-05-09" },
  { id: "winter_session", type: "exam", name: "Зимняя сессия", startDate: "2026-01-10", endDate: "2026-01-31" },
  { id: "summer_session", type: "exam", name: "Летняя сессия", startDate: "2026-06-01", endDate: "2026-06-30" },
  { id: "summer_vacation", type: "vacation", name: "Летние каникулы", startDate: "2026-07-01", endDate: "2026-08-31" },
]

export function getCurrentWeekType(): "even" | "odd" {
  return getWeekType(new Date())
}

export function getDayIndex(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

export function getCurrentDayIndex(): number {
  return getDayIndex(new Date())
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isSpecialPeriod(date: Date, periods: SpecialPeriod[]): SpecialPeriod | null {
  const dateStr = formatDateKey(date)
  return periods.find((p) => dateStr >= p.startDate && dateStr <= p.endDate) || null
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  }).replace(".", "")
}

export function formatDayDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function getWeekType(date: Date): "even" | "odd" {
  const weekNumber = getAcademicWeekNumber(date)
  return weekNumber % 2 === 1 ? "odd" : "even"
}

export function getWeekNumber(date: Date): number {
  return getAcademicWeekNumber(date)
}

function getAcademicWeekNumber(date: Date): number {
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
  const startDate = new Date(year, 8, 1)
  const dayOfWeek = startDate.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7
  const firstMonday = new Date(year, 8, 1 + daysUntilMonday)
  const diffDays = Math.floor((date.getTime() - firstMonday.getTime()) / 86400000)
  return Math.floor(diffDays / 7) + 1
}

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export function getDatesOfWeek(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}
