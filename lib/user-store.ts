import { createClient } from "@supabase/supabase-js"
import type { UserSettings } from "@/lib/schedule-types"
import type { NotificationState } from "@/lib/notification-state"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type TelegramUserProfile = {
  id: number
  is_bot?: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  added_to_attachment_menu?: boolean
  allows_write_to_pm?: boolean
  photo_url?: string
}

export type UserLoginEvent = {
  at: string
  deviceId: string | null
  ip: string | null
}

export type UserChangeEntry = {
  field: string
  before: string | null
  after: string | null
}

export type UserChangeEvent = {
  at: string
  type: "profile" | "settings"
  changes: UserChangeEntry[]
}

export type TelegramClientInfo = {
  deviceId?: string | null
  tgPlatform: string | null
  tgVersion: string | null
  userAgent: string | null
  platform: string | null
  language: string | null
  timezone: string | null
}

export type UserDevice = {
  id: string
  label: string
  tgPlatform: string | null
  tgVersion: string | null
  userAgent: string | null
  platform: string | null
  language: string | null
  timezone: string | null
  firstSeenAt: string
  lastSeenAt: string
  settings: UserSettings | null
}

export type StoredUser = {
  id: number
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
  languageCode: string | null
  isPremium: boolean | null
  addedToAttachmentMenu: boolean | null
  allowsWriteToPm: boolean | null
  isBot: boolean | null
  settings: UserSettings | null
  notificationState: NotificationState
  createdAt: string
  updatedAt: string
  lastSeenAt: string
  devices: UserDevice[]
  loginHistory: UserLoginEvent[]
  changeHistory: UserChangeEvent[]
}

export type UserSummary = {
  id: number
  name: string
  username: string | null
  photoUrl: string | null
  facultyName: string | null
  facultySlug: string | null
  groupName: string | null
  groupSlug: string | null
  course: number | null
  createdAt: string
  lastSeenAt: string
}

const MAX_DEVICES = 40
const MAX_LOGIN_HISTORY = 100
const MAX_CHANGE_HISTORY = 100

function buildDisplayName(user: StoredUser): string {
  const nameParts = [user.firstName, user.lastName].filter(Boolean)
  if (nameParts.length > 0) return nameParts.join(" ")
  if (user.username) return `@${user.username}`
  return `ID ${user.id}`
}

function mapDbUserToStoredUser(
  dbUser: any,
  devices: UserDevice[] = [],
  loginHistory: UserLoginEvent[] = [],
  changeHistory: UserChangeEvent[] = []
): StoredUser {
  return {
    id: dbUser.id,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    username: dbUser.username,
    photoUrl: dbUser.photo_url,
    languageCode: dbUser.language_code,
    isPremium: dbUser.is_premium,
    addedToAttachmentMenu: dbUser.added_to_attachment_menu,
    allowsWriteToPm: dbUser.allows_write_to_pm,
    isBot: dbUser.is_bot,
    settings: (dbUser.settings as UserSettings) ?? null,
    notificationState: (dbUser.notification_state as NotificationState) ?? {},
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
    lastSeenAt: dbUser.last_seen_at,
    devices: devices.map((d) => ({
      id: d.id,
      label: d.label,
      tgPlatform: d.tgPlatform,
      tgVersion: d.tgVersion,
      userAgent: d.userAgent,
      platform: d.platform,
      language: d.language,
      timezone: d.timezone,
      firstSeenAt: d.firstSeenAt,
      lastSeenAt: d.lastSeenAt,
      settings: d.settings,
    })),
    loginHistory,
    changeHistory,
  }
}

function mapDbDeviceToUserDevice(dbDevice: any): UserDevice {
  return {
    id: dbDevice.id,
    label: dbDevice.label,
    tgPlatform: dbDevice.tg_platform,
    tgVersion: dbDevice.tg_version,
    userAgent: dbDevice.user_agent,
    platform: dbDevice.platform,
    language: dbDevice.language,
    timezone: dbDevice.timezone,
    firstSeenAt: dbDevice.first_seen_at,
    lastSeenAt: dbDevice.last_seen_at,
    settings: dbDevice.settings as UserSettings | null,
  }
}

