"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Settings, Users, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserSettings, ChatTopic } from "@/lib/schedule-types"
import type { StoredChat } from "@/lib/chat-store"

interface GroupSettingsPanelProps {
  userId: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function GroupSettingsPanel({
  userId,
  isOpen,
  onOpenChange,
}: GroupSettingsPanelProps) {
  const [chats, setChats] = useState<StoredChat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [selectedChat, setSelectedChat] = useState<StoredChat | null>(null)
  const [topics, setTopics] = useState<ChatTopic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [userRole, setUserRole] = useState<"creator" | "administrator" | "member" | null>(null)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [isLoadingTopics, setIsLoadingTopics] = useState(false)
  const [chatsError, setChatsError] = useState<string | null>(null)
  const [topicsError, setTopicsError] = useState<string | null>(null)

  const selectedSettings: UserSettings = selectedChat?.settings ?? {
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

  useEffect(() => {
    if (!isOpen || !userId) {
      setChats([])
      setSelectedChat(null)
      setSelectedChatId(null)
      return
    }

    const loadChats = async () => {
      setIsLoadingChats(true)
      setChatsError(null)

      try {
        const response = await fetch(`/api/users/${userId}/chats`)
        if (!response.ok) {
          throw new Error("Failed to load chats")
        }
        const data = await response.json()
        setChats(data.chats || [])

        if (data.chats && data.chats.length > 0) {
          setSelectedChatId(data.chats[0].id)
        }
      } catch (error) {
        setChatsError(error instanceof Error ? error.message : "Failed to load chats")
      } finally {
        setIsLoadingChats(false)
      }
    }

    loadChats()
  }, [isOpen, userId])

  useEffect(() => {
    if (selectedChatId) {
      const chat = chats.find((c) => c.id === selectedChatId)
      setSelectedChat(chat || null)
      setSelectedTopicId(chat?.topicId ?? null)

      if (chat) {
        loadTopics(chat.id)
      }
    }
  }, [selectedChatId, chats])

  const loadTopics = async (chatId: number) => {
    setIsLoadingTopics(true)
    setTopicsError(null)

    try {
      const response = await fetch(`/api/chats/${chatId}/topics`, {
        headers: {
          "x-user-id": String(userId),
        },
      })

      if (!response.ok) {
        if (response.status === 403) {
          setUserRole("member")
          throw new Error("У вас нет прав администратора")
        }
        throw new Error("Failed to load topics")
      }

      const data = await response.json()
      setTopics(data.topics || [])
      setUserRole("administrator")
    } catch (error) {
      setTopicsError(error instanceof Error ? error.message : "Failed to load topics")
      setTopics([
        {
          id: null as any,
          chatId,
          name: "Основной чат",
          iconColor: null,
          iconCustomEmojiId: null,
          createdAt: "",
          updatedAt: "",
        },
      ])
    } finally {
      setIsLoadingTopics(false)
    }
  }

  const handleUpdateTopic = async (topicId: number | null) => {
    if (!selectedChatId) return

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/topic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({ topicId }),
      })

      if (!response.ok) {
        throw new Error("Failed to update topic")
      }

      const data = await response.json()
      setSelectedChat(data.chat)
      setSelectedTopicId(topicId)
    } catch (error) {
      console.error("Failed to update topic:", error)
      alert("Не удалось обновить тему")
    }
  }

  if (!isOpen) return null

  if (isLoadingChats) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка групп...</div>
      </div>
    )
  }

  if (chatsError) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-destructive text-center px-4">{chatsError}</div>
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center px-4">
        <Users className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Нет групп</h3>
        <p className="text-sm text-muted-foreground text-center">
          Добавьте бота в групповой чат, чтобы настроить расписание для группы.
        </p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium"
        >
          Закрыть
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-foreground">Настройки групп</h1>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Закрыть
          </button>
        </div>

        <div className="px-4 pb-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Выберите группу
          </label>
          <div className="relative">
            <select
              value={selectedChatId ?? ""}
              onChange={(e) => setSelectedChatId(Number(e.target.value) || null)}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border appearance-none cursor-pointer"
            >
              {chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title || "Без названия"}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4">
          {userRole === "member" && topicsError && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Недостаточно прав</p>
                <p className="text-xs text-destructive/80 mt-1">
                  У вас нет прав администратора в этой группе. Настройку расписания могут выполнять только администраторы.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Тема для отправки уведомлений
            </h3>
            <div className="relative">
              <select
                value={selectedTopicId?.toString() ?? ""}
                onChange={(e) => handleUpdateTopic(Number(e.target.value) || null)}
                disabled={isLoadingTopics || userRole === "member"}
                className={cn(
                  "w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border appearance-none cursor-pointer",
                  (isLoadingTopics || userRole === "member") && "opacity-50 cursor-not-allowed"
                )}
              >
                {topics.map((topic) => (
                  <option key={topic.id ?? "main"} value={topic.id?.toString() ?? ""}>
                    {topic.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            </div>
            {isLoadingTopics && (
              <p className="text-xs text-muted-foreground mt-2">Загрузка тем...</p>
            )}
            {!isLoadingTopics && !selectedChat?.isForum && (
              <p className="text-xs text-muted-foreground mt-2">
                В этой группе отключены темы. Уведомления будут отправляться в основной чат.
              </p>
            )}
          </div>

          {selectedChat && (
            <div className="space-y-4">
              <div className="p-4 bg-card rounded-xl border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{selectedChat.title || "Без названия"}</h4>
                    <p className="text-xs text-muted-foreground">
                      {selectedChat.isForum ? "Форум" : "Обычная группа"}
                    </p>
                  </div>
                </div>

                {selectedChat.settings && selectedChat.settings.groupName ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Группа: </span>
                    <span className="font-medium text-foreground">{selectedChat.settings.groupName}</span>
                    {selectedChat.settings.facultyName && (
                      <>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-foreground">{selectedChat.settings.facultyName}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Группа для расписания не выбрана. Выберите её в настройках.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
