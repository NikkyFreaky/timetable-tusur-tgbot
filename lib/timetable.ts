import type { DaySchedule, Lesson, ResourceLink } from "@/lib/schedule-types"
import { DAY_NAMES } from "@/lib/schedule-types"
import type { CourseOption, FacultyOption, GroupOption } from "@/lib/timetable-types"
import { getWeekType } from "@/lib/schedule-data"
import { CACHE_TTL, CACHE_TYPE } from "@/lib/cache-config"
import { get, getWithStale, set } from "@/lib/cache-store"

const BASE_URL = "https://timetable.tusur.ru"
const TUSUR_BASE_URL = "https://tusur.ru"
const FACULTY_PHOTOS_URL =
  "https://tusur.ru/ru/o-tusure/struktura-i-organy-upravleniya/departament-obrazovaniya/fakultety-i-kafedry"
const FACULTIES_CACHE_KEY = "faculties"
const SCHEDULE_CACHE_VERSION = "v2"
let facultiesInFlight: Promise<FacultyOption[]> | null = null
const BASE_WEEK_ID = 786

type LessonModalInfo = {
  courseLinksUrl?: string
  groupLinks: ResourceLink[]
  jointGroupLinks: ResourceLink[]
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&#60;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#62;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&#171;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&#187;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&#8212;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#8211;/g, "–")
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
}

function resolveTimetableUrl(path: string): string {
  return new URL(path, BASE_URL).toString()
}

function resolveAssetUrl(path: string): string {
  return resolveTimetableUrl(path)
}

function resolveTusurUrl(path: string): string {
  return new URL(path, TUSUR_BASE_URL).toString()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractParagraphContent(html: string, label: string): string | null {
  const pattern = new RegExp(`<strong>\\s*${escapeRegExp(label)}:\\s*<\\/strong>([\\s\\S]*?)<\\/p>`, "i")
  const match = html.match(pattern)
  return match ? match[1] : null
}

function extractLinks(html: string | null): ResourceLink[] {
  if (!html) return []
  const links: ResourceLink[] = []
  const deduped = new Set<string>()
  const linkRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(html)) !== null) {
    const label = stripHtml(match[2])
    if (!label) continue
    const url = resolveTimetableUrl(match[1])
    const key = `${label}|${url}`
    if (deduped.has(key)) continue
    deduped.add(key)
    links.push({ label, url })
  }

  return links
}

const NOTE_TOOLTIP_ATTRS = ["data-original-title", "title", "data-title", "data-content"]