function mapDbLoginEvent(row: any): UserLoginEvent {
  return {
    at: row.created_at,
    deviceId: row.device_id,
    ip: row.ip,
  }
}

function mapDbChangeEvent(row: any): UserChangeEvent {
  const changes = Array.isArray(row.changes) ? row.changes : []
  return {
    at: row.created_at,
    type: row.type as "profile" | "settings",
    changes: changes.map((c: any) => ({
      field: c.field ?? "",
      before: c.before ?? null,
      after: c.after ?? null,
    })),
  }
}

type ProfileFields = {
  first_name: string
  last_name: string | null
  username: string | null
  photo_url: string | null
  language_code: string | null
  is_premium: boolean | null
  added_to_attachment_menu: boolean | null
  allows_write_to_pm: boolean | null
  is_bot: boolean | null
}

const PROFILE_FIELD_LABELS: Record<keyof ProfileFields, string> = {
  first_name: "Имя",
  last_name: "Фамилия",
  username: "Username",
  photo_url: "Фото",
  language_code: "Язык",
  is_premium: "Премиум",
  added_to_attachment_menu: "Меню вложений",
  allows_write_to_pm: "Можно писать в ЛС",
  is_bot: "Бот",
}

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  facultySlug: "Факультет (slug)",
  facultyName: "Факультет",
  groupSlug: "Группа (slug)",
  groupName: "Группа",
  course: "Курс",
  weekType: "Тип недели",
  notificationsEnabled: "Уведомления",
  notificationTime: "Время уведомлений",
  sendDayBefore: "За день до",
  sendDayOf: "В день пар",
  notifyNoLessons: "Об отсутствии пар",
  notifyHolidays: "Праздники (за день)",
  notifyVacations: "Каникулы (за день)",
  notifyWeekStart: "Начало недели",
  notifyHolidayDay: "В день праздника",
  theme: "Тема",
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value ? "Да" : "Нет"
  return String(value)
}

function diffFields<T extends Record<string, unknown>>(
  oldObj: T | null | undefined,
  newObj: T | null | undefined,
  labels: Record<string, string>
): UserChangeEntry[] {
  if (!newObj) return []
  const entries: UserChangeEntry[] = []
  const keys = Object.keys(labels)
  for (const key of keys) {
    const oldVal = oldObj ? (oldObj as any)[key] : undefined
    const newVal = (newObj as any)[key]
    if (oldVal !== newVal && stringify(oldVal) !== stringify(newVal)) {
      entries.push({
        field: labels[key] ?? key,
        before: stringify(oldVal),
        after: stringify(newVal),
      })
    }
  }
  return entries
}

import { createHash } from "crypto"

function buildDeviceSignature(device: TelegramClientInfo | null | undefined): string | null {
  if (!device) return null
  if (device.deviceId) return device.deviceId
  const signature = [device.tgPlatform, device.tgVersion, device.platform, device.userAgent]
    .filter(Boolean)
    .join("|")
  if (!signature) return null
  return createHash("sha1").update(signature).digest("hex").slice(0, 12)
}

function buildDeviceLabel(device: TelegramClientInfo | null | undefined): string {
  if (!device) return "Неизвестное устройство"
  const parts: string[] = []
  if (device.tgPlatform) parts.push(`Telegram ${device.tgPlatform}`)
  if (device.platform && device.platform !== device.tgPlatform) {
    parts.push(device.platform)
  }
  if (!parts.length && device.userAgent) {
    parts.push(device.userAgent.split(")")[0]?.replace("(", "") ?? device.userAgent)
  }
  return parts.join(" · ") || "Неизвестное устройство"
}

