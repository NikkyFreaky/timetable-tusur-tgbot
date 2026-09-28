import { NextResponse } from "next/server"
import { getChatById, updateChatTopicId, getChatMemberRole } from "@/lib/chat-store"
import { isAdmin } from "@/lib/telegram-api"
import { requireTelegramInitData } from "@/lib/telegram-auth"

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
    const auth = requireTelegramInitData(request)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const chatId = Number(id)

    console.log("=== POST /api/chats/[id]/topic ===", { chatId })

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const chat = await getChatById(chatId)
    if (!chat) {
      console.log("Chat not found:", chatId)
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const role = await getChatMemberRole(chatId, auth.data.user.id)
    if (!role || !isAdmin(role)) {
      console.log("Access denied: role is not admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload = (await request.json()) as UpdateTopicPayload
    const { topicId } = payload

    console.log("Updating topic:", { topicId })

    if (topicId !== null && !Number.isFinite(topicId)) {
      return NextResponse.json({ error: "Invalid topic ID" }, { status: 400 })
    }

    await updateChatTopicId(chatId, topicId)

    console.log("Topic updated successfully in database")

    const updatedChat = await getChatById(chatId)

    console.log("Updated chat:", updatedChat)

    return NextResponse.json({ chat: updatedChat })
  } catch (error) {
    console.error("Failed to update chat topic:", error)
    return NextResponse.json({ error: "Failed to update chat topic" }, { status: 500 })
  }
}
