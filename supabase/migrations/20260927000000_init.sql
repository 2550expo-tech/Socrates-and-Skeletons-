-- MindPay database schema (Supabase / PostgreSQL)
-- Run once: Supabase Dashboard -> SQL Editor -> paste -> Run
-- or with the CLI: supabase db push
--
-- Security model: every row belongs to one user and Row Level Security (RLS)
-- makes sure a user can only ever read or change their own rows, even though
-- the app talks to the database directly with the public (publishable) key.

-- ---------------------------------------------------------------------------
-- profiles: one row per user (created automatically at sign-up)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  opening_balance_satang bigint not null default 0,
  runway_floor_satang bigint not null default 50000 check (runway_floor_satang >= 0), -- FR-6 low line, default ฿500
  monthly_budget_satang bigint check (monthly_budget_satang is null or monthly_budget_satang > 0),
  coach_tone text not null default 'friend' check (coach_tone in ('friend', 'coach', 'senior')), -- FR-5
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- transactions (FR-1). Money is stored in satang (integer) to avoid rounding errors.
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount_satang bigint not null check (amount_satang > 0),
  category_key text not null,
  title text not null default '' check (char_length(title) <= 120),
  note text check (note is null or char_length(note) <= 500),
  occurred_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual', 'slip')),
  status text not null default 'confirmed' check (status in ('draft', 'confirmed')),
  slip_ref text,                -- FR-4 duplicate key #1 (QR / printed reference)
  slip_image_hash text,         -- FR-4 duplicate key #2 (SHA-256 of the image)
  ocr_confidence numeric(3, 2) check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1)),
  review_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_time_idx on public.transactions (user_id, occurred_at desc);

-- The database itself refuses a second copy of the same slip, even if two
-- phones scan at the same moment (FR-4 "ตรวจรายการซ้ำ").
create unique index if not exists transactions_user_slip_ref_uidx
  on public.transactions (user_id, slip_ref) where slip_ref is not null;
create unique index if not exists transactions_user_slip_hash_uidx
  on public.transactions (user_id, slip_image_hash) where slip_image_hash is not null;

-- ---------------------------------------------------------------------------
-- ai_usage: counts calls to the AI so one account cannot run up the bill.
-- Written only by the Edge Functions (service role), readable by the owner.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('slip', 'coach')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_day_idx on public.ai_usage (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own ai usage read" on public.ai_usage;
create policy "own ai usage read" on public.ai_usage
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- Create the profile row when a user signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
