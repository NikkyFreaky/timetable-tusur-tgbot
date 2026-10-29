import { NextResponse } from "next/server"
import { getChatById, updateChatTopicId } from "@/lib/chat-store"
import { limitTelegramMutation, requireTelegramInitData } from "@/lib/telegram-auth"
import { verifyChatAdmin } from '@/lib/chat-access'

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
    const rateLimit = limitTelegramMutation(request, auth.data.user.id)
    if (rateLimit) return rateLimit

    const { id } = await context.params
    const chatId = Number(id)

    console.log('Updating chat topic')

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const chat = await getChatById(chatId)
    if (!chat) {
      console.log('Chat not found')
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const access = await verifyChatAdmin(chatId, auth.data.user.id)
    if (access === 'unavailable') {
      return NextResponse.json({ error: 'Unable to verify chat permissions' }, { status: 503 })
    }
    if (access !== 'authorized') {
      console.log("Access denied: role is not admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload = (await request.json()) as UpdateTopicPayload
    const { topicId } = payload

    if (topicId !== null && !Number.isFinite(topicId)) {
      return NextResponse.json({ error: "Invalid topic ID" }, { status: 400 })
    }

    await updateChatTopicId(chatId, topicId)

    console.log("Topic updated successfully in database")

    const updatedChat = await getChatById(chatId)

    return NextResponse.json({ chat: updatedChat })
  } catch (error) {
    console.error("Failed to update chat topic:", error)
    return NextResponse.json({ error: "Failed to update chat topic" }, { status: 500 })
  }
}
