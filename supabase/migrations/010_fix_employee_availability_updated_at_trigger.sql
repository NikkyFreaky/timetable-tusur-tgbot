CREATE OR REPLACE FUNCTION update_only_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_employee_availability_access_updated_at ON employee_availability_access;
CREATE TRIGGER update_employee_availability_access_updated_at
  BEFORE UPDATE ON employee_availability_access
  FOR EACH ROW
  EXECUTE FUNCTION update_only_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_availability_configs_updated_at ON employee_availability_configs;
CREATE TRIGGER update_employee_availability_configs_updated_at
  BEFORE UPDATE ON employee_availability_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_only_updated_at_column();
