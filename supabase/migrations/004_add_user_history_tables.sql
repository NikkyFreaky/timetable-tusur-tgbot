-- Create user_login_history table for tracking login events
CREATE TABLE IF NOT EXISTS user_login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_login_history_user_id ON user_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_history_created_at ON user_login_history(created_at DESC);

-- Create user_change_history table for tracking profile/settings changes
CREATE TABLE IF NOT EXISTS user_change_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('profile', 'settings')),
  changes JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_change_history_user_id ON user_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_change_history_created_at ON user_change_history(created_at DESC);
