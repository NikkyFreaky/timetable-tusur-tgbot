import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { EmployeeAttendanceType } from '@/lib/employee-availability'

export type EmployeeAvailabilityRecipientKind = 'user' | 'chat'
export type { EmployeeAttendanceType } from '@/lib/employee-availability'

export interface EmployeeAvailabilityPerson {
  id: string
  fullName: string
  facultySlug: string
  facultyName: string
  groupSlug: string
  groupName: string
  course: number
  attendanceType: EmployeeAttendanceType
  sortOrder: number
}

export interface EmployeeAvailabilityConfig {
  id: string
  recipientKind: EmployeeAvailabilityRecipientKind
  recipientId: number
  topicId: number | null
  enabled: boolean
  notificationTime: string
  workdayStart: string
  workdayEnd: string
  lunchStart: string
  lunchEnd: string
  people: EmployeeAvailabilityPerson[]
}

type ConfigRow = {
  id: string
  recipient_kind: EmployeeAvailabilityRecipientKind
  recipient_id: number
  topic_id: number | null
  enabled: boolean
  notification_time: string
  workday_start: string
  workday_end: string
  lunch_start: string
  lunch_end: string
  employee_availability_people?: Array<{
    id: string
    full_name: string
    faculty_slug: string
    faculty_name: string
    group_slug: string
    group_name: string
    course: number
    attendance_type: EmployeeAttendanceType
    sort_order: number
  }>
}

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
}

function mapConfig(row: ConfigRow): EmployeeAvailabilityConfig {
  return {
    id: row.id,
    recipientKind: row.recipient_kind,
    recipientId: row.recipient_id,
    topicId: row.topic_id,
    enabled: row.enabled,
    notificationTime: row.notification_time,
    workdayStart: row.workday_start,
    workdayEnd: row.workday_end,
    lunchStart: row.lunch_start,
    lunchEnd: row.lunch_end,
    people: (row.employee_availability_people ?? []).map((person) => ({
      id: person.id,
      fullName: person.full_name,
      facultySlug: person.faculty_slug,
      facultyName: person.faculty_name,
      groupSlug: person.group_slug,
      groupName: person.group_name,
      course: person.course,
      attendanceType: person.attendance_type,
      sortOrder: person.sort_order,
    })).sort((left, right) => left.sortOrder - right.sortOrder),
  }
}

export async function hasEmployeeAvailabilityAccess(userId: number): Promise<boolean> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('employee_availability_access')
    .select('telegram_user_id')
    .eq('telegram_user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`Failed to check employee availability access: ${error.message}`)
  return Boolean(data)
}

