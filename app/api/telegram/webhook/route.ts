import { NextResponse } from "next/server"
import { buildWebAppKeyboard, sendTelegramMessage } from "@/lib/telegram-bot"
import { getChat, getChatMember, getChatAdministrators, getRoleFromStatus } from "@/lib/telegram-api"
import { upsertChat, createOrUpdateChatMember, upsertChatTopic, deleteChatTopic, getChatById } from "@/lib/chat-store"

export const runtime = "nodejs"

type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string; title?: string; username?: string; photo_url?: string }
    text?: string
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
  forum_topic_created?: {
    name: string
    icon_color: number
    icon_custom_emoji_id?: string
    thread_id: number
  }
  forum_topic_edited?: {
    name?: string
    icon_custom_emoji_id?: string
    thread_id: number
  }
  forum_topic_closed?: {
    thread_id: number
  }
  forum_topic_reopened?: {
    thread_id: number
  }
  general_forum_topic_hidden?: {
    thread_id: number
  }
  general_forum_topic_unhidden?: {
    thread_id: number
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
  const webAppUrl = process.env.WEBAPP_URL || process.env.NEXT_PUBLIC_WEBAPP_URL

  if (!botToken || !webAppUrl) {
    return NextResponse.json({ ok: false })
  }

  try {
    const update = (await request.json()) as TelegramUpdate
    const message = update.message ?? update.edited_message

    if (!message?.chat?.id) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const isGroup = message.chat.type !== "private"

    const command = getCommand(message.text)

    if (command === "/start" || command === "/settings") {
      const text = "Откройте веб-приложение, чтобы выбрать группу и настроить уведомления."
      await sendTelegramMessage(botToken, chatId, text, {
        replyMarkup: buildWebAppKeyboard(webAppUrl),
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

          // Sync all administrators of the group
          const admins = await getChatAdministrators(botToken, chatId)
          if (admins) {
            for (const admin of admins) {
              const role = getRoleFromStatus(admin.status)
              await createOrUpdateChatMember(chatId, admin.user.id, role)
              console.log("Admin synced:", chatId, admin.user.id, role)
            }
          }

          await sendTelegramMessage(botToken, chatId,
            "Перейдите в личные сообщения бота и откройте веб-приложение для настройки уведомлений группы."
          )
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

    if (update.my_chat_member) {
      const { chat, new_chat_member } = update.my_chat_member

      if (new_chat_member.status === "left") {
        const memberInfo = await getChatMember(botToken, chat.id, new_chat_member.user.id)
        if (memberInfo) {
          const role = getRoleFromStatus(memberInfo.status)
          await createOrUpdateChatMember(chat.id, new_chat_member.user.id, role)
        }
      } else if (new_chat_member.status === "member") {
        const memberInfo = await getChatMember(botToken, chat.id, new_chat_member.user.id)
        if (memberInfo) {
          const role = getRoleFromStatus(memberInfo.status)

          if (role === "creator" || role === "administrator") {
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

            await sendTelegramMessage(botToken, chat.id,
              "Перейдите в личные сообщения бота и откройте веб-приложение для настройки уведомлений группы."
            )
          }
        }
      }
    }

    if (update.chat_member) {
      const { chat, new_chat_member, old_chat_member } = update.chat_member
      console.log("=== chat_member event ===", { chatId: chat.id, "user:", new_chat_member.user.id, "status:", new_chat_member.status, "oldStatus:", old_chat_member?.status })

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

          for (const topic of topics) {
            console.log("Upserting topic:", topic)
            await upsertChatTopic({
              id: topic.id,
              chatId: chat.id,
              name: topic.name,
              iconColor: topic.icon_color,
              iconCustomEmojiId: topic.icon_custom_emoji_id ? Number(topic.icon_custom_emoji_id) : undefined,
            })
          }

          console.log("Topics synced to database")
        }
      }
    }
        }

        await createOrUpdateChatMember(chat.id, new_chat_member.user.id, newRole)
        console.log("Chat member created/updated")
      }
    }

    if (update.forum_topic_created) {
      const { name, icon_color, icon_custom_emoji_id, thread_id } = update.forum_topic_created
      console.log("=== forum_topic_created event ===", {
        chatId,
        thread_id,
        name,
        icon_color,
        icon_custom_emoji_id,
      })
      await upsertChatTopic({
        id: thread_id,
        chatId: chatId,
        name,
        iconColor: icon_color,
        iconCustomEmojiId: icon_custom_emoji_id ? Number(icon_custom_emoji_id) : undefined,
      })
      console.log("Topic created/updated in database")
    }

    if (update.forum_topic_edited) {
      const { name, icon_custom_emoji_id, thread_id } = update.forum_topic_edited
      if (name) {
        await upsertChatTopic({
          id: thread_id,
          chatId: chatId,
          name,
          iconCustomEmojiId: icon_custom_emoji_id ? Number(icon_custom_emoji_id) : undefined,
        })
      }
    }

    if (update.forum_topic_closed || update.forum_topic_reopened) {
      const { thread_id } = update.forum_topic_closed || update.forum_topic_reopened!
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}
