-- ============================================================
-- 0009: View agregasi master data (dipakai halaman Asrama & Kelas)
-- ============================================================

-- Jumlah santri aktif per asrama (untuk kolom okupansi)
create or replace view public.dorm_occupancy
with (security_invoker = true) as
select dorm_id, count(*)::integer as occupied
from public.students
where deleted_at is null and dorm_id is not null
group by dorm_id;

-- Jumlah santri aktif per kelas (jumlah akurat, tanpa santri terhapus)
create or replace view public.class_sizes
with (security_invoker = true) as
select class_id, count(*)::integer as total
from public.students
where deleted_at is null and class_id is not null
group by class_id;
