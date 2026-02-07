"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { UserSettings } from "@/lib/schedule-types"
import type {
  StoredUser,
  UserChangeEvent,
  UserDevice,
  UserLoginEvent,
  UserSummary,
} from "@/lib/user-store"

const FALLBACK_FACULTY = "Факультет не выбран"
const FALLBACK_GROUP = "Группа не выбрана"
const MAX_HISTORY_ITEMS = 20
const DEFAULT_SETTINGS: UserSettings = {
  facultySlug: null,
  facultyName: null,
  groupSlug: null,
  groupName: null,
  course: null,
  weekType: "odd",
  notificationsEnabled: true,
  notificationTime: "07:00",
  sendDayBefore: false,
  sendDayOf: true,
  notifyNoLessons: true,
  notifyHolidays: false,
  notifyVacations: false,
  notifyWeekStart: false,
  notifyHolidayDay: false,
  theme: "system",
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) return "—"
  return value ? "Да" : "Нет"
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function getProfileLink(user: UserSummary | StoredUser) {
  if (user.username) return `https://t.me/${user.username}`
  return `tg://user?id=${user.id}`
}

function getFacultyLabel(user: UserSummary) {
  return user.facultyName ?? user.facultySlug ?? FALLBACK_FACULTY
}

function getGroupLabel(user: UserSummary) {
  const groupName = user.groupName ?? user.groupSlug ?? FALLBACK_GROUP
  return groupName === FALLBACK_GROUP ? FALLBACK_GROUP : `Группа ${groupName}`
}

function buildSettingsEntries(settings: UserSettings | null | undefined) {
  if (!settings) return []
  return [
    { label: "Факультет", value: settings.facultyName ?? "—" },
    { label: "Группа", value: settings.groupName ? `Группа ${settings.groupName}` : "—" },
    { label: "Курс", value: settings.course ? `${settings.course} курс` : "—" },
    {
      label: "Тип недели",
      value: settings.weekType === "even" ? "Четная" : "Нечетная",
    },
    {
      label: "Уведомления",
      value: settings.notificationsEnabled ? "Включены" : "Выключены",
    },
    { label: "Время уведомлений", value: settings.notificationTime },
    {
      label: "Отправлять за день до",
      value: settings.sendDayBefore ? "Да" : "Нет",
    },
    {
      label: "Отправлять в день пар",
      value: settings.sendDayOf ? "Да" : "Нет",
    },
    {
      label: "Об отсутствии пар",
      value: settings.notifyNoLessons ? "Да" : "Нет",
    },
    {
      label: "Праздники (за день)",
      value: settings.notifyHolidays ? "Да" : "Нет",
    },
    {
      label: "Каникулы (за день)",
      value: settings.notifyVacations ? "Да" : "Нет",
    },
    {
      label: "Начало недели",
      value: settings.notifyWeekStart ? "Да" : "Нет",
    },
    {
      label: "В день праздника",
      value: settings.notifyHolidayDay ? "Да" : "Нет",
    },
    {
      label: "Тема",
      value:
        settings.theme === "system" ? "Системная" : settings.theme === "dark" ? "Темная" : "Светлая",
    },
  ]
}

function isDefaultSettings(settings: UserSettings | null | undefined) {
  if (!settings) return false
  return (
    settings.facultySlug === DEFAULT_SETTINGS.facultySlug &&
    settings.facultyName === DEFAULT_SETTINGS.facultyName &&
    settings.groupSlug === DEFAULT_SETTINGS.groupSlug &&
    settings.groupName === DEFAULT_SETTINGS.groupName &&
    settings.course === DEFAULT_SETTINGS.course &&
    settings.weekType === DEFAULT_SETTINGS.weekType &&
    settings.notificationsEnabled === DEFAULT_SETTINGS.notificationsEnabled &&
    settings.notificationTime === DEFAULT_SETTINGS.notificationTime &&
    settings.sendDayBefore === DEFAULT_SETTINGS.sendDayBefore &&
    settings.sendDayOf === DEFAULT_SETTINGS.sendDayOf &&
    settings.notifyNoLessons === DEFAULT_SETTINGS.notifyNoLessons &&
    settings.notifyHolidays === DEFAULT_SETTINGS.notifyHolidays &&
    settings.notifyVacations === DEFAULT_SETTINGS.notifyVacations &&
    settings.notifyWeekStart === DEFAULT_SETTINGS.notifyWeekStart &&
    settings.notifyHolidayDay === DEFAULT_SETTINGS.notifyHolidayDay &&
    settings.theme === DEFAULT_SETTINGS.theme
  )
}

