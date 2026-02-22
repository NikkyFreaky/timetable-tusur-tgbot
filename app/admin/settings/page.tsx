'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type AdminProfile = {
  id: string
  email: string
  displayName: string
  role: 'admin' | 'superadmin'
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Display name form
  const [displayName, setDisplayName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Email form
  const [email, setEmail] = useState('')
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setProfile(data)
        setDisplayName(data.displayName || '')
        setEmail(data.email || '')
      } catch {
        setError('Не удалось загрузить профиль')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleNameSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setNameMessage(null)
    setNameLoading(true)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })

      const data = await res.json()

      if (!res.ok) {
        setNameMessage({ type: 'error', text: data.error || 'Ошибка обновления' })
        return
      }

      setNameMessage({ type: 'success', text: 'Имя обновлено' })
      router.refresh()
    } catch {
      setNameMessage({ type: 'error', text: 'Произошла ошибка' })
    } finally {
      setNameLoading(false)
    }
  }

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setEmailMessage(null)

    if (!emailCurrentPassword) {
      setEmailMessage({ type: 'error', text: 'Введите текущий пароль' })
      return
    }

    if (email === profile?.email) {
      setEmailMessage({ type: 'error', text: 'Email не изменился' })
      return
    }

    setEmailLoading(true)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName: profile?.displayName || '',
          currentPassword: emailCurrentPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEmailMessage({ type: 'error', text: data.error || 'Ошибка обновления' })
        return
      }

      setEmailCurrentPassword('')
      setEmailMessage({ type: 'success', text: 'Email обновлен' })
      router.refresh()
    } catch {
      setEmailMessage({ type: 'error', text: 'Произошла ошибка' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Новый пароль должен содержать минимум 6 символов' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Пароли не совпадают' })
      return
    }

    setPasswordLoading(true)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: newPassword,
          displayName: profile?.displayName || '',
          currentPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPasswordMessage({ type: 'error', text: data.error || 'Ошибка обновления' })
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({ type: 'success', text: 'Пароль обновлен' })
    } catch {
      setPasswordMessage({ type: 'error', text: 'Произошла ошибка' })
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Настройки</h1>
        <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Загрузка...
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Настройки</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error || 'Не удалось загрузить профиль'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-foreground">Настройки</h1>

      {/* Информация о профиле */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">
          Роль: {profile.role === 'superadmin' ? 'Суперадмин' : 'Админ'} · ID: {profile.id}
        </div>
      </div>

      {/* Отображаемое имя */}
      <form onSubmit={handleNameSubmit} className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Отображаемое имя</h2>

        <StatusMessage message={nameMessage} />

        <div className="space-y-1">
          <label htmlFor="displayName" className="text-xs font-medium text-muted-foreground">
            Имя
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Как вас отображать в системе"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={nameLoading}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nameLoading ? 'Сохранение...' : 'Сохранить имя'}
        </button>
      </form>

      {/* Изменение email */}
      <form onSubmit={handleEmailSubmit} className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Email</h2>

        <StatusMessage message={emailMessage} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Новый email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="emailPassword" className="text-xs font-medium text-muted-foreground">
              Текущий пароль
            </label>
            <input
              id="emailPassword"
              type="password"
              value={emailCurrentPassword}
              onChange={(e) => setEmailCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Для подтверждения"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={emailLoading}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {emailLoading ? 'Сохранение...' : 'Обновить email'}
        </button>
      </form>

      {/* Изменение пароля */}
      <form onSubmit={handlePasswordSubmit} className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Пароль</h2>

        <StatusMessage message={passwordMessage} />

        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="currentPassword" className="text-xs font-medium text-muted-foreground">
              Текущий пароль
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="newPassword" className="text-xs font-medium text-muted-foreground">
                Новый пароль
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Минимум 6 символов"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">
                Повторите пароль
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Повторите новый пароль"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={passwordLoading}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {passwordLoading ? 'Сохранение...' : 'Обновить пароль'}
        </button>
      </form>
    </div>
  )
}

function StatusMessage({ message }: { message: { type: 'success' | 'error'; text: string } | null }) {
  if (!message) return null

  return (
    <div className={cn(
      'rounded-xl border p-3 text-sm',
      message.type === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : 'border-destructive/30 bg-destructive/5 text-destructive'
    )}>
      {message.text}
    </div>
  )
}
