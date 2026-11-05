-- Claims prevent concurrent delivery and preserve completed update IDs across instances.
CREATE TABLE IF NOT EXISTS telegram_webhook_updates (
  update_id BIGINT PRIMARY KEY,
  claim_token UUID NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE telegram_webhook_updates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_telegram_webhook_updates_completed_at
  ON telegram_webhook_updates(completed_at) WHERE completed_at IS NOT NULL;
REVOKE ALL ON TABLE telegram_webhook_updates FROM anon, authenticated;
GRANT ALL ON TABLE telegram_webhook_updates TO service_role;
