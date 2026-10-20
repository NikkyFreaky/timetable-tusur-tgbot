'use client'

import { useEffect, useState } from 'react'

interface AccessEntry {
  telegramUserId: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function EmployeeAvailabilityAdminPage() {
  const [entries, setEntries] = useState<AccessEntry[]>([])
  const [telegramUserId, setTelegramUserId] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const loadEntries = async () => {
    const response = await fetch('/api/admin/employee-availability/access')
    if (!response.ok) throw new Error('Не удалось загрузить доступы')
    const data = await response.json() as { access: AccessEntry[] }
    setEntries(data.access)
  }

  useEffect(() => {
    loadEntries()
      .catch((error) => setStatus(error instanceof Error ? error.message : 'Не удалось загрузить доступы'))
      .finally(() => setLoading(false))
  }, [])

  const saveAccess = async (id: number, isActive: boolean) => {
    setStatus('')
    const response = await fetch('/api/admin/employee-availability/access', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: id, isActive }),
    })
    const data = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      setStatus(data.error ?? 'Не удалось обновить доступ')
      return
    }
    setTelegramUserId('')
    setStatus(isActive ? 'Доступ выдан' : 'Доступ отозван')
    await loadEntries()
  }

  const handleGrant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = Number(telegramUserId)
    if (!Number.isSafeInteger(id) || id <= 0) {
      setStatus('Укажите корректный Telegram ID')
      return
    }
    await saveAccess(id, true)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Сводки сотрудников</h1>
        <p className="text-sm text-muted-foreground">
          Выдайте доступ по Telegram ID. Пользователь может ещё не открывать бота.
        </p>
      </div>

      {status && <div className="rounded-xl border border-border bg-card p-3 text-sm">{status}</div>}

      <form onSubmit={handleGrant} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row">
        <input
          value={telegramUserId}
          onChange={(event) => setTelegramUserId(event.target.value)}
          inputMode="numeric"
          placeholder="Telegram ID"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Выдать доступ
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Выданные доступы</div>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Доступы ещё не выдавались.</div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.telegramUserId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{entry.telegramUserId}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.isActive ? 'Доступ активен' : 'Доступ отозван'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => saveAccess(entry.telegramUserId, !entry.isActive)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                >
                  {entry.isActive ? 'Отозвать' : 'Выдать снова'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
