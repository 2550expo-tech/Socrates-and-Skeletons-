-- Check that the LIVE database still has the access rules that supabase/__tests__/rls.test.ts (TC-100, TC-101) tests.
-- Supabase Dashboard -> SQL Editor -> paste -> Run. Read-only.
-- Expected: 5 rows "policy" (all with auth.uid()), 4 rows "table", and NO rows "rls_off" or "definer_callable".
-- Last checked 19 Oct 2569: as expected.

select 'policy' as kind, tablename || ' / ' || policyname as name,
       cmd || ' | ' || coalesce(qual, '') || ' | ' || coalesce(with_check, '') as detail
  from pg_policies where schemaname = 'public'
union all
select 'rls_off', c.relname, 'this table has no Row Level Security'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'definer_callable', p.proname, r.rolname || ' can call this security-definer function'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 cross join (values ('anon'), ('authenticated')) as r(rolname)
 where n.nspname = 'public' and p.prosecdef and has_function_privilege(r.rolname, p.oid, 'execute')
union all
select 'table', c.relname, ''
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
order by 1, 2;
