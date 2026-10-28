'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Template = { command: 'start' | 'settings' | 'info'; audience: 'private' | 'group'; text: string }
type Target = { id: string; chatId: number; threadId: number | null; kind: string; label: string; username: string | null }
type SendKind = 'text' | 'schedule'

const commandLabels = { start: '/start', settings: '/settings', info: '/info' }
const audienceLabels = { private: 'Личный чат', group: 'Группа / форум' }

export default function AdminBotPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [recipientQuery, setRecipientQuery] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingTemplates, setSavingTemplates] = useState(false)
  const [sending, setSending] = useState(false)
  const [pendingSend, setPendingSend] = useState<SendKind | null>(null)
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

  const selectedTargets = useMemo(
    () => targets.filter((target) => selectedIds.includes(target.id)),
    [selectedIds, targets]
  )
  const visibleTargets = useMemo(() => {
    const query = recipientQuery.trim().toLowerCase()
    if (!query) return targets
    return targets.filter((target) =>
      [target.label, target.username ?? '', target.kind, String(target.chatId)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [recipientQuery, targets])

  const selectVisible = () => {
    setSelectedIds((ids) => Array.from(new Set([...ids, ...visibleTargets.map((target) => target.id)])))
  }

  const clearVisible = () => {
    const visibleIds = new Set(visibleTargets.map((target) => target.id))
    setSelectedIds((ids) => ids.filter((id) => !visibleIds.has(id)))
  }

  const saveTemplates = async () => {
    setSavingTemplates(true)
    setStatus('')
    try {
      const response = await fetch('/api/admin/bot/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templates }) })
      setStatus(response.ok ? 'Шаблоны сохранены' : 'Не удалось сохранить шаблоны')
    } catch {
      setStatus('Не удалось сохранить шаблоны')
    } finally {
      setSavingTemplates(false)
    }
  }

  const requestSend = (kind: SendKind) => {
    if (!selectedTargets.length) return setStatus('Выберите хотя бы одного адресата')
    if (kind === 'text' && !text.trim()) return setStatus('Введите текст сообщения')
    if (kind === 'schedule' && selectedTargets.length !== 1) return setStatus('Для расписания выберите одного адресата')
    setPendingSend(kind)
  }

  const send = async () => {
    if (!pendingSend) return
    setSending(true)
    setStatus('')
    try {
      const response = await fetch('/api/admin/bot/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: pendingSend, text, confirm: true, targets: selectedTargets.map((target) => ({ chatId: target.chatId, threadId: target.threadId, kind: target.kind === 'user' ? 'user' : 'chat' })) }),
      })
      const data = await response.json().catch(() => ({}))
      setStatus(response.ok ? `Отправлено: ${data.sent}; ошибок: ${data.failed}` : data.error || 'Отправка не выполнена')
    } catch {
      setStatus('Отправка не выполнена')
    } finally {
      setSending(false)
      setPendingSend(null)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Загрузка…</div>
  const actionLabel = pendingSend === 'schedule' ? 'отправить расписание' : 'отправить сообщение'

  return (
    <div className="space-y-8">
      <div><h1 className="text-xl font-semibold">Сообщения бота</h1><p className="text-sm text-muted-foreground">Ручные отправки доступны только суперадминистратору.</p></div>
      {status && <div className="rounded-xl border border-border bg-card p-3 text-sm" role="status" aria-live="polite">{status}</div>}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Шаблоны команд</h2>
        {templates.map((template, index) => (
          <label key={`${template.command}-${template.audience}`} className="block space-y-1"><span className="text-sm font-medium">{commandLabels[template.command]} · {audienceLabels[template.audience]}</span><textarea value={template.text} maxLength={4096} rows={4} onChange={(event) => setTemplates((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
        ))}
        <button type="button" onClick={saveTemplates} disabled={savingTemplates} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">{savingTemplates ? 'Сохранение…' : 'Сохранить шаблоны'}</button>
      </section>
      {isSuperadmin && <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1"><h2 className="font-semibold">Ручная отправка</h2><p className="text-sm text-muted-foreground">Отправка происходит сразу после подтверждения. Проверьте адресатов и текст.</p></div>
        <div className="space-y-2"><div className="flex items-center justify-between gap-3"><label htmlFor="broadcast-text" className="text-sm font-medium">Текст сообщения</label><span className="text-xs text-muted-foreground">{text.length} / 4096</span></div><textarea id="broadcast-text" value={text} maxLength={4096} rows={6} onChange={(event) => setText(event.target.value)} placeholder="Введите текст сообщения" className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium">Адресаты</h3><p className="text-xs text-muted-foreground" aria-live="polite">Выбрано: {selectedTargets.length} из {targets.length}</p></div><div className="flex gap-2"><button type="button" onClick={selectVisible} className="min-h-11 rounded-lg px-3 text-sm text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Выбрать видимые</button><button type="button" onClick={clearVisible} className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Снять видимые</button></div></div>
          <label className="sr-only" htmlFor="recipient-search">Поиск адресатов</label><input id="recipient-search" type="search" value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Поиск по названию, username или ID" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="max-h-80 space-y-1 overflow-y-auto" aria-label="Список адресатов">
            {visibleTargets.map((target) => <label key={target.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent"><input type="checkbox" checked={selectedIds.includes(target.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, target.id] : ids.filter((id) => id !== target.id))} className="size-4" /><span>{target.label} <span className="text-muted-foreground">· {target.kind}{target.username ? ` · @${target.username}` : ''}</span></span></label>)}
            {!visibleTargets.length && <p className="py-4 text-center text-sm text-muted-foreground">Адресаты не найдены</p>}
          </div>
        </div>
        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-sm text-foreground">Будет отправлено {selectedTargets.length} адресатам.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => requestSend('schedule')} disabled={sending} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">Отправить расписание</button><button type="button" onClick={() => requestSend('text')} disabled={sending || !text.trim()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">Отправить текст</button></div></div>
      </section>}
      <AlertDialog open={pendingSend !== null} onOpenChange={(open) => !open && !sending && setPendingSend(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Подтвердите отправку</AlertDialogTitle><AlertDialogDescription>Вы собираетесь {actionLabel} для {selectedTargets.length} адресатов. Это действие нельзя отменить.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={sending}>Отмена</AlertDialogCancel><AlertDialogAction onClick={send} disabled={sending} className="bg-destructive text-white hover:bg-destructive/90">{sending ? 'Отправка…' : 'Отправить'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}
