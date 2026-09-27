-- Hardening after running the Supabase security/performance advisors on the first migration.

-- 1. Fixed search_path on trigger functions (advisor 0011).
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- 2. The sign-up trigger must not be callable through the REST API (advisors 0028/0029).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. Evaluate auth.uid() once per query instead of once per row (advisor 0003).
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own ai usage read" on public.ai_usage;
create policy "own ai usage read" on public.ai_usage
  for select using ((select auth.uid()) = user_id);
