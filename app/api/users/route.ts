import { NextResponse } from "next/server"
import { listUserSummaries } from "@/lib/user-store"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function GET() {
  try {
    // Проверяем авторизацию — только для админов
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const users = await listUserSummaries()
    return NextResponse.json({ users })
  } catch (error) {
    console.error("Failed to load users:", error)
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
  }
}
