"use client"

import { useEffect, useRef, useState } from "react"
import type { UserSettings } from "@/lib/schedule-types"
import { useSettings } from "@/lib/settings-store"
import { useTelegram } from "@/lib/telegram-context"
import type { TelegramClientInfo } from "@/lib/user-store"

type UserResponse = {
  user?: {
    settings?: UserSettings | null
  }
}

type ChatResponse = {
  chat?: {
    settings?: UserSettings | null
  }
}

function hasMeaningfulSettings(settings: UserSettings | null | undefined): boolean {
  return Boolean(settings?.facultySlug || settings?.groupSlug || settings?.course)
}

function areSettingsEqual(a: UserSettings, b: UserSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function UserSync() {
  const { user, webApp, chat } = useTelegram()
  const { settings, updateSettings, resetSettings } = useSettings()
  const [remoteReady, setRemoteReady] = useState(false)
  const lastSettingsRef = useRef(settings)
  const lastScopeRef = useRef<string | null>(null)

  useEffect(() => {
    lastSettingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const isChatScope = Boolean(chat?.id && chat?.type && chat.type !== "private")
    const scope: "user" | "chat" | null = isChatScope ? "chat" : user?.id ? "user" : null
    const scopeKey =
      scope === "chat"
        ? `chat:${chat?.id ?? "unknown"}`
        : scope === "user"
          ? `user:${user?.id ?? "unknown"}`
          : null

    if (lastScopeRef.current !== scopeKey) {
      lastScopeRef.current = scopeKey
      resetSettings()
    }

    if (scope === "chat" && !chat?.id) {
      setRemoteReady(false)
      return
    }

    if (scope === "user" && !user?.id) {
      setRemoteReady(false)
      return
    }

    let cancelled = false
    setRemoteReady(false)

    const endpoint =
      scope === "chat" && chat?.id ? `/api/chats/${chat.id}` : `/api/users/${user?.id}`

    fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) return null
        const data = (await response.json()) as UserResponse | ChatResponse
        if (scope === "chat") {
          return (data as ChatResponse).chat?.settings ?? null
        }
        return (data as UserResponse).user?.settings ?? null
      })
      .then((remoteSettings) => {
        if (cancelled) return
        if (!remoteSettings) return
        if (!hasMeaningfulSettings(remoteSettings)) return
        if (!areSettingsEqual(remoteSettings, lastSettingsRef.current)) {
          updateSettings(remoteSettings)
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, chat?.id, chat?.type, updateSettings, resetSettings])

  const buildDeviceInfo = (): TelegramClientInfo => {
    const storageKey = "telegram-schedule-device-id"
    let deviceId: string | null = null

    try {
      deviceId = localStorage.getItem(storageKey)
      if (!deviceId) {
        const generator = globalThis.crypto?.randomUUID
        deviceId = generator ? generator.call(globalThis.crypto) : null
        if (!deviceId) {
          deviceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        }
        localStorage.setItem(storageKey, deviceId)
      }
    } catch {
      deviceId = null
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return {
      deviceId,
      tgPlatform: webApp?.platform ?? null,
      tgVersion: webApp?.version ?? null,
      userAgent: navigator.userAgent ?? null,
      platform: navigator.platform ?? null,
      language: navigator.language ?? null,
      timezone: timezone ?? null,
    }
  }

  useEffect(() => {
    const isChatScope = Boolean(chat?.id && chat?.type && chat.type !== "private")
    const scope: "user" | "chat" | null = isChatScope ? "chat" : user?.id ? "user" : null
    if (!scope || !remoteReady) return

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      if (scope === "chat" && chat?.id) {
        fetch("/api/chats/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat, settings }),
          signal: controller.signal,
        }).catch(() => {})
      }

      if (scope === "user" && user?.id) {
        const device = buildDeviceInfo()
        fetch("/api/users/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user, settings, device }),
          signal: controller.signal,
        }).catch(() => {})
      }

    }, 400)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [user, chat, settings, remoteReady, webApp])

  return null
}
