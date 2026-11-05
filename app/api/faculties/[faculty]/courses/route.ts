import { NextResponse } from "next/server"
import { fetchFaculties, fetchFacultyCourses } from "@/lib/timetable"
import { getWithStale } from "@/lib/cache-store"
import { CACHE_TTL } from "@/lib/cache-config"
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  _request: Request,
  context: { params: Promise<{ faculty: string }> | { faculty: string } }
) {
  try {
    const limit = checkRateLimit('courses:global', { limit: 300, windowMs: 60_000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429, headers: { 'Retry-After': String(limit.retryAfter) },
      })
    }
    const { faculty } = await context.params
    if (!faculty || !/^[a-z0-9-]{1,100}$/i.test(faculty)) {
      return NextResponse.json({ error: "Missing faculty" }, { status: 400 })
    }

    const faculties = await fetchFaculties()
    if (!faculties.some((item) => item.slug === faculty)) {
      return NextResponse.json({ error: 'Faculty not found' }, { status: 404 })
    }
    const courses = await fetchFacultyCourses(faculty)

    const cacheKey = `courses:${faculty}`
    const staleData = await getWithStale(cacheKey)
    const isStale = staleData ? staleData.isStale : false

    return NextResponse.json(
      { courses },
      {
        headers: {
          "Cache-Control": `public, max-age=0, s-maxage=${Math.floor(CACHE_TTL.COURSES / 1000)}, stale-while-revalidate=${Math.floor(CACHE_TTL.COURSES / 1000)}`,
          "X-Cache": isStale ? "STALE" : "HIT",
        },
      }
    )
  } catch (error) {
    console.error("Failed to load courses:", error)

    const { faculty } = await context.params
    if (faculty) {
      const cacheKey = `courses:${faculty}`
      const staleData = await getWithStale(cacheKey)
      if (staleData) {
        return NextResponse.json(
          { courses: staleData.value },
          {
            headers: {
              "Cache-Control": "public, max-age=0, s-maxage=60",
              "X-Cache": "STALE-ERROR",
            },
          }
        )
      }
    }

    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 })
  }
}
