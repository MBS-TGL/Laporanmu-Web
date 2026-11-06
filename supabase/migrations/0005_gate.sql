-- ============================================================
-- 0005: Log keluar-masuk santri (gate)
-- Log bersifat immutable: tidak ada UPDATE/DELETE policy di 0006
-- ============================================================

create table public.gate_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  direction public.gate_direction not null,
  occurred_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index gate_logs_student_idx on public.gate_logs (student_id);
create index gate_logs_occurred_at_idx on public.gate_logs (occurred_at desc);
