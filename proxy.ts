import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from '@/lib/supabase-middleware'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Пропускаем страницу логина и API auth
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/api/admin/auth')
  ) {
    const { response } = await createSupabaseMiddlewareClient(request)
    return response
  }

  // Защищаем все /admin/* маршруты и /api/admin/* маршруты
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const { supabase, response } = await createSupabaseMiddlewareClient(request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Проверяем, что пользователь есть в таблице admins
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!admin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden: not an admin' },
          { status: 403 }
        )
      }
      // Пользователь аутентифицирован, но не админ — выход и редирект
      await supabase.auth.signOut()
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('error', 'not_admin')
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  // Редирект /list -> /admin/users
  if (pathname === '/list') {
    return NextResponse.redirect(new URL('/admin/users', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/list',
  ],
}