function extractAttributeValue(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}=['"]([^'"]*)['"]`, "i"))
  return match ? match[1] : null
}

function extractLessonNotes(html: string): string[] {
  const notes = new Set<string>()
  const tagRegex = /<[^>]+class=['"][^'"]*['"][^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[0]
    const classMatch = tag.match(/class=['"]([^'"]+)['"]/i)
    if (!classMatch) continue
    const classList = classMatch[1].split(/\s+/)
    if (!classList.includes("note")) continue
    let rawValue: string | null = null

    for (const attr of NOTE_TOOLTIP_ATTRS) {
      const value = extractAttributeValue(tag, attr)
      if (value && value.trim()) {
        rawValue = value
        break
      }
    }

    if (!rawValue) continue
    const cleaned = stripHtml(rawValue)
    if (cleaned) notes.add(cleaned)
  }

  return Array.from(notes)
}

function parseLessonModals(html: string): Map<string, LessonModalInfo> {
  const modalMap = new Map<string, LessonModalInfo>()
  const modalRegex = /<div id="js-lesson-info-(\d+)"[\s\S]*?<\/noindex>/gi
  let match: RegExpExecArray | null

  while ((match = modalRegex.exec(html)) !== null) {
    const lessonId = match[1]
    if (modalMap.has(lessonId)) continue

    const modalHtml = match[0]
    const courseLinksMatch = modalHtml.match(/data-course-links-url=['"]([^'"]+)['"]/i)
    const courseLinksUrl = courseLinksMatch ? resolveTimetableUrl(courseLinksMatch[1]) : undefined
    const groupsHtml =
      extractParagraphContent(modalHtml, "Группы") ?? extractParagraphContent(modalHtml, "Группа")
    const jointGroupsHtml = extractParagraphContent(modalHtml, "Совместно с группами")

    modalMap.set(lessonId, {
      courseLinksUrl,
      groupLinks: extractLinks(groupsHtml),
      jointGroupLinks: extractLinks(jointGroupsHtml),
    })
  }

  return modalMap
}

async function fetchResourceLinks(url: string): Promise<ResourceLink[]> {
  const cacheKey = `resources:${url}`

  const cached = await get<ResourceLink[]>(cacheKey)
  if (cached) {
    return cached
  }

  const staleData = await getWithStale<ResourceLink[]>(cacheKey)

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) {
      if (staleData) return staleData.value
      return []
    }

    const data = await response.json()
    if (!Array.isArray(data)) {
      if (staleData) return staleData.value
      return []
    }

    const deduped = new Map<string, ResourceLink>()
    for (const item of data) {
      if (!item || typeof item.url !== "string" || typeof item.anchor !== "string") continue
      const label = stripHtml(item.anchor)
      if (!label) continue

      let resolvedUrl = item.url
      try {
        resolvedUrl = new URL(item.url, BASE_URL).toString()
      } catch {
        resolvedUrl = item.url
      }

      const key = `${label}|${resolvedUrl}`
      if (!deduped.has(key)) {
        deduped.set(key, { label, url: resolvedUrl })
      }
    }

    const links = Array.from(deduped.values())
    await set(cacheKey, links, CACHE_TTL.RESOURCES, CACHE_TYPE.RESOURCES)
    return links
  } catch (error) {
    if (staleData) {
      return staleData.value
    }
    return []
  }
}

async function hydrateLessonResourceLinks(
  days: DaySchedule[],
  lessonModals: Map<string, LessonModalInfo>
): Promise<void> {
  const lessonsById = new Map<string, Lesson[]>()

  for (const day of days) {
    for (const lesson of day.lessons) {
      const bucket = lessonsById.get(lesson.id) ?? []
      bucket.push(lesson)
      lessonsById.set(lesson.id, bucket)
    }
  }

  const urlToLessonIds = new Map<string, string[]>()
  for (const [lessonId, info] of lessonModals.entries()) {
    if (!info.courseLinksUrl || !lessonsById.has(lessonId)) continue
    const bucket = urlToLessonIds.get(info.courseLinksUrl) ?? []
    bucket.push(lessonId)
    urlToLessonIds.set(info.courseLinksUrl, bucket)
  }

  if (urlToLessonIds.size === 0) return

  const results = await Promise.all(
    Array.from(urlToLessonIds.entries()).map(async ([courseLinksUrl, lessonIds]) => ({
      courseLinksUrl,
      lessonIds,
      links: await fetchResourceLinks(courseLinksUrl),
    }))
  )

  for (const result of results) {
    if (result.links.length === 0) continue
    for (const lessonId of result.lessonIds) {
      const lessons = lessonsById.get(lessonId)
      if (!lessons) continue
      for (const lesson of lessons) {
        lesson.resourceLinks = result.links
      }
    }
  }
}

function formatLessonDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}.${month}.${date.getFullYear()}`
}

function mapLessonType(kind: string): Lesson["type"] {
  const normalized = kind.toLowerCase().replace(/ё/g, "е")

  if (normalized.includes("лек")) return "lecture"
  if (normalized.includes("практ")) return "practice"
  if (normalized.includes("сем")) return "practice"
  if (normalized.includes("лаб")) return "lab"
  if (normalized.includes("проект")) return "courseProject"
  if (normalized.includes("курсов")) return "coursework"
  if (normalized.includes("зач") && normalized.includes("оцен")) return "creditWithGrade"
  if (normalized.includes("зач")) return "credit"
  if (normalized.includes("экзам")) return "exam"
  if (normalized.includes("самост") || normalized.includes("срс")) return "selfStudy"
  if (normalized.includes("конс")) return "consultation"

  return "lecture"
}

