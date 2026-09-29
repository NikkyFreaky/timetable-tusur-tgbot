import { NextResponse } from "next/server"
import { getChatById, listChatTopics, getChatMemberRole, upsertChat } from "@/lib/chat-store"
import { isAdmin, getChat } from "@/lib/telegram-api"
import { requireTelegramInitData } from "@/lib/telegram-auth"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
  request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const auth = requireTelegramInitData(request)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const chatId = Number(id)

    console.log("=== GET /api/chats/[id]/topics ===", { chatId })

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    let chat = await getChatById(chatId)
    if (!chat) {
      console.log("Chat not found:", chatId)
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    console.log("Chat found:", { id: chat.id, title: chat.title, isForum: chat.isForum, topicId: chat.topicId })

    // Check and update is_forum via Telegram API if needed
    const botToken = process.env.BOT_TOKEN
    if (botToken && chatId < 0) { // Only for group chats (negative IDs)
      console.log("Fetching chat info from Telegram API...")
      const telegramChat = await getChat(botToken, chatId)
      console.log("Telegram API chat info:", telegramChat)

      if (telegramChat) {
        const telegramIsForum = telegramChat.is_forum ?? false
        console.log("Telegram is_forum:", telegramIsForum, "DB isForum:", chat.isForum)

        // Update if mismatch
        if (telegramIsForum !== chat.isForum) {
          console.log("Updating is_forum in database...")
          await upsertChat({
            chat: {
              id: chatId,
              type: chat.type,
              title: chat.title || undefined,
              username: chat.username || undefined,
              photo_url: chat.photoUrl || undefined,
            },
            isForum: telegramIsForum,
          })

          // Reload chat with updated data
          const updatedChat = await getChatById(chatId)
          if (updatedChat) {
            chat = updatedChat
            console.log("Updated chat:", chat)
          }
        }
      }
    }

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    console.log("Checking user role:", { chatId, userId: auth.data.user.id })

    const role = await getChatMemberRole(chatId, auth.data.user.id)
    console.log("User role:", role)

    if (!role || !isAdmin(role)) {
      console.log("Access denied: role is not admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!chat.isForum) {
      console.log("Chat is not a forum, returning main topic only")
      const mainTopic = {
        id: null as any,
        chatId,
        name: "Основной чат",
        iconColor: null,
        iconCustomEmojiId: null,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      }
      return NextResponse.json({ topics: [mainTopic] })
    }

    console.log("Chat is a forum, loading topics from database")

    const topics = await listChatTopics(chatId)

    console.log("Topics loaded from database:", topics)

    // For forums, the general topic is handled separately
    // Return the actual topics from the database
    return NextResponse.json({ topics })
  } catch (error) {
    console.error("Failed to load chat topics:", error)
    return NextResponse.json({ error: "Failed to load chat topics" }, { status: 500 })
  }
}
