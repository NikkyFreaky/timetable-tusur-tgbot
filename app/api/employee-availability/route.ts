import { NextResponse } from 'next/server'
import {
  addEmployeeAvailabilityPerson,
  deleteEmployeeAvailabilityPerson,
  getEmployeeAvailabilityConfig,
  hasEmployeeAvailabilityAccess,
  reorderEmployeeAvailabilityPeople,
  saveEmployeeAvailabilityConfig,
  updateEmployeeAvailabilityPerson,
} from '@/lib/employee-availability-store'
import { getChatById, listChatTopics } from '@/lib/chat-store'
import { limitTelegramMutation, requireTelegramInitData } from '@/lib/telegram-auth'
import type { EmployeeAttendanceType } from '@/lib/employee-availability-store'
import { verifyChatAdmin } from '@/lib/chat-access'

export const runtime = 'nodejs'

type Target = {
  kind: 'user' | 'chat'
  id: number
  isForum: boolean
}

async function getTarget(request: Request): Promise<Target | NextResponse> {
  const auth = requireTelegramInitData(request)
  if ('response' in auth) return auth.response
  const rateLimit = limitTelegramMutation(request, auth.data.user.id)
  if (rateLimit) return rateLimit

  if (!await hasEmployeeAvailabilityAccess(auth.data.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const chatIdValue = url.searchParams.get('chatId')
  if (!chatIdValue) return { kind: 'user', id: auth.data.user.id, isForum: false }

  const chatId = Number(chatIdValue)
  if (!Number.isSafeInteger(chatId)) {
    return NextResponse.json({ error: 'Invalid chat id' }, { status: 400 })
  }

  const [chat, access] = await Promise.all([
    getChatById(chatId),
    verifyChatAdmin(chatId, auth.data.user.id),
  ])
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  if (access === 'unavailable') {
    return NextResponse.json({ error: 'Unable to verify chat permissions' }, { status: 503 })
  }
  if (access !== 'authorized') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return { kind: 'chat', id: chatId, isForum: chat.isForum }
}

const isTargetResponse = (value: Target | NextResponse): value is NextResponse => value instanceof NextResponse

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)
}

function isEmployeeAttendanceType(value: unknown): value is EmployeeAttendanceType {
  return value === 'gpo' || value === 'upd'
}

