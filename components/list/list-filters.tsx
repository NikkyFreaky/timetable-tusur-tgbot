"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type FilterOption = {
  key: string
  name: string
}

type Filters = {
  query: string
  faculty: string
  group: string
  course: number | null
  pageSize: number
}

type ListFiltersProps = {
  filters: Filters
  facultyOptions: FilterOption[]
  groupOptions: FilterOption[]
  courseOptions: number[]
  totalPages: number
  page: number
  fallbackGroupLabel: string
  defaultPageSize: number
}

function buildQueryString(filters: Filters, defaultPageSize: number, page?: number) {
  const params = new URLSearchParams()
  if (filters.query) params.set("q", filters.query)
  if (filters.faculty) params.set("faculty", filters.faculty)
  if (filters.group) params.set("group", filters.group)
  if (filters.course !== null) params.set("course", String(filters.course))
  if (filters.pageSize !== defaultPageSize) {
    params.set("pageSize", String(filters.pageSize))
  }
  if (page && page > 1) {
    params.set("page", String(page))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function ListFilters({
  filters,
  facultyOptions,
  groupOptions,
  courseOptions,
  totalPages,
  page,
  fallbackGroupLabel,
  defaultPageSize,
}: ListFiltersProps) {
  const router = useRouter()
  const [query, setQuery] = useState(filters.query)
  const [faculty, setFaculty] = useState(filters.faculty)
  const [group, setGroup] = useState(filters.group)
  const [course, setCourse] = useState<string>(filters.course === null ? "" : String(filters.course))
  const [pageSize, setPageSize] = useState(String(filters.pageSize))
  const [isComposing, setIsComposing] = useState(false)
  const skipInitial = useRef(true)

  useEffect(() => {
    setQuery(filters.query)
    setFaculty(filters.faculty)
    setGroup(filters.group)
    setCourse(filters.course === null ? "" : String(filters.course))
    setPageSize(String(filters.pageSize))
  }, [filters])

  const nextFilters = useMemo<Filters>(() => {
    const parsedCourse = Number.parseInt(course, 10)
    const courseValue = Number.isNaN(parsedCourse) ? null : parsedCourse
    const parsedPageSize = Number.parseInt(pageSize, 10)
    return {
      query: query.trim(),
      faculty,
      group,
      course: courseValue,
      pageSize: Number.isNaN(parsedPageSize) ? filters.pageSize : parsedPageSize,
    }
  }, [query, faculty, group, course, pageSize, filters.pageSize])

  useEffect(() => {
    if (skipInitial.current || isComposing) {
      skipInitial.current = false
      return
    }

    const handle = window.setTimeout(() => {
      const queryString = buildQueryString(nextFilters, defaultPageSize, 1)
      router.replace(`/list${queryString}`)
    }, 250)

    return () => window.clearTimeout(handle)
  }, [nextFilters, router, defaultPageSize, isComposing])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const queryString = buildQueryString(nextFilters, defaultPageSize, 1)
    router.replace(`/list${queryString}`)
  }

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="search">
            Поиск
          </label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => {
              setIsComposing(false)
              setQuery(event.currentTarget.value)
            }}
            placeholder="Имя, @ник, группа, ID"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="faculty">
            Факультет
          </label>
          <select
            id="faculty"
            value={faculty}
            onChange={(event) => {
              setFaculty(event.target.value)
              setGroup("")
            }}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Все факультеты</option>
            {facultyOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="group">
            Группа
          </label>
          <select
            id="group"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Все группы</option>
            {groupOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.name === fallbackGroupLabel ? option.name : `Группа ${option.name}`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="course">
            Курс
          </label>
          <select
            id="course"
            value={course}
            onChange={(event) => setCourse(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Любой курс</option>
            {courseOptions.map((courseValue) => (
              <option key={courseValue} value={courseValue}>
                {courseValue} курс
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="pageSize">
            Показывать
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(event) => setPageSize(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          >
            {[50, 100, 150, 200, 300, 500].map((size) => (
              <option key={size} value={size}>
                {size} / стр.
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 xl:col-span-5 flex flex-wrap gap-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Применить
          </button>
          <button
            type="button"
            onClick={() => router.replace("/list")}
            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:border-foreground/20"
          >
            Сбросить
          </button>
          <span className="ml-auto text-xs text-muted-foreground flex items-center">
            Страница {page} из {totalPages}
          </span>
        </div>
      </form>
    </section>
  )
}
