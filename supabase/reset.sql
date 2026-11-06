-- ============================================================
-- RESET: hapus semua objek Laporanmu di Supabase
-- ⚠️ Hapus SEMUA data aplikasi — hanya untuk project dev yang masih kosong!
-- Idempoten: aman dijalankan ulang (semua pakai IF EXISTS)
-- ============================================================

-- Trigger di skema auth (dibuat ulang oleh 0002)
drop trigger if exists on_auth_user_created on auth.users;

-- Tabel (anak dulu, baru induk; cascade membersihkan FK & view)
drop table if exists public.gate_logs cascade;
drop table if exists public.reports cascade;
drop table if exists public.point_rules cascade;
drop table if exists public.students cascade;
drop table if exists public.classes cascade;
drop table if exists public.dorms cascade;
drop table if exists public.teachers cascade;
drop table if exists public.academic_years cascade;
drop table if exists public.profiles cascade;

-- Fungsi
drop function if exists public.set_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.get_my_role() cascade;
drop function if exists public.has_any_role(public.app_role[]) cascade;
drop function if exists public.is_staff() cascade;
drop function if exists public.import_students(jsonb) cascade;
drop function if exists public.adjust_student_total_points() cascade;

-- Enum types (paling akhir — bergantung pada fungsi di atas)
drop type if exists public.app_role cascade;
drop type if exists public.person_gender cascade;
drop type if exists public.semester_type cascade;
drop type if exists public.student_status cascade;
drop type if exists public.teacher_status cascade;
drop type if exists public.dorm_gender cascade;
drop type if exists public.dorm_status cascade;
drop type if exists public.gate_direction cascade;
