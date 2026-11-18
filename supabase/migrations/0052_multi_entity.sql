-- ============================================================
-- 0052: P5b Connectivity — Multi-entity (yayasan multi-cabang)
--
-- Tabel `entities` + entity_id di tabel akar. Konteks entity staff
-- dikirim lewat request header `app.current_entity` (dipasang client
-- saat EntitySwitcher diganti) → RLS helper current_entity_id().
-- Tanpa header: fallback ke entity pertama yang aktif, jadi client
-- lama / RPC tanpa header tetap melihat entity utama.
--
-- Data lama di-backfill ke entity default (nama dari school_settings).
-- ============================================================

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  type text not null default 'sekolah'
    check (type in ('sekolah', 'cabang', 'yayasan')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entities_active_idx on public.entities (sort_order, created_at)
  where deleted_at is null and is_active;
create trigger trg_entities_updated_at
  before update on public.entities
  for each row execute function public.set_updated_at();

-- Entity default tunggal — nama dari profil sekolah bila tersedia
do $$
declare
  v_name text;
begin
  if not exists (select 1 from public.entities where deleted_at is null) then
    select coalesce(nullif(s.school_name, ''), 'Sekolah Utama')
      into v_name
    from public.school_settings s
    where s.id = true;
    insert into public.entities (name, code, type, sort_order)
    values (coalesce(v_name, 'Sekolah Utama'), 'utama', 'sekolah', 0);
  end if;
end $$;

-- ------------------------------------------------------------
-- entity_id di tabel akar (per PLAN P5b: students, teachers,
-- classes, academic_years, inventory, spp_components + school_settings)
-- ------------------------------------------------------------
alter table public.students add column if not exists entity_id uuid references public.entities (id);
alter table public.teachers add column if not exists entity_id uuid references public.entities (id);
alter table public.classes add column if not exists entity_id uuid references public.entities (id);
alter table public.academic_years add column if not exists entity_id uuid references public.entities (id);
alter table public.inventory_items add column if not exists entity_id uuid references public.entities (id);
alter table public.spp_components add column if not exists entity_id uuid references public.entities (id);
alter table public.school_settings add column if not exists entity_id uuid references public.entities (id);

-- Backfill baris lama ke entity utama
do $$
declare
  v_entity uuid;
  t text;
begin
  select id into v_entity from public.entities where deleted_at is null order by sort_order, created_at limit 1;
  if v_entity is null then raise exception 'Entity default tidak ditemukan'; end if;
  foreach t in array array['students', 'teachers', 'classes', 'academic_years', 'inventory_items', 'spp_components']
  loop
    execute format('update public.%I set entity_id = %L where entity_id is null', t, v_entity);
  end loop;
end $$;

create index if not exists students_entity_idx on public.students (entity_id) where deleted_at is null;
create index if not exists teachers_entity_idx on public.teachers (entity_id) where deleted_at is null;
create index if not exists classes_entity_idx on public.classes (entity_id) where deleted_at is null;
create index if not exists academic_years_entity_idx on public.academic_years (entity_id) where deleted_at is null;
create index if not exists inventory_items_entity_idx on public.inventory_items (entity_id) where deleted_at is null;
create index if not exists spp_components_entity_idx on public.spp_components (entity_id) where deleted_at is null;

-- ------------------------------------------------------------
-- RLS helper: entity dari request header, fallback entity pertama.
-- Regex guard supaya header tidak valid tidak melempar cast error
-- dan mematikan seluruh query.
-- ------------------------------------------------------------
create or replace function public.current_entity_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw text;
begin
  begin
    v_raw := coalesce(current_setting('request.headers', true)::jsonb ->> 'app.current_entity', '');
  exception when others then
    v_raw := null;
  end;
  if v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_raw::uuid;
  end if;
  return (
    select id from public.entities
    where deleted_at is null and is_active
    order by sort_order, created_at
    limit 1
  );
end;
$$;

-- Trigger isi entity_id otomatis saat insert (client tidak perlu kirim)
create or replace function public.set_entity_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entity_id is null then
    new.entity_id := public.current_entity_id();
  end if;
  return new;
end;
$$;

create trigger trg_students_entity before insert on public.students
  for each row execute function public.set_entity_default();
create trigger trg_teachers_entity before insert on public.teachers
  for each row execute function public.set_entity_default();
create trigger trg_classes_entity before insert on public.classes
  for each row execute function public.set_entity_default();
create trigger trg_academic_years_entity before insert on public.academic_years
  for each row execute function public.set_entity_default();
create trigger trg_inventory_items_entity before insert on public.inventory_items
  for each row execute function public.set_entity_default();
create trigger trg_spp_components_entity before insert on public.spp_components
  for each row execute function public.set_entity_default();

-- ------------------------------------------------------------
-- RLS entities: baca staff, tulis developer|admin
-- ------------------------------------------------------------
alter table public.entities enable row level security;

create policy "entities_select" on public.entities
  for select to authenticated
  using (public.is_staff());
create policy "entities_insert" on public.entities
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));
create policy "entities_update" on public.entities
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));
create policy "entities_delete" on public.entities
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- Persempit SELECT tabel akar ke entity terpilih.
-- Pelajaran 0041: policy permissive lama HARUS di-drop & recreate —
-- RLS permissive hanya OR, tidak bisa mengecil.
-- Catatan 0006 menanam literal 'pengurus' (label lama) di insert/
-- update: di-recreate sekalian pakai is_staff_writer() agar tahan
-- rename enum (pola 0043), sekaligus menyertakan guard entity.
-- ------------------------------------------------------------
alter table public.school_settings enable row level security;

