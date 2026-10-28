'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Bot, MessageSquare, Menu, Settings, ShieldCheck, Users, UsersRound } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface AdminNavProps {
  email: string
  displayName: string
  role: 'admin' | 'superadmin'
}

const navItems = [
  { href: '/admin', label: 'Дашборд', icon: BarChart3 },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/chats', label: 'Чаты', icon: MessageSquare },
  { href: '/admin/bot', label: 'Сообщения', icon: Bot },
  { href: '/admin/employee-availability', label: 'Сводки', icon: UsersRound },
  { href: '/admin/admins', label: 'Администраторы', icon: ShieldCheck },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
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
        <div className="flex min-h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 xl:gap-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 xl:hidden"
                  aria-label="Открыть навигацию"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(20rem,calc(100%-2rem))] p-0">
                <SheetHeader className="border-b">
                  <SheetTitle>Админ-панель</SheetTitle>
                  <SheetDescription>Разделы управления сервисом</SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col gap-1 p-3" aria-label="Навигация админ-панели">
                  {navItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive(item.href) ? 'page' : undefined}
                          className={cn(
                            'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isActive(item.href)
                              ? 'bg-accent font-medium text-accent-foreground'
                              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {item.label}
                        </Link>
                      </SheetClose>
                    )
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            <Link
              href="/admin"
              className="truncate text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Админ-панель
            </Link>
            <nav className="hidden items-center gap-1 xl:flex" aria-label="Навигация админ-панели">
              {navItems.map((item) => {
                const Icon = item.icon

                return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive(item.href)
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
                )
              })}
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
              className="min-h-11 rounded-lg border border-border px-3 text-xs text-muted-foreground transition hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
