import 'server-only'

import { createOrUpdateChatMember } from '@/lib/chat-store'
import { getChatMember, getRoleFromStatus, isAdmin } from '@/lib/telegram-api'

export type ChatAdminVerification = 'authorized' | 'forbidden' | 'unavailable'

export type ChatMemberVerification = 'authorized' | 'forbidden' | 'unavailable'

async function getCurrentChatRole(chatId: number, userId: number) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) return null

  const member = await getChatMember(botToken, chatId, userId)
  if (!member) return null

  const role = getRoleFromStatus(member.status)
  await createOrUpdateChatMember(chatId, userId, role)
  return role
}

/** Проверяет права администратора по актуальным данным Telegram и обновляет кэш. */
export async function verifyChatAdmin(
  chatId: number,
  userId: number
): Promise<ChatAdminVerification> {
  const role = await getCurrentChatRole(chatId, userId)
  if (!role) return 'unavailable'
  return isAdmin(role) ? 'authorized' : 'forbidden'
}

/** Проверяет наличие пользователя в чате по актуальным данным Telegram. */
export async function verifyChatMembership(
  chatId: number,
  userId: number
): Promise<ChatMemberVerification> {
  const role = await getCurrentChatRole(chatId, userId)
  if (!role) return 'unavailable'
  return role === 'left' || role === 'kicked' ? 'forbidden' : 'authorized'
}
