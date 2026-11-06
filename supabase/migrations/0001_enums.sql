-- ============================================================
-- 0001: Enum types Laporanmu V2
-- Project Supabase: ieckbzhpjehgwpjgdrwk (fresh)
-- ============================================================

create type public.app_role as enum ('developer', 'admin', 'pengurus', 'guru', 'pending');

create type public.person_gender as enum ('L', 'P');

create type public.semester_type as enum ('Ganjil', 'Genap');

create type public.student_status as enum ('aktif', 'lulus', 'pindah', 'keluar');

create type public.teacher_status as enum ('active', 'inactive', 'cuti');

create type public.dorm_gender as enum ('putra', 'putri', 'campur');

create type public.dorm_status as enum ('aktif', 'penuh', 'nonaktif');

create type public.gate_direction as enum ('keluar', 'masuk');
