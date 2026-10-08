-- Second architecture pass · 2/6 · Structure (docs/ARCHITECTURE.md §C, §G).
--
--   * functions: business functions (Accounting, Commercial, …) as org reference data, so a task
--     can belong to a function before a named PIC exists.
--   * Stable, human-readable addresses: projects.code (MB), tasks.ref (MB12, MB05.1),
--     milestones.ref (G3), asks.ref (K01). Legacy workbook ids are reused; new ids follow a
--     deterministic per-project sequence. Refs never change once set.
--   * Sub-tasks (inchstones): tasks.parent_task_id, one level deep, same project and gate.
--   * Typed dependencies: task_deps.kind 'start' (finish-to-start, the phase-1 meaning) or
--     'accept' (may run in parallel, cannot be accepted first). Same project only (composite FK).

-- ---------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------

create table public.functions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create unique index functions_name_key on public.functions (lower(name));

alter table public.functions enable row level security;
grant select, insert, update, delete on public.functions to authenticated;
create policy functions_read on public.functions for select to authenticated using (true);
create policy functions_admin_write on public.functions for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

alter table public.people add column function_id uuid references public.functions (id) on delete set null;
comment on column public.people.function_id is 'Primary business function. A function never implies an individual assignment.';

-- ---------------------------------------------------------------------------------------
-- Project codes
-- ---------------------------------------------------------------------------------------

alter table public.projects add column code text check (code ~ '^[A-Z][A-Z0-9]{1,5}$');
create unique index projects_code_key on public.projects (code);

-- Initials of the name without filler words: "Project Margin Bridge" → MB, "Project MAM" → MAM.
create function private.code_from_name(p_name text) returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_words text[];
  v_code text := '';
  w text;
begin
  select coalesce(array_agg(x), '{}') into v_words
    from unnest(regexp_split_to_array(upper(coalesce(p_name, '')), '[^A-Z0-9]+')) x
   where x <> '' and x not in ('PROJECT', 'PROYEK', 'PROJEK', 'THE', 'DAN', 'AND', 'OF', 'UNTUK', 'DI');
  if array_length(v_words, 1) is null then
    return 'PR';
  elsif array_length(v_words, 1) = 1 then
    v_code := left(v_words[1], 3);
  else
    foreach w in array v_words[1:4] loop
      v_code := v_code || left(w, 1);
    end loop;
  end if;
  if v_code !~ '^[A-Z]' then
    v_code := 'P' || v_code;
  end if;
  if length(v_code) < 2 then
    v_code := rpad(v_code, 2, 'X');
  end if;
  return left(v_code, 6);
end
$$;

-- A free code from a candidate: the candidate itself, else candidate + 2, 3, … (within 6 chars).
create function private.free_project_code(p_candidate text, p_self uuid) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_base text := left(p_candidate, 5);
  v_try text := p_candidate;
  i int := 2;
begin
  while exists (select 1 from public.projects p where p.code = v_try and p.id is distinct from p_self) loop
    v_try := v_base || i::text;
    i := i + 1;
    if length(v_try) > 6 then
      v_try := left(v_base, 6 - length(i::text)) || i::text;
    end if;
  end loop;
  return v_try;
end
$$;

