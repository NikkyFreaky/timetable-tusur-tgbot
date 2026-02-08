-- Create chat members table
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('creator', 'administrator', 'member', 'left', 'kicked')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

-- Indexes for chat members
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_role ON chat_members(role);

-- Create chat topics table
CREATE TABLE IF NOT EXISTS chat_topics (
  id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon_color INTEGER,
  icon_custom_emoji_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Index for chat topics
CREATE INDEX IF NOT EXISTS idx_chat_topics_chat_id ON chat_topics(chat_id);

-- Add new columns to chats table
ALTER TABLE chats ADD COLUMN IF NOT EXISTS topic_id BIGINT REFERENCES chat_topics(id) ON DELETE SET NULL;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS is_forum BOOLEAN DEFAULT FALSE;
