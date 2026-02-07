"use client"

import { useState, useEffect, useMemo } from "react"
import { Calendar, Settings, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { DAY_NAMES, type DaySchedule } from "@/lib/schedule-types"
import {
  SPECIAL_PERIODS,
  getDayIndex,
  isSpecialPeriod,
  formatDate,
  formatDayDate,
  getWeekType,
  getMondayOfWeek,
  addWeeks,
  getDatesOfWeek,
} from "@/lib/schedule-data"
import { useSettings } from "@/lib/settings-store"
import { useTelegram } from "@/lib/telegram-context"
import { WeekToggle } from "./week-toggle"
import { DaySelector } from "./day-selector"
import { DayView } from "./day-view"
import { UpcomingClasses } from "./upcoming-classes"
import { SettingsPanel } from "./settings-panel"

const buildEmptySchedule = (): DaySchedule[] =>
  DAY_NAMES.map((name, index) => ({
    dayName: name,
    dayIndex: index,
    lessons: [],
  }))

const normalizeSchedule = (days: DaySchedule[]): DaySchedule[] => {
  const byIndex = new Map(days.map((day) => [day.dayIndex, day]))
  return DAY_NAMES.map((name, index) => {
    return (
      byIndex.get(index) || {
        dayName: name,
        dayIndex: index,
        lessons: [],
      }
    )
  })
}

const formatDateParam = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const TOMSK_TIMEZONE = "Asia/Tomsk"
const tomskDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TOMSK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

const getTomskNow = (): Date => {
  const parts = tomskDateTimeFormatter.formatToParts(new Date())
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
  const year = Number(getPart("year"))
  const month = Number(getPart("month")) - 1
  const day = Number(getPart("day"))
  const hour = Number(getPart("hour"))
  const minute = Number(getPart("minute"))
  const second = Number(getPart("second"))
  return new Date(year, month, day, hour, minute, second)
}

const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

export function ScheduleApp() {
  const { hapticFeedback, isReady, chat } = useTelegram()
  const { settings, updateSettings, resetSettings } = useSettings()
  const scopeLabel =
    chat?.type && chat.type !== "private"
      ? `Настройки чата: ${chat.title || "без названия"}`
      : null

  const today = useMemo(() => getTomskNow(), [])
  const todayMonday = useMemo(() => getMondayOfWeek(today), [today])
  const currentDayIndex = useMemo(() => getDayIndex(today), [today])

  const [selectedMonday, setSelectedMonday] = useState<Date>(() => getMondayOfWeek(today))
  const [selectedDay, setSelectedDay] = useState(currentDayIndex)
  const [currentTime, setCurrentTime] = useState(() => formatTime(getTomskNow()))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"day" | "upcoming">("day")
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => buildEmptySchedule())
  const [isScheduleLoading, setIsScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [apiWeekType, setApiWeekType] = useState<"even" | "odd" | null>(null)

  // Derived state - week type is calculated from selected monday
  const computedWeekType = useMemo(() => getWeekType(selectedMonday), [selectedMonday])
  const weekType = apiWeekType ?? computedWeekType
  const weekDates = useMemo(() => getDatesOfWeek(selectedMonday), [selectedMonday])
  const selectedDate = weekDates[selectedDay]
  const isCurrentWeek = selectedMonday.getTime() === todayMonday.getTime()
  const isToday = isCurrentWeek && selectedDay === currentDayIndex
  const specialPeriod = isSpecialPeriod(selectedDate, SPECIAL_PERIODS)
  const isNewYearHoliday = specialPeriod?.id === "ny2026"

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatTime(getTomskNow()))
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Sync week type with settings
  useEffect(() => {
    if (settings.weekType !== weekType) {
      updateSettings({ weekType })
    }
  }, [weekType, settings.weekType, updateSettings])

  useEffect(() => {
    if (!settings.facultySlug || !settings.groupSlug) {
      setSchedule(buildEmptySchedule())
      setScheduleError(null)
      setApiWeekType(null)
      return
    }

    const controller = new AbortController()
    const weekStart = formatDateParam(selectedMonday)

    setIsScheduleLoading(true)
    setScheduleError(null)
    setApiWeekType(null)

    fetch(
      `/api/timetable?faculty=${settings.facultySlug}&group=${settings.groupSlug}&weekStart=${weekStart}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load timetable")
        }
        return (await response.json()) as {
          weekType?: "even" | "odd"
          days?: DaySchedule[]
        }
      })
      .then((data) => {
        setApiWeekType(data.weekType || null)
        setSchedule(normalizeSchedule(data.days || []))
      })
      .catch((error) => {
        if ((error as { name?: string }).name === "AbortError") return
        setScheduleError("Не удалось загрузить расписание")
        setSchedule(buildEmptySchedule())
      })
      .finally(() => {
        setIsScheduleLoading(false)
      })

    return () => controller.abort()
  }, [selectedMonday, settings.facultySlug, settings.groupSlug])

  const selectedDaySchedule = useMemo(() => {
    return schedule.find((d) => d.dayIndex === selectedDay) || {
      dayName: DAY_NAMES[selectedDay],
      dayIndex: selectedDay,
      lessons: [],
    }
  }, [schedule, selectedDay])

  const hasLessons = useMemo(() => {
    return Array.from({ length: DAY_NAMES.length }, (_, i) => {
      const day = schedule.find((d) => d.dayIndex === i)
      return day ? day.lessons.length > 0 : false
    })
  }, [schedule])

  const selectedGroupName = settings.groupName

  // Week navigation handlers
  const handlePrevWeek = () => {
    hapticFeedback("light")
    setSelectedMonday((prev) => addWeeks(prev, -1))
    setSelectedDay(0)
  }

  const handleNextWeek = () => {
    hapticFeedback("light")
    setSelectedMonday((prev) => addWeeks(prev, 1))
    setSelectedDay(0)
  }

  const handleGoToToday = () => {
    hapticFeedback("medium")
    setSelectedMonday(todayMonday)
    setSelectedDay(currentDayIndex)
  }

  const handleViewDay = (day: number) => {
    setSelectedDay(day)
    setViewMode("day")
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-semibold text-foreground leading-none">Расписание</h1>
              {selectedGroupName && (
                <p className="text-xs text-muted-foreground mt-0.5">Группа {selectedGroupName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticFeedback("light")
              setSettingsOpen(true)
            }}
            className="p-2 rounded-full hover:bg-accent active:bg-accent/70 transition-colors"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Week Navigation */}
        <div className="px-4 pb-3">
          <WeekToggle 
            weekType={weekType} 
            monday={selectedMonday}
            isCurrentWeek={isCurrentWeek}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onGoToToday={handleGoToToday}
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex border-t border-border">
          <button
            type="button"
            onClick={() => {
              hapticFeedback("selection")
              setViewMode("day")
            }}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              viewMode === "day"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            По дням
          </button>
          <button
            type="button"
            onClick={() => {
              hapticFeedback("selection")
              setViewMode("upcoming")
            }}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              viewMode === "upcoming"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            Ближайшие
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {viewMode === "day" ? (
          <>
            {/* Day Selector with Dates */}
            <DaySelector
              selectedDay={selectedDay}
              onSelect={setSelectedDay}
              currentDay={currentDayIndex}
              hasLessons={hasLessons}
              weekDates={weekDates}
              isCurrentWeek={isCurrentWeek}
            />

            {scheduleError ? (
              <div className="px-4 py-2 text-sm text-destructive">{scheduleError}</div>
            ) : isScheduleLoading ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">Загрузка расписания...</div>
            ) : null}

            {/* Day Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">{DAY_NAMES[selectedDay]}</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatDayDate(selectedDate)}
                    {isToday && " • Сегодня"}
                  </p>
                </div>
                {specialPeriod && (
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full border border-transparent",
                    isNewYearHoliday &&
                      "border-amber-200/70 bg-gradient-to-r from-amber-200/70 via-rose-200/60 to-sky-200/70 text-amber-700",
                    !isNewYearHoliday &&
                      specialPeriod.type === "holiday" &&
                      "bg-red-500/10 text-red-600 dark:text-red-400",
                    specialPeriod.type === "exam" && "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                    specialPeriod.type === "vacation" && "bg-green-500/10 text-green-600 dark:text-green-400"
                  )}>
                    {isNewYearHoliday && "Новогодние"}
                    {specialPeriod.type === "holiday" && !isNewYearHoliday && "Выходной"}
                    {specialPeriod.type === "exam" && "Сессия"}
                    {specialPeriod.type === "vacation" && "Каникулы"}
                  </span>
                )}
              </div>
            </div>

            {/* Schedule */}
            <DayView
              schedule={selectedDaySchedule}
              specialPeriod={specialPeriod}
              currentTime={currentTime}
              isToday={isToday}
            />
          </>
        ) : (
          <>
            {/* Today's Date */}
            <div className="px-4 py-4 border-b border-border">
              <p className="text-sm text-muted-foreground capitalize">{formatDate(today)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {weekType === "even" ? "Чётная" : "Нечётная"} неделя
              </p>
            </div>

            {scheduleError ? (
              <div className="px-4 py-2 text-sm text-destructive">{scheduleError}</div>
            ) : isScheduleLoading ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">Загрузка расписания...</div>
            ) : null}

            {/* Special Period Notice */}
            {specialPeriod && (
              <div className={cn(
                "mx-4 mt-4 p-3 rounded-xl text-sm border border-transparent",
                isNewYearHoliday &&
                  "border-amber-200/70 bg-gradient-to-br from-amber-100/70 via-rose-100/60 to-sky-100/70 text-amber-700",
                !isNewYearHoliday &&
                  specialPeriod.type === "holiday" &&
                  "bg-red-500/10 text-red-600 dark:text-red-400",
                specialPeriod.type === "exam" && "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                specialPeriod.type === "vacation" && "bg-green-500/10 text-green-600 dark:text-green-400"
              )}>
                <div className="flex items-start gap-2">
                  {isNewYearHoliday && <Sparkles className="h-4 w-4 mt-0.5" />}
                  <div>
                    <strong>{specialPeriod.name}</strong>
                    <span
                      className={cn(
                        "ml-2",
                        isNewYearHoliday ? "text-amber-700/80" : "text-muted-foreground"
                      )}
                    >
                      {specialPeriod.type === "holiday" && "• Выходной"}
                      {specialPeriod.type === "exam" && "• Сессия"}
                      {specialPeriod.type === "vacation" && "• Каникулы"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Classes */}
            <UpcomingClasses
              schedule={schedule}
              currentDayIndex={currentDayIndex}
              weekDates={weekDates}
              isCurrentWeek={isCurrentWeek}
              currentTime={currentTime}
              onViewDay={handleViewDay}
            />
          </>
        )}
      </main>

      {/* No Group Selected Notice */}
      {!settings.groupSlug && (
        <div className="sticky bottom-0 bg-primary/10 border-t border-primary/20 p-4">
          <button
            type="button"
            onClick={() => {
              hapticFeedback("light")
              setSettingsOpen(true)
            }}
            className="w-full text-center"
          >
            <p className="text-sm font-medium text-primary">Выберите группу в настройках</p>
            <p className="text-xs text-primary/70 mt-0.5">Нажмите, чтобы открыть настройки</p>
          </button>
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onUpdateSettings={updateSettings}
        onResetSettings={resetSettings}
        scopeLabel={scopeLabel}
      />
    </div>
  )
}
