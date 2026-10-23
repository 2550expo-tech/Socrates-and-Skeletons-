/**
 * Dishonest-user tests for the database (Ch8: access control / IDOR, "check, don't hope").
 *
 * The browser E2E tests run against a fake Supabase that filters rows by user itself,
 * so they would still pass if a Row Level Security policy in supabase/migrations were
 * wrong. These tests run the REAL migration files in a real PostgreSQL (PGlite, in
 * memory, no network) with the same roles and auth.uid() that Supabase uses, then let
 * user B (and a visitor with only the public key) try to read, change, delete and
 * plant rows of user A.
 *
 * TC-100 another user cannot touch A's data · TC-101 guards for future migrations.
 * (In the old app on `main` these are TC-90 and TC-91; MindPay ใหม่ already used those numbers.)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = join(__dirname, '..', 'migrations');
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

/**
 * The parts of a Supabase database the migrations rely on: the API roles, auth.users,
 * auth.uid() (reads the signed-in user's id from the JWT, as Supabase does), and
 * Supabase's default grants, which give the API roles full table access and let RLS
 * decide which rows they see. If these tests passed only because of a missing grant,
 * they would prove nothing, so the grants are as open as on Supabase.
 */
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

type Who = 'anon' | { user: string };
type Result = { rows: Record<string, unknown>[]; error: string | null };

let db: PGlite;
let aTx = '';
let aGoal = '';

/** Run one statement as an API caller, like a request with the public key (+ a login). */
async function as(who: Who, sql: string, params: unknown[] = []): Promise<Result> {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${who === 'anon' ? 'anon' : 'authenticated'}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who === 'anon' ? '' : who.user]);
    const r = await db.query<Record<string, unknown>>(sql, params);
    return { rows: r.rows, error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  } finally {
    await db.exec('rollback');
  }
}

