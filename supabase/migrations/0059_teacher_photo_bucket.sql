-- 0059: Bucket Storage foto guru
-- Pendamping fitur foto TeacherForm: foto dikompres di klien lalu diunggah ke
-- bucket 'teacher-photo' (pola V1); DB hanya menyimpan URL publik, bukan base64.
-- Catatan penerapan: migration history di project ini tidak lengkap (0050-0058
-- diterapkan via dashboard SQL editor), jadi file ini diterapkan dengan cara yang
-- sama — JANGAN `supabase db push` (akan mengulang migrasi lama dan gagal).

insert into storage.buckets (id, name, public)
values ('teacher-photo', 'teacher-photo', true)
on conflict (id) do nothing;

-- Bucket publik: URL publik bisa dibaca tanpa RLS; policy di bawah untuk akses
-- via API storage (list/get) dan operasi tulis pengguna login. Pembatasan
-- permission halus (mis. teachers:write) tetap di level aplikasi — pola V1.
create policy teacher_photo_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'teacher-photo');

create policy teacher_photo_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'teacher-photo');

create policy teacher_photo_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'teacher-photo');

create policy teacher_photo_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'teacher-photo');
