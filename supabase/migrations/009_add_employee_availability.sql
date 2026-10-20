CREATE TABLE IF NOT EXISTS employee_availability_access (
  telegram_user_id BIGINT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_availability_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('user', 'chat')),
  recipient_id BIGINT NOT NULL,
  topic_id BIGINT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notification_time TEXT NOT NULL DEFAULT '09:00'
    CHECK (notification_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_by BIGINT,
  updated_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipient_kind, recipient_id),
  CHECK ((recipient_kind = 'user' AND topic_id IS NULL) OR recipient_kind = 'chat')
);

CREATE TABLE IF NOT EXISTS employee_availability_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES employee_availability_configs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 200),
  faculty_slug TEXT NOT NULL,
  faculty_name TEXT NOT NULL,
  group_slug TEXT NOT NULL,
  group_name TEXT NOT NULL,
  course INTEGER NOT NULL CHECK (course > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_availability_configs_enabled_idx
  ON employee_availability_configs(enabled, notification_time);
CREATE INDEX IF NOT EXISTS employee_availability_people_config_idx
  ON employee_availability_people(config_id);

ALTER TABLE employee_availability_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_availability_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_availability_people ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_employee_availability_access_updated_at ON employee_availability_access;
CREATE TRIGGER update_employee_availability_access_updated_at
  BEFORE UPDATE ON employee_availability_access
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_availability_configs_updated_at ON employee_availability_configs;
CREATE TRIGGER update_employee_availability_configs_updated_at
  BEFORE UPDATE ON employee_availability_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
