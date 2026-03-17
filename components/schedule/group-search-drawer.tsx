'use client'

import { useState, useEffect, useMemo, useDeferredValue, useRef } from 'react'
import { Search, X, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTelegram } from '@/lib/telegram-context'
import { useSearchHistory } from '@/lib/search-history-store'
import {
  type GroupSearchMatch,
  normalizeSearchValue,
  buildGroupSearchMatches,
} from '@/lib/group-search'
import type { FacultyOption, CourseOption } from '@/lib/timetable-types'
import { Input } from '@/components/ui/input'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'

interface GroupSearchDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectGroup: (match: GroupSearchMatch) => void
}

export function GroupSearchDrawer({
  open,
  onOpenChange,
  onSelectGroup,
}: GroupSearchDrawerProps) {
  const { hapticFeedback } = useTelegram()
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [faculties, setFaculties] = useState<FacultyOption[]>([])
  const [coursesByFaculty, setCoursesByFaculty] = useState<Record<string, CourseOption[]>>({})
  const [isLoadingIndex, setIsLoadingIndex] = useState(false)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [indexReady, setIndexReady] = useState(false)

  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = normalizeSearchValue(deferredQuery)

  // Load faculties + all courses when drawer opens
  useEffect(() => {
    if (!open) return

    setQuery('')
    setIndexError(null)

    // If index is already loaded, skip
    if (indexReady && faculties.length > 0) {
      // Focus input after drawer animation
      setTimeout(() => inputRef.current?.focus(), 300)
      return
    }

    let cancelled = false
    setIsLoadingIndex(true)

    fetch('/api/faculties')
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить данные')
        const data = (await response.json()) as { faculties: FacultyOption[] }
        const loadedFaculties = data.faculties || []
        if (cancelled) return

        setFaculties(loadedFaculties)

        // Load courses for all faculties in parallel
        const results = await Promise.all(
          loadedFaculties.map(async (faculty) => {
            const res = await fetch(`/api/faculties/${faculty.slug}/courses`)
            if (!res.ok) throw new Error('Не удалось загрузить курсы')
            const courseData = (await res.json()) as { courses: CourseOption[] }
            return { slug: faculty.slug, courses: courseData.courses || [] }
          })
        )

        if (cancelled) return

        const coursesMap: Record<string, CourseOption[]> = {}
        results.forEach((entry) => {
          coursesMap[entry.slug] = entry.courses
        })
        setCoursesByFaculty(coursesMap)
        setIndexReady(true)
      })
      .catch((error) => {
        if (!cancelled) {
          setIndexError(
            error instanceof Error ? error.message : 'Не удалось загрузить данные'
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingIndex(false)
          setTimeout(() => inputRef.current?.focus(), 300)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const matches = useMemo(
    () => buildGroupSearchMatches(normalizedQuery, faculties, coursesByFaculty),
    [normalizedQuery, faculties, coursesByFaculty]
  )

  const handleSelect = (match: GroupSearchMatch) => {
    hapticFeedback('success')
    addToHistory(match)
    onSelectGroup(match)
    onOpenChange(false)
  }

  const handleSelectFromHistory = (match: GroupSearchMatch) => {
    hapticFeedback('success')
    addToHistory(match) // moves to top
    onSelectGroup(match)
    onOpenChange(false)
  }

  const handleRemoveFromHistory = (match: GroupSearchMatch) => {
    hapticFeedback('light')
    removeFromHistory(match.groupSlug, match.facultySlug)
  }

  const handleClearHistory = () => {
    hapticFeedback('warning')
    clearHistory()
  }

  const handleClearQuery = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  const hasQuery = query.trim().length > 0

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>Поиск группы</DrawerTitle>
        </DrawerHeader>

        {/* Search input */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Введите название группы"
              className="h-11 rounded-xl pl-10 pr-10 bg-card"
              autoComplete="off"
              autoFocus
            />
            {hasQuery && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Очистить поиск"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results / History */}
        <ScrollArea className="flex-1 overflow-y-auto px-4 pb-4">
          {indexError ? (
            <div className="rounded-xl border border-border bg-card/50 px-3 py-4 text-center text-sm text-destructive">
              {indexError}
            </div>
          ) : isLoadingIndex ? (
            <div className="rounded-xl border border-border bg-card/50 px-3 py-4 text-center text-sm text-muted-foreground">
              Загрузка списка групп...
            </div>
          ) : hasQuery ? (
            /* Search results */
            <div className="rounded-xl border border-border bg-card/50">
              {matches.length > 0 ? (
                matches.slice(0, 12).map((match) => (
                  <button
                    key={`${match.facultySlug}:${match.courseNumber}:${match.groupSlug}`}
                    type="button"
                    onClick={() => handleSelect(match)}
                    className="w-full border-b border-border/70 px-3 py-2.5 text-left last:border-b-0 active:bg-accent/50 transition-colors"
                  >
                    <div className="font-medium text-foreground">
                      Группа {match.groupName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {match.facultyName}, {match.courseNumber} курс
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Ничего не найдено. Проверьте название группы.
                </div>
              )}
            </div>
          ) : history.length > 0 ? (
            /* Recent history */
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Недавние</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Очистить</span>
                </button>
              </div>
              <div className="rounded-xl border border-border bg-card/50">
                {history.map((match) => (
                  <div
                    key={`${match.facultySlug}:${match.groupSlug}`}
                    className="flex items-center border-b border-border/70 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectFromHistory(match)}
                      className="flex-1 px-3 py-2.5 text-left active:bg-accent/50 transition-colors"
                    >
                      <div className="font-medium text-foreground">
                        Группа {match.groupName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {match.facultyName}, {match.courseNumber} курс
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromHistory(match)}
                      className="p-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Удалить ${match.groupName} из истории`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="py-8 text-center text-sm text-muted-foreground">
              Начните вводить название группы
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
