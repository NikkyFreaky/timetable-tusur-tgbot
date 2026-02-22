'use client'

import { useEffect, useMemo, useState } from 'react'

type ChatItem = {
  id: number
  type: string
  title: string | null
  username: string | null
  photoUrl: string | null
  createdBy: number | null
  isForum: boolean
  hasSettings: boolean
  faculty: string | null
  group: string | null
  createdAt: string
  updatedAt: string
  lastSeenAt: string
  memberCount: number
  activeMemberCount: number
  adminCount: number
  topicCount: number
}

type ChatsResponse = {
  chats: ChatItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  stats: {
    totalChats: number
    forums: number
    configured: number
    activeWeek: number
    byType: {
      private: number
      group: number
      supergroup: number
      channel: number
    }
  }
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

export default function AdminChatsPage() {
  const [data, setData] = useState<ChatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [forumsOnly, setForumsOnly] = useState(false)
  const [page, setPage] = useState(1)

  const pageSize = 50

  const requestQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (typeFilter) params.set('type', typeFilter)
    if (forumsOnly) params.set('forums', '1')
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return params.toString()
  }, [forumsOnly, page, query, typeFilter])

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`/api/admin/chats?${requestQuery}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((resData: ChatsResponse) => {
        setData(resData)
      })
      .catch(() => setError('Не удалось загрузить список чатов'))
      .finally(() => setLoading(false))
  }, [requestQuery])

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(searchInput.trim())
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Чаты</h1>
        <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Загрузка чатов...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Чаты</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error || 'Не удалось загрузить чаты'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Чаты с ботом</h1>
        <p className="text-xs text-muted-foreground">
          Всего: {data.stats.totalChats} · Найдено: {data.pagination.total} · На странице: {data.chats.length}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Всего чатов" value={data.stats.totalChats} />
        <StatCard label="Форумы" value={data.stats.forums} />
        <StatCard label="С настройками" value={data.stats.configured} />
        <StatCard label="Активны за 7 дней" value={data.stats.activeWeek} />
        <StatCard label="Private" value={data.stats.byType.private} />
        <StatCard label="Group" value={data.stats.byType.group} />
        <StatCard label="Supergroup" value={data.stats.byType.supergroup} />
        <StatCard label="Channel" value={data.stats.byType.channel} />
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="rounded-2xl border border-border bg-card p-4 grid gap-3 md:grid-cols-[1fr_180px_auto_auto]"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Поиск по названию, username или ID"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={typeFilter}
          onChange={(event) => {
            setPage(1)
            setTypeFilter(event.target.value)
          }}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Все типы</option>
          <option value="private">private</option>
          <option value="group">group</option>
          <option value="supergroup">supergroup</option>
          <option value="channel">channel</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-foreground px-2">
          <input
            type="checkbox"
            checked={forumsOnly}
            onChange={(event) => {
              setPage(1)
              setForumsOnly(event.target.checked)
            }}
          />
          Только форумы
        </label>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Найти
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {data.chats.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Чаты не найдены</div>
        ) : (
          <div className="divide-y divide-border">
            {data.chats.map((chat) => (
              <div key={chat.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {chat.title || `Chat ${chat.id}`}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {chat.type}
                      </span>
                      {chat.isForum && (
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          forum
                        </span>
                      )}
                      {chat.hasSettings && (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                          настроен
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {chat.id}
                      {chat.username ? ` · @${chat.username}` : ''}
                      {chat.faculty ? ` · ${chat.faculty}` : ''}
                      {chat.group ? ` / ${chat.group}` : ''}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>Последняя активность</div>
                    <div>{formatDateTime(chat.lastSeenAt)}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Участники: {chat.memberCount} (активных: {chat.activeMemberCount}) · Админов: {chat.adminCount} · Тем: {chat.topicCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-border px-4 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Предыдущая
          </button>
          <span className="text-xs text-muted-foreground">
            Страница {data.pagination.page} из {data.pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(data.pagination.totalPages, current + 1))}
            disabled={page >= data.pagination.totalPages}
            className="rounded-xl border border-border px-4 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Следующая
          </button>
        </div>
      )}
    </div>
  )
}