/** Look at the data as the database owner (no RLS), to check nothing really changed. */
async function owner(sql: string, params: unknown[] = []) {
  return (await db.query<Record<string, unknown>>(sql, params)).rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  // Two people sign up (the sign-up trigger makes their profiles).
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"display_name":"เอ"}'), ($2, '{"display_name":"บี"}')`, [A, B]);
  await db.query(`update public.profiles set opening_balance_satang = 500000 where id = $1`, [A]);
  aTx = (await owner(
    `insert into public.transactions (user_id, kind, amount_satang, category_key, title, occurred_at, source, slip_ref)
     values ($1, 'expense', 8500, 'food', 'ข้าวมันไก่', now(), 'slip', 'REF-A-001') returning id`, [A],
  ))[0].id as string;
  aGoal = (await owner(
    `insert into public.savings_goals (user_id, title, target_satang, saved_satang) values ($1, 'รองเท้า', 129000, 50000) returning id`, [A],
  ))[0].id as string;
  await owner(`insert into public.ai_usage (user_id, kind) values ($1, 'slip')`, [A]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('TC-100 another user cannot touch A’s data (real migrations, real RLS)', () => {
  it('control: A sees A’s own rows, so the checks below are not empty by accident', async () => {
    expect((await as({ user: A }, 'select id from public.transactions')).rows).toHaveLength(1);
    expect((await as({ user: A }, 'select id from public.savings_goals')).rows).toHaveLength(1);
    expect((await as({ user: A }, 'select id from public.profiles')).rows).toEqual([{ id: A }]);
    expect((await as({ user: A }, 'select id from public.ai_usage')).rows).toHaveLength(1);
    const own = await as({ user: A }, `update public.transactions set title = 'ข้าวมันไก่พิเศษ' where id = $1 returning id`, [aTx]);
    expect(own.rows).toHaveLength(1);
  });

  it('B asking for A’s transaction by its id gets nothing (the IDOR case)', async () => {
    expect((await as({ user: B }, 'select * from public.transactions where id = $1', [aTx])).rows).toEqual([]);
    expect((await as({ user: B }, 'select * from public.transactions where user_id = $1', [A])).rows).toEqual([]);
    expect((await as({ user: B }, 'select * from public.transactions')).rows).toEqual([]);
  });

  it('B cannot change or delete A’s transaction, even knowing its id', async () => {
    const upd = await as({ user: B }, 'update public.transactions set amount_satang = 1 where id = $1 returning id', [aTx]);
    expect(upd.rows).toEqual([]);
    const del = await as({ user: B }, 'delete from public.transactions where id = $1 returning id', [aTx]);
    expect(del.rows).toEqual([]);
    expect(await owner('select amount_satang from public.transactions where id = $1', [aTx])).toEqual([{ amount_satang: 8500 }]);
  });

  it('B cannot plant a transaction in A’s account, or move B’s own row into it', async () => {
    const plant = await as({ user: B },
      `insert into public.transactions (user_id, kind, amount_satang, category_key, occurred_at) values ($1, 'expense', 99900, 'other', now())`, [A]);
    expect(plant.error).toMatch(/row-level security/);

    const move = await as({ user: B },
      `with mine as (insert into public.transactions (kind, amount_satang, category_key, occurred_at) values ('expense', 100, 'other', now()) returning id)
       update public.transactions set user_id = $1 where id = (select id from mine) returning id`, [A]);
    // Either refused, or the update cannot see the row it just made: never a row owned by A.
    expect(move.rows).toEqual([]);
    expect(await owner('select count(*)::int as n from public.transactions where user_id = $1', [A])).toEqual([{ n: 1 }]);
  });

  it('a slip reference is only unique per user, so B cannot probe which slips A has', async () => {
    const same = await as({ user: B },
      `insert into public.transactions (kind, amount_satang, category_key, occurred_at, source, slip_ref)
       values ('expense', 8500, 'food', now(), 'slip', 'REF-A-001') returning user_id`);
    expect(same.error).toBeNull();
    expect(same.rows).toEqual([{ user_id: B }]);
  });

  it('B cannot read or change A’s profile (opening balance, low line, name)', async () => {
    expect((await as({ user: B }, 'select * from public.profiles where id = $1', [A])).rows).toEqual([]);
    const upd = await as({ user: B }, 'update public.profiles set opening_balance_satang = 0 where id = $1 returning id', [A]);
    expect(upd.rows).toEqual([]);
    const ins = await as({ user: B }, `insert into public.profiles (id, display_name) values ($1, 'ปลอม')`, [B]);
    expect(ins.error).toMatch(/row-level security|duplicate key/);
    expect(await owner('select opening_balance_satang from public.profiles where id = $1', [A])).toEqual([{ opening_balance_satang: 500000 }]);
  });

  it('B cannot read, change, delete or plant A’s savings goals', async () => {
    expect((await as({ user: B }, 'select * from public.savings_goals where id = $1', [aGoal])).rows).toEqual([]);
    expect((await as({ user: B }, 'update public.savings_goals set saved_satang = 0 where id = $1 returning id', [aGoal])).rows).toEqual([]);
    expect((await as({ user: B }, 'delete from public.savings_goals where id = $1 returning id', [aGoal])).rows).toEqual([]);
    const plant = await as({ user: B }, `insert into public.savings_goals (user_id, title, target_satang) values ($1, 'ปลอม', 100)`, [A]);
    expect(plant.error).toMatch(/row-level security/);
    expect(await owner('select saved_satang from public.savings_goals where id = $1', [aGoal])).toEqual([{ saved_satang: 50000 }]);
  });

  it('B cannot use up A’s AI quota, or reset B’s own', async () => {
    expect((await as({ user: B }, 'select * from public.ai_usage where user_id = $1', [A])).rows).toEqual([]);
    const burn = await as({ user: B }, `insert into public.ai_usage (user_id, kind) values ($1, 'slip')`, [A]);
    expect(burn.error).toMatch(/row-level security/);
    const rpc = await as({ user: B }, `select public.take_ai_quota($1, 'slip', 300)`, [A]);
    expect(rpc.error).toMatch(/permission denied/);
    const reset = await as({ user: A }, 'delete from public.ai_usage returning id');
    expect(reset.rows).toEqual([]);
    expect(await owner('select count(*)::int as n from public.ai_usage where user_id = $1', [A])).toEqual([{ n: 1 }]);
  });

  it('B cannot run the sign-up trigger to make profiles for others', async () => {
    const r = await as({ user: B }, 'select public.handle_new_user()');
    expect(r.error).toMatch(/permission denied/);
  });

  it('someone with only the public key (not signed in) sees and writes nothing', async () => {
    for (const table of ['transactions', 'profiles', 'savings_goals', 'ai_usage']) {
      expect((await as('anon', `select * from public.${table}`)).rows).toEqual([]);
    }
    const plant = await as('anon',
      `insert into public.transactions (user_id, kind, amount_satang, category_key, occurred_at) values ($1, 'expense', 100, 'other', now())`, [A]);
    expect(plant.error).not.toBeNull();
    expect((await as('anon', 'update public.profiles set opening_balance_satang = 0 returning id')).rows).toEqual([]);
  });
});

describe('TC-101 guards for future migrations', () => {
  it('every table the app can reach has Row Level Security turned on', async () => {
    const open = await owner(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(open).toEqual([]);
  });

  it('every policy is about the signed-in user (auth.uid()), none lets everyone in', async () => {
    const policies = await owner(
      `select tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as rule
         from pg_policies where schemaname = 'public'`);
    expect(policies.length).toBeGreaterThanOrEqual(5);
    for (const p of policies) expect(p.rule, `${p.tablename} / ${p.policyname}`).toMatch(/auth\.uid\(\)/);
  });

  it('no security-definer function can be called through the API', async () => {
    const callable = await owner(
      `select p.proname, r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         cross join (values ('anon'), ('authenticated')) as r(rolname)
        where n.nspname = 'public' and p.prosecdef and has_function_privilege(r.rolname, p.oid, 'execute')`);
    expect(callable).toEqual([]);
  });
});
