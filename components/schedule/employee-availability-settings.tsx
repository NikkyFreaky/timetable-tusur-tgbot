'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import { GroupSearchDrawer } from '@/components/schedule/group-search-drawer'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { getTelegramInitDataHeaders, useTelegram } from '@/lib/telegram-context'
import type { GroupSearchMatch } from '@/lib/group-search'
import type { ChatTopic } from '@/lib/schedule-types'

interface EmployeeAvailabilityPerson {
  id: string
  fullName: string
  facultyName: string
  groupName: string
  course: number
}

interface EmployeeAvailabilityConfig {
  id: string
  enabled: boolean
  notificationTime: string
  topicId: number | null
  people: EmployeeAvailabilityPerson[]
}

interface EmployeeAvailabilitySettingsProps {
  userId?: number
  chatId?: number
  isForum?: boolean
  topics?: ChatTopic[]
}

const EMPTY_CONFIG: Omit<EmployeeAvailabilityConfig, 'id' | 'people'> = {
  enabled: false,
  notificationTime: '08:00',
  topicId: null,
}

/** Настройки ежедневной сводки свободного времени. */
export function EmployeeAvailabilitySettings({
  userId,
  chatId,
  isForum = false,
  topics = [],
}: EmployeeAvailabilitySettingsProps) {
  const { webApp } = useTelegram()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [config, setConfig] = useState<EmployeeAvailabilityConfig | null>(null)
  const [fullName, setFullName] = useState('')
  const [group, setGroup] = useState<GroupSearchMatch | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

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

  if (!userId || allowed === false) return null
  if (allowed === null) return <div className="px-4 py-3 text-sm text-muted-foreground">Загрузка сводки сотрудников...</div>

  const values = { ...EMPTY_CONFIG, ...config }

  return (
    <section className="px-4 mb-6">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Сводка сотрудников
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

        <div className="space-y-3 border-t border-border p-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Время отправки</span>
            <Input
              type="time"
              value={values.notificationTime}
              disabled={saving}
              onChange={(event) => void saveConfig({ notificationTime: event.target.value })}
            />
          </label>

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
            <div className="divide-y divide-border rounded-lg border border-border">
              {config?.people.map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{person.fullName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Группа {person.groupName}, {person.facultyName}
                    </div>
                  </div>
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
          )}
        </div>
      </div>
      <GroupSearchDrawer open={searchOpen} onOpenChange={setSearchOpen} onSelectGroup={setGroup} />
    </section>
  )
}
