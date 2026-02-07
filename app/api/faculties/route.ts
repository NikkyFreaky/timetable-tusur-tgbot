import { NextResponse } from "next/server"
import { fetchFaculties } from "@/lib/timetable"
import { getWithStale } from "@/lib/cache-store"
import { CACHE_TTL } from "@/lib/cache-config"

export async function GET() {
  try {
    const faculties = await fetchFaculties()

    const staleData = await getWithStale("faculties")
    const isStale = staleData ? staleData.isStale : false

    return NextResponse.json(
      { faculties },
      {
        headers: {
          "Cache-Control": `public, max-age=0, s-maxage=${Math.floor(CACHE_TTL.FACULTIES / 1000)}, stale-while-revalidate=${Math.floor(CACHE_TTL.FACULTIES / 1000)}`,
          "X-Cache": isStale ? "STALE" : "HIT",
        },
      }
    )
  } catch (error) {
    console.error("Failed to load faculties:", error)

    const staleData = await getWithStale("faculties")
    if (staleData) {
      return NextResponse.json(
        { faculties: staleData.value },
        {
          headers: {
            "Cache-Control": "public, max-age=0, s-maxage=60",
            "X-Cache": "STALE-ERROR",
          },
        }
      )
    }

    return NextResponse.json({ error: "Failed to load faculties" }, { status: 500 })
  }
}
