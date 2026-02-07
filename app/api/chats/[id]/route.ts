import { NextResponse } from "next/server"
import { getChatById } from "@/lib/chat-store"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
  _request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const { id } = await context.params
    const chatId = Number(id)

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const chat = await getChatById(chatId)
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    return NextResponse.json({ chat })
  } catch (error) {
    console.error("Failed to load chat:", error)
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 })
  }
}
