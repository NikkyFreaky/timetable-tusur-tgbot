"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type TelegramChat = {
  id: number
  type: string
  title?: string
  username?: string
  photo_url?: string
}

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText: (text: string) => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
  }
  BackButton: {
    isVisible: boolean
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
  }
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred: (type: "error" | "success" | "warning") => void
    selectionChanged: () => void
  }
  platform?: string
  version?: string
  colorScheme: "light" | "dark"
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
  }
  initDataUnsafe: {
    user?: {
      id: number
      is_bot?: boolean
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
      is_premium?: boolean
      added_to_attachment_menu?: boolean
      allows_write_to_pm?: boolean
      photo_url?: string
    }
    chat?: TelegramChat
    chat_type?: string
  }
  sendData: (data: string) => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  enableClosingConfirmation: () => void
  disableClosingConfirmation: () => void
}

interface TelegramContextType {
  webApp: TelegramWebApp | null
  user: TelegramWebApp["initDataUnsafe"]["user"] | null
  chat: TelegramWebApp["initDataUnsafe"]["chat"] | null
  colorScheme: "light" | "dark"
  isReady: boolean
  hapticFeedback: (type: "light" | "medium" | "heavy" | "success" | "error" | "warning" | "selection") => void
}

const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  chat: null,
  colorScheme: "light",
  isReady: false,
  hapticFeedback: () => {},
})

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp

    if (tg) {
      tg.ready()
      tg.expand()
      setWebApp(tg)
      setColorScheme(tg.colorScheme || "light")
      setIsReady(true)

      console.log("Telegram WebApp initialized:", {
        initDataUnsafe: tg.initDataUnsafe,
        user: tg.initDataUnsafe?.user,
        chat: tg.initDataUnsafe?.chat,
      })

      // Apply Telegram theme
      if (tg.themeParams.bg_color) {
        document.documentElement.style.setProperty("--tg-bg-color", tg.themeParams.bg_color)
      }
      if (tg.themeParams.text_color) {
        document.documentElement.style.setProperty("--tg-text-color", tg.themeParams.text_color)
      }

      // Set theme class
      if (tg.colorScheme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    } else {
      // Fallback for non-Telegram environment (development)
      setIsReady(true)
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      setColorScheme(prefersDark ? "dark" : "light")
      if (prefersDark) {
        document.documentElement.classList.add("dark")
      }

      console.log("Telegram WebApp not found, using fallback mode")
    }
  }, [])

  const hapticFeedback = (type: "light" | "medium" | "heavy" | "success" | "error" | "warning" | "selection") => {
    if (!webApp?.HapticFeedback) return

    switch (type) {
      case "light":
      case "medium":
      case "heavy":
        webApp.HapticFeedback.impactOccurred(type)
        break
      case "success":
      case "error":
      case "warning":
        webApp.HapticFeedback.notificationOccurred(type)
        break
      case "selection":
        webApp.HapticFeedback.selectionChanged()
        break
    }
  }

  return (
    <TelegramContext.Provider
      value={{
        webApp,
        user: webApp?.initDataUnsafe?.user || null,
        chat: webApp?.initDataUnsafe?.chat || null,
        colorScheme,
        isReady,
        hapticFeedback,
      }}
    >
      {children}
    </TelegramContext.Provider>
  )
}

export const useTelegram = () => useContext(TelegramContext)
