import { createClient } from "@supabase/supabase-js"
import type { UserSettings, ChatTopic } from "@/lib/schedule-types"
import type { NotificationState } from "@/lib/notification-state"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type TelegramChatProfile = {
  id: number
  type: string
  title?: string
  username?: string
  photo_url?: string
}

export type StoredChat = {
  id: number
  type: string
  title: string | null
  username: string | null
  photoUrl: string | null
  settings: UserSettings | null
  notificationState: NotificationState
  createdAt: string
  updatedAt: string
  lastSeenAt: string
  topicId: number | null
  createdBy: number | null
  isForum: boolean
  topics?: ChatTopic[]
}

function mapDbChatToStoredChat(dbChat: any): StoredChat {
  return {
    id: dbChat.id,
    type: dbChat.type,
    title: dbChat.title,
    username: dbChat.username,
    photoUrl: dbChat.photo_url,
    settings: (dbChat.settings as UserSettings) ?? null,
    notificationState: (dbChat.notification_state as NotificationState) ?? {},
    createdAt: dbChat.created_at,
    updatedAt: dbChat.updated_at,
    lastSeenAt: dbChat.last_seen_at,
    topicId: dbChat.topic_id ?? null,
    createdBy: dbChat.created_by ?? null,
    isForum: dbChat.is_forum ?? false,
  }
}

export async function getChatById(chatId: number): Promise<StoredChat | null> {
  const { data: chat } = await supabase
    .from("chats")
    .select()
    .eq("id", chatId)
    .single()

  if (!chat) return null

  return mapDbChatToStoredChat(chat)
}

export async function listChatsWithSettings(): Promise<StoredChat[]> {
  const { data: chats } = await supabase
    .from("chats")
    .select()

  if (!chats) return []

  return chats.map(mapDbChatToStoredChat)
}

export async function upsertChat(payload: {
  chat: TelegramChatProfile
  settings?: UserSettings | null
  topicId?: number | null
  createdBy?: number | null
  isForum?: boolean
}): Promise<StoredChat> {
  const now = new Date().toISOString()
  const chatId = Number(payload.chat.id)

  const { data: existingChat } = await supabase
    .from("chats")
    .select("settings, topic_id, created_by, is_forum")
    .eq("id", chatId)
    .maybeSingle()

  const chatData = {
    id: chatId,
    type: payload.chat.type,
    title: payload.chat.title ?? null,
    username: payload.chat.username ?? null,
    photo_url: payload.chat.photo_url ?? null,
    settings: payload.settings === undefined ? ((existingChat?.settings as UserSettings) ?? null) : payload.settings,
    topic_id: payload.topicId === undefined ? (existingChat?.topic_id ?? null) : payload.topicId,
    created_by: payload.createdBy === undefined ? (existingChat?.created_by ?? null) : payload.createdBy,
    is_forum: payload.isForum === undefined ? (existingChat?.is_forum ?? false) : payload.isForum,
    updated_at: now,
    last_seen_at: now,
  }

  const { data: chat } = await supabase
    .from("chats")
    .upsert(chatData, { onConflict: "id" })
    .select()
    .single()

  return mapDbChatToStoredChat(chat)
}