function parseTrainingSpecialDay(trainingHtml: string): DaySchedule["specialDay"] | null {
  const rawText = stripHtml(trainingHtml).replace(/\s+/g, " ").trim()
  const text = rawText.toLowerCase().replace(/ё/g, "е")

  if (text.includes("праздничн")) {
    return {
      type: "holiday",
      name: "Праздничный день",
    }
  }

  if (text.includes("выходн")) {
    return {
      type: "holiday",
      name: "Выходной день",
    }
  }

  if (text.includes("каникул")) {
    return {
      type: "vacation",
      name: "Каникулы",
    }
  }

  if (text.includes("практик")) {
    return {
      type: "practice",
      name: rawText || "Практика",
    }
  }

  return null
}

function calculateWeekIdFromDate(date: Date): number {
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
  const startDate = new Date(year, 8, 1)
  const dayOfWeek = startDate.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7
  const firstMonday = new Date(year, 8, 1 + daysUntilMonday)
  const diffDays = Math.floor((date.getTime() - firstMonday.getTime()) / 86400000)
  const weeksSinceStart = Math.floor(diffDays / 7)

  return BASE_WEEK_ID + weeksSinceStart
}

export function buildTimetableUrl(facultySlug: string, groupSlug: string): string {
  return `${BASE_URL}/faculties/${facultySlug}/groups/${groupSlug}`
}

