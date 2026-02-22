-- Таблица администраторов
-- Связь: admins.id -> auth.users.id (Supabase Auth)
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Индекс по email для быстрого поиска
create index if not exists admins_email_idx on public.admins (email);

-- Row Level Security
alter table public.admins enable row level security;

-- Helper functions to avoid recursive RLS checks
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

-- Только аутентифицированные пользователи-админы могут читать таблицу
create policy "Admins can read admins"
  on public.admins for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Только superadmin может вставлять
create policy "Superadmins can insert admins"
  on public.admins for insert
  to authenticated
  with check (public.is_superadmin(auth.uid()));

-- Только superadmin может обновлять
create policy "Superadmins can update admins"
  on public.admins for update
  to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- Только superadmin может удалять (но не себя)
create policy "Superadmins can delete admins"
  on public.admins for delete
  to authenticated
  using (id != auth.uid() and public.is_superadmin(auth.uid()));
