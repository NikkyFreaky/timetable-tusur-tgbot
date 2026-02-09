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

    console.log("=== GET /api/chats/[id]/topics ===", { chatId })

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const chat = await getChatById(chatId)
    if (!chat) {
      console.log("Chat not found:", chatId)
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    console.log("Chat found:", { id: chat.id, title: chat.title, isForum: chat.isForum, topicId: chat.topicId })

    const userIdHeader = request.headers.get("x-user-id")
    if (!userIdHeader) {
      console.log("User ID header missing")
      return NextResponse.json({ error: "User ID required" }, { status: 401 })
    }

    const userId = Number(userIdHeader)
    if (!Number.isFinite(userId)) {
      console.log("Invalid user ID:", userIdHeader)
      return NextResponse.json({ error: "Invalid user ID" }, { status: 401 })
    }

    console.log("Checking user role:", { chatId, userId })

    const role = await getChatMemberRole(chatId, userId)
    console.log("User role:", role)

    if (!role || !isAdmin(role)) {
      console.log("Access denied: role is not admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const mainTopic = {
      id: null as any,
      chatId,
      name: "Основной чат",
      iconColor: null,
      iconCustomEmojiId: null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }

    if (!chat.isForum) {
      console.log("Chat is not a forum, returning main topic only")
      return NextResponse.json({ topics: [mainTopic] })
    }

    console.log("Chat is a forum, loading topics from database")

    const topics = await listChatTopics(chatId)

    console.log("Topics loaded from database:", topics)

    return NextResponse.json({
      topics: [mainTopic, ...topics],
    })
  } catch (error) {
    console.error("Failed to load chat topics:", error)
    return NextResponse.json({ error: "Failed to load chat topics" }, { status: 500 })
  }
}
