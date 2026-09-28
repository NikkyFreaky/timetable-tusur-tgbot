import { NextResponse } from "next/server"
import { cleanupExpired } from "@/lib/cache-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
