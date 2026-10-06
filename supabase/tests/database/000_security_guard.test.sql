-- Schema-wide security guard (BRIEF §2.4: every table has RLS enabled; anon reads nothing).
-- On the empty M0 schema these hold trivially; from M1 onward they fail the build
-- as soon as a table is added without RLS or with a grant to anon.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity $$,
  'every table in public has row-level security enabled'
);

select is_empty(
  $$ select table_name, privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee = 'anon' $$,
  'anon holds no table privileges in public'
);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('v', 'm')
        and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%' $$,
  'every view in public is security_invoker (cannot bypass RLS)'
);

select * from finish();
rollback;