export async function GET(request: Request) {
  try {
    const target = await getTarget(request)
    if (isTargetResponse(target)) return target
    const config = await getEmployeeAvailabilityConfig(target.kind, target.id)
    return NextResponse.json({ config })
  } catch (error) {
    console.error('Failed to load employee availability config:', error)
    return NextResponse.json({ error: 'Не удалось загрузить настройку сводки' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = requireTelegramInitData(request)
    if ('response' in auth) return auth.response
    const target = await getTarget(request)
    if (isTargetResponse(target)) return target

    const body = await request.json().catch(() => null) as {
      enabled?: unknown
      notificationTime?: unknown
      workdayStart?: unknown
      workdayEnd?: unknown
      lunchStart?: unknown
      lunchEnd?: unknown
      topicId?: unknown
    } | null
    const existing = await getEmployeeAvailabilityConfig(target.kind, target.id)
    const enabled = typeof body?.enabled === 'boolean' ? body.enabled : existing?.enabled ?? false
    const notificationTime = body?.notificationTime ?? existing?.notificationTime ?? '09:00'
    const workdayStart = body?.workdayStart ?? existing?.workdayStart ?? '09:00'
    const workdayEnd = body?.workdayEnd ?? existing?.workdayEnd ?? '18:00'
    const lunchStart = body?.lunchStart ?? existing?.lunchStart ?? '13:00'
    const lunchEnd = body?.lunchEnd ?? existing?.lunchEnd ?? '14:00'
    const rawTopicId = body?.topicId === undefined ? existing?.topicId ?? null : body.topicId

    if (!isTime(notificationTime)) {
      return NextResponse.json({ error: 'Некорректное время отправки' }, { status: 400 })
    }
    if (!isTime(workdayStart) || !isTime(workdayEnd) || !isTime(lunchStart) || !isTime(lunchEnd)) {
      return NextResponse.json({ error: 'Некорректное время рабочего дня или обеда' }, { status: 400 })
    }
    if (workdayStart >= workdayEnd || lunchStart >= lunchEnd
      || lunchStart < workdayStart || lunchEnd > workdayEnd) {
      return NextResponse.json({ error: 'Обед должен находиться в пределах рабочего дня' }, { status: 400 })
    }

    let topicId: number | null = null
    if (target.kind === 'chat' && rawTopicId !== null && rawTopicId !== undefined) {
      topicId = Number(rawTopicId)
      if (!Number.isSafeInteger(topicId) || !target.isForum) {
        return NextResponse.json({ error: 'Некорректная тема форума' }, { status: 400 })
      }
      const topics = await listChatTopics(target.id)
      if (!topics.some((topic) => topic.id === topicId)) {
        return NextResponse.json({ error: 'Тема не найдена' }, { status: 404 })
      }
    }

    const config = await saveEmployeeAvailabilityConfig({
      recipientKind: target.kind,
      recipientId: target.id,
      topicId,
      enabled,
      notificationTime,
      workdayStart,
      workdayEnd,
      lunchStart,
      lunchEnd,
      updatedBy: auth.data.user.id,
    })
    return NextResponse.json({ config })
  } catch (error) {
    console.error('Failed to save employee availability config:', error)
    return NextResponse.json({ error: 'Не удалось сохранить настройку сводки' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const target = await getTarget(request)
    if (isTargetResponse(target)) return target
    const config = await getEmployeeAvailabilityConfig(target.kind, target.id)
    if (!config) return NextResponse.json({ error: 'Сначала сохраните настройку сводки' }, { status: 400 })

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
    const facultySlug = typeof body?.facultySlug === 'string' ? body.facultySlug : ''
    const facultyName = typeof body?.facultyName === 'string' ? body.facultyName : ''
    const groupSlug = typeof body?.groupSlug === 'string' ? body.groupSlug : ''
    const groupName = typeof body?.groupName === 'string' ? body.groupName : ''
    const course = Number(body?.course)
    const attendanceType = body?.attendanceType ?? 'gpo'
    if (!fullName || fullName.length > 200 || !facultySlug || !facultyName || !groupSlug || !groupName || !Number.isInteger(course) || course <= 0 || !isEmployeeAttendanceType(attendanceType)) {
      return NextResponse.json({ error: 'Укажите ФИО и группу сотрудника' }, { status: 400 })
    }

    await addEmployeeAvailabilityPerson({
      configId: config.id,
      fullName,
      facultySlug,
      facultyName,
      groupSlug,
      groupName,
      course,
      attendanceType,
      sortOrder: Math.max(-1, ...config.people.map((person) => person.sortOrder)) + 1,
    })
    return NextResponse.json({ config: await getEmployeeAvailabilityConfig(target.kind, target.id) })
  } catch (error) {
    console.error('Failed to add employee availability person:', error)
    return NextResponse.json({ error: 'Не удалось добавить сотрудника' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const target = await getTarget(request)
    if (isTargetResponse(target)) return target
    const config = await getEmployeeAvailabilityConfig(target.kind, target.id)
    if (!config) return NextResponse.json({ error: 'Список сотрудников не найден' }, { status: 404 })

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const personId = typeof body?.personId === 'string' ? body.personId : null
    if (personId) {
      if (!config.people.some((person) => person.id === personId)) {
        return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 })
      }

      const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
      const facultySlug = typeof body?.facultySlug === 'string' ? body.facultySlug : ''
      const facultyName = typeof body?.facultyName === 'string' ? body.facultyName : ''
      const groupSlug = typeof body?.groupSlug === 'string' ? body.groupSlug : ''
      const groupName = typeof body?.groupName === 'string' ? body.groupName : ''
      const course = Number(body?.course)
      const attendanceType = body?.attendanceType
      if (!fullName || fullName.length > 200 || !facultySlug || !facultyName || !groupSlug || !groupName || !Number.isInteger(course) || course <= 0 || !isEmployeeAttendanceType(attendanceType)) {
        return NextResponse.json({ error: 'Укажите ФИО и группу сотрудника' }, { status: 400 })
      }

      await updateEmployeeAvailabilityPerson({
        configId: config.id,
        personId,
        fullName,
        facultySlug,
        facultyName,
        groupSlug,
        groupName,
        course,
        attendanceType,
      })
      return NextResponse.json({ config: await getEmployeeAvailabilityConfig(target.kind, target.id) })
    }

    const personIds = Array.isArray(body?.personIds) ? body.personIds : []
    if (
      personIds.length !== config.people.length
      || !personIds.every((personId): personId is string => typeof personId === 'string')
      || new Set(personIds).size !== personIds.length
      || !config.people.every((person) => personIds.includes(person.id))
    ) {
      return NextResponse.json({ error: 'Некорректный порядок сотрудников' }, { status: 400 })
    }

    await reorderEmployeeAvailabilityPeople(config.id, personIds)
    return NextResponse.json({ config: await getEmployeeAvailabilityConfig(target.kind, target.id) })
  } catch (error) {
    console.error('Failed to reorder employee availability people:', error)
    return NextResponse.json({ error: 'Не удалось изменить порядок сотрудников' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const target = await getTarget(request)
    if (isTargetResponse(target)) return target
    const config = await getEmployeeAvailabilityConfig(target.kind, target.id)
    const personId = new URL(request.url).searchParams.get('personId')
    if (!config || !personId) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 })

    await deleteEmployeeAvailabilityPerson(config.id, personId)
    return NextResponse.json({ config: await getEmployeeAvailabilityConfig(target.kind, target.id) })
  } catch (error) {
    console.error('Failed to delete employee availability person:', error)
    return NextResponse.json({ error: 'Не удалось удалить сотрудника' }, { status: 500 })
  }
}