drop policy if exists "students_select" on public.students;
drop policy if exists "students_insert" on public.students;
drop policy if exists "students_update" on public.students;
create policy "students_select" on public.students
  for select to authenticated
  using (public.is_staff() and (entity_id is null or entity_id = public.current_entity_id()));
create policy "students_insert" on public.students
  for insert to authenticated with check (public.is_staff_writer());
create policy "students_update" on public.students
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

drop policy if exists "teachers_select" on public.teachers;
drop policy if exists "teachers_insert" on public.teachers;
drop policy if exists "teachers_update" on public.teachers;
create policy "teachers_select" on public.teachers
  for select to authenticated
  using (public.is_staff() and (entity_id is null or entity_id = public.current_entity_id()));
create policy "teachers_insert" on public.teachers
  for insert to authenticated with check (public.is_staff_writer());
create policy "teachers_update" on public.teachers
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

drop policy if exists "classes_select" on public.classes;
drop policy if exists "classes_insert" on public.classes;
drop policy if exists "classes_update" on public.classes;
create policy "classes_select" on public.classes
  for select to authenticated
  using (public.is_staff() and (entity_id is null or entity_id = public.current_entity_id()));
create policy "classes_insert" on public.classes
  for insert to authenticated with check (public.is_staff_writer());
create policy "classes_update" on public.classes
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

drop policy if exists "academic_years_select" on public.academic_years;
drop policy if exists "academic_years_insert" on public.academic_years;
drop policy if exists "academic_years_update" on public.academic_years;
create policy "academic_years_select" on public.academic_years
  for select to authenticated
  using (public.is_staff() and (entity_id is null or entity_id = public.current_entity_id()));
create policy "academic_years_insert" on public.academic_years
  for insert to authenticated with check (public.is_staff_writer());
create policy "academic_years_update" on public.academic_years
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

drop policy if exists "inventory_items_select" on public.inventory_items;
create policy "inventory_items_select" on public.inventory_items
  for select to authenticated
  using (public.is_staff() and (entity_id is null or entity_id = public.current_entity_id()));

drop policy if exists "spp_components_select" on public.spp_components;
create policy "spp_components_select" on public.spp_components
  for select to authenticated
  using (public.is_staff() and (entity_id is null or entity_id = public.current_entity_id()));

drop policy if exists "school_settings_select" on public.school_settings;
-- Baris legacy entity_id null = profil bersama, tampil di semua entity.
-- Profil per-entity sungguhan menunggu restrukturisasi PK school_settings
-- (single-row table) — lihat MEMORY.md utang P5b.
create policy "school_settings_select" on public.school_settings
  for select to authenticated
  using (entity_id is null or entity_id = public.current_entity_id());

-- ------------------------------------------------------------
-- Flag system.multi_entity — default ON (single entity tidak
-- mengubah apa pun: switcher baru tampil bila entity > 1)
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('system.multi_entity', 'Multi-Entity (Yayasan)', 'system',
   'Kelola beberapa lembaga/cabang: switcher entity di Topbar + isolasi data per lembaga', true, 4)
on conflict (key) do nothing;
