-- ============================================================
-- 0015: Informasi / Pengumuman
-- Pengumuman internal staf (semua staff role bisa baca, tulis =
-- developer/admin/pengurus) + opsi tampil di portal publik /cek
-- (anon hanya melihat baris is_published + is_public via policy —
-- kolomnya non-sensitif, jadi tidak perlu RPC security-definer)
-- ============================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'Pengumuman'
    check (category in ('Pengumuman', 'Informasi', 'Akademik', 'Kesantrian', 'Darurat')),
  is_pinned boolean not null default false,
  is_published boolean not null default false,
  is_public boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_len_check check (char_length(title) <= 200)
);

-- Urutan baca: tersemat dulu, lalu terbaru
create index announcements_published_idx
  on public.announcements (is_pinned, published_at desc nulls last, created_at desc);

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

-- Staf: semua role staff boleh baca (guru ikut)
create policy "announcements_select_staff" on public.announcements
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus', 'guru']::public.app_role[]));

-- Anon (portal /cek): hanya yang terbit + ditandai publik
create policy "announcements_select_public" on public.announcements
  for select to anon
  using (is_published = true and is_public = true);

-- Tulis: developer/admin/pengurus (selaras WRITE_ROLES di aplikasi)
create policy "announcements_insert" on public.announcements
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));

create policy "announcements_update" on public.announcements
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));

-- Hapus: developer/admin (selaras DELETE_ROLES di aplikasi)
create policy "announcements_delete" on public.announcements
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));
