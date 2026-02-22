'use client'

import { useEffect, useState } from 'react'

type Admin = {
  id: string
  email: string
  displayName: string
  role: 'admin' | 'superadmin'
  createdAt: string
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [currentRole, setCurrentRole] = useState<string>('admin')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Форма добавления
  const [showForm, setShowForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState<'admin' | 'superadmin'>('admin')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isSuperadmin = currentRole === 'superadmin'

  const loadAdmins = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/admins')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setAdmins(data.admins)
      setCurrentRole(data.currentRole)
    } catch {
      setError('Не удалось загрузить список администраторов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormLoading(true)

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail,
          password: formPassword,
          displayName: formName,
          role: formRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setFormError(data.error || 'Ошибка создания')
        return
      }

      setFormEmail('')
      setFormPassword('')
      setFormName('')
      setFormRole('admin')
      setShowForm(false)
      await loadAdmins()
    } catch {
      setFormError('Произошла ошибка')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (admin: Admin) => {
    if (!confirm(`Удалить администратора ${admin.email}?`)) return

    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Ошибка удаления')
        return
      }

      await loadAdmins()
    } catch {
      alert('Произошла ошибка при удалении')
    }
  }

  const handleToggleRole = async (admin: Admin) => {
    const newRole = admin.role === 'superadmin' ? 'admin' : 'superadmin'
    if (!confirm(`Изменить роль ${admin.email} на "${newRole === 'superadmin' ? 'Суперадмин' : 'Админ'}"?`)) return

    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Ошибка обновления')
        return
      }

      await loadAdmins()
    } catch {
      alert('Произошла ошибка при обновлении')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Администраторы</h1>
        <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Загрузка...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Администраторы</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Администраторы</h1>
        {isSuperadmin && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            {showForm ? 'Отмена' : 'Добавить'}
          </button>
        )}
      </div>

      {showForm && isSuperadmin && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-border bg-card p-4 space-y-4"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Новый администратор
          </h2>

          {formError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-password">
                Пароль
              </label>
              <input
                id="admin-password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Минимум 6 символов"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-name">
                Отображаемое имя
              </label>
              <input
                id="admin-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Необязательно"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-role">
                Роль
              </label>
              <select
                id="admin-role"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as 'admin' | 'superadmin')}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="admin">Админ</option>
                <option value="superadmin">Суперадмин</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={formLoading}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formLoading ? 'Создание...' : 'Создать администратора'}
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {admin.displayName || admin.email}
                  </span>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    admin.role === 'superadmin'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {admin.role === 'superadmin' ? 'Суперадмин' : 'Админ'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {admin.email} · Добавлен: {formatDateTime(admin.createdAt)}
                </div>
              </div>

              {isSuperadmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleRole(admin)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground hover:border-foreground/20"
                  >
                    {admin.role === 'superadmin' ? 'Понизить' : 'Повысить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(admin)}
                    className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/5"
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}

          {admins.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Нет администраторов
            </div>
          )}
        </div>
      </div>

      {!isSuperadmin && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
          Управление администраторами доступно только суперадминам.
        </div>
      )}
    </div>
  )
}
