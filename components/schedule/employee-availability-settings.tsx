'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronRight, Clock, GripVertical, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { GroupSearchDrawer } from '@/components/schedule/group-search-drawer'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { getTelegramInitDataHeaders, useTelegram } from '@/lib/telegram-context'
import type { GroupSearchMatch } from '@/lib/group-search'
import type { ChatTopic } from '@/lib/schedule-types'

interface EmployeeAvailabilityPerson {
  id: string
  fullName: string
  facultySlug: string
  facultyName: string
  groupSlug: string
  groupName: string
  course: number
  sortOrder: number
}

interface EmployeeAvailabilityConfig {
  id: string
  enabled: boolean
  notificationTime: string
  workdayStart: string
  workdayEnd: string
  lunchStart: string
  lunchEnd: string
  topicId: number | null
  people: EmployeeAvailabilityPerson[]
}

interface EmployeeAvailabilitySettingsProps {
  userId?: number
  chatId?: number
  isForum?: boolean
  topics?: ChatTopic[]
  heading?: string
}

const EMPTY_CONFIG: Omit<EmployeeAvailabilityConfig, 'id' | 'people'> = {
  enabled: false,
  notificationTime: '09:00',
  workdayStart: '09:00',
  workdayEnd: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
  topicId: null,
}

const WHEEL_ITEM_HEIGHT = 44
const WHEEL_VISIBLE_ITEMS = 5
const WHEEL_CONTAINER_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS

const parseNotificationTime = (value: string) => {
  const [hourRaw, minuteRaw] = value.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 8,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  }
}

const buildNotificationTime = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

