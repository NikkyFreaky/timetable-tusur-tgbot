'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { GroupSearchMatch } from '@/lib/group-search'

const STORAGE_KEY = 'tusur-search-history'
const MAX_HISTORY = 5

let history: GroupSearchMatch[] = []
let listeners: Set<() => void> = new Set()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function loadHistory(): GroupSearchMatch[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_HISTORY)
    }
  } catch (error) {
    console.error('Failed to load search history:', error)
  }
  return []
}

function saveHistory(items: GroupSearchMatch[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (error) {
    console.error('Failed to save search history:', error)
  }
}

if (typeof window !== 'undefined') {
  history = loadHistory()
}

export function useSearchHistory() {
  const getSnapshot = useCallback(() => history, [])
  const getServerSnapshot = useCallback((): GroupSearchMatch[] => [], [])

  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const currentHistory = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addToHistory = useCallback((match: GroupSearchMatch) => {
    const filtered = history.filter(
      (item) => item.groupSlug !== match.groupSlug || item.facultySlug !== match.facultySlug
    )
    history = [match, ...filtered].slice(0, MAX_HISTORY)
    saveHistory(history)
    emitChange()
  }, [])

  const removeFromHistory = useCallback((groupSlug: string, facultySlug: string) => {
    history = history.filter(
      (item) => item.groupSlug !== groupSlug || item.facultySlug !== facultySlug
    )
    saveHistory(history)
    emitChange()
  }, [])

  const clearHistory = useCallback(() => {
    history = []
    saveHistory(history)
    emitChange()
  }, [])

  return {
    history: currentHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
  }
}
