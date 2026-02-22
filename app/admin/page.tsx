'use client'

import { useEffect, useState } from 'react'

type Stats = {
  totalUsers: number
  totalChats: number
  activeToday: number
  activeWeek: number
  activeMonth: number
  totalDevices: number
  totalAdmins: number
  facultyStats: { name: string; count: number }[]
  recentUsers: {
    id: number
    name: string
    username: string | null
    photoUrl: string | null
    createdAt: string
    lastSeenAt: string
    faculty: string | null
    group: string | null
  }[]
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(setStats)
      .catch(() => setError('Не удалось загрузить статистику'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Дашборд</h1>
        <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Загрузка статистики...
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Дашборд</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error || 'Не удалось загрузить статистику'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Дашборд</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Всего пользователей" value={stats.totalUsers} />
        <StatCard label="Активны сегодня" value={stats.activeToday} />
        <StatCard label="Активны за неделю" value={stats.activeWeek} />
        <StatCard label="Активны за месяц" value={stats.activeMonth} />
        <StatCard label="Всего чатов" value={stats.totalChats} />
        <StatCard label="Всего устройств" value={stats.totalDevices} />
        <StatCard label="Администраторов" value={stats.totalAdmins} />
      </div>

      {stats.facultyStats.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Пользователи по факультетам
          </h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {stats.facultyStats.map((faculty) => (
                <div
                  key={faculty.name}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="text-sm text-foreground truncate pr-4">
                    {faculty.name}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground shrink-0">
                    {faculty.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {stats.recentUsers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Недавно зарегистрированные
          </h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {stats.recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="h-9 w-9 rounded-xl bg-muted/40 border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {user.photoUrl ? (
                      <img
                        src={user.photoUrl}
                        alt={user.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {user.name}
                      </span>
                      {user.username && (
                        <span className="text-xs text-muted-foreground">
                          @{user.username}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.faculty && `${user.faculty}`}
                      {user.group && ` / ${user.group}`}
                      {!user.faculty && !user.group && 'Не настроено'}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    {formatDateTime(user.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
