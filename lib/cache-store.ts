import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

type CacheEntry<T = unknown> = {
  value: T
  expiresAt: number
}

type InMemoryCache = Map<string, CacheEntry>

const inMemoryCache: InMemoryCache = new Map()
const cleanupIntervalMs = 60 * 60 * 1000

function cleanupInMemoryCache(now: number): void {
  for (const [key, entry] of inMemoryCache.entries()) {
    if (entry.expiresAt < now) {
      inMemoryCache.delete(key)
    }
  }
}

setInterval(() => {
  cleanupInMemoryCache(Date.now())
}, cleanupIntervalMs)

export async function get<T>(key: string): Promise<T | null> {
  const now = Date.now()
  cleanupInMemoryCache(now)

  const memoryEntry = inMemoryCache.get(key)
  if (memoryEntry && memoryEntry.expiresAt > now) {
    return memoryEntry.value as T
  }

  try {
    const { data, error } = await supabase
      .from("cache")
      .select("value, expires_at")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error) {
      return null
    }

    if (!data) {
      return null
    }

    const expiresAt = new Date(data.expires_at).getTime()
    inMemoryCache.set(key, { value: data.value, expiresAt })
    return data.value as T
  } catch {
    return null
  }
}

export async function getWithStale<T>(key: string): Promise<{ value: T; isStale: boolean } | null> {
  const now = Date.now()
  cleanupInMemoryCache(now)

  const memoryEntry = inMemoryCache.get(key)
  if (memoryEntry) {
    return { value: memoryEntry.value as T, isStale: memoryEntry.expiresAt <= now }
  }

  try {
    const { data, error } = await supabase
      .from("cache")
      .select("value, expires_at")
      .eq("key", key)
      .single()

    if (error) {
      return null
    }

    if (!data) {
      return null
    }

    const expiresAt = new Date(data.expires_at).getTime()
    const isStale = expiresAt <= now
    inMemoryCache.set(key, { value: data.value, expiresAt })
    return { value: data.value as T, isStale }
  } catch {
    return null
  }
}

export async function set(
  key: string,
  value: unknown,
  ttlMs: number,
  type: string
): Promise<void> {
  const now = Date.now()
  const expiresAt = now + ttlMs

  inMemoryCache.set(key, { value, expiresAt })

  try {
    const expiresAtIso = new Date(expiresAt).toISOString()

    const { error } = await supabase
      .from("cache")
      .upsert(
        {
          key,
          value: value as any,
          type,
          expires_at: expiresAtIso,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      )

    if (error) {
      console.error("Failed to write cache entry to Supabase:", error)
    }
  } catch (error) {
    console.error("Failed to write cache entry to Supabase:", error)
  }
}

export async function deleteKey(key: string): Promise<void> {
  inMemoryCache.delete(key)

  try {
    const { error } = await supabase.from("cache").delete().eq("key", key)

    if (error) {
      console.error("Failed to delete cache entry:", error)
    }
  } catch (error) {
    console.error("Failed to delete cache entry:", error)
  }
}

export async function cleanupExpired(): Promise<number> {
  const now = Date.now()
  cleanupInMemoryCache(now)

  let deletedCount = 0

  try {
    const { count, error } = await supabase
      .from("cache")
      .delete({ count: "exact" })
      .lt("expires_at", new Date().toISOString())

    if (error) {
      console.error("Failed to cleanup expired cache entries:", error)
      return 0
    }

    deletedCount = count ?? 0
  } catch (error) {
    console.error("Failed to cleanup expired cache entries:", error)
  }

  return deletedCount
}

export async function deleteByType(type: string): Promise<number> {
  for (const [key] of inMemoryCache.entries()) {
    inMemoryCache.delete(key)
  }

  let deletedCount = 0

  try {
    const { count, error } = await supabase
      .from("cache")
      .delete({ count: "exact" })
      .eq("type", type)

    if (error) {
      console.error("Failed to delete cache entries by type:", error)
      return 0
    }

    deletedCount = count ?? 0
  } catch (error) {
    console.error("Failed to delete cache entries by type:", error)
  }

  return deletedCount
}
