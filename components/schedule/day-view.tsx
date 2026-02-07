"use client"

import { Calendar, Coffee, Snowflake, Sparkles } from "lucide-react"
import type { DaySchedule, SpecialPeriod } from "@/lib/schedule-types"
import { LessonCard } from "./lesson-card"
import { cn } from "@/lib/utils"

interface DayViewProps {
  schedule: DaySchedule
  specialPeriod?: SpecialPeriod | null
  currentTime?: string
  isToday?: boolean
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.NaN
  return hours * 60 + minutes
}

const LESSON_SLOTS = [
  { index: 1, start: "08:50", end: "10:25" },
  { index: 2, start: "10:40", end: "12:15" },
  { index: 3, start: "13:15", end: "14:50" },
  { index: 4, start: "15:00", end: "16:35" },
  { index: 5, start: "16:45", end: "18:20" },
  { index: 6, start: "18:30", end: "20:05" },
  { index: 7, start: "20:15", end: "21:50" },
].map((slot) => ({
  ...slot,
  startMinutes: parseTimeToMinutes(slot.start),
  endMinutes: parseTimeToMinutes(slot.end),
}))

function findSlotIndex(lesson: DaySchedule["lessons"][number]): number {
  const lessonStart = parseTimeToMinutes(lesson.time)
  const lessonEnd = parseTimeToMinutes(lesson.timeEnd)

  for (let i = 0; i < LESSON_SLOTS.length; i++) {
    const slot = LESSON_SLOTS[i]
    const matchesExact =
      lessonStart === slot.startMinutes && lessonEnd === slot.endMinutes
    const fitsSlot =
      lessonStart >= slot.startMinutes && lessonEnd <= slot.endMinutes

    if (matchesExact || fitsSlot) {
      return i
    }
  }

  return -1
}

