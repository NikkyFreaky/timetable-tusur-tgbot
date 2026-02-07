"use client"

import { cn } from "@/lib/utils"
import { DAY_NAMES_SHORT } from "@/lib/schedule-types"
import { useTelegram } from "@/lib/telegram-context"

interface DaySelectorProps {
  selectedDay: number
  onSelect: (day: number) => void
  currentDay?: number
  hasLessons?: boolean[]
  weekDates: Date[]
  isCurrentWeek: boolean
}

export function DaySelector({ 
  selectedDay, 
  onSelect, 
  currentDay, 
  hasLessons = [],
  weekDates,
  isCurrentWeek
}: DaySelectorProps) {
  const { hapticFeedback } = useTelegram()

  const handleSelect = (day: number) => {
    if (day !== selectedDay) {
      hapticFeedback("light")
      onSelect(day)
    }
  }

  const isToday = (index: number) => isCurrentWeek && index === currentDay

  return (
    <div className="flex gap-1 px-4 py-2">
      {DAY_NAMES_SHORT.map((name, index) => {
        const date = weekDates[index]
        const dayNum = date?.getDate() || ""
        
        return (
          <button
            key={name}
            type="button"
            onClick={() => handleSelect(index)}
            className={cn(
              "flex-1 flex flex-col items-center py-2 px-1 rounded-xl transition-all duration-200",
              selectedDay === index
                ? "bg-primary text-primary-foreground"
                : isToday(index)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="text-[11px] font-medium">{name}</span>
            <span className={cn(
              "text-sm font-semibold",
              selectedDay === index 
                ? "text-primary-foreground" 
                : isToday(index)
                  ? "text-primary"
                  : "text-foreground"
            )}>
              {dayNum}
            </span>
            {hasLessons[index] !== undefined && (
              <span
                className={cn(
                  "w-1 h-1 rounded-full mt-0.5",
                  hasLessons[index]
                    ? selectedDay === index
                      ? "bg-primary-foreground"
                      : "bg-primary"
                    : "bg-transparent"
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
