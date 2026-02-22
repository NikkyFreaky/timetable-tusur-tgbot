import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// GET /api/admin/auth — проверка текущей сессии
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!admin) {
      return NextResponse.json(
        { authenticated: false, error: 'Not an admin' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name,
        role: admin.role,
      },
    })
  } catch (error) {
    console.error('Admin auth check failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/auth — выход
export async function DELETE() {
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin signout failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
