-- ==========================================
-- Telegram Schedule App - Supabase Schema
-- ==========================================

-- Enable UUID extension for future use
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- Users table
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id bigint PRIMARY KEY,
  first_name text NOT NULL,
  last_name text,
  username text,
  photo_url text,
  language_code text,
  is_premium boolean,
  added_to_attachment_menu boolean,
  allows_write_to_pm boolean,
  is_bot boolean,
  settings jsonb,
  notification_state jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  last_seen_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- Chats table (for group chats)
-- ==========================================
CREATE TABLE IF NOT EXISTS chats (
  id bigint PRIMARY KEY,
  type text NOT NULL,
  title text,
  username text,
  photo_url text,
  settings jsonb,
  notification_state jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  last_seen_at timestamptz DEFAULT NOW()
);

-- ==========================================
-- User devices table
-- ==========================================
CREATE TABLE IF NOT EXISTS user_devices (
  id text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  tg_platform text,
  tg_version text,
  user_agent text,
  platform text,
  language text,
  timezone text,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  settings jsonb
);

-- ==========================================
-- Indexes for performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_chats_last_seen ON chats(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_username ON chats(username);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

-- ==========================================
-- Row Level Security (RLS) policies
-- ==========================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Users: Allow all operations (public access for web app)
CREATE POLICY "Enable all access for users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- Chats: Allow all operations (public access for web app)
CREATE POLICY "Enable all access for chats" ON chats
  FOR ALL USING (true) WITH CHECK (true);

-- User devices: Allow all operations (public access for web app)
CREATE POLICY "Enable all access for user_devices" ON user_devices
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- Function to auto-update updated_at and last_seen_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-update
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
