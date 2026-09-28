-- Savings goals ("กระปุกออม"): money the user sets aside for something they
-- want. Saved money still sits in the user's account, so the app keeps it out
-- of what can be spent (Money Runway) until the goal is used or removed.
-- Same security model as the other tables: each row belongs to one user and
-- Row Level Security lets a user read or change only their own rows.

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  emoji text not null default '🎯' check (char_length(emoji) <= 8),
  target_satang bigint not null check (target_satang > 0 and target_satang <= 100000000000),
  saved_satang bigint not null default 0 check (saved_satang >= 0 and saved_satang <= 100000000000),
  due_day date,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_goals_user_idx on public.savings_goals (user_id, created_at);

alter table public.savings_goals enable row level security;

drop policy if exists "own savings goals" on public.savings_goals;
create policy "own savings goals" on public.savings_goals
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop trigger if exists savings_goals_touch on public.savings_goals;
create trigger savings_goals_touch before update on public.savings_goals
  for each row execute function public.touch_updated_at();