function sortByDateDesc<T extends { at: string }>(items: T[]) {
  return [...items].sort((a, b) => b.at.localeCompare(a.at))
}

function sortByDeviceRecent<T extends { lastSeenAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
}

function HistoryList<T extends { at: string }>({
  title,
  items,
  renderItem,
  emptyMessage,
}: {
  title: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        {emptyMessage ?? `${title}: нет данных`}
      </div>
    )
  }

  const visible = items.slice(0, MAX_HISTORY_ITEMS)
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{title}</span>
        <span>
          Показано {visible.length} из {items.length}
        </span>
      </div>
      <div className="space-y-3">
        {visible.map((item, index) => (
          <div key={`${item.at}-${index}`}>{renderItem(item, index)}</div>
        ))}
      </div>
    </div>
  )
}

function SettingsGrid({ settings }: { settings: UserSettings | null | undefined }) {
  const entries = buildSettingsEntries(settings)
  if (entries.length === 0) {
    return <div className="text-xs text-muted-foreground">Нет данных о настройках.</div>
  }

  return (
    <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
      {entries.map((entry) => (
        <div key={entry.label} className="space-y-1">
          <div className="text-muted-foreground">{entry.label}</div>
          <div className="font-medium text-foreground">{entry.value}</div>
        </div>
      ))}
    </div>
  )
}

function renderLoginItem(item: UserLoginEvent, devices: UserDevice[]) {
  const device = item.deviceId ? devices.find((entry) => entry.id === item.deviceId) : null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="space-y-1">
        <div className="font-medium text-foreground">{formatDateTime(item.at)}</div>
        <div className="text-muted-foreground">{device?.label ?? "Неизвестное устройство"}</div>
      </div>
      <div className="text-muted-foreground">IP: {item.ip ?? "—"}</div>
    </div>
  )
}

