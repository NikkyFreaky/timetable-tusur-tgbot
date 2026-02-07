"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { UserSettings } from "./schedule-types"

const STORAGE_KEY = "tusur-schedule-settings"

const defaultSettings: UserSettings = {
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

let settings: UserSettings = defaultSettings
let listeners: Set<() => void> = new Set()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.error("Failed to load settings:", e)
  }
  return defaultSettings
}

function saveSettings(newSettings: UserSettings) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
  } catch (e) {
    console.error("Failed to save settings:", e)
  }
}

// Initialize settings
if (typeof window !== "undefined") {
  settings = loadSettings()
}

export function useSettings() {
  const getSnapshot = useCallback(() => settings, [])
  const getServerSnapshot = useCallback(() => defaultSettings, [])

  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])

  const currentSettings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    settings = { ...settings, ...updates }
    saveSettings(settings)
    emitChange()
  }, [])

  const resetSettings = useCallback(() => {
    settings = defaultSettings
    saveSettings(settings)
    emitChange()
  }, [])

  return {
    settings: currentSettings,
    updateSettings,
    resetSettings,
  }
}
