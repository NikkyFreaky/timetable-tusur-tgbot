import { NextResponse } from "next/server"
import { buildWebAppKeyboard, sendTelegramMessage } from "@/lib/telegram-bot"
import { getChat, getChatMember, getChatAdministrators, getRoleFromStatus, getForumTopics } from "@/lib/telegram-api"
import { upsertChat, createOrUpdateChatMember, upsertChatTopic, getChatById, markChatMembersInactive } from "@/lib/chat-store"

export const runtime = "nodejs"

type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string; title?: string; username?: string; photo_url?: string }
    message_thread_id?: number
    is_topic_message?: boolean
    text?: string
    forum_topic_created?: {
      name: string
      icon_color: number
      icon_custom_emoji_id?: string
    }
    forum_topic_edited?: {
      name?: string
      icon_custom_emoji_id?: string
    }
    forum_topic_closed?: Record<string, never>
    forum_topic_reopened?: Record<string, never>
    general_forum_topic_hidden?: Record<string, never>
    general_forum_topic_unhidden?: Record<string, never>
    reply_to_message?: {
      forum_topic_created?: {
        name: string
      }
    }
    from?: {
      id: number
      is_bot?: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    new_chat_members?: Array<{
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }>
    left_chat_member?: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
  }
  edited_message?: TelegramUpdate["message"]
  my_chat_member?: {
    chat: { id: number; type: string; title?: string; username?: string; photo_url?: string }
    from: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string }
    date: number
    old_chat_member: {
      status: string
    }
    new_chat_member: {
      status: string
      user: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string }
    }
  }
  chat_member?: {
    chat: { id: number; type: string; title?: string; username?: string; photo_url?: string }
    from: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string }
    date: number
    old_chat_member: {
      status: string
      user: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string }
    }
    new_chat_member: {
      status: string
      user: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string }
    }
  }
}

function getCommand(text: string | undefined) {
  if (!text) return null
  const [command] = text.trim().split(/\s+/)
  if (!command) return null
  return command.split("@")[0] || null
}

