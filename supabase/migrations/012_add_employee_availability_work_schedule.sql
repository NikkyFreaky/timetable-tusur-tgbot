ALTER TABLE employee_availability_configs
  ALTER COLUMN notification_time SET DEFAULT '09:00',
  ADD COLUMN workday_start TEXT NOT NULL DEFAULT '09:00'
    CHECK (workday_start ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD COLUMN workday_end TEXT NOT NULL DEFAULT '18:00'
    CHECK (workday_end ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD COLUMN lunch_start TEXT NOT NULL DEFAULT '13:00'
    CHECK (lunch_start ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD COLUMN lunch_end TEXT NOT NULL DEFAULT '14:00'
    CHECK (lunch_end ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT employee_availability_configs_work_schedule_check CHECK (
    workday_start < workday_end
    AND lunch_start < lunch_end
    AND lunch_start >= workday_start
    AND lunch_end <= workday_end
  );