async function upsertDevice(
  userId: number,
  deviceInfo: TelegramClientInfo | null | undefined,
  now: string,
  settings: UserSettings | null
): Promise<{ deviceId: string | null }> {
  const deviceId = buildDeviceSignature(deviceInfo)
  if (!deviceId) {
    return { deviceId: null }
  }

  const label = buildDeviceLabel(deviceInfo)

  const { data: existing } = await supabase
    .from("user_devices")
    .select()
    .eq("id", deviceId)
    .eq("user_id", userId)
    .single()

  if (!existing) {
    await supabase.from("user_devices").insert({
      id: deviceId,
      user_id: userId,
      label,
      tg_platform: deviceInfo?.tgPlatform ?? null,
      tg_version: deviceInfo?.tgVersion ?? null,
      user_agent: deviceInfo?.userAgent ?? null,
      platform: deviceInfo?.platform ?? null,
      language: deviceInfo?.language ?? null,
      timezone: deviceInfo?.timezone ?? null,
      first_seen_at: now,
      last_seen_at: now,
      settings: settings as any,
    })
  } else {
    await supabase
      .from("user_devices")
      .update({
        label: label || existing.label,
        tg_platform: deviceInfo?.tgPlatform ?? existing.tg_platform,
        tg_version: deviceInfo?.tgVersion ?? existing.tg_version,
        user_agent: deviceInfo?.userAgent ?? existing.user_agent,
        platform: deviceInfo?.platform ?? existing.platform,
        language: deviceInfo?.language ?? existing.language,
        timezone: deviceInfo?.timezone ?? existing.timezone,
        last_seen_at: now,
        settings: (settings ?? existing.settings) as any,
      })
      .eq("id", deviceId)
  }

  const { data: allDevices } = await supabase
    .from("user_devices")
    .select("id")
    .eq("user_id", userId)

  if (allDevices && allDevices.length > MAX_DEVICES) {
    allDevices.sort((a: any, b: any) => a.last_seen_at.localeCompare(b.last_seen_at))
    const toDelete = allDevices.slice(0, allDevices.length - MAX_DEVICES)
    for (const dev of toDelete) {
      await supabase.from("user_devices").delete().eq("id", dev.id)
    }
  }

  return { deviceId }
}

export async function getUserById(userId: number): Promise<StoredUser | null> {
  const { data: user } = await supabase
    .from("users")
    .select()
    .eq("id", userId)
    .single()

  if (!user) return null

  const [devicesResult, loginResult, changeResult] = await Promise.all([
    supabase
      .from("user_devices")
      .select()
      .eq("user_id", userId),
    supabase
      .from("user_login_history")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_LOGIN_HISTORY),
    supabase
      .from("user_change_history")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_CHANGE_HISTORY),
  ])

  const mappedDevices = devicesResult.data?.map(mapDbDeviceToUserDevice) || []
  const loginHistory = loginResult.data?.map(mapDbLoginEvent) || []
  const changeHistory = changeResult.data?.map(mapDbChangeEvent) || []

  return mapDbUserToStoredUser(user, mappedDevices, loginHistory, changeHistory)
}

export async function upsertUser(payload: {
  user: TelegramUserProfile
  settings?: UserSettings | null
  device?: TelegramClientInfo | null
  ip?: string | null
}): Promise<StoredUser> {
  const now = new Date().toISOString()

  // Fetch existing user to detect changes
  const { data: existingUser } = await supabase
    .from("users")
    .select()
    .eq("id", payload.user.id)
    .single()

  const userData = {
    id: payload.user.id,
    first_name: payload.user.first_name,
    last_name: payload.user.last_name ?? null,
    username: payload.user.username ?? null,
    photo_url: payload.user.photo_url ?? null,
    language_code: payload.user.language_code ?? null,
    is_premium: payload.user.is_premium ?? null,
    added_to_attachment_menu: payload.user.added_to_attachment_menu ?? null,
    allows_write_to_pm: payload.user.allows_write_to_pm ?? null,
    is_bot: payload.user.is_bot ?? null,
    settings: payload.settings ?? existingUser?.settings ?? null,
    updated_at: now,
    last_seen_at: now,
  }

  const { data: user } = await supabase
    .from("users")
    .upsert(userData, { onConflict: "id" })
    .select()
    .single()

  const { deviceId } = await upsertDevice(
    payload.user.id,
    payload.device,
    now,
    payload.settings ?? null
  )

  // Record login event
  await recordLoginEvent(payload.user.id, deviceId, payload.ip ?? null, now)

  // Track profile changes
  if (existingUser) {
    const profileChanges = diffFields(
      existingUser as ProfileFields,
      userData as unknown as ProfileFields,
      PROFILE_FIELD_LABELS
    )
    if (profileChanges.length > 0) {
      await recordChangeEvent(payload.user.id, "profile", profileChanges, now)
    }

    // Track settings changes
    if (payload.settings) {
      const oldSettings = existingUser.settings as UserSettings | null
      const settingsChanges = diffFields(
        oldSettings as any,
        payload.settings as any,
        SETTINGS_FIELD_LABELS
      )
      if (settingsChanges.length > 0) {
        await recordChangeEvent(payload.user.id, "settings", settingsChanges, now)
      }
    }
  }

  const { data: devices } = await supabase
    .from("user_devices")
    .select()
    .eq("user_id", payload.user.id)

  const mappedDevices = devices?.map(mapDbDeviceToUserDevice) || []

  return mapDbUserToStoredUser(user, mappedDevices)
}