/** Настройки ежедневной сводки свободного времени. */
export function EmployeeAvailabilitySettings({
  userId,
  chatId,
  isForum = false,
  topics = [],
  heading = 'Сводка сотрудников',
}: EmployeeAvailabilitySettingsProps) {
  const { hapticFeedback, webApp } = useTelegram()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [config, setConfig] = useState<EmployeeAvailabilityConfig | null>(null)
  const [fullName, setFullName] = useState('')
  const [group, setGroup] = useState<GroupSearchMatch | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<EmployeeAvailabilityPerson | null>(null)
  const [editingFullName, setEditingFullName] = useState('')
  const [editingGroup, setEditingGroup] = useState<GroupSearchMatch | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editGroupSearchOpen, setEditGroupSearchOpen] = useState(false)
  const [editMessage, setEditMessage] = useState('')
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null)
  const hourScrollRef = useRef<HTMLDivElement | null>(null)
  const minuteScrollRef = useRef<HTMLDivElement | null>(null)
  const hourScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minuteScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peopleOrderRef = useRef<EmployeeAvailabilityPerson[]>([])
  const dragStartOrderRef = useRef<string[] | null>(null)

  const query = chatId ? `?chatId=${chatId}` : ''
  const headers = getTelegramInitDataHeaders(webApp?.initData)

  const load = async () => {
    if (!userId) return
    const response = await fetch(`/api/employee-availability${query}`, { headers })
    if (response.status === 403) {
      setAllowed(false)
      return
    }
    if (!response.ok) throw new Error('Не удалось загрузить сводку сотрудников')
    const data = await response.json() as { config: EmployeeAvailabilityConfig | null }
    setConfig(data.config)
    setAllowed(true)
  }

  useEffect(() => {
    setAllowed(null)
    setConfig(null)
    setMessage('')
    load().catch((error) => {
      setAllowed(true)
      setMessage(error instanceof Error ? error.message : 'Не удалось загрузить сводку сотрудников')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, chatId, webApp?.initData])

  const saveConfig = async (updates: Partial<Omit<EmployeeAvailabilityConfig, 'id' | 'people'>> = {}) => {
    if (!userId) return null
    setSaving(true)
    setMessage('')
    const next = { ...EMPTY_CONFIG, ...config, ...updates }
    try {
      const response = await fetch(`/api/employee-availability${query}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          enabled: next.enabled,
          notificationTime: next.notificationTime,
          workdayStart: next.workdayStart,
          workdayEnd: next.workdayEnd,
          lunchStart: next.lunchStart,
          lunchEnd: next.lunchEnd,
          topicId: isForum ? next.topicId : null,
        }),
      })
      const data = await response.json().catch(() => ({})) as {
        config?: EmployeeAvailabilityConfig
        error?: string
      }
      if (!response.ok || !data.config) throw new Error(data.error ?? 'Не удалось сохранить настройку')
      setConfig(data.config)
      return data.config
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройку')
      return null
    } finally {
      setSaving(false)
    }
  }

  const addPerson = async () => {
    if (!fullName.trim() || !group) {
      setMessage('Укажите ФИО и выберите группу')
      return
    }
    const savedConfig = config ?? await saveConfig()
    if (!savedConfig) return

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/employee-availability${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          fullName: fullName.trim(),
          facultySlug: group.facultySlug,
          facultyName: group.facultyName,
          groupSlug: group.groupSlug,
          groupName: group.groupName,
          course: group.courseNumber,
        }),
      })
      const data = await response.json().catch(() => ({})) as {
        config?: EmployeeAvailabilityConfig
        error?: string
      }
      if (!response.ok || !data.config) throw new Error(data.error ?? 'Не удалось добавить сотрудника')
      setConfig(data.config)
      setFullName('')
      setGroup(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось добавить сотрудника')
    } finally {
      setSaving(false)
    }
  }

  const removePerson = async (personId: string) => {
    setSaving(true)
    setMessage('')
    try {
      const separator = query ? '&' : '?'
      const response = await fetch(`/api/employee-availability${query}${separator}personId=${encodeURIComponent(personId)}`, {
        method: 'DELETE',
        headers,
      })
      const data = await response.json().catch(() => ({})) as {
        config?: EmployeeAvailabilityConfig
        error?: string
      }
      if (!response.ok || !data.config) throw new Error(data.error ?? 'Не удалось удалить сотрудника')
      setConfig(data.config)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось удалить сотрудника')
    } finally {
      setSaving(false)
    }
  }

  const openEditPerson = (person: EmployeeAvailabilityPerson) => {
    setEditingPerson(person)
    setEditingFullName(person.fullName)
    setEditingGroup({
      facultySlug: person.facultySlug,
      facultyName: person.facultyName,
      courseNumber: person.course,
      groupSlug: person.groupSlug,
      groupName: person.groupName,
    })
    setEditMessage('')
    setEditSheetOpen(true)
  }

  const savePerson = async () => {
    if (!editingPerson || !editingFullName.trim() || !editingGroup) {
      setEditMessage('Укажите ФИО и выберите группу')
      return
    }

    setSaving(true)
    setEditMessage('')
    try {
      const response = await fetch(`/api/employee-availability${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          personId: editingPerson.id,
          fullName: editingFullName.trim(),
          facultySlug: editingGroup.facultySlug,
          facultyName: editingGroup.facultyName,
          groupSlug: editingGroup.groupSlug,
          groupName: editingGroup.groupName,
          course: editingGroup.courseNumber,
        }),
      })
      const data = await response.json().catch(() => ({})) as {
        config?: EmployeeAvailabilityConfig
        error?: string
      }
      if (!response.ok || !data.config) throw new Error(data.error ?? 'Не удалось сохранить сотрудника')
      setConfig(data.config)
      setEditSheetOpen(false)
      setEditingPerson(null)
      hapticFeedback('success')
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : 'Не удалось сохранить сотрудника')
    } finally {
      setSaving(false)
    }
  }

  const savePeopleOrder = async () => {
    const personIds = peopleOrderRef.current.map((person) => person.id)
    if (!config || personIds.length === 0) return

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/employee-availability${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ personIds }),
      })
      const data = await response.json().catch(() => ({})) as {
        config?: EmployeeAvailabilityConfig
        error?: string
      }
      if (!response.ok || !data.config) throw new Error(data.error ?? 'Не удалось изменить порядок сотрудников')
      setConfig(data.config)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось изменить порядок сотрудников')
      void load()
    } finally {
      setSaving(false)
    }
  }

  const movePerson = (personId: string, targetPersonId: string) => {
    if (personId === targetPersonId) return
    setConfig((current) => {
      if (!current) return current
      const fromIndex = current.people.findIndex((person) => person.id === personId)
      const targetIndex = current.people.findIndex((person) => person.id === targetPersonId)
      if (fromIndex < 0 || targetIndex < 0) return current

      const people = [...current.people]
      const [person] = people.splice(fromIndex, 1)
      people.splice(targetIndex, 0, person)
      peopleOrderRef.current = people
      return { ...current, people }
    })
  }

  const handlePersonPointerDown = (event: PointerEvent<HTMLButtonElement>, personId: string) => {
    if (saving) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartOrderRef.current = peopleOrderRef.current.map((person) => person.id)
    setDraggedPersonId(personId)
    hapticFeedback('selection')
  }

  const handlePersonPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!draggedPersonId) return
    const target = event.currentTarget.ownerDocument
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-employee-person-id]')
      ?.dataset.employeePersonId
    if (target) movePerson(draggedPersonId, target)
  }

  const handlePersonPointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (!draggedPersonId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDraggedPersonId(null)
    const startOrder = dragStartOrderRef.current
    dragStartOrderRef.current = null
    if (startOrder?.join(',') !== peopleOrderRef.current.map((person) => person.id).join(',')) {
      void savePeopleOrder()
    }
  }

  const values = { ...EMPTY_CONFIG, ...config }
  const timeParts = parseNotificationTime(values.notificationTime)
  const hours = Array.from({ length: 24 }, (_, index) => index)
  const minutes = Array.from({ length: 60 }, (_, index) => index)

  const snapWheelScroll = (element: HTMLDivElement | null, index: number, maxIndex: number) => {
    if (!element) return
    element.scrollTo({
      top: Math.min(maxIndex, Math.max(0, index)) * WHEEL_ITEM_HEIGHT,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    if (!timePickerOpen) return
    const timer = setTimeout(() => {
      snapWheelScroll(hourScrollRef.current, timeParts.hour, 23)
      snapWheelScroll(minuteScrollRef.current, timeParts.minute, 59)
    }, 0)
    return () => clearTimeout(timer)
  }, [timePickerOpen, timeParts.hour, timeParts.minute])

  useEffect(() => () => {
    if (hourScrollTimeout.current) clearTimeout(hourScrollTimeout.current)
    if (minuteScrollTimeout.current) clearTimeout(minuteScrollTimeout.current)
  }, [])

  useEffect(() => {
    peopleOrderRef.current = config?.people ?? []
  }, [config])

  if (!userId || allowed === false) return null
  if (allowed === null) return <div className="px-4 py-3 text-sm text-muted-foreground">Загрузка сводки сотрудников...</div>

  return (
    <section className="px-4 mb-6">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {heading}
      </h3>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
              <Users className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <div className="font-medium text-foreground">Отправлять сводку</div>
              <div className="text-xs text-muted-foreground">
                {chatId ? 'В эту беседу' : 'В личный чат'}
              </div>
            </div>
          </div>
          <Switch
            checked={values.enabled}
            disabled={saving}
            onCheckedChange={(enabled) => void saveConfig({ enabled })}
          />
        </div>

        {message && !values.enabled && <div className="border-t border-border px-4 pb-3 pt-2 text-sm text-destructive">{message}</div>}

        {values.enabled && (
          <div className="space-y-3 border-t border-border p-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              hapticFeedback('light')
              setTimePickerOpen(true)
            }}
            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background/80 p-3 text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-foreground">Время отправки</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{values.notificationTime}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>

          <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Рабочее время</div>
              <div className="text-xs text-muted-foreground">
                Учитывается при расчёте свободного времени сотрудников
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Начало работы</span>
                <Input
                  type="time"
                  value={values.workdayStart}
                  disabled={saving}
                  onChange={(event) => void saveConfig({ workdayStart: event.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Конец работы</span>
                <Input
                  type="time"
                  value={values.workdayEnd}
                  disabled={saving}
                  onChange={(event) => void saveConfig({ workdayEnd: event.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Начало обеда</span>
                <Input
                  type="time"
                  value={values.lunchStart}
                  disabled={saving}
                  onChange={(event) => void saveConfig({ lunchStart: event.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Конец обеда</span>
                <Input
                  type="time"
                  value={values.lunchEnd}
                  disabled={saving}
                  onChange={(event) => void saveConfig({ lunchEnd: event.target.value })}
                />
              </label>
            </div>
          </div>

          {chatId && isForum && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Тема для сводки</span>
              <select
                value={values.topicId ?? '__main__'}
                disabled={saving}
                onChange={(event) => {
                  const topicId = event.target.value === '__main__' ? null : Number(event.target.value)
                  void saveConfig({ topicId })
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="__main__">Основной чат</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
              </select>
            </label>
          )}

          <div className="space-y-2 rounded-lg border border-border/70 p-3">
            <Input
              value={fullName}
              maxLength={200}
              disabled={saving}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="ФИО сотрудника"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => setSearchOpen(true)}
              className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm"
            >
              {group ? `Группа ${group.groupName} · ${group.facultyName}` : 'Выбрать группу'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void addPerson()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Добавить сотрудника
            </button>
          </div>

          {message && <div className="text-sm text-destructive">{message}</div>}

          {(config?.people.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Список сотрудников</div>
              <div className="divide-y divide-border rounded-lg border border-border">
              {config?.people.map((person) => (
                <div
                  key={person.id}
                  data-employee-person-id={person.id}
                  className={`flex items-center justify-between gap-2 p-3 transition-opacity ${draggedPersonId === person.id ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    disabled={saving}
                    onPointerDown={(event) => handlePersonPointerDown(event, person.id)}
                    onPointerMove={handlePersonPointerMove}
                    onPointerUp={handlePersonPointerEnd}
                    onPointerCancel={handlePersonPointerEnd}
                    className="touch-none rounded-md p-2 text-muted-foreground active:cursor-grabbing disabled:opacity-50"
                    aria-label={`Изменить порядок: ${person.fullName}`}
                  >
                    <GripVertical className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{person.fullName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Группа {person.groupName}, {person.facultyName}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => openEditPerson(person)}
                    className="rounded-md p-2 text-muted-foreground hover:text-foreground"
                    aria-label={`Редактировать ${person.fullName}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removePerson(person.id)}
                    className="rounded-md p-2 text-muted-foreground hover:text-destructive"
                    aria-label={`Удалить ${person.fullName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              </div>
            </div>
          )}
          </div>
        )}
      </div>
      <GroupSearchDrawer open={searchOpen} onOpenChange={setSearchOpen} onSelectGroup={setGroup} />
      <GroupSearchDrawer
        open={editGroupSearchOpen}
        onOpenChange={setEditGroupSearchOpen}
        onSelectGroup={setEditingGroup}
      />
      <Sheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open)
          if (!open) setEditMessage('')
        }}
      >
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <SheetHeader className="border-b border-border px-4 pb-4">
            <SheetTitle className="mx-auto text-lg">Изменить сотрудника</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">ФИО сотрудника</span>
              <Input
                value={editingFullName}
                maxLength={200}
                disabled={saving}
                onChange={(event) => setEditingFullName(event.target.value)}
              />
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Группа</span>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditGroupSearchOpen(true)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm disabled:opacity-50"
              >
                {editingGroup
                  ? `Группа ${editingGroup.groupName} · ${editingGroup.facultyName}`
                  : 'Выбрать группу'}
              </button>
            </div>
            {editMessage && <div className="text-sm text-destructive">{editMessage}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditSheetOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void savePerson()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={timePickerOpen} onOpenChange={setTimePickerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <SheetHeader className="border-b border-border px-4 pb-4">
            <SheetTitle className="mx-auto text-lg">Время отправки</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 px-4 py-4">
            <div className="text-center">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Время отправки сводки
              </div>
              <div className="text-4xl font-semibold tracking-[0.08em] text-foreground">
                {values.notificationTime}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
              <div className="relative">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Час</div>
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-inner backdrop-blur-sm" style={{ height: WHEEL_CONTAINER_HEIGHT }}>
                  <div
                    ref={hourScrollRef}
                    onScroll={() => {
                      if (hourScrollTimeout.current) clearTimeout(hourScrollTimeout.current)
                      hourScrollTimeout.current = setTimeout(() => {
                        const element = hourScrollRef.current
                        if (!element) return
                        const hour = Math.min(23, Math.max(0, Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT)))
                        if (hour !== timeParts.hour) {
                          hapticFeedback('selection')
                          void saveConfig({ notificationTime: buildNotificationTime(hour, timeParts.minute) })
                        }
                        snapWheelScroll(element, hour, 23)
                      }, 120)
                    }}
                    className="h-full snap-y snap-mandatory overflow-y-auto scrollbar-none"
                    style={{ paddingBlock: WHEEL_ITEM_HEIGHT * 2 }}
                  >
                    {hours.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => {
                          hapticFeedback('selection')
                          void saveConfig({ notificationTime: buildNotificationTime(hour, timeParts.minute) })
                        }}
                        className={`flex h-11 w-full snap-center items-center justify-center text-lg font-semibold transition-colors ${hour === timeParts.hour ? 'text-2xl text-foreground' : 'text-muted-foreground/60'}`}
                      >
                        {String(hour).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background/90 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-3 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-foreground/5" />
                  <div className="pointer-events-none absolute inset-x-3 top-1/2 h-11 -translate-y-1/2 border-y border-foreground/20" />
                </div>
              </div>
              <div className="text-4xl font-semibold text-muted-foreground/70">:</div>
              <div className="relative">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Минуты</div>
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-inner backdrop-blur-sm" style={{ height: WHEEL_CONTAINER_HEIGHT }}>
                  <div
                    ref={minuteScrollRef}
                    onScroll={() => {
                      if (minuteScrollTimeout.current) clearTimeout(minuteScrollTimeout.current)
                      minuteScrollTimeout.current = setTimeout(() => {
                        const element = minuteScrollRef.current
                        if (!element) return
                        const minute = Math.min(59, Math.max(0, Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT)))
                        if (minute !== timeParts.minute) {
                          hapticFeedback('selection')
                          void saveConfig({ notificationTime: buildNotificationTime(timeParts.hour, minute) })
                        }
                        snapWheelScroll(element, minute, 59)
                      }, 120)
                    }}
                    className="h-full snap-y snap-mandatory overflow-y-auto scrollbar-none"
                    style={{ paddingBlock: WHEEL_ITEM_HEIGHT * 2 }}
                  >
                    {minutes.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => {
                          hapticFeedback('selection')
                          void saveConfig({ notificationTime: buildNotificationTime(timeParts.hour, minute) })
                        }}
                        className={`flex h-11 w-full snap-center items-center justify-center text-lg font-semibold transition-colors ${minute === timeParts.minute ? 'text-2xl text-foreground' : 'text-muted-foreground/60'}`}
                      >
                        {String(minute).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background/90 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-3 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-foreground/5" />
                  <div className="pointer-events-none absolute inset-x-3 top-1/2 h-11 -translate-y-1/2 border-y border-foreground/20" />
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-muted-foreground">Прокрутите, чтобы выбрать время, как в будильнике.</div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
