'use client'

import { useEffect, useMemo, useState } from 'react'

type Template = { command: 'start' | 'settings' | 'info'; audience: 'private' | 'group'; text: string }
type Target = { id: string; chatId: number; threadId: number | null; kind: string; label: string; username: string | null }

const commandLabels = { start: '/start', settings: '/settings', info: '/info' }
const audienceLabels = { private: 'Личный чат', group: 'Группа / форум' }

export default function AdminBotPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSuperadmin, setIsSuperadmin] = useState(false)

  useEffect(() => {
    Promise.all([fetch('/api/admin/bot/templates'), fetch('/api/admin/bot/recipients')])
      .then(async ([templatesResponse, recipientsResponse]) => {
        if (!templatesResponse.ok) throw new Error('Failed to load')
        const templatesData = await templatesResponse.json()
        setTemplates(templatesData.templates)
        setIsSuperadmin(templatesData.role === 'superadmin')
        if (recipientsResponse.ok) setTargets((await recipientsResponse.json()).targets)
      })
      .catch(() => setStatus('Не удалось загрузить настройки или адресатов'))
      .finally(() => setLoading(false))
  }, [])

  const selectedTargets = useMemo(() => targets.filter((target) => selectedIds.includes(target.id)), [selectedIds, targets])

  const saveTemplates = async () => {
    setStatus('')
    const response = await fetch('/api/admin/bot/templates', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templates }),
    })
    setStatus(response.ok ? 'Шаблоны сохранены' : 'Не удалось сохранить шаблоны')
  }

  const send = async (kind: 'text' | 'schedule') => {
    if (!selectedTargets.length) return setStatus('Выберите хотя бы одного адресата')
    if (kind === 'schedule' && selectedTargets.length !== 1) return setStatus('Для расписания выберите одного адресата')
    const action = kind === 'text' ? 'отправить сообщение' : 'отправить расписание'
    if (!confirm(`Подтвердите: ${action} для ${selectedTargets.length} адресата(ов)?`)) return
    const response = await fetch('/api/admin/bot/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind, text, confirm: true,
        targets: selectedTargets.map((target) => ({
          chatId: target.chatId, threadId: target.threadId,
          kind: target.kind === 'user' ? 'user' : 'chat',
        })),
      }),
    })
    const data = await response.json().catch(() => ({}))
    setStatus(response.ok ? `Отправлено: ${data.sent}; ошибок: ${data.failed}` : data.error || 'Отправка не выполнена')
  }

  if (loading) return <div className="text-sm text-muted-foreground">Загрузка…</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Сообщения бота</h1>
        <p className="text-sm text-muted-foreground">Ручные отправки доступны только суперадминистратору.</p>
      </div>
      {status && <div className="rounded-xl border border-border bg-card p-3 text-sm">{status}</div>}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Шаблоны команд</h2>
        {templates.map((template, index) => (
          <label key={`${template.command}-${template.audience}`} className="block space-y-1">
            <span className="text-sm font-medium">{commandLabels[template.command]} · {audienceLabels[template.audience]}</span>
            <textarea value={template.text} maxLength={4096} rows={4} onChange={(event) => setTemplates((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </label>
        ))}
        <button type="button" onClick={saveTemplates} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Сохранить шаблоны</button>
      </section>
      {isSuperadmin && <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Ручная отправка</h2>
        <textarea value={text} maxLength={4096} rows={5} onChange={(event) => setText(event.target.value)} placeholder="Текст сообщения" className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
        <button type="button" onClick={() => setSelectedIds(targets.map((target) => target.id))} className="text-sm text-primary">Выбрать всех доступных</button>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
          {targets.map((target) => <label key={target.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedIds.includes(target.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, target.id] : ids.filter((id) => id !== target.id))} /><span>{target.label} <span className="text-muted-foreground">· {target.kind}{target.username ? ` · @${target.username}` : ''}</span></span></label>)}
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => send('text')} disabled={!text.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Отправить текст</button><button type="button" onClick={() => send('schedule')} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Отправить расписание</button></div>
      </section>}
    </div>
  )
}
