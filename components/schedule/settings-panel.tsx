"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, GraduationCap, Bell, Clock, RotateCcw, Check, ChevronDown, Users, AlertCircle, RefreshCw } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CenteredLoader } from "@/components/ui/centered-loader"
import { cn } from "@/lib/utils"
import type { UserSettings } from "@/lib/schedule-types"
import type { StoredChat } from "@/lib/chat-store"
import type { ChatTopic } from "@/lib/schedule-types"
import { useTelegram } from "@/lib/telegram-context"
import type { CourseOption, FacultyOption, GroupOption } from "@/lib/timetable-types"

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: UserSettings
  onUpdateSettings: (updates: Partial<UserSettings>) => void
  onResetSettings: () => void
  scopeLabel?: string | null
  userId?: number
}

type SettingsView = "main" | "faculty" | "course" | "group" | "time"
type SettingsTab = "personal" | "groups"

const MASTER_GROUP_PATTERN = /(?:\u041C|\u043C|M|m)/
const COURSE_BADGE_STYLES = [
  "bg-sky-500/10 text-sky-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-amber-500/10 text-amber-600",
  "bg-rose-500/10 text-rose-600",
  "bg-indigo-500/10 text-indigo-600",
  "bg-teal-500/10 text-teal-600",
]

const parseNotificationTime = (value: string) => {
  const [hourRaw, minuteRaw] = value.split(":")
  const hour = Math.min(23, Math.max(0, Number(hourRaw)))
  const minute = Math.min(59, Math.max(0, Number(minuteRaw)))
  return {
    hour: Number.isFinite(hour) ? hour : 7,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

const buildNotificationTime = (hour: number, minute: number) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`

const WHEEL_ITEM_HEIGHT = 44
const WHEEL_VISIBLE_ITEMS = 5
const WHEEL_CONTAINER_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS

export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onResetSettings,
  scopeLabel,
  userId,
}: SettingsPanelProps) {
  const { hapticFeedback } = useTelegram()
  const [view, setView] = useState<SettingsView>("main")
  const [activeTab, setActiveTab] = useState<SettingsTab>("personal")
  const [tempFacultySlug, setTempFacultySlug] = useState<string | null>(settings.facultySlug)
  const [tempCourse, setTempCourse] = useState<number | null>(settings.course)
  const [faculties, setFaculties] = useState<FacultyOption[]>([])
  const [coursesByFaculty, setCoursesByFaculty] = useState<Record<string, CourseOption[]>>({})
  const [isLoadingFaculties, setIsLoadingFaculties] = useState(false)
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [facultiesError, setFacultiesError] = useState<string | null>(null)
  const [coursesError, setCoursesError] = useState<string | null>(null)
  const hourScrollRef = useRef<HTMLDivElement | null>(null)
  const minuteScrollRef = useRef<HTMLDivElement | null>(null)
  const hourScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minuteScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestTimeParts = useRef(parseNotificationTime(settings.notificationTime))

  // Group settings state
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
  const [groupView, setGroupView] = useState<SettingsView>("main")
  const [tempGroupFacultySlug, setTempGroupFacultySlug] = useState<string | null>(null)
  const [tempGroupCourse, setTempGroupCourse] = useState<number | null>(null)
  const [tempGroupSettings, setTempGroupSettings] = useState<UserSettings>({
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
  })
  const groupHourScrollRef = useRef<HTMLDivElement | null>(null)
  const groupMinuteScrollRef = useRef<HTMLDivElement | null>(null)
  const groupHourScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const groupMinuteScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const groupLatestTimeParts = useRef(parseNotificationTime(tempGroupSettings.notificationTime))

  const selectedFacultyName = settings.facultyName
  const selectedGroupName = settings.groupName
  const timeParts = parseNotificationTime(settings.notificationTime)

  useEffect(() => {
    latestTimeParts.current = timeParts
  }, [timeParts.hour, timeParts.minute])

  useEffect(() => {
    if (!open) return

    setTempFacultySlug(settings.facultySlug)
    setTempCourse(settings.course)

    let cancelled = false
    setIsLoadingFaculties(true)
    setFacultiesError(null)

    fetch("/api/faculties")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("⚠️ Не удалось загрузить факультеты. Попробуйте ещё раз чуть позже.")
        }
        const data = (await response.json()) as { faculties: FacultyOption[] }
        if (!cancelled) {
          setFaculties(data.faculties || [])
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFacultiesError(error instanceof Error ? error.message : "⚠️ Не удалось загрузить факультеты. Попробуйте ещё раз чуть позже.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingFaculties(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, settings.course, settings.facultySlug])

  const handleClose = () => {
    setView("main")
    onOpenChange(false)
  }

  const handleBack = () => {
    hapticFeedback("light")
    if (view === "course") setView("faculty")
    else if (view === "group") setView("course")
    else setView("main")
  }

  const handleSelectFaculty = (facultySlug: string) => {
    hapticFeedback("selection")
    setTempFacultySlug(facultySlug)
    setTempCourse(null)
    setView("course")
  }

  const handleSelectCourse = (course: number) => {
    hapticFeedback("selection")
    setTempCourse(course)
    setView("group")
  }

  const handleSelectGroup = (group: GroupOption) => {
    hapticFeedback("success")
    if (!tempFacultySlug || !tempCourse) return

    const faculty = faculties.find((item) => item.slug === tempFacultySlug)

    onUpdateSettings({
      facultySlug: tempFacultySlug,
      facultyName: faculty?.name || null,
      course: tempCourse,
      groupSlug: group.slug,
      groupName: group.name,
    })
    setView("main")
  }

  const handleToggleNotifications = (enabled: boolean) => {
    hapticFeedback("selection")
    onUpdateSettings({ notificationsEnabled: enabled })
  }

  const handleSelectHour = (hour: number) => {
    hapticFeedback("selection")
    onUpdateSettings({
      notificationTime: buildNotificationTime(hour, timeParts.minute),
    })
  }

  const handleSelectMinute = (minute: number) => {
    hapticFeedback("selection")
    onUpdateSettings({
      notificationTime: buildNotificationTime(timeParts.hour, minute),
    })
  }

  const snapWheelScroll = (
    element: HTMLDivElement | null,
    index: number,
    maxIndex: number
  ) => {
    if (!element) return
    const clampedIndex = Math.min(maxIndex, Math.max(0, index))
    element.scrollTo({
      top: clampedIndex * WHEEL_ITEM_HEIGHT,
      behavior: "smooth",
    })
  }

  const handleReset = () => {
    hapticFeedback("warning")
    onResetSettings()
    setView("main")
  }

  useEffect(() => {
    const missingFacultySlug = [tempFacultySlug, tempGroupFacultySlug].find(
      (slug): slug is string => Boolean(slug && !coursesByFaculty[slug])
    )

    if (!missingFacultySlug) return

    let cancelled = false
    setIsLoadingCourses(true)
    setCoursesError(null)

    fetch(`/api/faculties/${missingFacultySlug}/courses`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("⚠️ Не удалось загрузить курсы. Попробуйте ещё раз чуть позже.")
        }
        const data = (await response.json()) as { courses: CourseOption[] }
        if (!cancelled) {
          setCoursesByFaculty((prev) => ({
            ...prev,
            [missingFacultySlug]: data.courses || [],
          }))
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCoursesError(error instanceof Error ? error.message : "⚠️ Не удалось загрузить курсы. Попробуйте ещё раз чуть позже.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCourses(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [tempFacultySlug, tempGroupFacultySlug, coursesByFaculty])

  useEffect(() => {
    if (view !== "time") return
    snapWheelScroll(hourScrollRef.current, timeParts.hour, 23)
    snapWheelScroll(minuteScrollRef.current, timeParts.minute, 59)
  }, [view, timeParts.hour, timeParts.minute])

  useEffect(() => {
    return () => {
      if (hourScrollTimeout.current) clearTimeout(hourScrollTimeout.current)
      if (minuteScrollTimeout.current) clearTimeout(minuteScrollTimeout.current)
    }
  }, [])

  useEffect(() => {
    if (!open || activeTab !== "groups" || !userId) {
      console.log("Skipping chat load:", { open, activeTab, userId })
      return
    }

    let cancelled = false
    setIsLoadingChats(true)
    setChatsError(null)
    setSelectedChat(null)
    setSelectedChatId(null)
    setTopics([])
    setSelectedTopicId(null)
    setUserRole(null)
    setTopicsError(null)

    console.log("=== Loading user chats ===", { userId })

    fetch(`/api/users/${userId}/chats`)
      .then(async (response) => {
        console.log("Chats response status:", response.status)
        if (!response.ok) {
          throw new Error("Не удалось загрузить чаты")
        }
        const data = await response.json()
        console.log("Chats loaded:", data)
        if (!cancelled) {
          const loadedChats = data.chats || []
          console.log("Setting chats:", loadedChats)
          setChats(loadedChats)
        }
      })
      .catch((error) => {
        console.error("Failed to load chats:", error)
        if (!cancelled) {
          setChatsError(error instanceof Error ? error.message : "⚠️ Не удалось загрузить чаты. Попробуйте ещё раз чуть позже.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          console.log("Finished loading chats")
          setIsLoadingChats(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, activeTab, userId])

  // Auto-select first chat after chats are loaded
  useEffect(() => {
    if (chats.length > 0 && !selectedChatId && !isLoadingChats) {
      console.log("Auto-selecting first chat:", chats[0])
      handleChatSelect(chats[0].id)
    }
  }, [chats, selectedChatId, isLoadingChats])

  const handleChatSelect = (chatId: number) => {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return

    console.log("handleChatSelect called:", chatId, chat)

    hapticFeedback("selection")
    setSelectedChatId(chatId)
    setSelectedChat(chat)
    setSelectedTopicId(chat.topicId)
    setTempGroupSettings(chat.settings || {
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
    })
    setTempGroupFacultySlug(chat.settings?.facultySlug || null)
    setTempGroupCourse(chat.settings?.course || null)

    if (!userId) {
      console.log("No userId, skipping topic load")
      return
    }

    let cancelled = false
    setIsLoadingTopics(true)
    setTopicsError(null)
    setUserRole(null)

    console.log("Loading topics for chat:", chatId, "userId:", userId)

    fetch(`/api/chats/${chatId}/topics`, {
      headers: {
        "x-user-id": String(userId),
      },
    })
      .then(async (response) => {
        console.log("Topics response status:", response.status)
        if (response.status === 403) {
          console.log("User is not admin, role: member")
          setUserRole("member")
          setTopicsError("У вас нет прав администратора")
          return
        }
        if (!response.ok) {
          throw new Error("Не удалось загрузить темы")
        }
        const data = await response.json()
        console.log("Topics loaded:", data.topics)
        if (!cancelled) {
          setTopics(data.topics || [])
          setUserRole("administrator")
        }
      })
      .catch((error) => {
        console.error("Failed to load topics:", error)
        if (!cancelled) {
          setTopicsError(error instanceof Error ? error.message : "⚠️ Не удалось загрузить темы. Попробуйте ещё раз чуть позже.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTopics(false)
        }
      })
  }

  const handleSyncChatInfo = async (chatId: number) => {
    if (!userId) return

    console.log("Syncing chat info for:", chatId)

    try {
      const response = await fetch(`/api/chats/${chatId}/sync-info`, {
        method: "POST",
      })

      console.log("Sync chat info response status:", response.status)

      if (!response.ok) {
        throw new Error("Не удалось обновить информацию о чате")
      }

      const data = await response.json()
      console.log("Chat synced:", data.chat)

      hapticFeedback("success")

      // Reload topics
      if (selectedChatId === chatId) {
        handleChatSelect(chatId)
      }
    } catch (error) {
      console.error("Failed to sync chat info:", error)
      hapticFeedback("error")
    }
  }

  const handleUpdateTopic = async (topicId: number | null) => {
    if (!selectedChatId || !userId) {
      console.log("handleUpdateTopic called without selectedChatId or userId")
      return
    }

    console.log("Updating topic:", topicId, "for chat:", selectedChatId)

    hapticFeedback("selection")
    setSelectedTopicId(topicId)

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/topic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({ topicId }),
      })

      console.log("Topic update response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Failed to update topic:", response.status, errorText)
        throw new Error("Не удалось обновить тему")
      }

      const responseData = await response.json()
      console.log("Topic updated successfully:", responseData)

      if (selectedChat) {
        setSelectedChat({ ...selectedChat, topicId })
      }
    } catch (error) {
      console.error("Failed to update topic:", error)
    }
  }

  const handleUpdateGroupSettings = async (updates: Partial<UserSettings>) => {
    if (!selectedChatId || !userId) {
      console.log("handleUpdateGroupSettings called without selectedChatId or userId")
      return
    }

    const newSettings = { ...tempGroupSettings, ...updates }
    console.log("Updating group settings:", updates)
    console.log("New settings:", newSettings)
    setTempGroupSettings(newSettings)

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({ settings: updates }),
      })

      console.log("Settings update response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Failed to update settings:", response.status, errorText)
        throw new Error("Не удалось сохранить настройки")
      }

      const responseData = await response.json()
      console.log("Settings updated successfully:", responseData)

      if (selectedChat) {
        setSelectedChat({ ...selectedChat, settings: newSettings })
      }
    } catch (error) {
      console.error("Failed to update group settings:", error)
    }
  }

  const handleSelectGroupFacultyForChat = (facultySlug: string) => {
    hapticFeedback("selection")
    setTempGroupFacultySlug(facultySlug)
    setTempGroupCourse(null)
    setGroupView("course")
  }

  const handleSelectGroupCourseForChat = (course: number) => {
    hapticFeedback("selection")
    setTempGroupCourse(course)
    setGroupView("group")
  }

  const handleSelectGroupForChat = (group: GroupOption) => {
    hapticFeedback("success")
    if (!tempGroupFacultySlug || !tempGroupCourse) return

    const faculty = faculties.find((item) => item.slug === tempGroupFacultySlug)

    handleUpdateGroupSettings({
      facultySlug: tempGroupFacultySlug,
      facultyName: faculty?.name || null,
      course: tempGroupCourse,
      groupSlug: group.slug,
      groupName: group.name,
    })
    setGroupView("main")
  }

  const handleGroupBack = () => {
    hapticFeedback("light")
    if (groupView === "course") setGroupView("faculty")
    else if (groupView === "group") setGroupView("course")
    else if (groupView === "time") setGroupView("main")
    else setGroupView("main")
  }

  const groupTimeParts = parseNotificationTime(tempGroupSettings.notificationTime)

  useEffect(() => {
    groupLatestTimeParts.current = groupTimeParts
  }, [groupTimeParts.hour, groupTimeParts.minute])

  useEffect(() => {
    if (groupView !== "time") return
    setTimeout(() => {
      const hourRef = groupHourScrollRef.current
      const minuteRef = groupMinuteScrollRef.current
      if (hourRef) snapWheelScroll(hourRef, groupTimeParts.hour, 23)
      if (minuteRef) snapWheelScroll(minuteRef, groupTimeParts.minute, 59)
    }, 100)
  }, [groupView, groupTimeParts.hour, groupTimeParts.minute])

  useEffect(() => {
    return () => {
      if (groupHourScrollTimeout.current) clearTimeout(groupHourScrollTimeout.current)
      if (groupMinuteScrollTimeout.current) clearTimeout(groupMinuteScrollTimeout.current)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setActiveTab("personal")
      setChats([])
      setSelectedChatId(null)
      setSelectedChat(null)
      setTopics([])
      setSelectedTopicId(null)
      setUserRole(null)
      setChatsError(null)
      setTopicsError(null)
      setGroupView("main")
      setTempGroupFacultySlug(null)
      setTempGroupCourse(null)
      setTempGroupSettings({
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
      })
    }
  }, [open])

  const availableCourses = tempFacultySlug ? coursesByFaculty[tempFacultySlug] || [] : []
  const sortedCourses = [...availableCourses].sort((first, second) => {
    const firstHasMaster = first.groups.some((group) => MASTER_GROUP_PATTERN.test(group.name))
    const secondHasMaster = second.groups.some((group) => MASTER_GROUP_PATTERN.test(group.name))

    if (firstHasMaster !== secondHasMaster) {
      return firstHasMaster ? -1 : 1
    }

    return first.number - second.number
  })
  const selectedCourse = availableCourses.find((course) => course.number === tempCourse)
  const availableGroups = selectedCourse?.groups || []

  const availableGroupCourses = tempGroupFacultySlug ? coursesByFaculty[tempGroupFacultySlug] || [] : []
  const sortedGroupCourses = [...availableGroupCourses].sort((first, second) => {
    const firstHasMaster = first.groups.some((group) => MASTER_GROUP_PATTERN.test(group.name))
    const secondHasMaster = second.groups.some((group) => MASTER_GROUP_PATTERN.test(group.name))

    if (firstHasMaster !== secondHasMaster) {
      return firstHasMaster ? -1 : 1
    }

    return first.number - second.number
  })
  const selectedGroupCourse = availableGroupCourses.find((course) => course.number === tempGroupCourse)
  const availableGroupOptions = selectedGroupCourse?.groups || []
  const hours = Array.from({ length: 24 }, (_, index) => index)
  const minutes = Array.from({ length: 60 }, (_, index) => index)

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl px-0">
        <SheetHeader className="px-4 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            {view !== "main" && groupView === "main" ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-primary text-sm font-medium"
              >
                Назад
              </button>
            ) : view === "main" && groupView !== "main" ? (
              <button
                type="button"
                onClick={handleGroupBack}
                className="text-primary text-sm font-medium"
              >
                Назад
              </button>
            ) : (
              <div className="w-12" />
            )}
            <SheetTitle className={cn("text-lg", (view === "main" && groupView === "main") && "mx-auto")}>
              {view === "main" && groupView === "main" && "Настройки"}
              {view === "faculty" && "Выберите факультет"}
              {view === "course" && "Выберите курс"}
              {view === "group" && "Выберите группу"}
              {view === "time" && "Время уведомления"}
              {view === "main" && groupView === "faculty" && "Выберите факультет"}
              {view === "main" && groupView === "course" && "Выберите курс"}
              {view === "main" && groupView === "group" && "Выберите группу"}
              {view === "main" && groupView === "time" && "Время уведомления"}
            </SheetTitle>
            {view !== "main" || groupView !== "main" ? (
              <div className="w-12" />
            ) : null}
          </div>
          {view === "main" && groupView === "main" && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
              <TabsList className="w-full mt-4">
                <TabsTrigger value="personal">Личные</TabsTrigger>
                <TabsTrigger value="groups">Групповые</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </SheetHeader>

        <div className="overflow-y-auto h-full pb-20">
          {view === "main" && groupView === "main" && (
            <Tabs value={activeTab}>
              <TabsContent value="personal">
                <div className="py-4">
                  {scopeLabel && (
                    <div className="px-4 mb-4 text-xs text-muted-foreground text-center">
                      {scopeLabel}
                    </div>
                  )}
              {/* Group Selection */}
              <div className="px-4 mb-6">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Группа
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback("light")
                    setView("faculty")
                  }}
                  className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-foreground">
                        {selectedGroupName || "Не выбрана"}
                      </div>
                      {selectedFacultyName && settings.course && (
                        <div className="text-sm text-muted-foreground">
                          {selectedFacultyName}, {settings.course} курс
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Notifications */}
              <div className="px-4 mb-6">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Уведомления
                </h3>
                <div className="bg-card rounded-xl border border-border divide-y divide-border">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Bell className="h-5 w-5 text-green-500" />
                      </div>
                      <span className="font-medium text-foreground">Получать расписание</span>
                    </div>
                    <Switch
                      checked={settings.notificationsEnabled}
                      onCheckedChange={handleToggleNotifications}
                    />
                  </div>
                  {settings.notificationsEnabled && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          hapticFeedback("light")
                          setView("time")
                        }}
                        className="w-full flex items-center justify-between p-4 active:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-blue-500" />
                          </div>
                          <span className="font-medium text-foreground">Время отправки</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{settings.notificationTime}</span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </button>
                      <div className="px-4 pb-4 pt-3 space-y-4">
                        <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-foreground">
                              Когда отправлять
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Основное
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                              <span className="text-sm font-medium text-foreground">За день до</span>
                              <Switch
                                checked={settings.sendDayBefore}
                                onCheckedChange={(enabled) => {
                                  hapticFeedback("selection")
                                  onUpdateSettings({ sendDayBefore: enabled })
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                              <span className="text-sm font-medium text-foreground">В день пар</span>
                              <Switch
                                checked={settings.sendDayOf}
                                onCheckedChange={(enabled) => {
                                  hapticFeedback("selection")
                                  onUpdateSettings({ sendDayOf: enabled })
                                }}
                              />
                            </div>
                          </div>
                        </section>
                        <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-foreground">
                              Дополнительные уведомления
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              События
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                              <span className="text-sm font-medium text-foreground">Об отсутствии пар</span>
                              <Switch
                                checked={settings.notifyNoLessons}
                                onCheckedChange={(enabled) => {
                                  hapticFeedback("selection")
                                  onUpdateSettings({ notifyNoLessons: enabled })
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                              <span className="text-sm font-medium text-foreground">
                                Праздники (за день)
                              </span>
                              <Switch
                                checked={settings.notifyHolidays}
                                onCheckedChange={(enabled) => {
                                  hapticFeedback("selection")
                                  onUpdateSettings({ notifyHolidays: enabled })
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                              <span className="text-sm font-medium text-foreground">
                                Каникулы (за день)
                              </span>
                              <Switch
                                checked={settings.notifyVacations}
                                onCheckedChange={(enabled) => {
                                  hapticFeedback("selection")
                                  onUpdateSettings({ notifyVacations: enabled })
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                              <span className="text-sm font-medium text-foreground">Начало недели</span>
                              <Switch
                                checked={settings.notifyWeekStart}
                                onCheckedChange={(enabled) => {
                                  hapticFeedback("selection")
                                  onUpdateSettings({ notifyWeekStart: enabled })
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                              <span className="text-sm font-medium text-foreground">В день праздника</span>
                              <Switch
                                checked={settings.notifyHolidayDay}
                                onCheckedChange={(enabled) => {
                                  hapticFeedback("selection")
                                  onUpdateSettings({ notifyHolidayDay: enabled })
                                }}
                              />
                            </div>
                          </div>
                        </section>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Reset */}
              <div className="px-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full flex items-center justify-center gap-2 p-4 bg-destructive/10 text-destructive rounded-xl font-medium active:bg-destructive/20 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Сбросить настройки
                </button>
              </div>
            </div>
          </TabsContent>

              <TabsContent value="groups">
                <div className="py-4">
                  {!userId && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Групповые настройки доступны только через Telegram Mini App.
                      Откройте приложение через бота @timetable_tusur_tg_bot.
                    </div>
                  )}
                  {userId && isLoadingChats && (
                    <CenteredLoader label="Загрузка групп..." className="min-h-[180px]" />
                  )}
                  {userId && !isLoadingChats && chatsError && (
                    <div className="px-4 py-8 text-center text-destructive">
                      {chatsError}
                    </div>
                  )}
                  {userId && !isLoadingChats && !chatsError && chats.length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Нет групп
                    </div>
                  )}
                  {!isLoadingChats && !chatsError && chats.length > 0 && (
                    <>
                      {/* Chat Selection */}
                      <div className="px-4 mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Группа
                          </h3>
                          {selectedChatId && (
                            <button
                              type="button"
                              onClick={() => handleSyncChatInfo(selectedChatId)}
                              className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity"
                              title="Обновить информацию о чате"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Обновить
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <select
                            value={selectedChatId || ""}
                            onChange={(e) => e.target.value && handleChatSelect(Number(e.target.value))}
                            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border appearance-none cursor-pointer text-foreground"
                          >
                            <option value="" disabled>
                              Выберите группу
                            </option>
                            {chats.map((chat) => (
                              <option key={chat.id} value={chat.id}>
                                {chat.title || "Без названия"}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>

                      {selectedChat && (
                        <>
                          {/* Topic Selection */}
                          {selectedChat.isForum ? (
                            <div className="px-4 mb-6">
                              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                Тема для уведомлений
                              </h3>
                              <div className="relative">
                                  <select
                                    value={selectedTopicId === null ? "__main__" : String(selectedTopicId)}
                                    onChange={(e) => {
                                      const value = e.target.value === "__main__" ? null : Number(e.target.value)
                                      handleUpdateTopic(value)
                                    }}
                                    disabled={userRole === "member"}
                                  className={cn(
                                    "w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border appearance-none cursor-pointer text-foreground",
                                    userRole === "member" && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <option value="__main__">
                                    Без темы (в общий чат)
                                  </option>
                                  {topics.map((topic) => (
                                    <option key={topic.id} value={topic.id}>
                                      {topic.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                              </div>
                            </div>
                          ) : (
                            <div className="px-4 mb-6">
                              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                Темы отключены
                              </h3>
                              <div className="text-sm text-muted-foreground">
                                Этот чат не является форумом. Уведомления будут отправляться в общий чат.
                              </div>
                            </div>
                          )}

                          {/* User Role Warning */}
                          {userRole === "member" && (
                            <div className="px-4 mb-6">
                              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-700 dark:text-amber-400">
                                  У вас нет прав администратора. Управление настройками ограничено.
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Group Selection */}
                          <div className="px-4 mb-6">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Учебная группа
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                hapticFeedback("light")
                                setGroupView("faculty")
                              }}
                              disabled={userRole === "member"}
                              className={cn(
                                "w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:bg-accent/50 transition-colors",
                                userRole === "member" && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <GraduationCap className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-left">
                                  <div className="font-medium text-foreground">
                                    {tempGroupSettings.groupName || "Не выбрана"}
                                  </div>
                                  {tempGroupSettings.facultyName && tempGroupSettings.course && (
                                    <div className="text-sm text-muted-foreground">
                                      {tempGroupSettings.facultyName}, {tempGroupSettings.course} курс
                                    </div>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </button>
                          </div>

                          {/* Notifications */}
                          <div className="px-4 mb-6">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Уведомления
                            </h3>
                            <div className="bg-card rounded-xl border border-border divide-y divide-border">
                              <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <Bell className="h-5 w-5 text-green-500" />
                                  </div>
                                  <span className="font-medium text-foreground">Получать расписание</span>
                                </div>
                                <Switch
                                  checked={tempGroupSettings.notificationsEnabled}
                                  onCheckedChange={(enabled) => {
                                    hapticFeedback("selection")
                                    handleUpdateGroupSettings({ notificationsEnabled: enabled })
                                  }}
                                  disabled={userRole === "member"}
                                />
                              </div>
                              {tempGroupSettings.notificationsEnabled && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      hapticFeedback("light")
                                      setGroupView("time")
                                    }}
                                    disabled={userRole === "member"}
                                    className={cn(
                                      "w-full flex items-center justify-between p-4 active:bg-accent/50 transition-colors",
                                      userRole === "member" && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                        <Clock className="h-5 w-5 text-blue-500" />
                                      </div>
                                      <span className="font-medium text-foreground">Время отправки</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">{tempGroupSettings.notificationTime}</span>
                                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  </button>
                                  <div className="px-4 pb-4 pt-3 space-y-4">
                                    <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-xs font-semibold text-foreground">
                                          Когда отправлять
                                        </div>
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                          Основное
                                        </span>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                                          <span className="text-sm font-medium text-foreground">За день до</span>
                                          <Switch
                                            checked={tempGroupSettings.sendDayBefore}
                                            onCheckedChange={(enabled) => {
                                              hapticFeedback("selection")
                                              handleUpdateGroupSettings({ sendDayBefore: enabled })
                                            }}
                                            disabled={userRole === "member"}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                                          <span className="text-sm font-medium text-foreground">В день пар</span>
                                          <Switch
                                            checked={tempGroupSettings.sendDayOf}
                                            onCheckedChange={(enabled) => {
                                              hapticFeedback("selection")
                                              handleUpdateGroupSettings({ sendDayOf: enabled })
                                            }}
                                            disabled={userRole === "member"}
                                          />
                                        </div>
                                      </div>
                                    </section>
                                    <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-xs font-semibold text-foreground">
                                          Дополнительные уведомления
                                        </div>
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                          События
                                        </span>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                                          <span className="text-sm font-medium text-foreground">Об отсутствии пар</span>
                                          <Switch
                                            checked={tempGroupSettings.notifyNoLessons}
                                            onCheckedChange={(enabled) => {
                                              hapticFeedback("selection")
                                              handleUpdateGroupSettings({ notifyNoLessons: enabled })
                                            }}
                                            disabled={userRole === "member"}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                                          <span className="text-sm font-medium text-foreground">
                                            Праздники (за день)
                                          </span>
                                          <Switch
                                            checked={tempGroupSettings.notifyHolidays}
                                            onCheckedChange={(enabled) => {
                                              hapticFeedback("selection")
                                              handleUpdateGroupSettings({ notifyHolidays: enabled })
                                            }}
                                            disabled={userRole === "member"}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                                          <span className="text-sm font-medium text-foreground">
                                            Каникулы (за день)
                                          </span>
                                          <Switch
                                            checked={tempGroupSettings.notifyVacations}
                                            onCheckedChange={(enabled) => {
                                              hapticFeedback("selection")
                                              handleUpdateGroupSettings({ notifyVacations: enabled })
                                            }}
                                            disabled={userRole === "member"}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                                          <span className="text-sm font-medium text-foreground">Начало недели</span>
                                          <Switch
                                            checked={tempGroupSettings.notifyWeekStart}
                                            onCheckedChange={(enabled) => {
                                              hapticFeedback("selection")
                                              handleUpdateGroupSettings({ notifyWeekStart: enabled })
                                            }}
                                            disabled={userRole === "member"}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
                                          <span className="text-sm font-medium text-foreground">В день праздника</span>
                                          <Switch
                                            checked={tempGroupSettings.notifyHolidayDay}
                                            onCheckedChange={(enabled) => {
                                              hapticFeedback("selection")
                                              handleUpdateGroupSettings({ notifyHolidayDay: enabled })
                                            }}
                                            disabled={userRole === "member"}
                                          />
                                        </div>
                                      </div>
                                    </section>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Group sub-views */}
          {view === "main" && groupView !== "main" && (
            <div className="py-4">
              {groupView === "faculty" && (
                <div className="py-2">
                  {isLoadingFaculties && (
                    <CenteredLoader label="Загрузка факультетов..." className="min-h-[180px]" />
                  )}
                  {!isLoadingFaculties && facultiesError && (
                    <div className="px-4 py-8 text-center text-destructive">
                      {facultiesError}
                    </div>
                  )}
                  {!isLoadingFaculties && !facultiesError && faculties.length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Нет доступных факультетов
                    </div>
                  )}
                  {!isLoadingFaculties && !facultiesError && faculties.length > 0 && (
                    faculties.map((faculty) => (
                      <button
                        key={faculty.slug}
                        type="button"
                        onClick={() => handleSelectGroupFacultyForChat(faculty.slug)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3.5 active:bg-accent/50 transition-colors",
                          faculty.slug === tempGroupFacultySlug && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="h-11 w-11 rounded-2xl border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden">
                            {faculty.imageUrl ? (
                              <img
                                src={faculty.imageUrl}
                                alt={`${faculty.name} логотип`}
                                className="h-8 w-8 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground">
                                {faculty.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-foreground">{faculty.name}</div>
                        </div>
                        {faculty.slug === tempGroupFacultySlug && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {groupView === "course" && (
                <div className="py-2">
                  {!tempGroupFacultySlug && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Сначала выберите факультет
                    </div>
                  )}
                  {tempGroupFacultySlug && isLoadingCourses && (
                    <CenteredLoader label="Загрузка курсов..." className="min-h-[180px]" />
                  )}
                  {tempGroupFacultySlug && !isLoadingCourses && coursesError && (
                    <div className="px-4 py-8 text-center text-destructive">
                      {coursesError}
                    </div>
                  )}
                  {tempGroupFacultySlug && !isLoadingCourses && !coursesError && sortedGroupCourses.length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Нет доступных курсов
                    </div>
                  )}
                  {tempGroupFacultySlug && !isLoadingCourses && !coursesError && sortedGroupCourses.length > 0 && (
                    sortedGroupCourses.map((course) => (
                      <button
                        key={course.number}
                        type="button"
                        onClick={() => handleSelectGroupCourseForChat(course.number)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3.5 active:bg-accent/50 transition-colors",
                          course.number === tempGroupCourse && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-12 w-12 rounded-2xl flex items-center justify-center text-2xl font-semibold",
                              COURSE_BADGE_STYLES[
                                (course.number - 1) % COURSE_BADGE_STYLES.length
                              ]
                            )}
                          >
                            {course.number}
                          </div>
                          <div className="text-left">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">
                              Курс
                            </div>
                            <div className="font-medium text-foreground">{course.name}</div>
                          </div>
                        </div>
                        {course.number === tempGroupCourse && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {groupView === "group" && (
                <div className="py-2">
                  {!tempGroupCourse && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Сначала выберите курс
                    </div>
                  )}
                  {tempGroupCourse && isLoadingCourses && (
                    <CenteredLoader label="Загрузка групп..." className="min-h-[180px]" />
                  )}
                  {tempGroupCourse && !isLoadingCourses && coursesError && (
                    <div className="px-4 py-8 text-center text-destructive">
                      {coursesError}
                    </div>
                  )}
                  {tempGroupCourse && !isLoadingCourses && availableGroupOptions.length > 0 ? (
                    availableGroupOptions.map((group) => (
                      <button
                        key={group.slug}
                        type="button"
                        onClick={() => handleSelectGroupForChat(group)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3.5 active:bg-accent/50 transition-colors",
                          group.slug === tempGroupSettings.groupSlug && "bg-primary/5"
                        )}
                      >
                        <span className="font-medium text-foreground">Группа {group.name}</span>
                        {group.slug === tempGroupSettings.groupSlug && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))
                  ) : tempGroupCourse && !isLoadingCourses && !coursesError ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Нет доступных групп для выбранного курса
                    </div>
                  ) : null}
                </div>
              )}

              {groupView === "time" && (
                <div className="py-4 px-4 space-y-6">
                  <div className="text-center">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Время уведомления
                    </div>
                    <div className="text-4xl font-semibold text-foreground tracking-[0.08em]">
                      {tempGroupSettings.notificationTime}
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Час
                      </div>
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-inner backdrop-blur-sm"
                        style={{ height: WHEEL_CONTAINER_HEIGHT }}
                      >
                        <div
                          ref={groupHourScrollRef}
                          onScroll={() => {
                            if (groupHourScrollTimeout.current) {
                              clearTimeout(groupHourScrollTimeout.current)
                            }
                            groupHourScrollTimeout.current = setTimeout(() => {
                              const element = groupHourScrollRef.current
                              if (!element) return
                              const index = Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT)
                              const clampedIndex = Math.min(23, Math.max(0, index))
                              if (clampedIndex !== groupLatestTimeParts.current.hour) {
                                hapticFeedback("selection")
                                handleUpdateGroupSettings({
                                  notificationTime: buildNotificationTime(
                                    clampedIndex,
                                    groupLatestTimeParts.current.minute
                                  ),
                                })
                              }
                              snapWheelScroll(element, clampedIndex, 23)
                            }, 120)
                          }}
                          className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
                          style={{ paddingBlock: WHEEL_ITEM_HEIGHT * 2 }}
                        >
                           {hours.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => {
                                hapticFeedback("selection")
                                handleUpdateGroupSettings({
                                  notificationTime: buildNotificationTime(hour, groupTimeParts.minute),
                                })
                              }}
                              className={cn(
                                "h-11 w-full flex items-center justify-center text-lg font-semibold snap-center transition-colors",
                                hour === groupTimeParts.hour
                                  ? "text-foreground text-2xl"
                                  : "text-muted-foreground/60"
                              )}
                            >
                              {String(hour).padStart(2, "0")}
                            </button>
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 rounded-xl bg-foreground/5" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 border-t border-b border-foreground/20" />
                      </div>
                    </div>
                    <div className="text-4xl font-semibold text-muted-foreground/70">:</div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Минуты
                      </div>
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-inner backdrop-blur-sm"
                        style={{ height: WHEEL_CONTAINER_HEIGHT }}
                      >
                        <div
                          ref={groupMinuteScrollRef}
                          onScroll={() => {
                            if (groupMinuteScrollTimeout.current) {
                              clearTimeout(groupMinuteScrollTimeout.current)
                            }
                            groupMinuteScrollTimeout.current = setTimeout(() => {
                              const element = groupMinuteScrollRef.current
                              if (!element) return
                              const index = Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT)
                              const clampedIndex = Math.min(59, Math.max(0, index))
                              if (clampedIndex !== groupLatestTimeParts.current.minute) {
                                hapticFeedback("selection")
                                handleUpdateGroupSettings({
                                  notificationTime: buildNotificationTime(
                                    groupLatestTimeParts.current.hour,
                                    clampedIndex
                                  ),
                                })
                              }
                              snapWheelScroll(element, clampedIndex, 59)
                            }, 120)
                          }}
                          className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
                          style={{ paddingBlock: WHEEL_ITEM_HEIGHT * 2 }}
                        >
                          {minutes.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => {
                                hapticFeedback("selection")
                                handleUpdateGroupSettings({
                                  notificationTime: buildNotificationTime(groupTimeParts.hour, minute),
                                })
                              }}
                              className={cn(
                                "h-11 w-full flex items-center justify-center text-lg font-semibold snap-center transition-colors",
                                minute === groupTimeParts.minute
                                  ? "text-foreground text-2xl"
                                  : "text-muted-foreground/60"
                              )}
                            >
                              {String(minute).padStart(2, "0")}
                            </button>
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 rounded-xl bg-foreground/5" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 border-t border-b border-foreground/20" />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Прокрутите, чтобы выбрать время, как в будильнике.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Personal sub-views */}
          {view !== "main" && (
            <div className="py-4">
              {view === "faculty" && (
                <div className="py-2">
                  {isLoadingFaculties && (
                    <CenteredLoader label="Загрузка факультетов..." className="min-h-[180px]" />
                  )}
                  {!isLoadingFaculties && facultiesError && (
                    <div className="px-4 py-8 text-center text-destructive">
                      {facultiesError}
                    </div>
                  )}
                  {!isLoadingFaculties && !facultiesError && faculties.length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Нет доступных факультетов
                    </div>
                  )}
                  {!isLoadingFaculties && !facultiesError && faculties.length > 0 && (
                    faculties.map((faculty) => (
                      <button
                        key={faculty.slug}
                        type="button"
                        onClick={() => handleSelectFaculty(faculty.slug)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3.5 active:bg-accent/50 transition-colors",
                          faculty.slug === tempFacultySlug && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="h-11 w-11 rounded-2xl border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden">
                            {faculty.imageUrl ? (
                              <img
                                src={faculty.imageUrl}
                                alt={`${faculty.name} логотип`}
                                className="h-8 w-8 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground">
                                {faculty.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-foreground">{faculty.name}</div>
                        </div>
                        {faculty.slug === tempFacultySlug && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {view === "course" && (
                <div className="py-2">
                  {!tempFacultySlug && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Сначала выберите факультет
                    </div>
                  )}
                  {tempFacultySlug && isLoadingCourses && (
                    <CenteredLoader label="Загрузка курсов..." className="min-h-[180px]" />
                  )}
                  {tempFacultySlug && !isLoadingCourses && coursesError && (
                    <div className="px-4 py-8 text-center text-destructive">
                      {coursesError}
                    </div>
                  )}
                  {tempFacultySlug && !isLoadingCourses && sortedCourses.length > 0 ? (
                    sortedCourses.map((course) => (
                      <button
                        key={course.number}
                        type="button"
                        onClick={() => handleSelectCourse(course.number)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3.5 active:bg-accent/50 transition-colors",
                          course.number === tempCourse && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-12 w-12 rounded-2xl flex items-center justify-center text-2xl font-semibold",
                              COURSE_BADGE_STYLES[
                                (course.number - 1) % COURSE_BADGE_STYLES.length
                              ]
                            )}
                          >
                            {course.number}
                          </div>
                          <div className="text-left">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">
                              Курс
                            </div>
                            <div className="font-medium text-foreground">{course.name}</div>
                          </div>
                        </div>
                        {course.number === tempCourse && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))
                  ) : tempFacultySlug && !isLoadingCourses && !coursesError ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Нет доступных курсов для выбранного факультета
                    </div>
                  ) : null}
                </div>
              )}

              {view === "group" && (
                <div className="py-2">
                  {!tempCourse && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Сначала выберите курс
                    </div>
                  )}
                  {tempCourse && isLoadingCourses && (
                    <CenteredLoader label="Загрузка групп..." className="min-h-[180px]" />
                  )}
                  {tempCourse && !isLoadingCourses && coursesError && (
                    <div className="px-4 py-8 text-center text-destructive">
                      {coursesError}
                    </div>
                  )}
                  {tempCourse && !isLoadingCourses && availableGroups.length > 0 ? (
                    availableGroups.map((group) => (
                      <button
                        key={group.slug}
                        type="button"
                        onClick={() => handleSelectGroup(group)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3.5 active:bg-accent/50 transition-colors",
                          group.slug === settings.groupSlug && "bg-primary/5"
                        )}
                      >
                        <span className="font-medium text-foreground">Группа {group.name}</span>
                        {group.slug === settings.groupSlug && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))
                  ) : tempCourse && !isLoadingCourses && !coursesError ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Нет доступных групп для выбранного курса
                    </div>
                  ) : null}
                </div>
              )}

              {view === "time" && (
                <div className="py-4 px-4 space-y-6">
                  <div className="text-center">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Время уведомления
                    </div>
                    <div className="text-4xl font-semibold text-foreground tracking-[0.08em]">
                      {settings.notificationTime}
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Час
                      </div>
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-inner backdrop-blur-sm"
                        style={{ height: WHEEL_CONTAINER_HEIGHT }}
                      >
                        <div
                          ref={hourScrollRef}
                          onScroll={() => {
                            if (hourScrollTimeout.current) {
                              clearTimeout(hourScrollTimeout.current)
                            }
                            hourScrollTimeout.current = setTimeout(() => {
                              const element = hourScrollRef.current
                              if (!element) return
                              const index = Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT)
                              const clampedIndex = Math.min(23, Math.max(0, index))
                              if (clampedIndex !== latestTimeParts.current.hour) {
                                hapticFeedback("selection")
                                onUpdateSettings({
                                  notificationTime: buildNotificationTime(clampedIndex, latestTimeParts.current.minute),
                                })
                              }
                              snapWheelScroll(element, clampedIndex, 23)
                            }, 120)
                          }}
                          className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
                          style={{ paddingBlock: WHEEL_ITEM_HEIGHT * 2 }}
                        >
                           {hours.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleSelectHour(hour)}
                              className={cn(
                                "h-11 w-full flex items-center justify-center text-lg font-semibold snap-center transition-colors",
                                hour === timeParts.hour
                                  ? "text-foreground text-2xl"
                                  : "text-muted-foreground/60"
                              )}
                            >
                              {String(hour).padStart(2, "0")}
                            </button>
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 rounded-xl bg-foreground/5" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 border-t border-b border-foreground/20" />
                      </div>
                    </div>
                    <div className="text-4xl font-semibold text-muted-foreground/70">:</div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Минуты
                      </div>
                      <div
                        className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-inner backdrop-blur-sm"
                        style={{ height: WHEEL_CONTAINER_HEIGHT }}
                      >
                        <div
                          ref={minuteScrollRef}
                          onScroll={() => {
                            if (minuteScrollTimeout.current) {
                              clearTimeout(minuteScrollTimeout.current)
                            }
                            minuteScrollTimeout.current = setTimeout(() => {
                              const element = minuteScrollRef.current
                              if (!element) return
                              const index = Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT)
                              const clampedIndex = Math.min(59, Math.max(0, index))
                              if (clampedIndex !== latestTimeParts.current.minute) {
                                hapticFeedback("selection")
                                onUpdateSettings({
                                  notificationTime: buildNotificationTime(latestTimeParts.current.hour, clampedIndex),
                                })
                              }
                              snapWheelScroll(element, clampedIndex, 59)
                            }, 120)
                          }}
                          className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
                          style={{ paddingBlock: WHEEL_ITEM_HEIGHT * 2 }}
                        >
                          {minutes.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleSelectMinute(minute)}
                              className={cn(
                                "h-11 w-full flex items-center justify-center text-lg font-semibold snap-center transition-colors",
                                minute === timeParts.minute
                                  ? "text-foreground text-2xl"
                                  : "text-muted-foreground/60"
                              )}
                            >
                              {String(minute).padStart(2, "0")}
                            </button>
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 rounded-xl bg-foreground/5" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-11 border-t border-b border-foreground/20" />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Прокрутите, чтобы выбрать время, как в будильнике.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
