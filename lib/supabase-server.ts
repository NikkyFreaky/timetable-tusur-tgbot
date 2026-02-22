import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll может вызываться из Server Component,
            // где запись cookie невозможна — это нормально
          }
        },
      },
    }
  )
}

export async function getAdminUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: admin } = await supabase
    .from('admins')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!admin) return null

  return {
    ...user,
    admin: {
      id: admin.id as string,
      email: admin.email as string,
      displayName: admin.display_name as string,
      role: admin.role as 'admin' | 'superadmin',
      createdAt: admin.created_at as string,
    },
  }
}
