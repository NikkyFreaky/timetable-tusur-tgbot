import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET() {
  const adminUser = await getAdminUser()
  if (!adminUser || adminUser.admin.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [usersResult, chatsResult, topicsResult] = await Promise.all([
    supabase.from('users').select('id,first_name,last_name,username').eq('bot_active', true).order('last_seen_at', { ascending: false }),
    supabase.from('chats').select('id,type,title,username,is_forum,topic_id').eq('bot_active', true).neq('type', 'private').order('last_seen_at', { ascending: false }),
    supabase.from('chat_topics').select('chat_id,id,name'),
  ])
  if (usersResult.error || chatsResult.error || topicsResult.error) {
    return NextResponse.json({ error: 'Не удалось загрузить адресатов' }, { status: 500 })
  }

  const targets = [
    ...(usersResult.data ?? []).map((user) => ({
      id: String(user.id), chatId: user.id, threadId: null, kind: 'user',
      label: [user.first_name, user.last_name].filter(Boolean).join(' ') || `Пользователь ${user.id}`,
      username: user.username,
    })),
    ...(chatsResult.data ?? []).map((chat) => ({
      id: `chat:${chat.id}`, chatId: chat.id, threadId: chat.topic_id ?? null,
      kind: chat.is_forum ? 'forum' : chat.type,
      label: chat.title || `Чат ${chat.id}`, username: chat.username,
    })),
    ...(topicsResult.data ?? []).map((topic) => ({
      id: `topic:${topic.chat_id}:${topic.id}`, chatId: topic.chat_id, threadId: topic.id,
      kind: 'forum-topic', label: `Тема: ${topic.name}`, username: null,
    })),
  ]
  return NextResponse.json({ targets })
}
