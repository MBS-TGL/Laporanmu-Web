-- ============================================================
-- 0058: Penanda foto pada daftar siswa
--
-- `photo_url` menyimpan data-URL base64 (s.d. ~450 KB/foto), jadi
-- menariknya untuk 1.000 baris daftar = puluhan MB. Kolom turunan
-- ini membuat klien tetap bisa menghitung kelengkapan data /
-- memfilter "belum ada foto" tanpa memuat base64-nya.
-- ============================================================

alter table public.students
  add column if not exists has_photo boolean
  generated always as (photo_url is not null) stored;

comment on column public.students.has_photo is
  'Turunan photo_url is not null - cek kelengkapan tanpa memuat base64 foto';
