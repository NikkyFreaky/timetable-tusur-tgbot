ALTER TABLE employee_availability_people
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ranked_people AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY config_id ORDER BY created_at, id) - 1 AS next_sort_order
  FROM employee_availability_people
)
UPDATE employee_availability_people AS people
SET sort_order = ranked_people.next_sort_order
FROM ranked_people
WHERE people.id = ranked_people.id;

ALTER TABLE employee_availability_people
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS employee_availability_people_config_sort_order_idx
  ON employee_availability_people(config_id, sort_order);