-- The dominant workbook prefix of a project's task ids (MB01…MB54 → MB), when one prefix covers
-- at least half of its legacy-numbered tasks.
create function private.legacy_task_prefix(p_project uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select pre from (
    select substring(t.legacy_id from '^([A-Z]{2,6})[0-9]+$') as pre, count(*) as n,
           sum(count(*)) over () as total
      from public.tasks t
     where t.project_id = p_project and t.legacy_id ~ '^[A-Z]{2,6}[0-9]+$'
     group by 1
  ) x
  where n * 2 >= total
  order by n desc
  limit 1
$$;

do $$
declare
  r record;
begin
  for r in select p.id, p.name from public.projects p order by p.created_at, p.id loop
    update public.projects
       set code = private.free_project_code(coalesce(private.legacy_task_prefix(r.id), private.code_from_name(r.name)), r.id)
     where id = r.id;
  end loop;
end
$$;
alter table public.projects alter column code set not null;
-- '' asks the insert trigger for a code; the trigger always replaces it, so writers may omit it.
alter table public.projects alter column code set default '';

-- ---------------------------------------------------------------------------------------
-- Record refs
-- ---------------------------------------------------------------------------------------

alter table public.milestones add column ref text check (ref ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$');
alter table public.tasks add column ref text check (ref ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$');
alter table public.asks add column ref text check (ref ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$');

-- Next number after the highest <prefix><n> ref in a set of refs.
create function private.next_num(p_refs text[], p_prefix text) returns int
language sql immutable set search_path = ''
as $$
  select coalesce(max(substring(r from length(p_prefix) + 1)::int), 0) + 1
    from unnest(p_refs) r
   where r ~ ('^' || regexp_replace(p_prefix, '([.\-])', '\\\1', 'g') || '[0-9]{1,6}$')
$$;

create function private.valid_ref(p_ref text) returns boolean
language sql immutable set search_path = ''
as $$ select p_ref ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$' $$;

-- Assign refs on insert (all write paths: RPCs, imports, extraction). One advisory lock per
-- project serialises numbering, so concurrent inserts never pick the same number.
create function private.assign_ref() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_refs text[];
  v_prefix text;
  v_parent text;
begin
  if coalesce(new.ref, '') <> '' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ref:' || tg_table_name || ':' || new.project_id::text, 0));

  if tg_table_name = 'tasks' then
    select coalesce(array_agg(t.ref), '{}') into v_refs from public.tasks t where t.project_id = new.project_id;
    if new.legacy_id is not null and private.valid_ref(new.legacy_id) and not new.legacy_id = any (v_refs) then
      new.ref := new.legacy_id;
    elsif new.parent_task_id is not null then
      select t.ref into v_parent from public.tasks t where t.id = new.parent_task_id;
      new.ref := v_parent || '.' || private.next_num(v_refs, v_parent || '.');
    else
      select p.code into v_prefix from public.projects p where p.id = new.project_id;
      new.ref := v_prefix || lpad(private.next_num(v_refs, v_prefix)::text, 2, '0');
    end if;
  elsif tg_table_name = 'milestones' then
    select coalesce(array_agg(m.ref), '{}') into v_refs from public.milestones m where m.project_id = new.project_id;
    if new.legacy_id is not null and private.valid_ref(new.legacy_id) and not new.legacy_id = any (v_refs) then
      new.ref := new.legacy_id;
    else
      -- Follow the project's own convention (G0…G12 → G13), else M1, M2, …
      select substring(m.ref from '^([A-Za-z]+)[0-9]+$') into v_prefix
        from public.milestones m
       where m.project_id = new.project_id and m.ref ~ '^[A-Za-z]+[0-9]+$'
       order by m.created_at desc, m.id desc limit 1;
      v_prefix := coalesce(v_prefix, 'M');
      new.ref := v_prefix || private.next_num(v_refs, v_prefix);
    end if;
  elsif tg_table_name = 'asks' then
    select coalesce(array_agg(a.ref), '{}') into v_refs from public.asks a where a.project_id = new.project_id;
    if new.legacy_id is not null and private.valid_ref(new.legacy_id) and not new.legacy_id = any (v_refs) then
      new.ref := new.legacy_id;
    else
      new.ref := 'K' || lpad(private.next_num(v_refs, 'K')::text, 2, '0');
    end if;
  end if;
  return new;
end
$$;

-- Backfill, oldest first so numbering follows creation order. Legacy ids first.
update public.milestones set ref = legacy_id where legacy_id is not null and private.valid_ref(legacy_id);
update public.tasks set ref = legacy_id where legacy_id is not null and private.valid_ref(legacy_id);
update public.asks set ref = legacy_id where legacy_id is not null and private.valid_ref(legacy_id);

do $$
declare
  r record;
  v_refs text[];
  v_prefix text;
begin
  -- Milestones without a legacy id keep the number they display today (M1…Mn by position).
  for r in
    select m.id, m.project_id, row_number() over (partition by m.project_id order by m.sort_order, m.id) as pos
      from public.milestones m where m.ref is null order by m.project_id, m.sort_order, m.id
  loop
    select coalesce(array_agg(x.ref), '{}') into v_refs from public.milestones x where x.project_id = r.project_id;
    update public.milestones
       set ref = case when not ('M' || r.pos) = any (v_refs) then 'M' || r.pos else 'M' || private.next_num(v_refs, 'M') end
     where id = r.id;
  end loop;
  for r in select t.id, t.project_id from public.tasks t where t.ref is null order by t.created_at, t.id loop
    select p.code into v_prefix from public.projects p where p.id = r.project_id;
    select coalesce(array_agg(x.ref), '{}') into v_refs from public.tasks x where x.project_id = r.project_id;
    update public.tasks set ref = v_prefix || lpad(private.next_num(v_refs, v_prefix)::text, 2, '0') where id = r.id;
  end loop;
  for r in select a.id, a.project_id from public.asks a where a.ref is null order by a.created_at, a.id loop
    select coalesce(array_agg(x.ref), '{}') into v_refs from public.asks x where x.project_id = r.project_id;
    update public.asks set ref = 'K' || lpad(private.next_num(v_refs, 'K')::text, 2, '0') where id = r.id;
  end loop;
end
$$;

alter table public.milestones alter column ref set not null;
alter table public.tasks alter column ref set not null;
alter table public.asks alter column ref set not null;
-- '' asks assign_ref for the next ref; the trigger always replaces it, so writers may omit it.
alter table public.milestones alter column ref set default '';
alter table public.tasks alter column ref set default '';
alter table public.asks alter column ref set default '';
create unique index milestones_ref_key on public.milestones (project_id, ref);
create unique index tasks_ref_key on public.tasks (project_id, ref);
create unique index asks_ref_key on public.asks (project_id, ref);

-- ---------------------------------------------------------------------------------------
-- Sub-tasks, owner function, typed dependencies
-- ---------------------------------------------------------------------------------------

alter table public.tasks
  add column parent_task_id uuid,
  add column owner_function_id uuid references public.functions (id) on delete set null,
  add constraint tasks_parent_same_project foreign key (parent_task_id, project_id)
    references public.tasks (id, project_id) on delete cascade,
  add constraint tasks_parent_not_self check (parent_task_id is distinct from id);
create index tasks_parent_idx on public.tasks (parent_task_id);
create index tasks_owner_function_idx on public.tasks (owner_function_id);

-- Inchstone titles from the workbook run up to ~200 characters.
alter table public.tasks drop constraint tasks_title_check;
alter table public.tasks add constraint tasks_title_check check (length(btrim(title)) between 1 and 200);

alter table public.task_deps add column kind text not null default 'start' check (kind in ('start', 'accept'));
comment on column public.task_deps.kind is
  'start: cannot start or be submitted before the prerequisite is accepted · accept: may run in parallel, cannot be accepted first';

-- Assign refs before the integrity triggers see the row ("a" sorts before "t").
create trigger assign_ref before insert on public.tasks for each row execute function private.assign_ref();
create trigger assign_ref before insert on public.milestones for each row execute function private.assign_ref();
create trigger assign_ref before insert on public.asks for each row execute function private.assign_ref();

create function private.project_code_assign() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.code, '') = '' then
      perform pg_advisory_xact_lock(hashtextextended('project-code', 0));
      new.code := private.free_project_code(private.code_from_name(new.name), new.id);
    end if;
  elsif new.code is distinct from old.code then
    raise exception 'Kode project tidak bisa diubah: tautan ke project ini memakainya.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger assign_code before insert or update of code on public.projects
  for each row execute function private.project_code_assign();

-- Refs are addresses: they never change.
create function private.ref_immutable() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.ref is distinct from old.ref then
    raise exception 'ID % tidak bisa diubah: tautan ke data ini memakainya.', old.ref using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger ref_immutable before update of ref on public.tasks for each row execute function private.ref_immutable();
create trigger ref_immutable before update of ref on public.milestones for each row execute function private.ref_immutable();
create trigger ref_immutable before update of ref on public.asks for each row execute function private.ref_immutable();

-- Sub-task rules: one level deep, same gate as the parent, a parent cannot become a child.
create function private.tasks_hierarchy() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.tasks;
begin
  if new.parent_task_id is not null then
    select * into v_parent from public.tasks where id = new.parent_task_id;
    if v_parent.parent_task_id is not null then
      raise exception 'Sub-task hanya satu tingkat: % sudah merupakan sub-task.', v_parent.ref using errcode = '23514';
    end if;
    if exists (select 1 from public.tasks c where c.parent_task_id = new.id) then
      raise exception 'Task yang punya sub-task tidak bisa menjadi sub-task.' using errcode = '23514';
    end if;
    new.milestone_id := v_parent.milestone_id;
  end if;
  return new;
end
$$;
create trigger tasks_hierarchy before insert or update of parent_task_id, milestone_id on public.tasks
  for each row execute function private.tasks_hierarchy();

-- Moving a package to another gate moves its sub-tasks with it.
create function private.tasks_follow_parent() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.tasks c set milestone_id = new.milestone_id
   where c.parent_task_id = new.id and c.milestone_id is distinct from new.milestone_id;
  return null;
end
$$;
create trigger tasks_follow_parent after update of milestone_id on public.tasks
  for each row when (new.milestone_id is distinct from old.milestone_id)
  execute function private.tasks_follow_parent();

-- Value-chain links are checked against the project's template (unchanged rule, also for children).

revoke all on all functions in schema private from public, anon;
