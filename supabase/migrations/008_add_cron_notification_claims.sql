-- A successful insert is an atomic, durable claim for one scheduled notification.
-- dispatch_key is a minute in Asia/Tomsk, formatted as YYYY-MM-DD HH:MM.
CREATE TABLE IF NOT EXISTS cron_notification_claims (
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('user', 'chat')),
  recipient_id BIGINT NOT NULL,
  notification_type TEXT NOT NULL,
  dispatch_key TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (recipient_kind, recipient_id, notification_type, dispatch_key)
);

CREATE INDEX IF NOT EXISTS idx_cron_notification_claims_claimed_at
  ON cron_notification_claims(claimed_at);
