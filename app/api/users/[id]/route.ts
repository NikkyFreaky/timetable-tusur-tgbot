import { NextResponse } from "next/server"
import { getUserById } from "@/lib/user-store"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
  _request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const { id } = await context.params
    const userId = Number(id)

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }

    const user = await getUserById(userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Failed to load user:", error)
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
  }
}
