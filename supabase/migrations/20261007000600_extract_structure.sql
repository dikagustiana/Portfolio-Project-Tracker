-- Second architecture pass · 6/6 · Structure out of prose, Realtime (docs/ARCHITECTURE.md §I.5).
--
-- The workbook import put real structure into task descriptions. private.extract_structure()
-- turns what can be parsed reliably into rows, idempotently:
--   Owner (fungsi): X · Nama owner: …                  → tasks.owner_function_id
--   Prasyarat (acceptance only, …): MB01, MB02          → task_deps kind 'accept'
--   MB05.1 · <judul>                                    → sub-task MB05.1 under MB05
--      Bukti: <bukti> · <Fungsi> → <Fungsi pemeriksa> · <tanggal> · Dep: … · Record: … · Kalau meleset: …
--                                                       → proof, owner function, dates, 'start'
--                                                         dependencies, Keputusan links (Record: Kxx)
-- Descriptions stay verbatim. Anything ambiguous is written to migration_flags instead of being
-- guessed. Sub-task PIC: the package's PIC when the function is the package's own (or reads
-- "Owner paket"); otherwise unassigned and owned by its function.

create function private.ensure_function(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v uuid;
begin
  select f.id into v from public.functions f where lower(f.name) = lower(btrim(p_name));
  if v is null then
    insert into public.functions (name, sort) values (btrim(p_name), (select coalesce(max(f.sort), 0) + 1 from public.functions f))
    returning id into v;
  end if;
  return v;
end
$$;

-- '7 Okt 2026' → 2026-10-07; null when it does not parse.
create function private.parse_id_date(p text) returns date
language plpgsql immutable set search_path = ''
as $$
declare
  m text[] := regexp_match(btrim(p), '^([0-9]{1,2}) ([A-Za-z]{3}) ([0-9]{4})$');
  v_month int;
begin
  if m is null then
    return null;
  end if;
  v_month := array_position(array['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'], lower(m[2]));
  if v_month is null and lower(m[2]) = 'agt' then
    v_month := 8;
  end if;
  if v_month is null then
    return null;
  end if;
  return make_date(m[3]::int, v_month, m[1]::int);
exception when others then
  return null;
end
$$;

create function private.flag(p_project uuid, p_type text, p_id uuid, p_ref text, p_code text, p_detail text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.migration_flags (project_id, object_type, object_id, ref, code, detail)
  values (p_project, p_type, p_id, p_ref, p_code, p_detail)
  on conflict (project_id, ref, code, detail) do nothing
$$;

create function private.add_dep(p_project uuid, p_task public.tasks, p_ref text, p_kind text) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_dep uuid;
begin
  select t.id into v_dep from public.tasks t where t.project_id = p_project and t.ref = p_ref;
  if v_dep is null then
    perform private.flag(p_project, 'task', p_task.id, p_task.ref, 'dep_unresolved',
                         format('Prasyarat %s tidak ditemukan di project ini; tidak dibuat.', p_ref));
    return 0;
  end if;
  if v_dep = p_task.id or exists (select 1 from public.task_deps d where d.task_id = p_task.id and d.depends_on_task_id = v_dep) then
    return 0;
  end if;
  -- A package and its own sub-task already relate through the hierarchy.
  if exists (select 1 from public.tasks t where (t.id = v_dep and t.parent_task_id = p_task.id)
                                            or (t.id = p_task.id and t.parent_task_id = v_dep)) then
    return 0;
  end if;
  begin
    insert into public.task_deps (project_id, task_id, depends_on_task_id, kind) values (p_project, p_task.id, v_dep, p_kind);
  exception when check_violation then
    perform private.flag(p_project, 'task', p_task.id, p_task.ref, 'dep_cycle',
                         format('Prasyarat %s akan membuat ketergantungan melingkar; tidak dibuat.', p_ref));
    return 0;
  end;
  return 1;
end
$$;

create function private.extract_structure(p_project uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tasks;
  c public.tasks;
  v_lines text[];
  v_line text;
  v_next text;
  m text[];
  v_segs text[];
  v_seg text;
  v_arrow int;
  v_proof text;
  v_owner text;
  v_val text;
  v_dates text;
  v_deps text;
  v_records text;
  v_fallback text;
  v_start date;
  v_end date;
  v_parent_fn text;
  v_fn uuid;
  v_ref text;
  v_desc text;
  v_assignee uuid;
  v_children int := 0;
  v_accept int := 0;
  v_start_deps int := 0;
  v_links int := 0;
  v_inferred int := 0;
  r record;
  v_pending jsonb := '[]'::jsonb;
  v_ask uuid;
begin
  perform set_config('app.quiet_events', 'on', true);

  for t in
    select * from public.tasks x
     where x.project_id = p_project and x.parent_task_id is null and x.description <> ''
     order by x.ref
  loop
    -- Owner function of the package.
    m := regexp_match(t.description, 'Owner \(fungsi\): ([^\n·]+?) · Nama owner:');
    v_parent_fn := case when m is not null then btrim(m[1]) end;
    if v_parent_fn is not null and v_parent_fn <> '-' then
      v_fn := private.ensure_function(v_parent_fn);
      if t.owner_function_id is null then
        update public.tasks set owner_function_id = v_fn where id = t.id;
        t.owner_function_id := v_fn;
      end if;
    end if;

    -- Acceptance-only prerequisites.
    m := regexp_match(t.description, 'Prasyarat \(acceptance only[^)]*\): ([^\n]+)');
    if m is not null then
      for r in select x[1] as ref from regexp_matches(m[1], '([A-Z][A-Z0-9-]*[A-Z0-9](?:\.[0-9]+)?)', 'g') x loop
        v_accept := v_accept + private.add_dep(p_project, t, r.ref, 'accept');
      end loop;
    end if;

    -- Inchstones.
    v_lines := string_to_array(t.description, E'\n');
    for i in 1 .. coalesce(array_length(v_lines, 1), 0) - 1 loop
      v_line := v_lines[i];
      v_next := v_lines[i + 1];
      m := regexp_match(v_line, '^(' || regexp_replace(t.ref, '([.\-])', '\\\1', 'g') || '\.[0-9]+) · (.+)$');
      continue when m is null or v_next !~ '^   Bukti: ';
      v_ref := m[1];

      v_segs := string_to_array(substring(v_next from 11), ' · ');
      v_arrow := null;
      v_proof := null;
      v_dates := null;
      v_deps := null;
      v_records := null;
      v_fallback := null;
      for j in 1 .. coalesce(array_length(v_segs, 1), 0) loop
        v_seg := v_segs[j];
        if v_arrow is null and position(' → ' in v_seg) > 0 then
          v_arrow := j;
          v_owner := btrim(split_part(v_seg, ' → ', 1));
          v_val := btrim(split_part(v_seg, ' → ', 2));
        elsif v_arrow is not null and v_seg ~ '^[0-9]{1,2} [A-Za-z]{3} [0-9]{4}( – [0-9]{1,2} [A-Za-z]{3} [0-9]{4})?$' then
          v_dates := v_seg;
        elsif v_seg like 'Dep: %' then
          v_deps := substring(v_seg from 6);
        elsif v_seg like 'Record: %' then
          v_records := substring(v_seg from 9);
        elsif v_seg like 'Kalau meleset: %' then
          v_fallback := substring(v_seg from 16);
        end if;
      end loop;
      if v_arrow is null then
        perform private.flag(p_project, 'task', t.id, v_ref, 'inchstone_unparsed',
                             'Baris bukti inchstone tidak berformat "Fungsi → Fungsi"; sub-task tidak dibuat: ' || left(v_next, 300));
        continue;
      end if;
      v_proof := array_to_string(v_segs[1:v_arrow - 1], ' · ');

      if exists (select 1 from public.tasks x where x.project_id = p_project and x.ref = v_ref) then
        v_pending := v_pending || jsonb_build_object('ref', v_ref, 'deps', v_deps, 'records', v_records);
        continue;
      end if;

      -- Function: aliases for roles written in place of a function are flagged, not hidden.
      if v_owner = 'Owner paket' then
        v_owner := v_parent_fn;
      elsif v_owner in ('Head of Accounting', 'Distribution lead') then
        perform private.flag(p_project, 'task', t.id, v_ref, 'function_alias',
          format('Fungsi pemilik ditulis "%s"; dipetakan ke fungsi %s.', v_owner,
                 case v_owner when 'Head of Accounting' then 'Accounting' else 'Distribution' end));
        v_owner := case v_owner when 'Head of Accounting' then 'Accounting' else 'Distribution' end;
      end if;
      v_fn := case when coalesce(v_owner, '-') <> '-' then private.ensure_function(v_owner) end;

      v_start := private.parse_id_date(split_part(coalesce(v_dates, ''), ' – ', 1));
      v_end := coalesce(private.parse_id_date(nullif(split_part(coalesce(v_dates, ''), ' – ', 2), '')), v_start);
      if v_start is null or v_end is null or v_end < v_start then
        perform private.flag(p_project, 'task', t.id, v_ref, 'dates_unparsed',
          format('Tanggal "%s" tidak terbaca; sub-task memakai jadwal paket %s.', coalesce(v_dates, '-'), t.ref));
        v_start := t.start_date;
        v_end := t.end_date;
      end if;

      -- PIC only where the app already names the accountable person for that function.
      v_assignee := case when t.assignee_person_id is not null and v_fn is not null and v_fn = t.owner_function_id
                         then t.assignee_person_id end;
      if v_assignee is not null then
        v_inferred := v_inferred + 1;
      end if;

      v_desc := format('Inchstone %s dari paket %s.', v_ref, t.ref)
        || case when coalesce(v_val, '-') <> '-' then E'\nFungsi pemeriksa (workbook): ' || v_val else '' end
        || case when v_records is not null then E'\nRecord: ' || v_records else '' end
        || case when v_fallback is not null then E'\nKalau meleset: ' || v_fallback else '' end
        || E'\n\nSumber: baris inchstone di deskripsi paket ' || t.ref || '.';

      insert into public.tasks (project_id, milestone_id, parent_task_id, legacy_id, ref, title, description,
                                start_date, end_date, assignee_person_id, proof_requested, owner_function_id,
                                stage, accepted_at, accepted_by, done_at, evidence, created_at)
      values (p_project, t.milestone_id, t.id, v_ref, v_ref, left(btrim(m[2]), 200), v_desc,
              v_start, v_end, v_assignee, left(coalesce(v_proof, ''), 2000), v_fn,
              case when t.stage = 'done' then 'done' else 'todo' end,
              case when t.stage = 'done' then t.accepted_at end, case when t.stage = 'done' then t.accepted_by end,
              case when t.stage = 'done' then t.done_at end,
              case when t.stage = 'done' then 'Diterima bersama paket ' || t.ref || ' sebelum sub-task dipisahkan.' end,
              t.created_at);
      v_children := v_children + 1;
      if t.stage = 'done' then
        perform private.flag(p_project, 'task', t.id, v_ref, 'accepted_with_package',
          format('Paket %s sudah diterima sebelum sub-task dipisahkan; %s ditandai diterima bersamanya.', t.ref, v_ref));
      elsif t.stage = 'review' then
        perform private.flag(p_project, 'task', t.id, v_ref, 'package_in_review',
          format('Paket %s sedang diperiksa saat sub-task %s dibuat; paket baru bisa diterima setelah sub-task-nya diterima.', t.ref, v_ref));
      end if;
      v_pending := v_pending || jsonb_build_object('ref', v_ref, 'deps', v_deps, 'records', v_records);
    end loop;
  end loop;

  -- Second pass, once every sub-task exists: finish-to-start dependencies and Keputusan links.
  for r in select x ->> 'ref' as ref, x ->> 'deps' as deps, x ->> 'records' as records from jsonb_array_elements(v_pending) x loop
    select * into c from public.tasks x where x.project_id = p_project and x.ref = r.ref;
    if r.deps is not null then
      for v_seg in select y[1] from regexp_matches(r.deps, '([A-Z][A-Z0-9-]*[A-Z0-9](?:\.[0-9]+)?)', 'g') y loop
        v_start_deps := v_start_deps + private.add_dep(p_project, c, v_seg, 'start');
      end loop;
    end if;
    if r.records is not null then
      for v_seg in select y[1] from regexp_matches(r.records, '\m(K[0-9]{2})\M', 'g') y loop
        select a.id into v_ask from public.asks a where a.project_id = p_project and a.ref = v_seg;
        if v_ask is not null then
          insert into public.ask_tasks (project_id, ask_id, task_id) values (p_project, v_ask, c.id) on conflict do nothing;
          if found then
            v_links := v_links + 1;
          end if;
        end if;
      end loop;
    end if;
  end loop;

  if v_inferred > 0 then
    perform private.flag(p_project, 'project', p_project, null, 'pic_from_package',
      format('%s sub-task diberi PIC dari PIC paketnya karena fungsinya sama. Sub-task fungsi lain dibiarkan tanpa PIC.', v_inferred));
  end if;

  perform set_config('app.quiet_events', '', true);
  return jsonb_build_object('children', v_children, 'accept_deps', v_accept, 'start_deps', v_start_deps,
                            'ask_links', v_links, 'pic_from_package', v_inferred);
end
$$;

-- Person → function where the job title is exactly a function name (Dika: Project Finance, …).
create function private.map_people_functions() returns int
language sql security definer set search_path = ''
as $$
  with u as (
    update public.people pe set function_id = f.id
      from public.functions f
     where pe.function_id is null and lower(btrim(pe.job_title)) = lower(f.name)
    returning 1
  )
  select count(*)::int from u
$$;

select private.extract_structure(p.id) from public.projects p order by p.created_at;
select private.map_people_functions();

-- Realtime: the new project tables stream like the phase-1 ones (RLS decides who receives what).
-- Invitations (e-mail addresses), profiles and migration notes are refetched after writes instead.
alter publication supabase_realtime add table
  public.functions, public.ask_tasks, public.task_reviews, public.task_commitments, public.task_blockers,
  public.comments, public.project_events;

revoke all on all functions in schema private from public, anon;
grant execute on function private.is_super_admin(), private.is_project_admin(uuid), private.can_contribute(uuid),
  private.readable_project_ids(), private.visible_person_ids(), private.contact_visible(uuid),
  private.current_person_id(), private.member_role(uuid), private.can_read_project(uuid),
  private.can_see_invitation(uuid) to authenticated;