async function recordLoginEvent(
  userId: number,
  deviceId: string | null,
  ip: string | null,
  now: string
): Promise<void> {
  await supabase.from("user_login_history").insert({
    user_id: userId,
    device_id: deviceId,
    ip,
    created_at: now,
  })

  // Trim old entries beyond limit
  const { data: rows } = await supabase
    .from("user_login_history")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (rows && rows.length > MAX_LOGIN_HISTORY) {
    const idsToDelete = rows.slice(MAX_LOGIN_HISTORY).map((r: any) => r.id)
    await supabase
      .from("user_login_history")
      .delete()
      .in("id", idsToDelete)
  }
}

async function recordChangeEvent(
  userId: number,
  type: "profile" | "settings",
  changes: UserChangeEntry[],
  now: string
): Promise<void> {
  await supabase.from("user_change_history").insert({
    user_id: userId,
    type,
    changes: changes as any,
    created_at: now,
  })

  // Trim old entries beyond limit
  const { data: rows } = await supabase
    .from("user_change_history")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (rows && rows.length > MAX_CHANGE_HISTORY) {
    const idsToDelete = rows.slice(MAX_CHANGE_HISTORY).map((r: any) => r.id)
    await supabase
      .from("user_change_history")
      .delete()
      .in("id", idsToDelete)
  }
}

export async function listUserSummaries(): Promise<UserSummary[]> {
  const { data: users } = await supabase
    .from("users")
    .select()
    .order("last_seen_at", { ascending: false })

  if (!users) return []

  return users.map((u: any) => ({
    id: u.id,
    name: buildDisplayName({
      firstName: u.first_name,
      lastName: u.last_name,
      username: u.username,
    } as StoredUser),
    username: u.username,
    photoUrl: u.photo_url,
    facultyName: (u.settings as UserSettings)?.facultyName ?? null,
    facultySlug: (u.settings as UserSettings)?.facultySlug ?? null,
    groupName: (u.settings as UserSettings)?.groupName ?? null,
    groupSlug: (u.settings as UserSettings)?.groupSlug ?? null,
    course: (u.settings as UserSettings)?.course ?? null,
    createdAt: u.created_at,
    lastSeenAt: u.last_seen_at,
  }))
}

export async function listUsersWithSettings(): Promise<StoredUser[]> {
  const { data: users } = await supabase
    .from("users")
    .select()

  if (!users) return []

  const result: StoredUser[] = []
  for (const u of users) {
    const { data: devices } = await supabase
      .from("user_devices")
      .select()
      .eq("user_id", u.id)

    const mappedDevices = devices?.map(mapDbDeviceToUserDevice) || []
    result.push(mapDbUserToStoredUser(u, mappedDevices))
  }

  return result
}

export async function updateUsersNotificationState(
  updates: Array<{ id: number; state: Partial<NotificationState> }>
) {
  if (updates.length === 0) return

  for (const { id, state } of updates) {
    await supabase
      .from("users")
      .update({
        notification_state: state as any,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
  }
}
