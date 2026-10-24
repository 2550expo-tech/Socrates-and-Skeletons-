-- PDPA consent records (MyPay, src/domain/consent.ts): each answer to "may slip
-- photos go to the AI?" is kept with the account, so it follows the user to a
-- new phone and shows what they agreed to, which wording, and when.
--
-- Append-only: a new answer (yes, no, or withdrawing) is a new row, and the
-- newest row is the answer in force. Nobody can change or delete an earlier
-- answer through the API, not even its owner.
-- Deleting the account (auth.users) deletes these rows with everything else.

create table if not exists public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Which app asked (MyPay and MindPay share accounts; their wording differs).
  app text not null check (app in ('mypay', 'mindpay')),
  purpose text not null check (purpose in ('slip_ai')),
  granted boolean not null,
  -- The wording the person answered (SLIP_AI_CONSENT_VERSION in the app).
  version integer not null check (version between 1 and 1000),
  -- When the person tapped (the phone's clock; may be earlier than created_at when sent later).
  answered_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists consents_user_idx on public.consents (user_id, app, purpose, answered_at desc);

alter table public.consents enable row level security;

-- Read and add only; no update or delete for anyone using the API.
revoke all on public.consents from anon, authenticated;
grant select, insert on public.consents to authenticated;

drop policy if exists "own consents read" on public.consents;
create policy "own consents read" on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own consents add" on public.consents;
create policy "own consents add" on public.consents
  for insert to authenticated with check ((select auth.uid()) = user_id);
