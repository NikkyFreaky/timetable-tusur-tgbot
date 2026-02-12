export interface ResourceLink {
  label: string
  url: string
}

export interface Lesson {
  id: string
  time: string
  timeEnd: string
  subject: string
  type:
    | "lecture"
    | "practice"
    | "lab"
    | "coursework"
    | "courseProject"
    | "credit"
    | "creditWithGrade"
    | "exam"
    | "selfStudy"
    | "consultation"
  room: string
  roomLinks?: ResourceLink[]
  instructor: string
  instructorLinks?: ResourceLink[]
  weekType?: "even" | "odd" | "all"
  date?: string
  jointGroups?: string[]
  groupLinks?: ResourceLink[]
  jointGroupLinks?: ResourceLink[]
  resourceLinks?: ResourceLink[]
  notes?: string[]
}

export interface DaySchedule {
  dayName: string
  dayIndex: number
  lessons: Lesson[]
  specialDay?: TimetableSpecialDay
}

export interface TimetableSpecialDay {
  type: "vacation" | "holiday"
  name: string
}

export interface WeekSchedule {
  weekNumber: number
  weekType: "even" | "odd"
  days: DaySchedule[]
}

export interface Faculty {
  id: string
  name: string
  shortName: string
}

export interface Group {
  id: string
  name: string
  facultyId: string
  course: number
}

export interface UserSettings {
  facultySlug: string | null
  facultyName: string | null
  groupSlug: string | null
  groupName: string | null
  course: number | null
  weekType: "even" | "odd"
  notificationsEnabled: boolean
  notificationTime: string
  sendDayBefore: boolean
  sendDayOf: boolean
  notifyNoLessons: boolean
  notifyHolidays: boolean
  notifyVacations: boolean
  notifyWeekStart: boolean
  notifyHolidayDay: boolean
  theme: "light" | "dark" | "system"
}

export interface SpecialPeriod {
  id: string
  type: "holiday" | "exam" | "vacation" | "weekend"
  name: string
  startDate: string
  endDate: string
}

export const LESSON_TYPES: Record<Lesson["type"], { label: string; color: string }> = {
  lecture: { label: "Лекция", color: "#E5FFD5" },
  practice: { label: "Практика", color: "#D5F6FF" },
  lab: { label: "Лаба", color: "#D7D7F4" },
  coursework: { label: "Курсовая", color: "#FFD5E5" },
  courseProject: { label: "Курс. пр.", color: "#FFD5E5" },
  credit: { label: "Зачет", color: "#F7DC6F" },
  creditWithGrade: { label: "Зач. с оц.", color: "#F8C471" },
  exam: { label: "Экзамен", color: "#F1948A" },
  selfStudy: { label: "СРС", color: "#FFFFFF" },
  consultation: { label: "Конс.", color: "#FFFFFF" },
}

export const DAY_NAMES = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
]

export const DAY_NAMES_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

export interface ChatMember {
  chatId: number
  userId: number
  role: "creator" | "administrator" | "member" | "left" | "kicked"
  addedAt: string
  updatedAt: string
}

export interface ChatTopic {
  id: number
  chatId: number
  name: string
  iconColor: number | null
  iconCustomEmojiId: number | null
  createdAt: string
  updatedAt: string
}
