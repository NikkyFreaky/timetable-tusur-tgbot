'use client'

import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingRevoke, setPendingRevoke] = useState<AccessEntry | null>(null)

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
    setFormError('')
    setSaving(true)
    try {
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
    } catch {
      setStatus('Не удалось обновить доступ')
    } finally {
      setSaving(false)
      setPendingRevoke(null)
    }
  }

  const handleGrant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = Number(telegramUserId)
    if (!Number.isSafeInteger(id) || id <= 0) {
      setFormError('Укажите корректный Telegram ID')
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

      {status && <div className="rounded-xl border border-border bg-card p-3 text-sm" role="status" aria-live="polite">{status}</div>}

      <form onSubmit={handleGrant} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="telegram-user-id" className="text-xs font-medium text-muted-foreground">Telegram ID</label>
          <input
            id="telegram-user-id"
            value={telegramUserId}
            onChange={(event) => setTelegramUserId(event.target.value)}
            inputMode="numeric"
            aria-describedby="telegram-id-hint telegram-id-error"
            aria-invalid={Boolean(formError)}
            placeholder="Например, 123456789"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p id="telegram-id-hint" className="text-xs text-muted-foreground">Числовой идентификатор пользователя Telegram.</p>
          {formError && <p id="telegram-id-error" className="text-xs text-destructive" role="alert">{formError}</p>}
        </div>
        <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Сохранение…' : 'Выдать доступ'}
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
              <div key={entry.telegramUserId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium">{entry.telegramUserId}</div>
                  <span className={entry.isActive ? 'mt-1 inline-flex rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300' : 'mt-1 inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground'}>
                    {entry.isActive ? 'Доступ активен' : 'Доступ отозван'}
                  </span>
                  <div className="mt-1 text-xs text-muted-foreground">Выдан: {new Date(entry.createdAt).toLocaleString('ru-RU')} · Обновлён: {new Date(entry.updatedAt).toLocaleString('ru-RU')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => entry.isActive ? setPendingRevoke(entry) : saveAccess(entry.telegramUserId, true)}
                  disabled={saving}
                  className="min-h-11 rounded-lg border border-border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {entry.isActive ? 'Отозвать' : 'Выдать снова'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={pendingRevoke !== null} onOpenChange={(open) => !open && !saving && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отозвать доступ?</AlertDialogTitle>
            <AlertDialogDescription>Пользователь с Telegram ID {pendingRevoke?.telegramUserId} больше не сможет получать сводки.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={saving || !pendingRevoke} onClick={() => pendingRevoke && saveAccess(pendingRevoke.telegramUserId, false)} className="bg-destructive text-white hover:bg-destructive/90">
              {saving ? 'Отзыв…' : 'Отозвать доступ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
