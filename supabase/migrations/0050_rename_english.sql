-- ============================================================
-- 0050: Normalisasi penamaan sistem ke English
--   * feature_flags: ganti key modul ke English
--   * role_permissions: ganti permission 'keuangan:'/'evaluasi:'/'disiplin:'
--     ke 'finance:'/'evaluation:'/'discipline:'
-- Copy UI tetap Bahasa Indonesia (aturan AGENTS.md).
-- ============================================================

-- ------------------------------------------------------------
-- feature_flags: ganti key (nilai & urutan dipertahankan)
-- ------------------------------------------------------------
update public.feature_flags set key = 'module.finance_spp'
  where key = 'module.keuangan_spp';
update public.feature_flags set key = 'module.evaluation'
  where key = 'module.evaluasi';
update public.feature_flags set key = 'module.subject_attendance'
  where key = 'module.presensi_mapel';
update public.feature_flags set key = 'module.spiritual'
  where key = 'module.rohani';
update public.feature_flags set key = 'module.worship'
  where key = 'module.ibadah';
update public.feature_flags set key = 'module.discipline'
  where key = 'module.disiplin';

-- ------------------------------------------------------------
-- role_permissions: override per role mengikuti registry baru
-- ------------------------------------------------------------
update public.role_permissions
  set permission = 'finance:' || split_part(permission, ':', 2)
  where permission like 'keuangan:%';
update public.role_permissions
  set permission = 'evaluation:' || split_part(permission, ':', 2)
  where permission like 'evaluasi:%';
update public.role_permissions
  set permission = 'discipline:' || split_part(permission, ':', 2)
  where permission like 'disiplin:%';
