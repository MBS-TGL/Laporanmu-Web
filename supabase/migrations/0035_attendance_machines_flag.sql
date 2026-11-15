-- ============================================================
-- 0035: Seed feature flag tab Mesin Presensi (Absensi)
--
-- Flag ini dipakai AttendancePage untuk menampilkan tab Mesin.
-- Sebelumnya key tidak pernah di-seed sehingga useFlag() jatuh ke
-- fallback dan tab Mesin hilang. Nilai default: aktif.
--
-- `do nothing` agar tidak menimpa pilihan admin bila flag sudah ada.
-- ============================================================

insert into public.feature_flags (key, label, category, description, enabled, sort_order)
values (
  'attendance.student_machines',
  'Mesin Presensi Santri',
  'module',
  'Tampilkan tab Mesin di halaman Absensi (impor log mesin & sinkron ke absensi santri)',
  true,
  10
)
on conflict (key) do nothing;
