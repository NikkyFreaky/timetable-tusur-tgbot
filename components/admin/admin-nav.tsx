'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'

interface AdminNavProps {
  email: string
  displayName: string
  role: 'admin' | 'superadmin'
}

const navItems = [
  { href: '/admin', label: 'Дашборд' },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/admins', label: 'Администраторы' },
  { href: '/admin/settings', label: 'Настройки' },
]

export function AdminNav({ email, displayName, role }: AdminNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-sm font-semibold text-foreground"
            >
              Админ-панель
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm transition',
                    isActive(item.href)
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-foreground">
                {displayName || email}
              </div>
              <div className="text-xs text-muted-foreground">
                {role === 'superadmin' ? 'Суперадмин' : 'Админ'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground hover:border-foreground/20"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
