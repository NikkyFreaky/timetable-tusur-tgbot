import { NextResponse } from "next/server"
import { getUserById } from "@/lib/user-store"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

type Params = { id: string }

export async function GET(
  _request: Request,
  context: { params: Promise<Params> | Params }
) {
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

    const { id } = await context.params
    const userId = Number(id)

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }

    const dbUser = await getUserById(userId)
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user: dbUser })
  } catch (error) {
    console.error("Failed to load user:", error)
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
  }
}
