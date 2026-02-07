import { NextResponse } from "next/server"
import { fetchWeekSchedule } from "@/lib/timetable"
import type { DaySchedule } from "@/lib/schedule-types"

type SchedulePayload = {
  weekType: "even" | "odd"
  days: DaySchedule[]
  weekStart: string
}

type CacheEntry = {
  value: SchedulePayload
  expiresAt: number
}

const CACHE_TTL_MS = 10 * 60 * 1000
const scheduleCache = new Map<string, CacheEntry>()
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

function getCacheKey(faculty: string, group: string, weekStart: string): string {
  return `${faculty}|${group}|${weekStart}`
}

function cleanupCache(now: number) {
  for (const [key, entry] of scheduleCache.entries()) {
    if (entry.expiresAt + CACHE_TTL_MS < now) {
      scheduleCache.delete(key)
    }
  }
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
    const cacheKey = getCacheKey(faculty, group, weekStart)
    const now = Date.now()

    cleanupCache(now)

    const cachedEntry = scheduleCache.get(cacheKey)
    if (cachedEntry && cachedEntry.expiresAt > now) {
      return NextResponse.json(cachedEntry.value, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600",
          "X-Cache": "HIT",
        },
      })
    }

    const staleValue = cachedEntry?.value ?? null
    const inflight = inflightRequests.get(cacheKey)

    if (inflight) {
      try {
        const payload = await inflight
        return NextResponse.json(payload, {
          headers: {
            "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600",
            "X-Cache": "SHARED",
          },
        })
      } catch (error) {
        if (staleValue) {
          return NextResponse.json(staleValue, {
            headers: {
              "Cache-Control": "public, max-age=0, s-maxage=60",
              "X-Cache": "STALE",
            },
          })
        }
        throw error
      }
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
      scheduleCache.set(cacheKey, {
        value: payload,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600",
          "X-Cache": staleValue ? "REFRESH" : "MISS",
        },
      })
    } catch (error) {
      if (staleValue) {
        return NextResponse.json(staleValue, {
          headers: {
            "Cache-Control": "public, max-age=0, s-maxage=60",
            "X-Cache": "STALE",
          },
        })
      }
      throw error
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
