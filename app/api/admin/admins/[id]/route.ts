import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// DELETE /api/admin/admins/[id] — удаление админа
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const adminUser = await getAdminUser()

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (adminUser.admin.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Только суперадмин может удалять администраторов' },
        { status: 403 }
      )
    }

    if (id === adminUser.id) {
      return NextResponse.json(
        { error: 'Нельзя удалить самого себя' },
        { status: 400 }
      )
    }

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

    // Удаляем запись из admins (каскадно удалится через FK)
    const { error: deleteAdminError } = await supabaseAdmin
      .from('admins')
      .delete()
      .eq('id', id)

    if (deleteAdminError) {
      console.error('Failed to delete admin record:', deleteAdminError)
      return NextResponse.json(
        { error: 'Не удалось удалить администратора' },
        { status: 500 }
      )
    }

    // Удаляем auth пользователя
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError)
      // Не критично — запись из admins уже удалена
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/admins/[id] — обновление роли админа
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const adminUser = await getAdminUser()

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (adminUser.admin.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Только суперадмин может менять роли' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { role, displayName } = body as {
      role?: string
      displayName?: string
    }

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

    const updates: Record<string, unknown> = {}
    if (role && (role === 'admin' || role === 'superadmin')) {
      updates.role = role
    }
    if (displayName !== undefined) {
      updates.display_name = displayName
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Нет данных для обновления' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('admins')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Failed to update admin:', error)
      return NextResponse.json(
        { error: 'Не удалось обновить администратора' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
