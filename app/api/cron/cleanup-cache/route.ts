import { NextResponse } from "next/server"
import { cleanupExpired } from "@/lib/cache-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const requestUrl = new URL(request.url)

  if (cronSecret) {
    const auth = request.headers.get("authorization")
    const querySecret = requestUrl.searchParams.get("secret")
    if (auth !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const deletedCount = await cleanupExpired()
    return NextResponse.json({
      ok: true,
      deleted: deletedCount,
    })
  } catch (error) {
    console.error("Failed to cleanup cache:", error)
    return NextResponse.json(
      { error: "Failed to cleanup cache" },
      { status: 500 }
    )
  }
}