export function DayView({ schedule, specialPeriod, currentTime, isToday }: DayViewProps) {
  const isNewYearHoliday = specialPeriod?.id === "ny2026"
  const nowMinutes =
    isToday && currentTime ? parseTimeToMinutes(currentTime) : Number.NaN
  const normalizedNowMinutes = Number.isNaN(nowMinutes) ? null : nowMinutes

  const lessonsBySlot = LESSON_SLOTS.map(() => [] as DaySchedule["lessons"])
  const unmatchedLessons: DaySchedule["lessons"] = []

  for (const lesson of schedule.lessons) {
    const slotIndex = findSlotIndex(lesson)
    if (slotIndex === -1) {
      unmatchedLessons.push(lesson)
    } else {
      lessonsBySlot[slotIndex].push(lesson)
    }
  }

  let activeSlotIndex = -1
  let nextSlotIndex = -1
  let activeBreakIndex = -1

  if (normalizedNowMinutes !== null) {
    for (let i = 0; i < LESSON_SLOTS.length; i++) {
      const slot = LESSON_SLOTS[i]

      if (normalizedNowMinutes >= slot.startMinutes && normalizedNowMinutes <= slot.endMinutes) {
        activeSlotIndex = i
        nextSlotIndex = i + 1 < LESSON_SLOTS.length ? i + 1 : -1
        break
      }

      if (normalizedNowMinutes < slot.startMinutes && nextSlotIndex === -1) {
        nextSlotIndex = i
      }

      if (i < LESSON_SLOTS.length - 1) {
        const breakStart = slot.endMinutes
        const breakEnd = LESSON_SLOTS[i + 1].startMinutes
        if (normalizedNowMinutes > breakStart && normalizedNowMinutes < breakEnd) {
          activeBreakIndex = i
        }
      }
    }
  }

  // No lessons
  if (schedule.lessons.length === 0) {
    if (specialPeriod) {
      if (isNewYearHoliday) {
        return (
          <div className="px-4 py-10">
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-100/70 via-rose-100/60 to-sky-100/70 p-6 text-center">
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/50 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/50 blur-2xl" />
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 text-amber-600 shadow-sm">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">{specialPeriod.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Праздничные дни и новогоднее настроение
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-amber-700">
                <Snowflake className="h-3.5 w-3.5" />
                Каникулы
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mb-4",
            specialPeriod.type === "holiday" && "bg-red-500/20",
            specialPeriod.type === "exam" && "bg-orange-500/20",
            specialPeriod.type === "vacation" && "bg-green-500/20"
          )}>
            <Calendar className={cn(
              "h-8 w-8",
              specialPeriod.type === "holiday" && "text-red-500",
              specialPeriod.type === "exam" && "text-orange-500",
              specialPeriod.type === "vacation" && "text-green-500"
            )} />
          </div>
          <h3 className="font-semibold text-lg text-foreground mb-1">{specialPeriod.name}</h3>
          <p className="text-sm text-muted-foreground">
            {specialPeriod.type === "holiday" && "Выходной день"}
            {specialPeriod.type === "exam" && "Экзаменационный период"}
            {specialPeriod.type === "vacation" && "Каникулы"}
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Coffee className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg text-foreground mb-1">Нет занятий</h3>
        <p className="text-sm text-muted-foreground">
          {schedule.dayIndex === 5 || schedule.dayIndex === 6 ? "Выходной день" : "Свободный день"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pb-4">
      {LESSON_SLOTS.map((slot, slotIndex) => {
        const slotLessons = lessonsBySlot[slotIndex]
        const isActiveSlot = slotIndex === activeSlotIndex
        const isNextSlot = slotIndex === nextSlotIndex

        return (
          <div key={slot.index} className="space-y-2">
            <div className="grid grid-cols-[110px_1fr] gap-3 items-start">
              <div className="pt-1 text-xs text-muted-foreground">
                <div className={cn("font-medium", isActiveSlot && "text-primary")}>
                  Пара {slot.index}
                </div>
                <div className="text-[11px]">{slot.start} — {slot.end}</div>
              </div>
              <div
                className={cn(
                  "rounded-2xl border border-transparent p-2 space-y-3",
                  isActiveSlot && "border-primary/30 bg-primary/5",
                  isNextSlot && !isActiveSlot && "border-primary/10 bg-primary/5/50"
                )}
              >
                {slotLessons.length > 0 ? (
                  slotLessons.map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      dayName={schedule.dayName}
                      isActive={isActiveSlot}
                      isNext={isNextSlot && !isActiveSlot}
                      showTime={false}
                      density="compact"
                    />
                  ))
                ) : (
                  <div
                    className={cn(
                      "rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground",
                      isActiveSlot && "border-primary/40 bg-primary/5 text-primary"
                    )}
                  >
                    Нет пары
                  </div>
                )}
              </div>
            </div>

            {slotIndex < LESSON_SLOTS.length - 1 && (
              <BreakRow
                start={slot.end}
                end={LESSON_SLOTS[slotIndex + 1].start}
                duration={LESSON_SLOTS[slotIndex + 1].startMinutes - slot.endMinutes}
                isActive={slotIndex === activeBreakIndex}
              />
            )}
          </div>
        )
      })}

      {unmatchedLessons.length > 0 && (
        <div className="pt-3 space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Другое время
          </div>
          {unmatchedLessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              dayName={schedule.dayName}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface BreakRowProps {
  start: string
  end: string
  duration: number
  isActive: boolean
}

function BreakRow({ start, end, duration, isActive }: BreakRowProps) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return null
  }

  const isLongBreak = duration >= 40

  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 items-center">
      <div className="text-[11px] text-muted-foreground">
        {start} — {end}
      </div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
          isLongBreak
            ? "bg-amber-500/10 text-amber-700"
            : "bg-muted/40 text-muted-foreground",
          isActive && "bg-primary/10 text-primary ring-1 ring-primary/30"
        )}
      >
        <Coffee className="h-3.5 w-3.5" />
        <span>
          {isLongBreak ? "Большой перерыв" : "Перерыв"} • {duration} мин
        </span>
        {isActive && (
          <span className="ml-auto text-[10px] uppercase tracking-wide">Сейчас</span>
        )}
      </div>
    </div>
  )
}
