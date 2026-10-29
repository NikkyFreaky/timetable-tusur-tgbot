-- Avoid recalculating the current authenticated user for every checked row.

DROP POLICY IF EXISTS "Admins can read admins" ON public.admins;
DROP POLICY IF EXISTS "Superadmins can insert admins" ON public.admins;
DROP POLICY IF EXISTS "Superadmins can update admins" ON public.admins;
DROP POLICY IF EXISTS "Superadmins can delete admins" ON public.admins;

CREATE POLICY "Admins can read admins"
  ON public.admins FOR SELECT
  TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

CREATE POLICY "Superadmins can insert admins"
  ON public.admins FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin((SELECT auth.uid())));

CREATE POLICY "Superadmins can update admins"
  ON public.admins FOR UPDATE
  TO authenticated
  USING (public.is_superadmin((SELECT auth.uid())))
  WITH CHECK (public.is_superadmin((SELECT auth.uid())));

CREATE POLICY "Superadmins can delete admins"
  ON public.admins FOR DELETE
  TO authenticated
  USING (
    id != (SELECT auth.uid())
    AND public.is_superadmin((SELECT auth.uid()))
  );

CREATE INDEX IF NOT EXISTS admins_created_by_idx ON public.admins (created_by);
CREATE INDEX IF NOT EXISTS bot_message_dispatches_created_by_idx
  ON public.bot_message_dispatches (created_by);
CREATE INDEX IF NOT EXISTS chats_created_by_idx ON public.chats (created_by);
CREATE INDEX IF NOT EXISTS employee_availability_access_granted_by_idx
  ON public.employee_availability_access (granted_by);
