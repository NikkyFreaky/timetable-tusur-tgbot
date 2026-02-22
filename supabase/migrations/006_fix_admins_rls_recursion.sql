-- Fix recursive RLS policies on public.admins
-- Apply this migration for existing databases where 005 was already executed

drop policy if exists "Admins can read admins" on public.admins;
drop policy if exists "Superadmins can insert admins" on public.admins;
drop policy if exists "Superadmins can update admins" on public.admins;
drop policy if exists "Superadmins can delete admins" on public.admins;

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where id = check_user_id
  );
$$;

create or replace function public.is_superadmin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where id = check_user_id
      and role = 'superadmin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_superadmin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_superadmin(uuid) to authenticated;

create policy "Admins can read admins"
  on public.admins for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Superadmins can insert admins"
  on public.admins for insert
  to authenticated
  with check (public.is_superadmin(auth.uid()));

create policy "Superadmins can update admins"
  on public.admins for update
  to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "Superadmins can delete admins"
  on public.admins for delete
  to authenticated
  using (id != auth.uid() and public.is_superadmin(auth.uid()));
