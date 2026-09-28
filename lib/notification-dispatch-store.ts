import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

type NotificationRecipientKind = 'user' | 'chat'

interface NotificationDispatchClaim {
  recipientKind: NotificationRecipientKind
  recipientId: number
  notificationType: string
  dispatchKey: string
}

/**
 * Atomically claims a scheduled notification. A duplicate claim is a normal
 * outcome and means another cron invocation owns this delivery.
 */
export async function claimNotificationDispatch({
  recipientKind,
  recipientId,
  notificationType,
  dispatchKey,
}: NotificationDispatchClaim): Promise<boolean> {
  const { data, error } = await supabase
    .from('cron_notification_claims')
    .upsert(
      {
        recipient_kind: recipientKind,
        recipient_id: recipientId,
        notification_type: notificationType,
        dispatch_key: dispatchKey,
      },
      {
        onConflict: 'recipient_kind,recipient_id,notification_type,dispatch_key',
        ignoreDuplicates: true,
      }
    )
    .select('recipient_id')

  if (error) {
    throw new Error(`Failed to claim notification dispatch: ${error.message}`)
  }

  return data?.length === 1
}
