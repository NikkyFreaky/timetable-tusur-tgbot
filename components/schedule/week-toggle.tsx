"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTelegram } from "@/lib/telegram-context"
import { formatShortDate, getDatesOfWeek } from "@/lib/schedule-data"

interface WeekToggleProps {
  weekType: "even" | "odd"
  monday: Date
  isCurrentWeek: boolean
  onPrevWeek: () => void
  onNextWeek: () => void
  onGoToToday: () => void
}

export function WeekToggle({ 
  weekType, 
  monday, 
  isCurrentWeek, 
  onPrevWeek, 
  onNextWeek, 
  onGoToToday 
}: WeekToggleProps) {
  const { hapticFeedback } = useTelegram()

  const dates = getDatesOfWeek(monday)
  const startDate = formatShortDate(dates[0])
  const endDate = formatShortDate(dates[dates.length - 1])

  const handlePrev = () => {
    hapticFeedback("light")
    onPrevWeek()
  }

  const handleNext = () => {
    hapticFeedback("light")
    onNextWeek()
  }

  const handleGoToToday = () => {
    if (!isCurrentWeek) {
      hapticFeedback("medium")
      onGoToToday()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          className="p-2 rounded-full hover:bg-accent active:bg-accent/70 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        
        <button
          type="button"
          onClick={handleGoToToday}
          className={cn(
            "flex flex-col items-center px-4 py-1 rounded-lg transition-colors",
            !isCurrentWeek && "hover:bg-accent active:bg-accent/70"
          )}
        >
          <span className="text-sm font-medium text-foreground">
            {startDate} — {endDate}
          </span>
          <span className={cn(
            "text-xs",
            weekType === "odd" ? "text-blue-500" : "text-orange-500"
          )}>
            {weekType === "odd" ? "Нечётная" : "Чётная"} неделя
            {!isCurrentWeek && " • Сегодня"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="p-2 rounded-full hover:bg-accent active:bg-accent/70 transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
