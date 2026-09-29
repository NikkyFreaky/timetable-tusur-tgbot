-- Baseline for the tables that predate the repository's migrations.
--
-- Keep this migration before 001: later migrations add chat features,
-- history, and bot_active columns to these tables.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  language_code TEXT,
  is_premium BOOLEAN,
  added_to_attachment_menu BOOLEAN,
  allows_write_to_pm BOOLEAN,
  is_bot BOOLEAN,
  settings JSONB,
  notification_state JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id BIGINT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  username TEXT,
  photo_url TEXT,
  settings JSONB,
  notification_state JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_devices (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  tg_platform TEXT,
  tg_version TEXT,
  user_agent TEXT,
  platform TEXT,
  language TEXT,
  timezone TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  settings JSONB
);

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_chats_last_seen ON chats(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_username ON chats(username);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Drop first so the baseline can also be recorded safely on the linked
-- project where these tables were created manually before migrations existed.
DROP POLICY IF EXISTS "Enable all access for users" ON users;
CREATE POLICY "Enable all access for users" ON users
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for chats" ON chats;
CREATE POLICY "Enable all access for chats" ON chats
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for user_devices" ON user_devices;
CREATE POLICY "Enable all access for user_devices" ON user_devices
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_devices_last_seen_at ON user_devices;
CREATE TRIGGER update_user_devices_last_seen_at
  BEFORE UPDATE ON user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
