const TELEGRAM_API = "https://api.telegram.org/bot"

type TelegramResponse<T> = {
  ok: boolean
  result?: T
  description?: string
}

type ChatInfo = {
  id: number
  type: "private" | "group" | "supergroup" | "channel"
  title?: string
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
  description?: string
  invite_link?: string
  pinned_message?: any
  permissions?: any
  slow_mode_delay?: number
  message_auto_delete_time?: number
  has_protected_content?: boolean
  has_private_forwards?: boolean
  join_to_send_messages?: boolean
  join_by_request?: boolean
  has_restricted_voice_and_video_messages?: boolean
  is_forum?: boolean
  forum_topics?: Array<{
    id: number
    name: string
    icon_color_id: number
    thread_id: number
  }>
  forum_chat_created?: boolean
  active_usernames?: string[]
  emoji_status_custom_emoji_id?: string
  emoji_status_expiration_date?: number
  has_hidden_members?: boolean
  has_aggressive_anti_spam_enabled?: boolean
  has_hidden_history?: boolean
  has_visible_history?: boolean
}

type ChatMemberInfo = {
  user: {
    id: number
    is_bot: boolean
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    is_premium?: boolean
    added_to_attachment_menu?: boolean
  }
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"
  custom_title?: string
  is_anonymous?: boolean
  can_be_edited?: boolean
  can_manage_chat?: boolean
  can_change_info?: boolean
  can_post_messages?: boolean
  can_edit_messages?: boolean
  can_delete_messages?: boolean
  can_manage_video_chats?: boolean
  can_restrict_members?: boolean
  can_promote_members?: boolean
  can_manage_topics?: boolean
  can_pin_messages?: boolean
  can_manage_voice_chats?: boolean
}

async function telegramFetch<T>(botToken: string, method: string, body?: any): Promise<T | null> {
  const url = `${TELEGRAM_API}${botToken}/${method}`

  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = (await response.json()) as TelegramResponse<T>

    if (!response.ok || !data.ok) {
      const description = data.description || `HTTP ${response.status}`
      console.error(`Telegram ${method} failed: ${description}`)
      return null
    }

    return data.result ?? null
  } catch (error) {
    console.error(`Telegram ${method} error:`, error)
    return null
  }
}

export async function getChat(
  botToken: string,
  chatId: number
): Promise<ChatInfo | null> {
  return telegramFetch<ChatInfo>(botToken, "getChat", {
    chat_id: chatId,
  })
}

export async function getChatMember(
  botToken: string,
  chatId: number,
  userId: number
): Promise<ChatMemberInfo | null> {
  return telegramFetch<ChatMemberInfo>(botToken, "getChatMember", {
    chat_id: chatId,
    user_id: userId,
  })
}

export async function getChatAdministrators(
  botToken: string,
  chatId: number
): Promise<ChatMemberInfo[] | null> {
  return telegramFetch<ChatMemberInfo[]>(botToken, "getChatAdministrators", {
    chat_id: chatId,
  })
}

export async function getForumTopics(
  botToken: string,
  chatId: number
): Promise<Array<{ id: number; name: string; icon_color: number | null }> | null> {
  const chatInfo = await getChat(botToken, chatId)

  if (!chatInfo) {
    return null
  }

  if (!chatInfo.is_forum) {
    return []
  }

  const topics: Array<{ id: number; name: string; icon_color: number | null }> = []

  if (chatInfo.forum_topics && Array.isArray(chatInfo.forum_topics)) {
    for (const topic of chatInfo.forum_topics) {
      topics.push({
        id: topic.thread_id,
        name: topic.name,
        icon_color: topic.icon_color_id,
      })
    }
  }

  return topics
}

export function getRoleFromStatus(status: ChatMemberInfo["status"]): "creator" | "administrator" | "member" | "left" | "kicked" {
  if (status === "creator") return "creator"
  if (status === "administrator") return "administrator"
  if (status === "restricted" || status === "member") return "member"
  if (status === "left") return "left"
  if (status === "kicked") return "kicked"
  return "member"
}

export function isAdmin(role: "creator" | "administrator" | "member" | "left" | "kicked"): boolean {
  return role === "creator" || role === "administrator"
}
