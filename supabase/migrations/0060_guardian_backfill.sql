-- ============================================================
-- 0060: Backfill data wali dari kolom legacy students.guardian_name
--
-- Tab "Hub Wali" membaca tabel student_guardians (0020), tapi data
-- wali hasil impor V1 masih tinggal di kolom legacy students
-- (guardian_name / guardian_relation / phone) sehingga tab tampil
-- kosong. Migrasi ini menanamkan satu baris wali per siswa yang
-- punya guardian_name (idempoten: dilewati bila siswa sudah punya
-- baris aktif di student_guardians).
--
-- Catatan:
--  - `students.phone` pada data V1 adalah kontak keluarga (dipakai
--    sebagai "No. HP / WhatsApp" wali di drawer) — ikut dibawa.
--  - `guardian_relation` legacy bisa berisi teks Indonesia/English;
--    dipetakan ke enum father/mother/guardian, selain itu 'guardian'.
--  - Aman dijalankan berulang (idempoten); RLS tidak menghalangi
--    karena dijalankan sebagai owner tabel.
-- ============================================================

insert into public.student_guardians (student_id, relation, name, phone)
select
  s.id,
  case
    when lower(coalesce(s.guardian_relation, '')) in ('ayah', 'father') then 'father'
    when lower(coalesce(s.guardian_relation, '')) in ('ibu', 'mother') then 'mother'
    else 'guardian'
  end::text,
  trim(s.guardian_name),
  s.phone
from public.students s
where s.deleted_at is null
  and nullif(trim(s.guardian_name), '') is not null
  and not exists (
    select 1 from public.student_guardians g
    where g.student_id = s.id
      and g.deleted_at is null
  )
on conflict do nothing;
