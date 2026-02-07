"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, GraduationCap, Bell, Clock, RotateCcw, Check } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { UserSettings } from "@/lib/schedule-types"
import { useTelegram } from "@/lib/telegram-context"
import type { CourseOption, FacultyOption, GroupOption } from "@/lib/timetable-types"

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: UserSettings
  onUpdateSettings: (updates: Partial<UserSettings>) => void
  onResetSettings: () => void
  scopeLabel?: string | null
}

type SettingsView = "main" | "faculty" | "course" | "group" | "time"

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
}: SettingsPanelProps) {
  const { hapticFeedback } = useTelegram()
  const [view, setView] = useState<SettingsView>("main")
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
          throw new Error("Failed to load faculties")
        }
        const data = (await response.json()) as { faculties: FacultyOption[] }
        if (!cancelled) {
          setFaculties(data.faculties || [])
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFacultiesError(error instanceof Error ? error.message : "Failed to load faculties")
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
    if (!tempFacultySlug) return
    if (coursesByFaculty[tempFacultySlug]) return

    let cancelled = false
    setIsLoadingCourses(true)
    setCoursesError(null)

    fetch(`/api/faculties/${tempFacultySlug}/courses`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load courses")
        }
        const data = (await response.json()) as { courses: CourseOption[] }
        if (!cancelled) {
          setCoursesByFaculty((prev) => ({
            ...prev,
            [tempFacultySlug]: data.courses || [],
          }))
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCoursesError(error instanceof Error ? error.message : "Failed to load courses")
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
  }, [tempFacultySlug, coursesByFaculty])

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
  const hours = Array.from({ length: 24 }, (_, index) => index)
  const minutes = Array.from({ length: 60 }, (_, index) => index)

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl px-0">
        <SheetHeader className="px-4 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            {view !== "main" && (
              <button
                type="button"
                onClick={handleBack}
                className="text-primary text-sm font-medium"
              >
                Назад
              </button>
            )}
            <SheetTitle className={cn("text-lg", view === "main" && "mx-auto")}>
              {view === "main" && "Настройки"}
              {view === "faculty" && "Выберите факультет"}
              {view === "course" && "Выберите курс"}
              {view === "group" && "Выберите группу"}
              {view === "time" && "Время уведомления"}
            </SheetTitle>
            {view !== "main" && <div className="w-12" />}
          </div>
        </SheetHeader>

        <div className="overflow-y-auto h-full pb-20">
          {view === "main" && (
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
          )}

          {view === "faculty" && (
            <div className="py-2">
              {isLoadingFaculties && (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  Загрузка факультетов...
                </div>
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
                <div className="px-4 py-8 text-center text-muted-foreground">
                  Загрузка курсов...
                </div>
              )}
              {tempFacultySlug && !isLoadingCourses && coursesError && (
                <div className="px-4 py-8 text-center text-destructive">
                  {coursesError}
                </div>
              )}
              {tempFacultySlug && !isLoadingCourses && !coursesError && availableCourses.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  Нет доступных курсов
                </div>
              )}
              {tempFacultySlug && !isLoadingCourses && !coursesError && availableCourses.length > 0 && (
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
              )}
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
                <div className="px-4 py-8 text-center text-muted-foreground">
                  Загрузка групп...
                </div>
              )}
              {tempCourse && !isLoadingCourses && coursesError && (
                <div className="px-4 py-8 text-center text-destructive">
                  {coursesError}
                </div>
              )}
              {tempCourse && !isLoadingCourses && !coursesError && availableGroups.length > 0 ? (
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
                              notificationTime: buildNotificationTime(
                                clampedIndex,
                                latestTimeParts.current.minute
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
                              notificationTime: buildNotificationTime(
                                latestTimeParts.current.hour,
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
      </SheetContent>
    </Sheet>
  )
}
