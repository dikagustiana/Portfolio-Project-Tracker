-- Schema-wide security guard (BRIEF §2.4: every table has RLS enabled; anon reads nothing).
-- On the empty M0 schema these hold trivially; from M1 onward they fail the build
-- as soon as a table is added without RLS or with a grant to anon.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

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

select is_empty(
  $$ select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any function in public or private'
);

select is_empty(
  $$ select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and p.prosecdef
        and not coalesce(p.proconfig::text[] @> array['search_path=""'], false) $$,
  'every SECURITY DEFINER function pins an empty search_path'
);

select is_empty(
  $$ select tablename
       from pg_publication_tables
      where pubname = 'supabase_realtime'
        and tablename in ('people_contact', 'profiles', 'pending_system_roles', 'invitations', 'invitation_projects',
                          'migration_flags', 'activity_log', 'email_log') $$,
  'contact details, roles, invitations, migration notes and logs are not streamed over Realtime'
);

select * from finish();
rollback;
