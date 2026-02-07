import { createClient } from "@supabase/supabase-js"
import type { UserSettings } from "@/lib/schedule-types"
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
}): Promise<StoredChat> {
  const now = new Date().toISOString()
  const chatId = Number(payload.chat.id)

  const chatData = {
    id: chatId,
    type: payload.chat.type,
    title: payload.chat.title ?? null,
    username: payload.chat.username ?? null,
    photo_url: payload.chat.photo_url ?? null,
    settings: payload.settings ?? null,
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
