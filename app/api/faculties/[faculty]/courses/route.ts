import { NextResponse } from "next/server"
import { fetchFacultyCourses } from "@/lib/timetable"
import { getWithStale } from "@/lib/cache-store"
import { CACHE_TTL } from "@/lib/cache-config"

export async function GET(
  _request: Request,
  context: { params: Promise<{ faculty: string }> | { faculty: string } }
) {
  try {
    const { faculty } = await context.params
    if (!faculty) {
      return NextResponse.json({ error: "Missing faculty" }, { status: 400 })
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
