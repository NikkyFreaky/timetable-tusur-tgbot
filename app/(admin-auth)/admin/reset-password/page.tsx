'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function AdminResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [validRecovery, setValidRecovery] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const initRecoverySession = async () => {
      try {
        const supabase = createSupabaseBrowserClient()

        // Method 1: token_hash in query params (from custom email template)
        const urlParams = new URLSearchParams(window.location.search)
        const tokenHash = urlParams.get('token_hash')
        const queryType = urlParams.get('type')

        if (tokenHash && queryType === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })

          if (verifyError) {
            if (!cancelled) setError('Ссылка для восстановления недействительна или устарела')
            return
          }

          window.history.replaceState(null, '', window.location.pathname)

          if (!cancelled) {
            setValidRecovery(true)
          }
          return
        }

        // Method 2: access_token in hash fragment (from default Supabase template)
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const hashType = hashParams.get('type')

        if (accessToken && refreshToken && hashType === 'recovery') {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (setSessionError) {
            if (!cancelled) setError('Ссылка для восстановления недействительна или устарела')
            return
          }

          window.history.replaceState(null, '', window.location.pathname)

          if (!cancelled) {
            setValidRecovery(true)
          }
          return
        }

        // No recovery tokens found — check if already has a session
        const { data: { user } } = await supabase.auth.getUser()

        if (!cancelled) {
          setValidRecovery(Boolean(user))
          if (!user) {
            setError('Ссылка для восстановления недействительна или устарела')
          }
        }
      } catch {
        if (!cancelled) {
          setError('Не удалось проверить ссылку восстановления')
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    initRecoverySession()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      return
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      await supabase.auth.signOut()
      setSuccess('Пароль успешно изменен. Сейчас вы будете перенаправлены на вход.')

      setTimeout(() => {
        router.push('/admin/login?reset=success')
      }, 1200)
    } catch {
      setError('Не удалось обновить пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Новый пароль</h1>
          <p className="text-sm text-muted-foreground">Админ-панель расписания ТУСУР</p>
        </div>

        {checking ? (
          <div className="text-center text-sm text-muted-foreground py-4">Проверка ссылки...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Новый пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                required
                minLength={6}
                autoComplete="new-password"
                disabled={!validRecovery || loading}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Повторите пароль
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                required
                minLength={6}
                autoComplete="new-password"
                disabled={!validRecovery || loading}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={!validRecovery || loading}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/admin/login')}
              className="w-full text-sm text-muted-foreground transition hover:text-foreground"
            >
              Вернуться ко входу
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
