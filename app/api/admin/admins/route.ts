import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAdminUser } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// GET /api/admin/admins — список всех админов
export async function GET() {
  try {
    const adminUser = await getAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: admins, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to list admins:', error)
      return NextResponse.json({ error: 'Failed to list admins' }, { status: 500 })
    }

    return NextResponse.json({
      admins: admins.map((a: any) => ({
        id: a.id,
        email: a.email,
        displayName: a.display_name,
        role: a.role,
        createdAt: a.created_at,
      })),
      currentRole: adminUser.admin.role,
    })
  } catch (error) {
    console.error('Failed to list admins:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/admins — добавление нового админа
export async function POST(request: Request) {
  try {
    const adminUser = await getAdminUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (adminUser.admin.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Только суперадмин может добавлять администраторов' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, displayName, role } = body as {
      email?: string
      password?: string
      displayName?: string
      role?: string
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен содержать минимум 6 символов' },
        { status: 400 }
      )
    }

    const adminRole = role === 'superadmin' ? 'superadmin' : 'admin'

    // Используем service role key для создания пользователя через Supabase Admin API
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY не настроен на сервере' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Создаём пользователя в Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Failed to create auth user:', authError)
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Пользователь с таким email уже существует' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Не удалось создать пользователя' },
        { status: 500 }
      )
    }

    // Добавляем запись в таблицу admins
    const { error: insertError } = await supabaseAdmin
      .from('admins')
      .insert({
        id: authData.user.id,
        email,
        display_name: displayName || '',
        role: adminRole,
        created_by: adminUser.id,
      })

    if (insertError) {
      console.error('Failed to insert admin record:', insertError)
      // Откатываем — удаляем auth пользователя
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Не удалось создать запись администратора' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      admin: {
        id: authData.user.id,
        email,
        displayName: displayName || '',
        role: adminRole,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to create admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
