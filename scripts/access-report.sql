-- Prints docs/access-policies.md from the live catalog (BRIEF §10, M1 gate: policy list for
-- owner review). Run: npm run db:report. CI fails when the committed file is out of date.
\pset format unaligned
\pset tuples_only on
\pset footer off

select string_agg(line, E'\n' order by ord) from (
  select 1 as ord, '# Access policies' as line
  union all select 2, ''
  union all select 3, 'Generated from the database catalog by `scripts/access-report.sql` (`npm run db:report`). Do not edit by hand.'
  union all select 4, ''
  union all select 5, '## Table privileges'
  union all select 6, ''
  union all select 7, '`anon` has no privileges anywhere. `service_role` (server-side only) bypasses RLS and is not listed.'
  union all select 8, ''
  union all select 9, '| Table | RLS | authenticated may |'
  union all select 10, '|---|---|---|'
  union all select 11 + row_number() over (order by c.relname),
    format('| `%s` | %s | %s |', c.relname,
      case when c.relrowsecurity then 'on' else '**off**' end,
      coalesce((select string_agg(lower(g.privilege_type), ', ' order by g.privilege_type)
                  from information_schema.role_table_grants g
                 where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'authenticated'), '—'))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
) t
union all
select string_agg(line, E'\n' order by ord) from (
  select 1 as ord, E'\n## Row-level security policies\n' as line
  union all select 2, '| Table | Policy | For | Using | With check |'
  union all select 3, '|---|---|---|---|---|'
  union all select 3 + row_number() over (order by tablename, policyname),
    format('| `%s` | %s | %s | `%s` | %s |', tablename, policyname, lower(cmd),
      replace(regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g'), '|', '\|'),
      case when with_check is null then '' else '`' || replace(regexp_replace(with_check, '\s+', ' ', 'g'), '|', '\|') || '`' end)
    from pg_policies where schemaname = 'public'
) t
union all
select string_agg(line, E'\n' order by ord) from (
  select 1 as ord, E'\n## RPCs (the only write path for project data)\n' as line
  union all select 2, 'All are `SECURITY DEFINER` with an empty `search_path`; each checks visibility, the project lock and the caller''s role before writing.'
  union all select 3, ''
  union all select 4, '| Function | Arguments | Executable by |'
  union all select 5, '|---|---|---|'
  union all select 5 + row_number() over (order by p.proname),
    format('| `%s` | %s | %s |', p.proname, nullif(pg_get_function_identity_arguments(p.oid), ''),
      (select string_agg(r, ', ' order by r) from unnest(array['anon', 'authenticated']) r
        where has_function_privilege(r, p.oid, 'execute')))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
) t
union all
select string_agg(line, E'\n' order by ord) from (
  select 1 as ord, E'\n## Realtime\n' as line
  union all select 2, 'Published tables (each subscriber only receives rows its SELECT policies allow):'
  union all select 3, ''
  union all select 3 + row_number() over (order by tablename), format('- `%s`', tablename)
    from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
) t;
