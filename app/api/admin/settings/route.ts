import { NextResponse } from 'next/server'
import { getAdminUser, createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// GET /api/admin/settings — текущий профиль
export async function GET() {
  try {
    const adminUser = await getAdminUser()

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      id: adminUser.id,
      email: adminUser.email,
      displayName: adminUser.admin.displayName,
      role: adminUser.admin.role,
    })
  } catch (error) {
    console.error('Failed to load admin settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/settings — обновление профиля
export async function PATCH(request: Request) {
  try {
    const adminUser = await getAdminUser()

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { displayName, email, password, currentPassword } = body as {
      displayName?: string
      email?: string
      password?: string
      currentPassword?: string
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY не настроен на сервере' },
        { status: 500 }
      )
    }

    // Обновление display_name в таблице admins
    if (displayName !== undefined) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { error: updateError } = await supabaseAdmin
        .from('admins')
        .update({ display_name: displayName })
        .eq('id', adminUser.id)

      if (updateError) {
        console.error('Failed to update display name:', updateError)
        return NextResponse.json(
          { error: 'Не удалось обновить имя' },
          { status: 500 }
        )
      }

      // Также обновляем email в admins если он меняется
      if (email && email !== adminUser.email) {
        const { error: emailUpdateError } = await supabaseAdmin
          .from('admins')
          .update({ email })
          .eq('id', adminUser.id)

        if (emailUpdateError) {
          console.error('Failed to update admin email:', emailUpdateError)
        }
      }
    }

    // Обновление email/password через Supabase Auth
    if (email || password) {
      if ((email || password) && !currentPassword) {
        return NextResponse.json(
          { error: 'Для изменения email или пароля введите текущий пароль' },
          { status: 400 }
        )
      }

      // Верифицируем текущий пароль
      const supabase = await createSupabaseServerClient()
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: adminUser.email!,
        password: currentPassword!,
      })

      if (verifyError) {
        return NextResponse.json(
          { error: 'Неверный текущий пароль' },
          { status: 403 }
        )
      }

      // Обновляем через service role (надежнее)
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const authUpdates: { email?: string; password?: string } = {}
      if (email && email !== adminUser.email) authUpdates.email = email
      if (password) {
        if (password.length < 6) {
          return NextResponse.json(
            { error: 'Пароль должен содержать минимум 6 символов' },
            { status: 400 }
          )
        }
        authUpdates.password = password
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          adminUser.id,
          authUpdates
        )

        if (authUpdateError) {
          console.error('Failed to update auth user:', authUpdateError)
          return NextResponse.json(
            { error: 'Не удалось обновить учетные данные' },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update admin settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
