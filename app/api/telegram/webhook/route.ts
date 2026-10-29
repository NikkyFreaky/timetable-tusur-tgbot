import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from "next/server"
import { buildWebAppKeyboard, buildUrlKeyboard, sendTelegramMessage } from "@/lib/telegram-bot"
import { getChat, getChatMember, getChatAdministrators, getRoleFromStatus, getForumTopics } from "@/lib/telegram-api"
import { upsertChat, createOrUpdateChatMember, upsertChatTopic, getChatById, markChatMembersInactive, updateChatBotActive } from "@/lib/chat-store"
import { updateUserBotActive } from '@/lib/user-store'
import { getBotMessageTemplate } from '@/lib/bot-message-templates'
import { checkRateLimit, getClientAddress } from '@/lib/rate-limit'

export const runtime = "nodejs"

function hasValidWebhookSecret(request: Request, expectedSecret: string): boolean {
  const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!receivedSecret) return false

  const expected = Buffer.from(expectedSecret)
  const received = Buffer.from(receivedSecret)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

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
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const webAppUrl = process.env.WEBAPP_URL || process.env.NEXT_PUBLIC_WEBAPP_URL
  const miniAppUrl = process.env.MINI_APP_URL

  if (!botToken) {
    console.error("BOT_TOKEN is not set")
    return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 })
  }
  if (!webhookSecret) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not set')
    return NextResponse.json({ ok: false, error: 'Webhook is not configured' }, { status: 503 })
  }
  if (!hasValidWebhookSecret(request, webhookSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const rateLimit = checkRateLimit(`telegram-webhook:${getClientAddress(request)}`, {
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }
  if (!webAppUrl) {
    console.error("WEBAPP_URL or NEXT_PUBLIC_WEBAPP_URL is not set")
    return NextResponse.json({ ok: false, error: "WEBAPP_URL missing" }, { status: 500 })
  }
  if (!miniAppUrl) {
    console.error("MINI_APP_URL is not set")
    return NextResponse.json({ ok: false, error: "MINI_APP_URL missing" }, { status: 500 })
  }

  try {
    const update = (await request.json()) as TelegramUpdate
    console.log('Telegram update received', {
      hasMessage: Boolean(update.message),
      hasEditedMessage: Boolean(update.edited_message),
      hasMyChatMember: Boolean(update.my_chat_member),
      hasChatMember: Boolean(update.chat_member),
    })
    const message = update.message ?? update.edited_message

    if (message?.chat?.id) {
      const chatId = message.chat.id
      const isGroup = message.chat.type !== "private"
      console.log('Telegram message received', {
        chatType: message.chat.type,
        isGroup,
        hasNewChatMembers: Boolean(message.new_chat_members),
        hasLeftChatMember: Boolean(message.left_chat_member),
      })

      const command = getCommand(message.text)

      if (command === "/start") {
        console.log('Handling /start command', { isGroup, chatType: message.chat.type })
        const text = await getBotMessageTemplate('start', isGroup ? 'group' : 'private')
        console.log('Sending /start message', { isGroup })
        await sendTelegramMessage(botToken, chatId, text, {
          replyMarkup: isGroup ? buildUrlKeyboard(miniAppUrl) : buildWebAppKeyboard(webAppUrl),
        })
        console.log("=== /start message sent successfully ===")
      }

      if (command === "/settings") {
        console.log('Handling /settings command', { isGroup, chatType: message.chat.type })
        const text = await getBotMessageTemplate('settings', isGroup ? 'group' : 'private')
        console.log('Sending /settings message', { isGroup })
        await sendTelegramMessage(botToken, chatId, text, {
          replyMarkup: isGroup ? buildUrlKeyboard(miniAppUrl) : buildWebAppKeyboard(webAppUrl),
        })
        console.log("=== /settings message sent successfully ===")
      }

      if (command === '/info') {
        const text = await getBotMessageTemplate('info', isGroup ? 'group' : 'private')
        await sendTelegramMessage(botToken, chatId, text, {
          replyMarkup: isGroup ? buildUrlKeyboard(miniAppUrl) : buildWebAppKeyboard(webAppUrl),
        })
      }

      if (isGroup && message.new_chat_members) {
      console.log('Telegram chat member added')
      for (const member of message.new_chat_members) {
        if (member.is_bot) {
          console.log('Bot added to chat')
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
              console.log('Chat administrator synced', { role })
            }
          }

          // Send welcome message with Mini App button
          console.log('Bot added to group')
          const welcomeText = `✅ Бот добавлен в группу!\n\n📖 Откройте веб-приложение, чтобы настроить расписание для этой группы.`
          await sendTelegramMessage(botToken, chatId, welcomeText, {
            replyMarkup: buildUrlKeyboard(miniAppUrl),
          })
        } else {
          console.log('Chat member added')
          const memberInfo = await getChatMember(botToken, chatId, member.id)
          if (memberInfo) {
            const role = getRoleFromStatus(memberInfo.status)
            console.log('Chat member role synchronized', { role })
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
        await updateChatBotActive(chat.id, false)
        if (chat.type === 'private') await updateUserBotActive(chat.id, false)
        await createOrUpdateChatMember(chat.id, new_chat_member.user.id, newRole)
        await markChatMembersInactive(chat.id)
        const { updateChatsNotificationState } = await import("@/lib/chat-store")
        await updateChatsNotificationState([{ id: chat.id, state: {} }])
      } else if (new_chat_member.status === "member" || new_chat_member.status === "administrator") {
        await updateChatBotActive(chat.id, true)
        if (chat.type === 'private') await updateUserBotActive(chat.id, true)
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
          console.log('Bot activated in private chat')
          const activationText = "⚙️ Чтобы настроить уведомления:\n1) Откройте веб-приложение\n2) В группе выдайте боту права администратора"
          await sendTelegramMessage(
            botToken,
            chat.id,
            activationText,
            {
              replyMarkup: buildWebAppKeyboard(webAppUrl),
            }
          )
          console.log("=== Activation message sent successfully ===")
        }
      }
    }

    if (update.chat_member) {
      const { chat, new_chat_member, old_chat_member } = update.chat_member
      console.log('Telegram chat member updated', {
        status: new_chat_member.status,
        oldStatus: old_chat_member?.status,
      })

      const memberInfo = await getChatMember(botToken, chat.id, new_chat_member.user.id)
      if (memberInfo) {
        const status = memberInfo.status as any
        const newRole = getRoleFromStatus(status)
        console.log("New role:", newRole)

        await createOrUpdateChatMember(chat.id, new_chat_member.user.id, newRole)

        if ((newRole === "creator" || newRole === "administrator") && !new_chat_member.user.is_bot) {
          console.log("User is now admin, syncing topics...")
          const topics = await getForumTopics(botToken, chat.id)
          if (topics) {
            for (const topic of topics) {
              console.log('Synchronizing forum topic')
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
      console.log('Forum topic created')
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