export async function POST(request: Request) {
  const botToken = process.env.BOT_TOKEN
  const miniAppUrl = process.env.MINI_APP_URL

  if (!botToken || !miniAppUrl) {
    return NextResponse.json({ ok: false })
  }

  try {
    const update = (await request.json()) as TelegramUpdate
    const message = update.message ?? update.edited_message

    if (message?.chat?.id) {
      const chatId = message.chat.id
      const isGroup = message.chat.type !== "private"

      const command = getCommand(message.text)

      if (command === "/start" || command === "/settings") {
        console.log("=== Handling command ===", { command, chatId, isGroup, chatType: message.chat.type })
        const text = "⚙️ Настройка уведомлений\nОткройте веб-приложение, выберите группу и включите нужные рассылки."
        await sendTelegramMessage(botToken, chatId, text, {
          replyMarkup: buildWebAppKeyboard(miniAppUrl),
        })
      }

      if (isGroup && message.new_chat_members) {
      console.log("new_chat_members event in chat:", chatId, message.new_chat_members)
      for (const member of message.new_chat_members) {
        if (member.is_bot) {
          console.log("Bot added to chat:", chatId)
          const chatInfo = await getChat(botToken, chatId)
          const isForum = chatInfo?.is_forum ?? false

          await upsertChat({
            chat: message.chat,
            isForum,
          })

          // Sync all administrators of group
          const admins = await getChatAdministrators(botToken, chatId)
          if (admins) {
            for (const admin of admins) {
              const role = getRoleFromStatus(admin.status)
              await createOrUpdateChatMember(chatId, admin.user.id, role)
              console.log("Admin synced:", chatId, admin.user.id, role)
            }
          }

          // Send welcome message with Mini App button
          const welcomeText = `✅ Бот добавлен в группу!\n\n📖 Откройте веб-приложение, чтобы настроить расписание для этой группы.`
          await sendTelegramMessage(botToken, chatId, welcomeText, {
            replyMarkup: buildWebAppKeyboard(miniAppUrl),
          })
        } else {
          console.log("Member added to chat:", chatId, "member:", member.id)
          const memberInfo = await getChatMember(botToken, chatId, member.id)
          console.log("Member info from Telegram:", memberInfo)
          if (memberInfo) {
            const role = getRoleFromStatus(memberInfo.status)
            console.log("Role:", role)
            await createOrUpdateChatMember(chatId, member.id, role)
            console.log("Chat member created/updated")
          }
        }
      }
      }

      if (isGroup && message.left_chat_member) {
        const storedChat = await getChatById(chatId)
        if (storedChat && storedChat.createdBy === message.left_chat_member.id) {
          const { updateChatsNotificationState } = await import("@/lib/chat-store")
          await updateChatsNotificationState([{ id: chatId, state: {} }])
        }

        const role = getRoleFromStatus("left")
        await createOrUpdateChatMember(chatId, message.left_chat_member.id, role)
      }
    }

    if (update.my_chat_member) {
      const { chat, old_chat_member, new_chat_member } = update.my_chat_member
      const newRole = getRoleFromStatus(new_chat_member.status as any)
      const isActivationTransition =
        (old_chat_member.status === "left" || old_chat_member.status === "kicked") &&
        (new_chat_member.status === "member" || new_chat_member.status === "administrator")

      if (new_chat_member.status === "left" || new_chat_member.status === "kicked") {
        await createOrUpdateChatMember(chat.id, new_chat_member.user.id, newRole)
        await markChatMembersInactive(chat.id)
        const { updateChatsNotificationState } = await import("@/lib/chat-store")
        await updateChatsNotificationState([{ id: chat.id, state: {} }])
      } else if (new_chat_member.status === "member" || new_chat_member.status === "administrator") {
        await createOrUpdateChatMember(chat.id, new_chat_member.user.id, newRole)

        const chatInfo = await getChat(botToken, chat.id)
        const isForum = chatInfo?.is_forum ?? false

        await upsertChat({
          chat: chat,
          isForum,
        })

        // Sync all administrators of group
        const admins = await getChatAdministrators(botToken, chat.id)
        if (admins) {
          for (const admin of admins) {
            const adminRole = getRoleFromStatus(admin.status)
            await createOrUpdateChatMember(chat.id, admin.user.id, adminRole)
          }
        }

        if (isActivationTransition && chat.type === "private") {
          const activationText = "⚙️ Чтобы настроить уведомления:\n1) Откройте веб-приложение\n2) В группе выдайте боту права администратора"
          await sendTelegramMessage(
            botToken,
            chat.id,
            activationText,
            {
              replyMarkup: buildWebAppKeyboard(miniAppUrl),
            }
          )
        }
      }
    }

    if (update.chat_member) {
      const { chat, new_chat_member, old_chat_member } = update.chat_member
      console.log("=== chat_member event ===", { chatId: chat.id, userId: new_chat_member.user.id, status: new_chat_member.status, oldStatus: old_chat_member?.status })

      const memberInfo = await getChatMember(botToken, chat.id, new_chat_member.user.id)
      console.log("Member info from Telegram:", memberInfo)

      if (memberInfo) {
        const status = memberInfo.status as any
        const newRole = getRoleFromStatus(status)
        console.log("New role:", newRole)

        await createOrUpdateChatMember(chat.id, new_chat_member.user.id, newRole)

        if ((newRole === "creator" || newRole === "administrator") && !new_chat_member.user.is_bot) {
          console.log("User is now admin, syncing topics...")
          const topics = await getForumTopics(botToken, chat.id)
          console.log("Topics from Telegram API:", topics)

          if (topics) {
            for (const topic of topics) {
              console.log("Upserting topic:", topic)
              await upsertChatTopic({
                id: topic.id,
                chatId: chat.id,
                name: topic.name,
                iconColor: topic.icon_color,
              })
            }
          }

          console.log("Topics synced to database")
        }
      }
    }

    if (message?.chat?.id && message.message_thread_id && message.is_topic_message) {
      const threadId = message.message_thread_id
      const chatId = message.chat.id
      const topicName =
        message.forum_topic_created?.name ||
        message.forum_topic_edited?.name ||
        message.reply_to_message?.forum_topic_created?.name ||
        (threadId === 1 ? "General" : `Тема ${threadId}`)

      await upsertChatTopic({
        id: threadId,
        chatId,
        name: topicName,
        iconColor: message.forum_topic_created?.icon_color,
        iconCustomEmojiId: message.forum_topic_created?.icon_custom_emoji_id
          ? Number(message.forum_topic_created.icon_custom_emoji_id)
          : message.forum_topic_edited?.icon_custom_emoji_id
          ? Number(message.forum_topic_edited.icon_custom_emoji_id)
          : undefined,
      })
    }

    if (message?.forum_topic_created && message.message_thread_id && message.chat?.id) {
      const { name, icon_color, icon_custom_emoji_id } = message.forum_topic_created
      const threadId = message.message_thread_id
      const chatId = message.chat.id
      console.log("=== forum_topic_created event ===", {
        chatId,
        thread_id: threadId,
        name,
        icon_color,
        icon_custom_emoji_id,
      })
      await upsertChatTopic({
        id: threadId,
        chatId: chatId,
        name,
        iconColor: icon_color,
        iconCustomEmojiId: icon_custom_emoji_id ? Number(icon_custom_emoji_id) : undefined,
      })
      console.log("Topic created/updated in database")
    }

    if (message?.forum_topic_edited && message.message_thread_id && message.chat?.id) {
      const { name, icon_custom_emoji_id } = message.forum_topic_edited
      const threadId = message.message_thread_id
      const chatId = message.chat.id
      if (name) {
        await upsertChatTopic({
          id: threadId,
          chatId: chatId,
          name,
          iconCustomEmojiId: icon_custom_emoji_id ? Number(icon_custom_emoji_id) : undefined,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}
