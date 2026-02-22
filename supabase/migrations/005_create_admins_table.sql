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

-- Только аутентифицированные пользователи-админы могут читать таблицу
create policy "Admins can read admins"
  on public.admins for select
  to authenticated
  using (
    exists (
      select 1 from public.admins a where a.id = auth.uid()
    )
  );

-- Только superadmin может вставлять
create policy "Superadmins can insert admins"
  on public.admins for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admins a where a.id = auth.uid() and a.role = 'superadmin'
    )
  );

-- Только superadmin может обновлять
create policy "Superadmins can update admins"
  on public.admins for update
  to authenticated
  using (
    exists (
      select 1 from public.admins a where a.id = auth.uid() and a.role = 'superadmin'
    )
  );

-- Только superadmin может удалять (но не себя)
create policy "Superadmins can delete admins"
  on public.admins for delete
  to authenticated
  using (
    id != auth.uid() and
    exists (
      select 1 from public.admins a where a.id = auth.uid() and a.role = 'superadmin'
    )
  );
