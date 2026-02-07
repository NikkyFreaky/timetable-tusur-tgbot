import { NextResponse } from "next/server"
import { fetchWeekSchedule } from "@/lib/timetable"
import type { DaySchedule } from "@/lib/schedule-types"

type SchedulePayload = {
  weekType: "even" | "odd"
  days: DaySchedule[]
  weekStart: string
}

const inflightRequests = new Map<string, Promise<SchedulePayload>>()

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const parts = value.split("-").map((part) => Number(part))
  if (parts.length !== 3) return null

  const [year, month, day] = parts
  if (!year || !month || !day) return null

  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
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
    const { searchParams } = new URL(request.url)
    const faculty = searchParams.get("faculty")
    const group = searchParams.get("group")
    const weekStartParam = searchParams.get("weekStart")

    if (!faculty || !group) {
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