export async function listEmployeeAvailabilityAccess() {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('employee_availability_access')
    .select('telegram_user_id, is_active, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to load employee availability access: ${error.message}`)
  return (data ?? []).map((item: any) => ({
    telegramUserId: item.telegram_user_id as number,
    isActive: item.is_active as boolean,
    createdAt: item.created_at as string,
    updatedAt: item.updated_at as string,
  }))
}

export async function setEmployeeAvailabilityAccess(
  telegramUserId: number,
  isActive: boolean,
  grantedBy: string
) {
  const supabase = getServiceClient()
  const { error } = await supabase.from('employee_availability_access').upsert({
    telegram_user_id: telegramUserId,
    is_active: isActive,
    granted_by: grantedBy,
  })

  if (error) throw new Error(`Failed to update employee availability access: ${error.message}`)
}

export async function getEmployeeAvailabilityConfig(
  recipientKind: EmployeeAvailabilityRecipientKind,
  recipientId: number
): Promise<EmployeeAvailabilityConfig | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('employee_availability_configs')
    .select('*, employee_availability_people(*)')
    .eq('recipient_kind', recipientKind)
    .eq('recipient_id', recipientId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load employee availability config: ${error.message}`)
  return data ? mapConfig(data as ConfigRow) : null
}

export async function saveEmployeeAvailabilityConfig(input: {
  recipientKind: EmployeeAvailabilityRecipientKind
  recipientId: number
  topicId: number | null
  enabled: boolean
  notificationTime: string
  workdayStart: string
  workdayEnd: string
  lunchStart: string
  lunchEnd: string
  updatedBy: number
}): Promise<EmployeeAvailabilityConfig> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('employee_availability_configs')
    .upsert(
      {
        recipient_kind: input.recipientKind,
        recipient_id: input.recipientId,
        topic_id: input.topicId,
        enabled: input.enabled,
        notification_time: input.notificationTime,
        workday_start: input.workdayStart,
        workday_end: input.workdayEnd,
        lunch_start: input.lunchStart,
        lunch_end: input.lunchEnd,
        created_by: input.updatedBy,
        updated_by: input.updatedBy,
      },
      { onConflict: 'recipient_kind,recipient_id' }
    )
    .select('*, employee_availability_people(*)')
    .single()

  if (error || !data) throw new Error(`Failed to save employee availability config: ${error?.message}`)
  return mapConfig(data as ConfigRow)
}

export async function addEmployeeAvailabilityPerson(input: {
  configId: string
  fullName: string
  facultySlug: string
  facultyName: string
  groupSlug: string
  groupName: string
  course: number
  attendanceType: EmployeeAttendanceType
  sortOrder: number
}) {
  const supabase = getServiceClient()
  const { error } = await supabase.from('employee_availability_people').insert({
    config_id: input.configId,
    full_name: input.fullName,
    faculty_slug: input.facultySlug,
    faculty_name: input.facultyName,
    group_slug: input.groupSlug,
    group_name: input.groupName,
    course: input.course,
    attendance_type: input.attendanceType,
    sort_order: input.sortOrder,
  })

  if (error) throw new Error(`Failed to add employee availability person: ${error.message}`)
}

export async function updateEmployeeAvailabilityPerson(input: {
  configId: string
  personId: string
  fullName: string
  facultySlug: string
  facultyName: string
  groupSlug: string
  groupName: string
  course: number
  attendanceType: EmployeeAttendanceType
}) {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('employee_availability_people')
    .update({
      full_name: input.fullName,
      faculty_slug: input.facultySlug,
      faculty_name: input.facultyName,
      group_slug: input.groupSlug,
      group_name: input.groupName,
      course: input.course,
      attendance_type: input.attendanceType,
    })
    .eq('id', input.personId)
    .eq('config_id', input.configId)

  if (error) throw new Error(`Failed to update employee availability person: ${error.message}`)
}

export async function reorderEmployeeAvailabilityPeople(configId: string, personIds: string[]) {
  const supabase = getServiceClient()
  const results = await Promise.all(personIds.map((personId, sortOrder) => supabase
    .from('employee_availability_people')
    .update({ sort_order: sortOrder })
    .eq('id', personId)
    .eq('config_id', configId)
  ))
  const error = results.find((result) => result.error)?.error
  if (error) throw new Error(`Failed to reorder employee availability people: ${error.message}`)
}

export async function deleteEmployeeAvailabilityPerson(configId: string, personId: string) {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('employee_availability_people')
    .delete()
    .eq('id', personId)
    .eq('config_id', configId)

  if (error) throw new Error(`Failed to delete employee availability person: ${error.message}`)
}

export async function listEnabledEmployeeAvailabilityConfigs(): Promise<EmployeeAvailabilityConfig[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('employee_availability_configs')
    .select('*, employee_availability_people(*)')
    .eq('enabled', true)

  if (error) throw new Error(`Failed to load enabled employee availability configs: ${error.message}`)

  const configs = (data ?? []).map((row) => mapConfig(row as ConfigRow))
  const privateRecipientIds = configs
    .filter((config) => config.recipientKind === 'user')
    .map((config) => config.recipientId)

  if (privateRecipientIds.length === 0) return configs

  const { data: activeAccess, error: accessError } = await supabase
    .from('employee_availability_access')
    .select('telegram_user_id')
    .in('telegram_user_id', privateRecipientIds)
    .eq('is_active', true)

  if (accessError) throw new Error(`Failed to load active employee availability access: ${accessError.message}`)
  const activeUsers = new Set((activeAccess ?? []).map((item: any) => item.telegram_user_id as number))
  return configs.filter((config) => config.recipientKind === 'chat' || activeUsers.has(config.recipientId))
}

export async function isEmployeeAvailabilityRecipientActive(
  recipientKind: EmployeeAvailabilityRecipientKind,
  recipientId: number
): Promise<boolean> {
  const supabase = getServiceClient()
  const table = recipientKind === 'user' ? 'users' : 'chats'
  const { data, error } = await supabase.from(table).select('bot_active').eq('id', recipientId).maybeSingle()
  if (error) throw new Error(`Failed to check employee availability recipient: ${error.message}`)
  return Boolean(data?.bot_active)
}
