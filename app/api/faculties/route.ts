import { NextResponse } from "next/server"
import { fetchFaculties } from "@/lib/timetable"

export async function GET() {
  try {
    const faculties = await fetchFaculties()
    return NextResponse.json(
      { faculties },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=2592000, stale-while-revalidate=2592000",
        },
      }
    )
  } catch (error) {
    console.error("Failed to load faculties:", error)
    return NextResponse.json({ error: "Failed to load faculties" }, { status: 500 })
  }
}
