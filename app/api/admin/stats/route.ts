import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const adminUser = await getAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      usersResult,
      chatsResult,
      activeToday,
      activeWeek,
      activeMonth,
      devicesResult,
      adminsResult,
      recentUsersResult,
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('chats').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('last_seen_at', todayStart),
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('last_seen_at', weekAgo),
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('last_seen_at', monthAgo),
      supabase.from('user_devices').select('id', { count: 'exact', head: true }),
      supabase.from('admins').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id, first_name, last_name, username, photo_url, last_seen_at, created_at, settings')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Статистика по факультетам
    const { data: allUsers } = await supabase.from('users').select('settings')
    const facultyMap = new Map<string, number>()
    if (allUsers) {
      for (const u of allUsers) {
        const settings = u.settings as Record<string, unknown> | null
        const faculty = (settings?.facultyName as string) || 'Не выбран'
        facultyMap.set(faculty, (facultyMap.get(faculty) || 0) + 1)
      }
    }

    const facultyStats = Array.from(facultyMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({
      totalUsers: usersResult.count ?? 0,
      totalChats: chatsResult.count ?? 0,
      activeToday: activeToday.count ?? 0,
      activeWeek: activeWeek.count ?? 0,
      activeMonth: activeMonth.count ?? 0,
      totalDevices: devicesResult.count ?? 0,
      totalAdmins: adminsResult.count ?? 0,
      facultyStats,
      recentUsers: (recentUsersResult.data ?? []).map((u: any) => ({
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || `ID ${u.id}`,
        username: u.username,
        photoUrl: u.photo_url,
        createdAt: u.created_at,
        lastSeenAt: u.last_seen_at,
        faculty: (u.settings as Record<string, unknown>)?.facultyName ?? null,
        group: (u.settings as Record<string, unknown>)?.groupName ?? null,
      })),
    })
  } catch (error) {
    console.error('Failed to load stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
