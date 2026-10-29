import { NextResponse } from "next/server"
import { fetchWeekSchedule } from "@/lib/timetable"
import type { DaySchedule, SpecialPeriod } from "@/lib/schedule-types"
import { checkRateLimit, getClientAddress } from '@/lib/rate-limit'

type SchedulePayload = {
  weekType: "even" | "odd"
  days: DaySchedule[]
  specialPeriods: SpecialPeriod[]
  weekStart: string
}

const inflightRequests = new Map<string, Promise<SchedulePayload>>()

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parts = value.split("-").map((part) => Number(part))

  const [year, month, day] = parts
  if (!year || !month || !day) return null

  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateParam(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function GET(request: Request) {
  try {
    const rateLimit = checkRateLimit(`timetable:${getClientAddress(request)}`, {
      limit: 60,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }
    const { searchParams } = new URL(request.url)
    const faculty = searchParams.get("faculty")
    const group = searchParams.get("group")
    const weekStartParam = searchParams.get("weekStart")

    if (!faculty || !group || !/^[a-z0-9-]{1,100}$/i.test(faculty)
      || !/^[a-z0-9-]{1,100}$/i.test(group)) {
      return NextResponse.json({ error: "Missing faculty or group" }, { status: 400 })
    }

    const parsedWeekStart = parseDateParam(weekStartParam)
    if (!parsedWeekStart) {
      return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 })
    }

    const monday = getMondayOfWeek(parsedWeekStart)
    const weekStart = formatDateParam(monday)
    const cacheKey = `${faculty}|${group}|${weekStart}`

    const inflight = inflightRequests.get(cacheKey)
    if (inflight) {
      const payload = await inflight
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600",
          "X-Cache": "SHARED",
        },
      })
    }

    const fetchPromise = (async (): Promise<SchedulePayload> => {
      const schedule = await fetchWeekSchedule(faculty, group, monday)
      return {
        weekType: schedule.weekType,
        days: schedule.days,
        specialPeriods: schedule.specialPeriods,
        weekStart,
      }
    })()

    inflightRequests.set(cacheKey, fetchPromise)

    try {
      const payload = await fetchPromise
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600",
          "X-Cache": "MISS",
        },
      })
    } finally {
      if (inflightRequests.get(cacheKey) === fetchPromise) {
        inflightRequests.delete(cacheKey)
      }
    }

  } catch (error) {
    console.error("Failed to load timetable:", error)
    return NextResponse.json({ error: "Failed to load timetable" }, { status: 500 })
  }
}
