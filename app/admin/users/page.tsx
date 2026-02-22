import { UserProfileDialog } from "@/components/list/user-profile-dialog"
import { ListFilters } from "@/components/admin/admin-list-filters"
import { fetchFaculties } from "@/lib/timetable"
import { listUserSummaries, type UserSummary } from "@/lib/user-store"

export const dynamic = "force-dynamic"

const FALLBACK_FACULTY = "Факультет не выбран"
const FALLBACK_GROUP = "Группа не выбрана"
const DEFAULT_PAGE_SIZE = 150
const MIN_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 500

const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" })

type SearchParams = Record<string, string | string[] | undefined>

type FacultyBucket = {
  key: string
  name: string
  slug: string | null
  imageUrl: string | null
  groups: Map<string, GroupBucket>
}

type GroupBucket = {
  key: string
  name: string
  slug: string | null
  users: UserSummary[]
}

function getParam(params: SearchParams | undefined, key: string) {
  if (!params) return ""
  const value = params[key]
  if (!value) return ""
  return Array.isArray(value) ? value[0] ?? "" : value
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function compareWithFallback(a: string, b: string, fallback: string) {
  const aIsFallback = a === fallback
  const bIsFallback = b === fallback
  if (aIsFallback && !bIsFallback) return 1
  if (!aIsFallback && bIsFallback) return -1
  return collator.compare(a, b)
}

function getFacultyKey(user: UserSummary) {
  return user.facultySlug ?? user.facultyName ?? FALLBACK_FACULTY
}

function getFacultyLabel(user: UserSummary) {
  return user.facultyName ?? user.facultySlug ?? FALLBACK_FACULTY
}

function getGroupKey(user: UserSummary) {
  return user.groupSlug ?? user.groupName ?? FALLBACK_GROUP
}

function getGroupLabel(user: UserSummary) {
  return user.groupName ?? user.groupSlug ?? FALLBACK_GROUP
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function buildQueryString(
  filters: {
    query: string
    faculty: string
    group: string
    course: number | null
    pageSize: number
  },
  overrides: { page?: number } = {}
) {
  const params = new URLSearchParams()
  if (filters.query) params.set("q", filters.query)
  if (filters.faculty) params.set("faculty", filters.faculty)
  if (filters.group) params.set("group", filters.group)
  if (filters.course !== null) params.set("course", String(filters.course))
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize))
  }
  if (overrides.page && overrides.page > 1) {
    params.set("page", String(overrides.page))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams)
  const queryParam = getParam(resolvedSearchParams, "q") || getParam(resolvedSearchParams, "query")
  const facultyParam = getParam(resolvedSearchParams, "faculty")
  const groupParam = getParam(resolvedSearchParams, "group")
  const courseParam = getParam(resolvedSearchParams, "course")
  const pageParam = getParam(resolvedSearchParams, "page")
  const pageSizeParam = getParam(resolvedSearchParams, "pageSize")

  const parsedCourse = Number.parseInt(courseParam, 10)
  const courseFilter = Number.isNaN(parsedCourse) ? null : parsedCourse
  const parsedPage = Number.parseInt(pageParam, 10)
  const requestedPage = Number.isNaN(parsedPage) ? 1 : parsedPage
  const parsedPageSize = Number.parseInt(pageSizeParam, 10)
  const pageSize = clamp(
    Number.isNaN(parsedPageSize) ? DEFAULT_PAGE_SIZE : parsedPageSize,
    MIN_PAGE_SIZE,
    MAX_PAGE_SIZE
  )

  const [users, faculties] = await Promise.all([
    listUserSummaries(),
    fetchFaculties().catch(() => []),
  ])

  const facultyImages = new Map<string, string>()
  const facultyImagesByName = new Map<string, string>()
  for (const faculty of faculties) {
    if (faculty.imageUrl) {
      facultyImages.set(faculty.slug, faculty.imageUrl)
      facultyImagesByName.set(faculty.name.toLowerCase(), faculty.imageUrl)
    }
  }

  const facultyOptionMap = new Map<string, { key: string; name: string }>()
  for (const user of users) {
    const key = getFacultyKey(user)
    const name = getFacultyLabel(user)
    if (!facultyOptionMap.has(key)) {
      facultyOptionMap.set(key, { key, name })
    }
  }
  const facultyOptions = Array.from(facultyOptionMap.values()).sort((a, b) =>
    compareWithFallback(a.name, b.name, FALLBACK_FACULTY)
  )

  const groupSource = facultyParam
    ? users.filter((user) => getFacultyKey(user) === facultyParam)
    : users
  const groupOptionMap = new Map<string, { key: string; name: string }>()
  for (const user of groupSource) {
    const key = getGroupKey(user)
    const name = getGroupLabel(user)
    if (!groupOptionMap.has(key)) {
      groupOptionMap.set(key, { key, name })
    }
  }
  const groupOptions = Array.from(groupOptionMap.values()).sort((a, b) =>
    compareWithFallback(a.name, b.name, FALLBACK_GROUP)
  )

  const courseOptions = Array.from(
    new Set(groupSource.map((user) => user.course).filter((value) => typeof value === "number"))
  ).sort((a, b) => a - b)

  const normalizedQuery = queryParam.trim().toLowerCase()

  const filteredUsers = users.filter((user) => {
    if (facultyParam && getFacultyKey(user) !== facultyParam) return false
    if (groupParam && getGroupKey(user) !== groupParam) return false
    if (courseFilter !== null && user.course !== courseFilter) return false
    if (!normalizedQuery) return true

    const haystack = [
      user.name,
      user.username ?? "",
      user.username ? `@${user.username}` : "",
      user.facultyName ?? "",
      user.groupName ?? "",
      user.groupSlug ?? "",
      String(user.id),
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const facultyCompare = compareWithFallback(
      getFacultyLabel(a),
      getFacultyLabel(b),
      FALLBACK_FACULTY
    )
    if (facultyCompare !== 0) return facultyCompare

    const groupCompare = compareWithFallback(
      getGroupLabel(a),
      getGroupLabel(b),
      FALLBACK_GROUP
    )
    if (groupCompare !== 0) return groupCompare

    return collator.compare(a.name, b.name)
  })

  const totalFiltered = sortedUsers.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
  const page = clamp(requestedPage, 1, totalPages)
  const pageUsers = sortedUsers.slice((page - 1) * pageSize, page * pageSize)

  const grouped = new Map<string, FacultyBucket>()
  for (const user of pageUsers) {
    const facultyKey = getFacultyKey(user)
    const facultyName = getFacultyLabel(user)
    const facultySlug = user.facultySlug ?? null
    const facultyImage =
      (facultySlug ? facultyImages.get(facultySlug) : null) ??
      (facultyName !== FALLBACK_FACULTY
        ? facultyImagesByName.get(facultyName.toLowerCase()) ?? null
        : null)
    const groupKey = getGroupKey(user)
    const groupName = getGroupLabel(user)
    const groupSlug = user.groupSlug ?? null

    let facultyBucket = grouped.get(facultyKey)
    if (!facultyBucket) {
      facultyBucket = {
        key: facultyKey,
        name: facultyName,
        slug: facultySlug,
        imageUrl: facultyImage,
        groups: new Map<string, GroupBucket>(),
      }
      grouped.set(facultyKey, facultyBucket)
    }

    const groupBucket = facultyBucket.groups.get(groupKey) ?? {
      key: groupKey,
      name: groupName,
      slug: groupSlug,
      users: [],
    }
    groupBucket.users.push(user)
    facultyBucket.groups.set(groupKey, groupBucket)
  }

  const facultyEntries = Array.from(grouped.values()).sort((a, b) =>
    compareWithFallback(a.name, b.name, FALLBACK_FACULTY)
  )

  const paginationFilters = {
    query: queryParam,
    faculty: facultyParam,
    group: groupParam,
    course: courseFilter,
    pageSize,
  }

  const prevPage = Math.max(1, page - 1)
  const nextPage = Math.min(totalPages, page + 1)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Пользователи</h1>
        <p className="text-xs text-muted-foreground">
          Всего: {users.length} · Найдено: {totalFiltered} · Показано: {pageUsers.length}
        </p>
      </div>

      <ListFilters
        filters={paginationFilters}
        facultyOptions={facultyOptions}
        groupOptions={groupOptions}
        courseOptions={courseOptions}
        totalPages={totalPages}
        page={page}
        fallbackGroupLabel={FALLBACK_GROUP}
        defaultPageSize={DEFAULT_PAGE_SIZE}
      />

      {totalFiltered === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Ничего не найдено. Попробуйте изменить фильтры или поиск.
        </div>
      ) : (
        facultyEntries.map((faculty) => {
          const groupEntries = Array.from(faculty.groups.values()).sort((a, b) =>
            compareWithFallback(a.name, b.name, FALLBACK_GROUP)
          )

          return (
            <section key={faculty.key} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
                    {faculty.imageUrl ? (
                      <img
                        src={faculty.imageUrl}
                        alt={faculty.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {getInitials(faculty.name) || "?"}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                      {faculty.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {Array.from(faculty.groups.values()).reduce(
                        (sum, list) => sum + list.users.length,
                        0
                      )}{" "}
                      на странице
                    </p>
                  </div>
                </div>
              </div>

              {groupEntries.map((group) => {
                const groupTitle =
                  group.name === FALLBACK_GROUP ? FALLBACK_GROUP : `Группа ${group.name}`
                const sortedGroupUsers = [...group.users].sort((a, b) =>
                  collator.compare(a.name, b.name)
                )

                return (
                  <div key={group.key} className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{groupTitle}</span>
                      <span>{sortedGroupUsers.length}</span>
                    </div>

                    <div className="space-y-3">
                      {sortedGroupUsers.map((user) => (
                        <UserProfileDialog key={user.id} user={user} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })
      )}

      {totalFiltered > 0 && totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm">
          <a
            href={`/admin/users${buildQueryString(paginationFilters, { page: prevPage })}`}
            className={`inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 transition ${
              page <= 1
                ? "pointer-events-none text-muted-foreground"
                : "hover:border-foreground/20"
            }`}
            aria-disabled={page <= 1}
          >
            Предыдущая
          </a>
          <span className="text-xs text-muted-foreground">
            Страница {page} из {totalPages}
          </span>
          <a
            href={`/admin/users${buildQueryString(paginationFilters, { page: nextPage })}`}
            className={`inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 transition ${
              page >= totalPages
                ? "pointer-events-none text-muted-foreground"
                : "hover:border-foreground/20"
            }`}
            aria-disabled={page >= totalPages}
          >
            Следующая
          </a>
        </nav>
      )}
    </div>
  )
}
