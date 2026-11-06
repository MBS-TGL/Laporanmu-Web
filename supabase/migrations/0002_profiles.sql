-- ============================================================
-- 0002: Profiles + helper RLS + trigger updated_at & signup
-- ============================================================

-- ------------------------------------------------------------
-- Helper: updated_at otomatis di semua tabel
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Tabel profiles (1:1 dengan auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  role public.app_role not null default 'pending',
  phone text,
  avatar_url text,
  spmb_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil staff; kolom role menentukan akses via RLS';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Trigger: buat profil otomatis (role pending) saat user signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Helper RLS (security definer agar bisa membaca profiles
-- saat mengevaluasi policy tabel lain)
-- ------------------------------------------------------------
create or replace function public.get_my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_any_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = any (required)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(
    array['developer', 'admin', 'pengurus', 'guru']::public.app_role[]
  );
$$;
