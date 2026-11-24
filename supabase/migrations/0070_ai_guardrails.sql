-- ============================================================
-- 0070: Guardrail pemakaian AI
--
-- Tabel ai_usage menyimpan estimasi token per permintaan untuk
-- rate limit per user + budget global. Akses hanya lewat RPC
-- security definer; tidak ada policy RLS untuk authenticated.
--
-- Deploy: jalankan migrasi ini sebelum deploy ulang `ai-proxy`.
-- ============================================================

create table if not exists public.ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  tokens_est int not null default 0
);

create index if not exists ai_usage_user_idx
  on public.ai_usage (user_id, used_at);
create index if not exists ai_usage_time_idx
  on public.ai_usage (used_at);

alter table public.ai_usage enable row level security;

comment on table public.ai_usage is
  'Log ringkas pemakaian AI untuk kuota per user. Tanpa isi percakapan.';

create or replace function public.ai_consume_quota(
  p_tokens int,
  p_minute_limit int default 5,
  p_day_limit int default 30,
  p_minute_tokens int default 24000,
  p_day_tokens int default 180000
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;

  delete from public.ai_usage where used_at < now() - interval '2 days';

  if (
    select count(*)
    from public.ai_usage
    where user_id = v_uid
      and used_at > now() - interval '1 minute'
  ) >= p_minute_limit then
    return 'minute';
  end if;

  if (
    select count(*)
    from public.ai_usage
    where user_id = v_uid
      and used_at > now() - interval '1 day'
  ) >= p_day_limit then
    return 'day';
  end if;

  if (
    select coalesce(sum(tokens_est), 0)
    from public.ai_usage
    where used_at > now() - interval '1 minute'
  ) + greatest(p_tokens, 0) > p_minute_tokens then
    return 'token_minute';
  end if;

  if (
    select coalesce(sum(tokens_est), 0)
    from public.ai_usage
    where used_at > now() - interval '1 day'
  ) + greatest(p_tokens, 0) > p_day_tokens then
    return 'token_day';
  end if;

  insert into public.ai_usage (user_id, tokens_est)
  values (v_uid, greatest(p_tokens, 0));

  return 'ok';
end;
$$;

revoke execute on function public.ai_consume_quota(int, int, int, int, int)
  from public, anon;
grant execute on function public.ai_consume_quota(int, int, int, int, int)
  to authenticated;
