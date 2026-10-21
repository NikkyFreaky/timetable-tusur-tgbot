ALTER TABLE employee_availability_people
  ADD COLUMN IF NOT EXISTS attendance_type TEXT NOT NULL DEFAULT 'gpo'
    CHECK (attendance_type IN ('gpo', 'upd'));