function renderChangeItem(item: UserChangeEvent) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {item.type === "settings" ? "Настройки" : "Профиль"}
        </span>
        <span>{formatDateTime(item.at)}</span>
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {item.changes.map((change, index) => (
          <div key={`${item.at}-${change.field}-${index}`} className="flex gap-2">
            <span className="font-medium text-foreground">{change.field}:</span>
            <span>
              {change.before ?? "—"} → {change.after ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function UserProfileDialog({ user }: { user: UserSummary }) {
  const [open, setOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [details, setDetails] = useState<StoredUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setDetails(null)

    fetch(`/api/users/${user.id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load user")
        }
        const data = (await response.json()) as { user: StoredUser }
        return data.user
      })
      .then((data) => {
        setDetails(data)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setError("Не удалось загрузить данные пользователя.")
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [open, user.id])

  const facultyLabel = getFacultyLabel(user)
  const groupLabel = getGroupLabel(user)
  const courseLabel = user.course ? `${user.course} курс` : null
  const initials = getInitials(user.name)
  const profileLink = getProfileLink(user)

  const loginHistory = useMemo(
    () => sortByDateDesc(details?.loginHistory ?? []),
    [details?.loginHistory]
  )
  const changeHistory = useMemo(
    () => sortByDateDesc(details?.changeHistory ?? []),
    [details?.changeHistory]
  )
  const devices = useMemo(() => sortByDeviceRecent(details?.devices ?? []), [details?.devices])

  const fullName = details
    ? [details.firstName, details.lastName].filter(Boolean).join(" ")
    : user.name

  const telegramFields = details
    ? [
        { label: "ID", value: String(details.id) },
        { label: "Имя", value: formatValue(details.firstName) },
        { label: "Фамилия", value: formatValue(details.lastName) },
        { label: "Username", value: details.username ? `@${details.username}` : "—" },
        { label: "Язык", value: formatValue(details.languageCode) },
        { label: "Премиум", value: formatBoolean(details.isPremium ?? null) },
        { label: "Можно писать в ЛС", value: formatBoolean(details.allowsWriteToPm ?? null) },
        {
          label: "Добавлен в меню вложений",
          value: formatBoolean(details.addedToAttachmentMenu ?? null),
        },
        { label: "Бот", value: formatBoolean(details.isBot ?? null) },
      ]
    : []

  const trigger = (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Открыть профиль ${user.name}`}
    >
      <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center overflow-hidden">
        {user.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={user.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">
            {initials || "?"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground truncate">{user.name}</h3>
          {user.username && (
            <span className="text-xs text-muted-foreground">@{user.username}</span>
          )}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{facultyLabel}</div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{groupLabel}</span>
          {courseLabel && <span>• {courseLabel}</span>}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Регистрация: {formatDateTime(user.createdAt)} · Последний вход:{" "}
          {formatDateTime(user.lastSeenAt)}
        </div>
      </div>
    </button>
  )

  if (!isMounted) {
    return trigger
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fullName}</DialogTitle>
          <DialogDescription>Профиль пользователя и активность</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Загружаем данные пользователя...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && details && (
          <div className="space-y-6">
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/10 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl border border-border bg-background flex items-center justify-center overflow-hidden">
                  {details.photoUrl ? (
                    <img
                      src={details.photoUrl}
                      alt={fullName}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {getInitials(fullName) || "?"}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{fullName}</div>
                  {details.username && (
                    <div className="text-xs text-muted-foreground">@{details.username}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={profileLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Открыть Telegram
                </a>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
              <div className="text-xs font-semibold text-foreground">Данные Telegram</div>
              <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                {telegramFields.map((field) => (
                  <div key={field.label} className="space-y-1">
                    <div className="text-muted-foreground">{field.label}</div>
                    <div className="font-medium text-foreground">{field.value}</div>
                  </div>
                ))}
                {details.photoUrl && (
                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-muted-foreground">Фото URL</div>
                    <a
                      href={details.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary"
                    >
                      Открыть
                    </a>
                  </div>
                )}
              </div>
            </section>

            {details.settings ? (
              isDefaultSettings(details.settings) ? (
                <section className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                  Текущие настройки: стандартные
                </section>
              ) : (
                <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                  <div className="text-xs font-semibold text-foreground">Текущие настройки</div>
                  <SettingsGrid settings={details.settings} />
                </section>
              )
            ) : (
              <section className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                Текущие настройки: нет данных
              </section>
            )}

            <HistoryList
              title="История входов"
              items={loginHistory}
              renderItem={(item) => renderLoginItem(item, devices)}
              emptyMessage="История входов: нет данных"
            />

            <HistoryList
              title="История изменений"
              items={changeHistory}
              renderItem={(item) => renderChangeItem(item)}
              emptyMessage="История изменений: нет данных"
            />

            {devices.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                Устройства: нет данных
              </section>
            ) : (
              <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                <div className="text-xs font-semibold text-foreground">Устройства</div>
                <Accordion type="single" collapsible>
                  {devices.map((device) => (
                    <AccordionItem key={device.id} value={device.id}>
                      <AccordionTrigger>
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-sm font-semibold text-foreground">
                            {device.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Последний вход: {formatDateTime(device.lastSeenAt)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 text-xs text-muted-foreground">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Первый вход</div>
                              <div className="font-medium text-foreground">
                                {formatDateTime(device.firstSeenAt)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Последний вход</div>
                              <div className="font-medium text-foreground">
                                {formatDateTime(device.lastSeenAt)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Telegram платформа</div>
                              <div className="font-medium text-foreground">
                                {formatValue(device.tgPlatform)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Версия Telegram</div>
                              <div className="font-medium text-foreground">
                                {formatValue(device.tgVersion)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Платформа</div>
                              <div className="font-medium text-foreground">
                                {formatValue(device.platform)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Язык устройства</div>
                              <div className="font-medium text-foreground">
                                {formatValue(device.language)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Часовой пояс</div>
                              <div className="font-medium text-foreground">
                                {formatValue(device.timezone)}
                              </div>
                            </div>
                          </div>
                          {device.userAgent && (
                            <div className="rounded-xl border border-border bg-background p-3">
                              <div className="text-xs font-semibold text-foreground">User Agent</div>
                              <div className="mt-2 text-xs text-muted-foreground break-words">
                                {device.userAgent}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
