import { NextResponse } from "next/server"
import { listUserChats } from "@/lib/chat-store"

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

    const chats = await listUserChats(userId)

    return NextResponse.json({ chats })
  } catch (error) {
    console.error("Failed to load user chats:", error)
    return NextResponse.json({ error: "Failed to load user chats" }, { status: 500 })
  }
}
