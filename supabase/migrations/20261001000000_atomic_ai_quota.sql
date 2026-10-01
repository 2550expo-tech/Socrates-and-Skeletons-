-- Atomic daily AI quota (audit 1 Oct 2569).
-- Before: the Edge Functions counted today's uses and inserted a new one in two
-- separate calls, so many requests sent at once could all pass the limit.
-- Now counting and recording happen in one call, under a lock per user and kind.
-- Called only by the Edge Functions with the service role.

create or replace function public.take_ai_quota(p_user uuid, p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  if p_kind not in ('slip', 'coach') or p_limit is null or p_limit < 1 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_kind, 0));
  select count(*) into used
    from public.ai_usage
   where user_id = p_user and kind = p_kind and created_at >= now() - interval '24 hours';
  if used >= p_limit then
    return false;
  end if;
  insert into public.ai_usage (user_id, kind) values (p_user, p_kind);
  return true;
end;
$$;

revoke execute on function public.take_ai_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.take_ai_quota(uuid, text, integer) to service_role;

-- Amounts have the same upper bound as savings goals (฿1,000,000,000), so a misread
-- amount can never overflow what the app handles.
alter table public.transactions
  drop constraint if exists transactions_amount_max,
  add constraint transactions_amount_max check (amount_satang <= 100000000000);
alter table public.profiles
  drop constraint if exists profiles_amounts_max,
  add constraint profiles_amounts_max check (
    abs(opening_balance_satang) <= 100000000000
    and (monthly_budget_satang is null or monthly_budget_satang <= 100000000000)
  );
