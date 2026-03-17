import type { FacultyOption, CourseOption } from '@/lib/timetable-types'

export interface GroupSearchMatch {
  facultySlug: string
  facultyName: string
  courseNumber: number
  groupSlug: string
  groupName: string
}

export const normalizeSearchValue = (value: string) =>
  value.toLocaleLowerCase('ru-RU').replace(/\s+/g, '')

export const buildGroupSearchMatches = (
  normalizedQuery: string,
  faculties: FacultyOption[],
  coursesByFaculty: Record<string, CourseOption[]>
): GroupSearchMatch[] => {
  if (!normalizedQuery) return []

  const matches: GroupSearchMatch[] = []

  faculties.forEach((faculty) => {
    const courses = coursesByFaculty[faculty.slug] || []

    courses.forEach((course) => {
      course.groups.forEach((group) => {
        if (normalizeSearchValue(group.name).includes(normalizedQuery)) {
          matches.push({
            facultySlug: faculty.slug,
            facultyName: faculty.name,
            courseNumber: course.number,
            groupSlug: group.slug,
            groupName: group.name,
          })
        }
      })
    })
  })

  return matches.sort((first, second) => {
    const firstStartsWith = normalizeSearchValue(first.groupName).startsWith(normalizedQuery)
    const secondStartsWith = normalizeSearchValue(second.groupName).startsWith(normalizedQuery)

    if (firstStartsWith !== secondStartsWith) {
      return firstStartsWith ? -1 : 1
    }

    const byName = first.groupName.localeCompare(second.groupName, 'ru')
    if (byName !== 0) {
      return byName
    }

    return first.courseNumber - second.courseNumber
  })
}
