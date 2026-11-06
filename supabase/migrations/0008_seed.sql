-- ============================================================
-- 0008: View agregasi dashboard + seed aturan poin umum
-- ============================================================

-- ------------------------------------------------------------
-- View: jumlah siswa per status (dipakai widget dashboard)
-- security_invoker agar RLS students tetap berlaku
-- ------------------------------------------------------------
create or replace view public.student_status_counts
with (security_invoker = true) as
select status, count(*)::integer as count
from public.students
where deleted_at is null
group by status;

-- ------------------------------------------------------------
-- Seed aturan poin umum (idempoten — aman dijalankan ulang)
-- ------------------------------------------------------------
insert into public.point_rules (name, points, category) values
  ('Terlambat masuk kelas', -5, 'Kedisiplinan'),
  ('Tidak memakai atribut lengkap', -5, 'Kerapian'),
  ('Membolos', -10, 'Kehadiran'),
  ('Membawa HP tanpa izin', -15, 'Kedisiplinan'),
  ('Berkata kasar', -10, 'Perilaku'),
  ('Berkelahi', -30, 'Perilaku'),
  ('Merokok', -25, 'Kesehatan'),
  ('Mencuri', -40, 'Kejujuran'),
  ('Membantu teman', 5, 'Kebaikan'),
  ('Hafalan baru', 10, 'Prestasi'),
  ('Juara lomba', 20, 'Prestasi')
on conflict (name) where deleted_at is null do nothing;
