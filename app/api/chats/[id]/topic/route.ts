import { NextResponse } from "next/server"
import { getChatById, updateChatTopicId, getChatMemberRole } from "@/lib/chat-store"
import { isAdmin } from "@/lib/telegram-api"

export const runtime = "nodejs"

type Params = { id: string }

type UpdateTopicPayload = {
  topicId: number | null
}

export async function POST(
  request: Request,
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

    const userIdHeader = request.headers.get("x-user-id")
    if (!userIdHeader) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 })
    }

    const userId = Number(userIdHeader)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 401 })
    }

    const role = await getChatMemberRole(chatId, userId)
    if (!role || !isAdmin(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload = (await request.json()) as UpdateTopicPayload
    const { topicId } = payload

    if (topicId !== null && !Number.isFinite(topicId)) {
      return NextResponse.json({ error: "Invalid topic ID" }, { status: 400 })
    }

    await updateChatTopicId(chatId, topicId)

    const updatedChat = await getChatById(chatId)

    return NextResponse.json({ chat: updatedChat })
  } catch (error) {
    console.error("Failed to update chat topic:", error)
    return NextResponse.json({ error: "Failed to update chat topic" }, { status: 500 })
  }
}
