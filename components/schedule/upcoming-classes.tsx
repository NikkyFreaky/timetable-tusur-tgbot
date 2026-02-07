"use client"

import { ArrowRight } from "lucide-react"
import type { DaySchedule, Lesson } from "@/lib/schedule-types"
import { DAY_NAMES, DAY_NAMES_SHORT, LESSON_TYPES } from "@/lib/schedule-types"
import { cn } from "@/lib/utils"
import { useTelegram } from "@/lib/telegram-context"
import { formatDayDate } from "@/lib/schedule-data"
import { BUILDING_STYLES, parseRoom } from "@/lib/buildings"

interface UpcomingClassesProps {
  schedule: DaySchedule[]
  currentDayIndex: number
  weekDates: Date[]
  isCurrentWeek: boolean
  currentTime?: string
  onViewDay: (day: number) => void
}

interface UpcomingLesson extends Lesson {
  dayIndex: number
  dayName: string
}

export function UpcomingClasses({
  schedule,
  currentDayIndex,
  weekDates,
  isCurrentWeek,
  currentTime,
  onViewDay,
}: UpcomingClassesProps) {
  const { hapticFeedback } = useTelegram()

  // Get next 3 lessons starting from today
  const upcomingLessons: UpcomingLesson[] = []
  let dayOffset = 0

  while (upcomingLessons.length < 3 && dayOffset < DAY_NAMES.length) {
    const dayIndex = (currentDayIndex + dayOffset) % DAY_NAMES.length
    const day = schedule.find((d) => d.dayIndex === dayIndex)

    if (day) {
      const timeNow = dayOffset === 0
        ? currentTime || new Date().toTimeString().slice(0, 5)
        : "00:00"

      for (const lesson of day.lessons) {
        if (dayOffset > 0 || lesson.time > timeNow) {
          upcomingLessons.push({
            ...lesson,
            dayIndex: day.dayIndex,
            dayName: day.dayName,
          })
          if (upcomingLessons.length >= 3) break
        }
      }
    }
    dayOffset++
  }

  if (upcomingLessons.length === 0) {
    return null
  }

  const handleViewDay = (dayIndex: number) => {
    hapticFeedback("light")
    onViewDay(dayIndex)
  }

  return (
    <div className="px-4 py-3">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Ближайшие занятия</h3>
      <div className="space-y-2">
        {upcomingLessons.map((lesson, index) => {
          const lessonType = LESSON_TYPES[lesson.type]
          const isTypeWhite = lessonType.color.toUpperCase() === "#FFFFFF"
          const isToday = isCurrentWeek && lesson.dayIndex === currentDayIndex
          const lessonDate = weekDates[lesson.dayIndex]
          const dateLabel = lessonDate ? formatDayDate(lessonDate) : ""
          const { building, roomLabel } = parseRoom(lesson.room)
          const buildingStyle = building ? BUILDING_STYLES[building] : null

          return (
            <button
              key={`${lesson.id}-${lesson.dayIndex}`}
              type="button"
              onClick={() => handleViewDay(lesson.dayIndex)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-accent/50 active:scale-[0.98] transition-all"
            >
              <div className="flex-shrink-0 w-12 text-center">
                <div className="text-xs text-muted-foreground">
                  {isToday ? "Сегодня" : DAY_NAMES_SHORT[lesson.dayIndex]}
                </div>
                {dateLabel && (
                  <div className="text-[10px] text-muted-foreground/80">{dateLabel}</div>
                )}
                <div className="text-sm font-semibold text-foreground">{lesson.time}</div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-foreground truncate">{lesson.subject}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded text-slate-900",
                      isTypeWhite && "border border-border"
                    )}
                    style={{ backgroundColor: lessonType.color }}
                  >
                    {lessonType.label}
                  </span>
                  {buildingStyle && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
                        buildingStyle.badgeClass
                      )}
                    >
                      {buildingStyle.label}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{roomLabel}</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
