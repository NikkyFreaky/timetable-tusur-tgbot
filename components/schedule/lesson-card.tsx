"use client"

import { useState } from "react"
import { Clock, MapPin, User, ChevronRight, Info } from "lucide-react"
import type { Lesson } from "@/lib/schedule-types"
import { LESSON_TYPES } from "@/lib/schedule-types"
import { cn } from "@/lib/utils"
import { useTelegram } from "@/lib/telegram-context"
import { LessonDetailSheet } from "./lesson-detail-sheet"
import { BUILDING_STYLES, parseRoom } from "@/lib/buildings"

interface LessonCardProps {
  lesson: Lesson
  dayName?: string
  isActive?: boolean
  isNext?: boolean
  showTime?: boolean
  density?: "default" | "compact"
}

export function LessonCard({
  lesson,
  dayName,
  isActive,
  isNext,
  showTime = true,
  density = "default",
}: LessonCardProps) {
  const { hapticFeedback } = useTelegram()
  const [detailOpen, setDetailOpen] = useState(false)
  const lessonType = LESSON_TYPES[lesson.type]
  const isTypeWhite = lessonType.color.toUpperCase() === "#FFFFFF"
  const isCompact = density === "compact"
  const { building, roomLabel } = parseRoom(lesson.room)
  const buildingStyle = building ? BUILDING_STYLES[building] : null
  const hasNotes = Boolean(lesson.notes && lesson.notes.length > 0)

  const handlePress = () => {
    hapticFeedback("medium")
    setDetailOpen(true)
  }

  return (
    <>
      <div
        onClick={handlePress}
        className={cn(
          "relative rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer",
          isCompact ? "p-3" : "p-4",
          "bg-card border border-border",
          isActive && "ring-2 ring-primary shadow-lg",
          isNext && "border-primary/50 bg-primary/5"
        )}
      >
        {/* Time indicator line */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
            isActive ? "bg-primary" : isNext ? "bg-primary/50" : "bg-muted"
          )}
        />

        <div className="pl-2">
          {/* Header with time and type badge */}
          <div className="flex items-center justify-between mb-2">
            {showTime ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                <span className={cn("font-medium", isCompact ? "text-xs" : "text-sm")}>
                  {lesson.time} — {lesson.timeEnd}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Пара</span>
            )}
            <div className="flex items-center gap-2">
              {hasNotes && (
                <Info className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", "text-amber-500")} />
              )}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium text-slate-900",
                  isTypeWhite && "border border-border"
                )}
                style={{ backgroundColor: lessonType.color }}
              >
                {lessonType.label}
              </span>
            </div>
          </div>

          {/* Subject name */}
          <h3
            className={cn(
              "font-semibold text-foreground leading-tight",
              isCompact ? "text-sm mb-1.5" : "text-base mb-2"
            )}
          >
            {lesson.subject}
          </h3>

          {/* Details */}
          <div
            className={cn(
              "flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground",
              isCompact ? "text-xs" : "text-sm"
            )}
          >
            <div className="flex items-center gap-1.5">
              <MapPin
                className={cn(
                  isCompact ? "h-3 w-3" : "h-3.5 w-3.5",
                  buildingStyle?.iconClass
                )}
              />
              {buildingStyle && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                    buildingStyle.badgeClass
                  )}
                >
                  {buildingStyle.label}
                </span>
              )}
              <span>{roomLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className={cn(isCompact ? "h-3 w-3" : "h-3.5 w-3.5")} />
              <span>{lesson.instructor}</span>
            </div>
          </div>

          {/* Active/Next indicators */}
          {isActive && (
            <div className="absolute top-2 right-2">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            </div>
          )}
          {/* Chevron indicator for clickable */}
          <ChevronRight
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50",
              isCompact ? "h-4 w-4" : "h-5 w-5"
            )}
          />
        </div>
      </div>
      
      <LessonDetailSheet 
        lesson={lesson}
        dayName={dayName}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
