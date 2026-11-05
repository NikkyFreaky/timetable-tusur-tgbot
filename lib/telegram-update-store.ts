import 'server-only'

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const LEASE_MS = 5 * 60_000
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Claim = { state: 'claimed'; token: string } | { state: 'completed' } | { state: 'busy' }

export async function claimTelegramUpdate(updateId: number): Promise<Claim> {
  const token = randomUUID()
  const { error } = await supabase.from('telegram_webhook_updates').insert({
    update_id: updateId, claim_token: token,
  })
  if (!error) return { state: 'claimed', token }
  if (error.code !== '23505') throw error

  const { data, error: readError } = await supabase.from('telegram_webhook_updates')
    .select('claim_token, claimed_at, completed_at').eq('update_id', updateId).maybeSingle()
  if (readError) throw readError
  if (!data) return { state: 'busy' }
  if (data.completed_at) return { state: 'completed' }
  if (Date.parse(data.claimed_at) > Date.now() - LEASE_MS) return { state: 'busy' }

  const { data: claimed, error: claimError } = await supabase.from('telegram_webhook_updates')
    .update({ claim_token: token, claimed_at: new Date().toISOString() })
    .eq('update_id', updateId).eq('claim_token', data.claim_token).is('completed_at', null)
    .select('update_id').maybeSingle()
  if (claimError) throw claimError
  return claimed ? { state: 'claimed', token } : { state: 'busy' }
}

export async function completeTelegramUpdate(updateId: number, token: string): Promise<void> {
  const { data, error } = await supabase.from('telegram_webhook_updates')
    .update({ completed_at: new Date().toISOString() }).eq('update_id', updateId)
    .eq('claim_token', token).is('completed_at', null).select('update_id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Telegram update claim expired')
}

export async function releaseTelegramUpdate(updateId: number, token: string): Promise<void> {
  const { error } = await supabase.from('telegram_webhook_updates').delete()
    .eq('update_id', updateId).eq('claim_token', token).is('completed_at', null)
  if (error) throw error
}

/** Retain completed IDs long enough to suppress delayed Telegram retries. */
export async function cleanupTelegramUpdates(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()
  const { count, error } = await supabase.from('telegram_webhook_updates')
    .delete({ count: 'exact' }).lt('completed_at', cutoff)
  if (error) throw error
  return count ?? 0
}
