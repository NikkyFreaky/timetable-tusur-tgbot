export const CACHE_TTL = {
  FACULTIES: 30 * 24 * 60 * 60 * 1000,
  COURSES: 7 * 24 * 60 * 60 * 1000,
  SCHEDULE: 24 * 60 * 60 * 1000,
  LOGOS: 30 * 24 * 60 * 60 * 1000,
  PHOTOS: 30 * 24 * 60 * 60 * 1000,
  RESOURCES: 24 * 60 * 60 * 1000,
}

export const CACHE_TYPE = {
  FACULTIES: "faculties",
  COURSES: "courses",
  SCHEDULE: "schedule",
  LOGOS: "logos",
  PHOTOS: "photos",
  RESOURCES: "resources",
} as const

export type CacheType = (typeof CACHE_TYPE)[keyof typeof CACHE_TYPE]
