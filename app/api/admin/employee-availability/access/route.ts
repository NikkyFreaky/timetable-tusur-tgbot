import { NextResponse } from 'next/server'
import {
  listEmployeeAvailabilityAccess,
  setEmployeeAvailabilityAccess,
} from '@/lib/employee-availability-store'
import { getAdminUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET() {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return NextResponse.json({ access: await listEmployeeAvailabilityAccess() })
  } catch (error) {
    console.error('Failed to load employee availability access:', error)
    return NextResponse.json({ error: 'Не удалось загрузить доступы' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const adminUser = await getAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null) as {
      telegramUserId?: unknown
      isActive?: unknown
    } | null
    const telegramUserId = Number(body?.telegramUserId)
    if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0 || typeof body?.isActive !== 'boolean') {
      return NextResponse.json({ error: 'Укажите корректный Telegram ID и статус доступа' }, { status: 400 })
    }

    await setEmployeeAvailabilityAccess(telegramUserId, body.isActive, adminUser.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to update employee availability access:', error)
    return NextResponse.json({ error: 'Не удалось обновить доступ' }, { status: 500 })
  }
}
