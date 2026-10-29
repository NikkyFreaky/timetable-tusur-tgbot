import 'server-only'

type RateLimit = {
  limit: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  retryAfter: number
}

const buckets = new Map<string, number[]>()
const MAX_BUCKETS = 10_000

function pruneExpiredBuckets(threshold: number) {
  for (const [key, requests] of buckets) {
    if (!requests.some((timestamp) => timestamp > threshold)) buckets.delete(key)
  }
}

/** Ограничивает частоту запросов в рамках одного экземпляра приложения. */
export function checkRateLimit(key: string, { limit, windowMs }: RateLimit): RateLimitResult {
  const now = Date.now()
  const threshold = now - windowMs
  let bucketKey = key
  if (!buckets.has(bucketKey) && buckets.size >= MAX_BUCKETS) {
    pruneExpiredBuckets(threshold)
    if (buckets.size >= MAX_BUCKETS) bucketKey = 'overflow'
  }
  const requests = (buckets.get(bucketKey) ?? []).filter((timestamp) => timestamp > threshold)

  if (requests.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((requests[0] + windowMs - now) / 1000))
    buckets.set(bucketKey, requests)
    return { allowed: false, retryAfter }
  }

  requests.push(now)
  buckets.set(bucketKey, requests)
  return { allowed: true, retryAfter: 0 }
}

/** Возвращает идентификатор клиента для best-effort ограничения частоты. */
export function getClientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown'
}
