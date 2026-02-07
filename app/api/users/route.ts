import { NextResponse } from "next/server"
import { listUserSummaries } from "@/lib/user-store"

export const runtime = "nodejs"

export async function GET() {
  try {
    const users = await listUserSummaries()
    return NextResponse.json({ users })
  } catch (error) {
    console.error("Failed to load users:", error)
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
  }
}
