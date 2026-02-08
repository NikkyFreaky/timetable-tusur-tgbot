import { NextResponse } from "next/server"
import { getChatById, listChatTopics, getChatMemberRole } from "@/lib/chat-store"
import { isAdmin } from "@/lib/telegram-api"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
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

    if (!chat.isForum) {
      return NextResponse.json({
        topics: [
          {
            id: null,
            chatId,
            name: "Основной чат",
            iconColor: null,
            iconCustomEmojiId: null,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
          },
        ],
      })
    }

    const topics = await listChatTopics(chatId)

    return NextResponse.json({
      topics: [
        {
          id: null,
          chatId,
          name: "Основной чат",
          iconColor: null,
          iconCustomEmojiId: null,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
        ...topics,
      ],
    })
  } catch (error) {
    console.error("Failed to load chat topics:", error)
    return NextResponse.json({ error: "Failed to load chat topics" }, { status: 500 })
  }
}
