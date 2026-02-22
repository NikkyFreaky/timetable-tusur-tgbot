'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(
    searchParams.get('reset') === 'success'
      ? 'Пароль обновлен. Войдите с новым паролем.'
      : null
  )
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'not_admin'
      ? 'Этот аккаунт не является администратором'
      : null
  )
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setResetMessage(null)
    setLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Неверный email или пароль'
            : authError.message
        )
        return
      }

      const next = searchParams.get('next') || '/admin'
      router.push(next)
      router.refresh()
    } catch {
      setError('Произошла ошибка. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    setError(null)
    setResetMessage(null)

    if (!email.trim()) {
      setError('Введите email, затем нажмите сброс пароля')
      return
    }

    setResetLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectTo = `${window.location.origin}/admin/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      )

      if (resetError) {
        setError(resetError.message)
        return
      }

      setResetMessage('Письмо для сброса пароля отправлено на указанный email')
    } catch {
      setError('Не удалось отправить письмо для сброса пароля')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {resetMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {resetMessage}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground"
        >
          Пароль
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Вход...' : 'Войти'}
      </button>

      <button
        type="button"
        onClick={handlePasswordReset}
        disabled={resetLoading}
        className="w-full text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {resetLoading ? 'Отправка...' : 'Забыли пароль?'}
      </button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Админ-панель
          </h1>
          <p className="text-sm text-muted-foreground">
            Расписание ТУСУР
          </p>
        </div>

        <Suspense fallback={
          <div className="text-center text-sm text-muted-foreground py-4">
            Загрузка...
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
