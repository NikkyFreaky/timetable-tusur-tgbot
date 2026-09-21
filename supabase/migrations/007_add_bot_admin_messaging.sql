CREATE TABLE IF NOT EXISTS bot_message_templates (
  command TEXT NOT NULL CHECK (command IN ('start', 'settings', 'info')),
  audience TEXT NOT NULL CHECK (audience IN ('private', 'group')),
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 4096),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (command, audience)
);

INSERT INTO bot_message_templates (command, audience, text)
VALUES
  ('start', 'private', E'⚙️ Чтобы настроить уведомления:\n1) Откройте веб-приложение\n2) Выберите группу\n3) Включите нужные рассылки'),
  ('start', 'group', E'⚙️ Чтобы настроить уведомления:\n1) Откройте веб-приложение\n2) В группе выдайте боту права администратора'),
  ('settings', 'private', E'⚙️ Настройка уведомлений\nОткройте веб-приложение, выберите группу и включите нужные рассылки.'),
  ('settings', 'group', E'⚙️ Настройка уведомлений\nОткройте веб-приложение, выберите группу и включите нужные рассылки.'),
  ('info', 'private', '📚 Бот расписания ТУСУР. Откройте приложение, чтобы выбрать группу и настроить уведомления.'),
  ('info', 'group', '📚 Бот расписания ТУСУР. Откройте приложение, чтобы настроить расписание и уведомления для этого чата.')
ON CONFLICT (command, audience) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS bot_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS bot_message_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES admins(id),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'schedule')),
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bot_message_delivery_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispatch_id UUID NOT NULL REFERENCES bot_message_dispatches(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  message_thread_id BIGINT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_message_delivery_attempts_dispatch_id
  ON bot_message_delivery_attempts(dispatch_id);
