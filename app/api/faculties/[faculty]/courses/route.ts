import { NextResponse } from "next/server"
import { fetchFacultyCourses } from "@/lib/timetable"

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
    return NextResponse.json({ courses })
  } catch (error) {
    console.error("Failed to load courses:", error)
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 })
  }
}