async function fetchTimetableHtml(url: string, weekStart: Date): Promise<string> {
  const weekId = calculateWeekIdFromDate(weekStart)
  const baseUrl = url.replace(/[?&]week_id=\d+/, "")
  const separator = baseUrl.includes("?") ? "&" : "?"
  const finalUrl = `${baseUrl}${separator}week_id=${weekId}`

  const response = await fetch(finalUrl, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to fetch timetable (${response.status})`)
  }
  return await response.text()
}

function parseWeekSchedule(
  html: string,
  weekStart: Date,
  lessonModals: Map<string, LessonModalInfo>
): { weekType: "even" | "odd"; days: DaySchedule[] } {
  const days: DaySchedule[] = DAY_NAMES.map((name, index) => ({
    dayName: name,
    dayIndex: index,
    lessons: [],
  }))

  const tableMatch =
    html.match(
      /<table[^>]*class=(["'])(?=[^"']*table-lessons)(?=[^"']*hidden-xs)(?=[^"']*hidden-sm)[^"']*\1[^>]*>[\s\S]*?<\/table>/i
    ) ||
    html.match(
      /<table[^>]*class=(["'])(?=[^"']*table-lessons)[^"']*\1[^>]*>[\s\S]*?<\/table>/i
    )

  const fallbackWeekType = getWeekType(weekStart)
  if (!tableMatch) {
    return { weekType: fallbackWeekType, days }
  }

  const tableHtml = tableMatch[0]
  const classMatch = tableHtml.match(/<table[^>]*class=(["'])([^"']*)\1/i)
  const className = classMatch ? classMatch[2] : ""
  const weekType =
    className.includes("even") ? "even" : className.includes("odd") ? "odd" : fallbackWeekType

  const dayDates = Array.from({ length: DAY_NAMES.length }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return formatLessonDate(date)
  })

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1]
    const timeMatch = rowHtml.match(
      /<th[^>]*class=['"]time['"][^>]*>[\s\S]*?<span>\s*(\d{1,2}:\d{2})\s*<\/span>[\s\S]*?<span>\s*(\d{1,2}:\d{2})\s*<\/span>/i
    )

    const timeStart = timeMatch?.[1]
    const timeEnd = timeMatch?.[2]

    const cellRegex = /<td[^>]*class=['"][^'"]*lesson_cell[^'"]*day_(\d+)[^'"]*['"][^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch: RegExpExecArray | null

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const dayNumber = parseInt(cellMatch[1], 10)
      const dayIndex = dayNumber - 1
      if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex >= days.length) continue

      const cellHtml = cellMatch[2]
      const trainingRegex = /<div[^>]*class=['"][^'"]*training[^'"]*['"][^>]*>([\s\S]*?)<\/div>/gi
      let trainingMatch: RegExpExecArray | null

      while ((trainingMatch = trainingRegex.exec(cellHtml)) !== null) {
        const trainingHtml = trainingMatch[0]
        const disciplineMatch = trainingHtml.match(
          /<span[^>]*class=['"][^'"]*discipline[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i
        )
        if (!disciplineMatch) {
          const specialDay = parseTrainingSpecialDay(trainingHtml)
          if (specialDay && !days[dayIndex].specialDay) {
            days[dayIndex].specialDay = specialDay
          }
          continue
        }

        const abbrMatch = trainingHtml.match(
          /<abbr[^>]*(?:title|data-original-title)=['"]([^'"]+)['"][^>]*>/i
        )
        const subject = abbrMatch ? decodeHtmlEntities(abbrMatch[1]) : stripHtml(disciplineMatch[1])
        if (!subject) continue

        const kindMatch = trainingHtml.match(/<span[^>]*class=['"]kind['"][^>]*>([\s\S]*?)<\/span>/i)
        const kind = kindMatch ? stripHtml(kindMatch[1]) : ""

        const roomMatch = trainingHtml.match(
          /<span[^>]*class=['"]auditoriums?['"][^>]*>([\s\S]*?)<\/span>/i
        )
        const roomLinks = roomMatch ? extractLinks(roomMatch[1]) : []
        const roomText = roomMatch ? stripHtml(roomMatch[1]) : ""
        const room = roomLinks.length
          ? roomLinks.map((link) => link.label).join(", ")
          : roomText || "—"

        const teacherMatch = trainingHtml.match(
          /<span[^>]*class=['"]group['"][^>]*>([\s\S]*?)<\/span>/i
        )
        const instructorLinks = teacherMatch ? extractLinks(teacherMatch[1]) : []
        const instructorText = teacherMatch ? stripHtml(teacherMatch[1]) : ""
        const instructor = instructorLinks.length
          ? instructorLinks.map((link) => link.label).join(", ")
          : instructorText || "—"

        const notes = extractLessonNotes(trainingHtml)

        const idMatch =
          trainingHtml.match(/data-lesson-id=['"](\d+)['"]/i) ||
          trainingHtml.match(/<span[^>]*class=['"]hidden['"][^>]*>(\d+)<\/span>/i)

        if (!timeStart || !timeEnd) continue

        const lessonId = idMatch?.[1] || `${dayIndex}-${timeStart}-${subject}`
        const modalInfo = lessonModals.get(lessonId)
        const groupLinks = modalInfo?.groupLinks.length ? modalInfo.groupLinks : undefined
        const jointGroupLinks = modalInfo?.jointGroupLinks.length ? modalInfo.jointGroupLinks : undefined
        const jointGroups = jointGroupLinks?.map((link) => link.label)

        days[dayIndex].lessons.push({
          id: lessonId,
          time: timeStart,
          timeEnd: timeEnd,
          subject,
          type: mapLessonType(kind),
          room,
          roomLinks: roomLinks.length ? roomLinks : undefined,
          instructor,
          instructorLinks: instructorLinks.length ? instructorLinks : undefined,
          groupLinks,
          jointGroups,
          jointGroupLinks,
          date: dayDates[dayIndex],
          notes: notes.length ? notes : undefined,
        })
      }
    }
  }

  return { weekType, days }
}

function extractStylesheetUrl(html: string): string | null {
  const match = html.match(
    /<link[^>]+href=['"]([^'"]*application-[^'"]+\.css)['"][^>]*>/i
  )
  if (!match) return null
  return resolveAssetUrl(match[1])
}

function parseFacultyLogoUrls(css: string): Record<string, string> {
  const logoMap = new Map<string, { url: string; priority: number }>()
  const logoRegex =
    /\/assets\/(?:faculties_logo\/)?logo_([a-z0-9]+)(?:_bw)?-[a-f0-9]+\.(?:svg|png|jpg)/gi

  let match: RegExpExecArray | null
  while ((match = logoRegex.exec(css)) !== null) {
    const slug = match[1]
    const path = match[0]
    const isFacultyLogo = path.includes("faculties_logo/")
    const isBwLogo = path.includes("_bw-")
    const priority = isFacultyLogo ? 2 : isBwLogo ? 0 : 1
    const current = logoMap.get(slug)

    if (!current || priority > current.priority) {
      logoMap.set(slug, { url: resolveAssetUrl(path), priority })
    }
  }

  const result: Record<string, string> = {}
  for (const [slug, entry] of logoMap.entries()) {
    result[slug] = entry.url
  }
  return result
}

async function fetchFacultyLogos(html: string): Promise<Record<string, string>> {
  const cacheKey = "logos"

  const cached = await get<Record<string, string>>(cacheKey)
  if (cached) {
    return cached
  }

  const staleData = await getWithStale<Record<string, string>>(cacheKey)

  try {
    const cssUrl = extractStylesheetUrl(html)
    if (!cssUrl) return {}

    const response = await fetch(cssUrl, { cache: "no-store" })
    if (!response.ok) {
      if (staleData) return staleData.value
      return {}
    }

    const css = await response.text()
    const logos = parseFacultyLogoUrls(css)
    await set(cacheKey, logos, CACHE_TTL.LOGOS, CACHE_TYPE.LOGOS)
    return logos
  } catch (error) {
    if (staleData) {
      return staleData.value
    }
    return {}
  }
}

function parseFacultyPhotos(html: string): Record<string, string> {
  const photoMap = new Map<string, string>()
  const photoRegex = /\/assets\/faculties\/([a-z0-9]+)-[a-f0-9]+\.(?:jpg|jpeg|png)/gi

  let match: RegExpExecArray | null
  while ((match = photoRegex.exec(html)) !== null) {
    const slug = match[1]
    const path = match[0]
    if (!photoMap.has(slug)) {
      photoMap.set(slug, resolveTusurUrl(path))
    }
  }

  const result: Record<string, string> = {}
  for (const [slug, url] of photoMap.entries()) {
    result[slug] = url
  }
  return result
}

async function fetchFacultyPhotos(): Promise<Record<string, string>> {
  const cacheKey = "photos"

  const cached = await get<Record<string, string>>(cacheKey)
  if (cached) {
    return cached
  }

  const staleData = await getWithStale<Record<string, string>>(cacheKey)

  try {
    const response = await fetch(FACULTY_PHOTOS_URL, { cache: "no-store" })
    if (!response.ok) {
      if (staleData) return staleData.value
      return {}
    }

    const html = await response.text()
    const photos = parseFacultyPhotos(html)
    await set(cacheKey, photos, CACHE_TTL.PHOTOS, CACHE_TYPE.PHOTOS)
    return photos
  } catch (error) {
    if (staleData) {
      return staleData.value
    }
    return {}
  }
}

function parseFaculties(
  html: string,
  logos: Record<string, string>,
  photos: Record<string, string>
): FacultyOption[] {
  const faculties: FacultyOption[] = []
  const listMatch = html.match(/<h1[^>]*>Список факультетов<\/h1>([\s\S]*?)<\/ul>/i)
  if (!listMatch) return faculties

  const listHtml = listMatch[1]
  const linkPattern = /<a\s+href="\/faculties\/([^"]+)"[^>]*>([^<]+)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(listHtml)) !== null) {
    const slug = match[1]
    const name = decodeHtmlEntities(match[2].trim())
    faculties.push({ slug, name, imageUrl: photos[slug] ?? logos[slug] ?? null })
  }

  return faculties
}

function parseGroups(html: string): GroupOption[] {
  const groups: GroupOption[] = []
  const groupPattern =
    /<a\s+href="\/faculties\/[^\/]+\/groups\/([^"]+)"[^>]*>([^<]+)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = groupPattern.exec(html)) !== null) {
    const slug = match[1]
    const name = decodeHtmlEntities(match[2].trim())
    groups.push({ slug, name })
  }

  return groups
}

function parseFacultyCourses(html: string): CourseOption[] {
  const courses: CourseOption[] = []
  const coursePattern = /<h2[^>]*>(\d+)\s*курс<\/h2>([\s\S]*?)(?=<h2|<\/div>|$)/gi
  let match: RegExpExecArray | null

  while ((match = coursePattern.exec(html)) !== null) {
    const courseNumber = Number(match[1])
    const courseHtml = match[2]
    const groups = parseGroups(courseHtml)

    if (groups.length > 0) {
      courses.push({
        number: courseNumber,
        name: `${courseNumber} курс`,
        groups,
      })
    }
  }

  return courses
}

export async function fetchFaculties(): Promise<FacultyOption[]> {
  const cached = await get<FacultyOption[]>(FACULTIES_CACHE_KEY)
  if (cached) {
    return cached
  }

  if (facultiesInFlight) {
    return facultiesInFlight
  }

  const staleData = await getWithStale<FacultyOption[]>(FACULTIES_CACHE_KEY)

  const fetchPromise = (async () => {
    const response = await fetch(`${BASE_URL}/faculties`, { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`Failed to fetch faculties (${response.status})`)
    }
    const html = await response.text()
    const [logos, photos] = await Promise.all([
      fetchFacultyLogos(html).catch(() => ({})),
      fetchFacultyPhotos().catch(() => ({})),
    ])
    const faculties = parseFaculties(html, logos, photos)
    await set(FACULTIES_CACHE_KEY, faculties, CACHE_TTL.FACULTIES, CACHE_TYPE.FACULTIES)
    return faculties
  })()

  facultiesInFlight = fetchPromise

  try {
    const faculties = await fetchPromise
    return faculties
  } catch (error) {
    if (staleData) {
      return staleData.value
    }
    throw error
  } finally {
    if (facultiesInFlight === fetchPromise) {
      facultiesInFlight = null
    }
  }
}

export async function fetchFacultyCourses(facultySlug: string): Promise<CourseOption[]> {
  const cacheKey = `courses:${facultySlug}`

  const cached = await get<CourseOption[]>(cacheKey)
  if (cached) {
    return cached
  }

  const staleData = await getWithStale<CourseOption[]>(cacheKey)

  try {
    const response = await fetch(`${BASE_URL}/faculties/${facultySlug}`, { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`Failed to fetch courses (${response.status})`)
    }
    const html = await response.text()
    const courses = parseFacultyCourses(html)
    await set(cacheKey, courses, CACHE_TTL.COURSES, CACHE_TYPE.COURSES)
    return courses
  } catch (error) {
    if (staleData) {
      return staleData.value
    }
    throw error
  }
}

export async function fetchWeekSchedule(
  facultySlug: string,
  groupSlug: string,
  weekStart: Date
): Promise<{ weekType: "even" | "odd"; days: DaySchedule[] }> {
  const cacheKey = `schedule:${SCHEDULE_CACHE_VERSION}:${facultySlug}:${groupSlug}:${weekStart.toISOString().split('T')[0]}`

  const cached = await get<{ weekType: "even" | "odd"; days: DaySchedule[] }>(cacheKey)
  if (cached) {
    return cached
  }

  const staleData = await getWithStale<{ weekType: "even" | "odd"; days: DaySchedule[] }>(cacheKey)

  try {
    const url = buildTimetableUrl(facultySlug, groupSlug)
    const html = await fetchTimetableHtml(url, weekStart)
    const lessonModals = parseLessonModals(html)
    const schedule = parseWeekSchedule(html, weekStart, lessonModals)
    await hydrateLessonResourceLinks(schedule.days, lessonModals)
    await set(cacheKey, schedule, CACHE_TTL.SCHEDULE, CACHE_TYPE.SCHEDULE)
    return schedule
  } catch (error) {
    if (staleData) {
      return staleData.value
    }
    throw error
  }
}
