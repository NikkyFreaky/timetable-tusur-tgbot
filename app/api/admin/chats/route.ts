import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

type ChatRow = {
  id: number
  type: string
  title: string | null
  username: string | null
  photo_url: string | null
  settings: Record<string, unknown> | null
  created_at: string
  updated_at: string
  last_seen_at: string
  is_forum: boolean
  created_by: number | null
}

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('q') || '').trim()
    const typeFilter = (searchParams.get('type') || '').trim()
    const forumsOnly = searchParams.get('forums') === '1'

    const page = Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const requestedPageSize = Number.parseInt(searchParams.get('pageSize') || '', 10)
    const pageSize = Math.min(
      Math.max(Number.isNaN(requestedPageSize) ? DEFAULT_PAGE_SIZE : requestedPageSize, 20),
      MAX_PAGE_SIZE
    )
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let chatsQuery = supabase
      .from('chats')
      .select(
        'id,type,title,username,photo_url,settings,created_at,updated_at,last_seen_at,is_forum,created_by',
        { count: 'exact' }
      )
      .order('last_seen_at', { ascending: false })
      .range(from, to)

    if (typeFilter) {
      chatsQuery = chatsQuery.eq('type', typeFilter)
    }

    if (forumsOnly) {
      chatsQuery = chatsQuery.eq('is_forum', true)
    }

    if (query) {
      const maybeId = Number(query)
      if (Number.isFinite(maybeId)) {
        chatsQuery = chatsQuery.eq('id', maybeId)
      } else {
        const escaped = query.replace(/[%_,]/g, (char) => `\\${char}`)
        chatsQuery = chatsQuery.or(`title.ilike.%${escaped}%,username.ilike.%${escaped}%`)
      }
    }

    const { data: chats, count: totalFiltered, error: chatsError } = await chatsQuery

    if (chatsError) {
      console.error('Failed to list chats:', chatsError)
      return NextResponse.json({ error: 'Failed to list chats' }, { status: 500 })
    }

    const chatRows = (chats ?? []) as ChatRow[]
    const chatIds = chatRows.map((chat) => chat.id)

    const [
      totalChatsResult,
      forumsResult,
      configuredChatsResult,
      activeWeekResult,
      privateResult,
      groupResult,
      supergroupResult,
      channelResult,
      membersResult,
      topicsResult,
    ] = await Promise.all([
      supabase.from('chats').select('id', { count: 'exact', head: true }),
      supabase.from('chats').select('id', { count: 'exact', head: true }).eq('is_forum', true),
      supabase.from('chats').select('id', { count: 'exact', head: true }).not('settings', 'is', null),
      supabase
        .from('chats')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('chats').select('id', { count: 'exact', head: true }).eq('type', 'private'),
      supabase.from('chats').select('id', { count: 'exact', head: true }).eq('type', 'group'),
      supabase.from('chats').select('id', { count: 'exact', head: true }).eq('type', 'supergroup'),
      supabase.from('chats').select('id', { count: 'exact', head: true }).eq('type', 'channel'),
      chatIds.length > 0
        ? supabase.from('chat_members').select('chat_id,role').in('chat_id', chatIds)
        : Promise.resolve({ data: [] as Array<{ chat_id: number; role: string }>, error: null }),
      chatIds.length > 0
        ? supabase.from('chat_topics').select('chat_id,id').in('chat_id', chatIds)
        : Promise.resolve({ data: [] as Array<{ chat_id: number; id: number }>, error: null }),
    ])

    if (membersResult.error) {
      console.error('Failed to load chat members:', membersResult.error)
      return NextResponse.json({ error: 'Failed to load chat members' }, { status: 500 })
    }

    if (topicsResult.error) {
      console.error('Failed to load chat topics:', topicsResult.error)
      return NextResponse.json({ error: 'Failed to load chat topics' }, { status: 500 })
    }

    const memberStats = new Map<number, { total: number; active: number; admins: number }>()
    for (const member of membersResult.data ?? []) {
      const current = memberStats.get(member.chat_id) ?? { total: 0, active: 0, admins: 0 }
      current.total += 1
      if (member.role === 'creator' || member.role === 'administrator' || member.role === 'member') {
        current.active += 1
      }
      if (member.role === 'creator' || member.role === 'administrator') {
        current.admins += 1
      }
      memberStats.set(member.chat_id, current)
    }

    const topicCount = new Map<number, number>()
    for (const topic of topicsResult.data ?? []) {
      topicCount.set(topic.chat_id, (topicCount.get(topic.chat_id) || 0) + 1)
    }

    return NextResponse.json({
      chats: chatRows.map((chat) => ({
        id: chat.id,
        type: chat.type,
        title: chat.title,
        username: chat.username,
        photoUrl: chat.photo_url,
        createdBy: chat.created_by,
        isForum: Boolean(chat.is_forum),
        hasSettings: Boolean(chat.settings),
        faculty: (chat.settings?.facultyName as string) || null,
        group: (chat.settings?.groupName as string) || null,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
        lastSeenAt: chat.last_seen_at,
        memberCount: memberStats.get(chat.id)?.total || 0,
        activeMemberCount: memberStats.get(chat.id)?.active || 0,
        adminCount: memberStats.get(chat.id)?.admins || 0,
        topicCount: topicCount.get(chat.id) || 0,
      })),
      pagination: {
        page,
        pageSize,
        total: totalFiltered ?? 0,
        totalPages: Math.max(1, Math.ceil((totalFiltered ?? 0) / pageSize)),
      },
      stats: {
        totalChats: totalChatsResult.count ?? 0,
        forums: forumsResult.count ?? 0,
        configured: configuredChatsResult.count ?? 0,
        activeWeek: activeWeekResult.count ?? 0,
        byType: {
          private: privateResult.count ?? 0,
          group: groupResult.count ?? 0,
          supergroup: supergroupResult.count ?? 0,
          channel: channelResult.count ?? 0,
        },
      },
    })
  } catch (error) {
    console.error('Failed to load admin chats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
