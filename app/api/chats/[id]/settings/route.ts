import { NextResponse } from "next/server"
import { getChatById } from "@/lib/chat-store"
import type { UserSettings } from "@/lib/schedule-types"

export const runtime = "nodejs"

type Params = { id: string }

type UpdateSettingsPayload = {
  settings: Partial<UserSettings>
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> | Params }
) {
  try {
    const { id } = await context.params
    const chatId = Number(id)

    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ error: "Invalid chat id" }, { status: 400 })
    }

    const chat = await getChatById(chatId)
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const userIdHeader = request.headers.get("x-user-id")
    if (!userIdHeader) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 })
    }

    const userId = Number(userIdHeader)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 401 })
    }

    const { settings } = (await request.json()) as UpdateSettingsPayload
    if (!settings) {
      return NextResponse.json({ error: "Settings required" }, { status: 400 })
    }

    const { upsertChat } = await import("@/lib/chat-store")

    const updatedSettings: UserSettings = {
      facultySlug: settings.facultySlug ?? chat.settings?.facultySlug ?? null,
      facultyName: settings.facultyName ?? chat.settings?.facultyName ?? null,
      groupSlug: settings.groupSlug ?? chat.settings?.groupSlug ?? null,
      groupName: settings.groupName ?? chat.settings?.groupName ?? null,
      course: settings.course ?? chat.settings?.course ?? null,
      weekType: settings.weekType ?? chat.settings?.weekType ?? "odd",
      notificationsEnabled: settings.notificationsEnabled ?? chat.settings?.notificationsEnabled ?? true,
      notificationTime: settings.notificationTime ?? chat.settings?.notificationTime ?? "07:00",
      sendDayBefore: settings.sendDayBefore ?? chat.settings?.sendDayBefore ?? false,
      sendDayOf: settings.sendDayOf ?? chat.settings?.sendDayOf ?? true,
      notifyNoLessons: settings.notifyNoLessons ?? chat.settings?.notifyNoLessons ?? true,
      notifyHolidays: settings.notifyHolidays ?? chat.settings?.notifyHolidays ?? false,
      notifyVacations: settings.notifyVacations ?? chat.settings?.notifyVacations ?? false,
      notifyWeekStart: settings.notifyWeekStart ?? chat.settings?.notifyWeekStart ?? false,
      notifyHolidayDay: settings.notifyHolidayDay ?? chat.settings?.notifyHolidayDay ?? false,
      theme: settings.theme ?? chat.settings?.theme ?? "system",
    }

    await upsertChat({
      chat: {
        id: chatId,
        type: chat.type,
        title: chat.title || undefined,
        username: chat.username || undefined,
        photo_url: chat.photoUrl || undefined,
      },
      settings: updatedSettings,
    })

    const updatedChat = await getChatById(chatId)

    return NextResponse.json({ chat: updatedChat })
  } catch (error) {
    console.error("Failed to update chat settings:", error)
    return NextResponse.json({ error: "Failed to update chat settings" }, { status: 500 })
  }
}