export async function updateChatsNotificationState(
  updates: Array<{ id: number; state: Partial<NotificationState> }>
) {
  if (updates.length === 0) return

  for (const { id, state } of updates) {
    await supabase
      .from("chats")
      .update({
        notification_state: state as any,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
  }
}

export async function listUserChats(userId: number): Promise<StoredChat[]> {
  const { data: members } = await supabase
    .from("chat_members")
    .select()
    .eq("user_id", userId)
    .in("role", ["creator", "administrator", "member"])

  if (!members || members.length === 0) return []

  const chatIds = members.map((m: any) => m.chat_id)
  const { data: chats } = await supabase
    .from("chats")
    .select()
    .in("id", chatIds)

  if (!chats) return []

  const chatsMap = new Map<number, any>()
  for (const chat of chats) {
    chatsMap.set(chat.id, chat)
  }

  const result: StoredChat[] = []
  for (const member of members) {
    const chat = chatsMap.get(member.chat_id)
    if (chat) {
      const stored = mapDbChatToStoredChat(chat)
      result.push({
        ...stored,
      })
    }
  }

  return result
}

export async function createOrUpdateChatMember(
  chatId: number,
  userId: number,
  role: "creator" | "administrator" | "member" | "left" | "kicked"
) {
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from("chat_members")
    .select()
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  if (existing) {
    await supabase
      .from("chat_members")
      .update({
        role,
        updated_at: now,
      })
      .eq("chat_id", chatId)
      .eq("user_id", userId)
  } else {
    await supabase.from("chat_members").insert({
      chat_id: chatId,
      user_id: userId,
      role,
      added_at: now,
      updated_at: now,
    })
  }
}

export async function updateChatMemberRole(
  chatId: number,
  userId: number,
  role: "creator" | "administrator" | "member" | "left" | "kicked"
) {
  await supabase
    .from("chat_members")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId)
    .eq("user_id", userId)
}

export async function listChatTopics(chatId: number): Promise<ChatTopic[]> {
  console.log("=== listChatTopics called ===", { chatId })

  const { data: topics } = await supabase
    .from("chat_topics")
    .select()
    .eq("chat_id", chatId)

  console.log("Topics from database:", topics)

  if (!topics) {
    console.log("No topics found")
    return []
  }

  const mappedTopics = topics.map((t: any) => ({
    id: t.id,
    chatId: t.chat_id,
    name: t.name,
    iconColor: t.icon_color ?? null,
    iconCustomEmojiId: t.icon_custom_emoji_id ?? null,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }))

  console.log("Mapped topics:", mappedTopics)

  return mappedTopics
}

export async function upsertChatTopic(topic: {
  id: number
  chatId: number
  name: string
  iconColor?: number | null
  iconCustomEmojiId?: number | null
}): Promise<ChatTopic> {
  const now = new Date().toISOString()

  console.log("=== upsertChatTopic called ===", {
    topicId: topic.id,
    chatId: topic.chatId,
    name: topic.name,
    iconColor: topic.iconColor,
    iconCustomEmojiId: topic.iconCustomEmojiId,
  })

  const { data: existing } = await supabase
    .from("chat_topics")
    .select()
    .eq("id", topic.id)
    .eq("chat_id", topic.chatId)
    .single()

  console.log("Existing topic check:", existing)

  if (existing) {
    console.log("Updating existing topic...")
    await supabase
      .from("chat_topics")
      .update({
        name: topic.name,
        icon_color: topic.iconColor ?? null,
        icon_custom_emoji_id: topic.iconCustomEmojiId ?? null,
        updated_at: now,
      })
      .eq("id", topic.id)
      .eq("chat_id", topic.chatId)
  } else {
    console.log("Inserting new topic...")
    const { error: insertError } = await supabase
      .from("chat_topics")
      .insert({
        id: topic.id,
        chat_id: topic.chatId,
        name: topic.name,
        icon_color: topic.iconColor ?? null,
        icon_custom_emoji_id: topic.iconCustomEmojiId ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Failed to insert topic:", insertError)
    } else {
      console.log("Topic inserted successfully")
    }
  }

  return {
    id: topic.id,
    chatId: topic.chatId,
    name: topic.name,
    iconColor: topic.iconColor ?? null,
    iconCustomEmojiId: topic.iconCustomEmojiId ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function deleteChatTopic(chatId: number, topicId: number): Promise<void> {
  await supabase
    .from("chat_topics")
    .delete()
    .eq("id", topicId)
    .eq("chat_id", chatId)
}

export async function updateChatTopicId(chatId: number, topicId: number | null): Promise<void> {
  await supabase
    .from("chats")
    .update({
      topic_id: topicId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId)
}

export async function getChatMemberRole(
  chatId: number,
  userId: number
): Promise<"creator" | "administrator" | "member" | "left" | "kicked" | null> {
  const { data: member } = await supabase
    .from("chat_members")
    .select()
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  if (!member) return null

  return member.role
}

