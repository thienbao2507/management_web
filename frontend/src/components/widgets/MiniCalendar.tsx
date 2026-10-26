import React, { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MiniCalendarProps {
  onSelectDate?: (date: Date) => void
  taskDueDates?: string[] // e.g. ["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02"]
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  onSelectDate,
  taskDueDates = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02", "2026-11-12"],
}) => {
  // Base on Oct 2026
  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 27))
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 9, 27))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const days = []
  // Padding for first day
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }

  const isToday = (day: number) => {
    // Current simulated date is Oct 27, 2026
    return year === 2026 && month === 9 && day === 27
  }

  const isSelected = (day: number) => {
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    )
  }

  const hasTask = (day: number) => {
    const monthStr = String(month + 1).padStart(2, "0")
    const dayStr = String(day).padStart(2, "0")
    const dateStr = `${year}-${monthStr}-${dayStr}`
    return taskDueDates.includes(dateStr)
  }

  const handleDateClick = (day: number) => {
    const newSelected = new Date(year, month, day)
    setSelectedDate(newSelected)
    onSelectDate?.(newSelected)
  }

  return (
    <div className="rounded-lg border border-border/80 bg-card/60 p-3 shadow-xs">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">
          {monthNames[month]} {year}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {daysOfWeek.map((dow) => (
          <span
            key={dow}
            className="text-[10px] font-medium text-muted-foreground/80 py-0.5"
          >
            {dow}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-6 w-6" />
          }

          const selected = isSelected(day)
          const today = isToday(day)
          const taskExists = hasTask(day)

          return (
            <button
              key={`day-${day}`}
              type="button"
              onClick={() => handleDateClick(day)}
              className={cn(
                "relative flex h-6 w-6 mx-auto items-center justify-center rounded-md text-[11px] font-medium transition-all",
                selected
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : today
                  ? "border border-primary text-primary font-bold"
                  : "text-foreground hover:bg-accent/80"
              )}
            >
              {day}
              {taskExists && !selected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-amber-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
