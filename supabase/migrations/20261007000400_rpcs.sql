-- Second architecture pass · 4/6 · Write RPCs on the new role model (docs/ARCHITECTURE.md §D, §E, §K).
--
-- Same conventions as phase 1: SECURITY DEFINER, empty search_path, an invisible project looks
-- exactly like a missing one (P0002), 42501 not allowed, P0001 workflow rule, 23514 integrity.
--
-- What changed:
--   * require_pm → require_admin (project_admin or super admin).
--   * Judgment is record-level: pemeriksa/pemutus/decider may be any project_admin or member.
--     Gate decisions: the effective pemutus, or a project admin recording for the forum.
--   * Sub-tasks: a member who is PIC of a task may create and edit sub-tasks under it. A package is
--     submitted and accepted only after all its sub-tasks; reopening a sub-task reopens its package.
--   * Typed dependencies: 'start' blocks starting and submitting, every dependency blocks accepting.
--   * Members raise Keputusan and blockers and comment; viewers only read.

-- ---------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------

create function private.require_admin(p_project uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_project_admin(p_project) then
    raise exception 'Hanya Project Admin yang bisa melakukan ini.' using errcode = '42501';
  end if;
end
$$;

create function private.require_contributor(p_project uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_contribute(p_project) then
    raise exception 'Kamu hanya bisa melihat project ini.' using errcode = '42501';
  end if;
end
$$;

-- personId when that person may judge in the project (project_admin or member), else null.
create function private.judge_only(p_person uuid, p_project uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select case when private.can_judge(p_person, p_project) then p_person end $$;

create or replace function private.pm_of(p_project uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select case when private.person_role(p.pm_person_id, p.id) = 'project_admin' then p.pm_person_id end
    from public.projects p where p.id = p_project
$$;

create or replace function private.approver_of(p_milestone uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.judge_only(m.approver_person_id, m.project_id), private.pm_of(m.project_id))
    from public.milestones m where m.id = p_milestone
$$;

-- Effective pemeriksa: own → (sub-task) the package's own → gate pemutus → project PM.
create or replace function private.validator_of(p_task uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    private.judge_only(t.validator_person_id, t.project_id),
    private.judge_only(par.validator_person_id, t.project_id),
    case when t.milestone_id is not null then private.approver_of(t.milestone_id) else private.pm_of(t.project_id) end
  )
    from public.tasks t
    left join public.tasks par on par.id = t.parent_task_id
   where t.id = p_task
$$;

create or replace function private.decider_of(p_ask uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.judge_only(a.decider_person_id, a.project_id), private.pm_of(a.project_id))
    from public.asks a where a.id = p_ask
$$;

-- The person themself, or a project admin acting for someone without a login (or for nobody,
-- when the role falls back to the project PM and there is none).
create or replace function private.can_act_for(p_person uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce(p_person = private.current_person_id(), false) then true
    else (p_person is null or (select pe.user_id from public.people pe where pe.id = p_person) is null)
         and private.is_project_admin(p_project)
  end
$$;

create function private.has_children(p_task uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.tasks c where c.parent_task_id = p_task) $$;

-- Refs of unaccepted prerequisites of a task, of the given dependency kinds; null when none.
create function private.open_deps(p_task uuid, p_kinds text[]) returns text
language sql stable security definer set search_path = ''
as $$
  select string_agg(dep.ref, ', ' order by dep.ref)
    from public.task_deps d
    join public.tasks dep on dep.id = d.depends_on_task_id
   where d.task_id = p_task and d.kind = any (p_kinds) and dep.stage <> 'done'
$$;

create function private.open_children(p_task uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select string_agg(c.ref, ', ' order by c.ref) from public.tasks c where c.parent_task_id = p_task and c.stage <> 'done'
$$;

-- May the caller plan this task: project admin, or (for a sub-task) the PIC of its package.
create function private.can_plan_child(p_parent uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks par
     where par.id = p_parent and par.parent_task_id is null
       and coalesce(par.assignee_person_id = private.current_person_id(), false)
       and private.can_contribute(par.project_id)
  )
$$;

-- ---------------------------------------------------------------------------------------
-- Tasks: planning
-- ---------------------------------------------------------------------------------------

-- Create or edit a task. p keys: id?, project_id (new), parent_task_id (new), milestone_id, title,
-- description, start_date, end_date, assignee_person_id, validator_person_id, proof_requested,
-- owner_function_id, stage, deps (uuid[] = start, or [{task_id, kind}]), steps (codes),
-- commit ('on' | 'off'). Missing keys keep their value. PIC, pemeriksa and requested proof may be
-- left empty (a draft); commitment and submission require them.
create or replace function public.save_task(p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid;
  v_old public.tasks;
  v_new public.tasks;
  v_proj public.projects;
  v_parent public.tasks;
  v_is_new boolean := nullif(p ->> 'id', '') is null;
  v_admin boolean;
  v_changed boolean;
  v_commit text := nullif(p ->> 'commit', '');
  v_code text;
  v_step uuid;
  v_dep jsonb;
  v_dep_id uuid;
  v_dep_kind text;
begin
  perform private.require_user();
  v_me := private.current_person_id();
  if v_is_new then
    v_proj := private.assert_project((p ->> 'project_id')::uuid, true);
    v_old := null;
    v_new.id := gen_random_uuid();
    v_new.project_id := v_proj.id;
    v_new.description := '';
    v_new.proof_requested := '';
    v_new.stage := 'todo';
    v_new.committed := false;
    v_new.created_at := now();
    v_new.created_by := v_me;
    v_new.parent_task_id := nullif(p ->> 'parent_task_id', '')::uuid;
  else
    v_old := private.load_task((p ->> 'id')::uuid);
    v_proj := private.assert_project(v_old.project_id, true);
    v_new := v_old;
    if v_proj.gate_mode and v_old.stage in ('review', 'done') then
      raise exception 'Task yang sedang diperiksa atau sudah diterima tidak bisa diedit.' using errcode = 'P0001';
    end if;
  end if;

  v_admin := private.is_project_admin(v_proj.id);
  if not v_admin then
    -- A member plans only sub-tasks of a package they are PIC of, and never moves them elsewhere.
    if v_new.parent_task_id is null or not private.can_plan_child(v_new.parent_task_id)
       or (p ? 'parent_task_id' and not v_is_new) or p ? 'stage' then
      perform private.require_admin(v_proj.id);
    end if;
  end if;
  if not v_is_new and p ? 'parent_task_id' then
    v_new.parent_task_id := nullif(p ->> 'parent_task_id', '')::uuid;
  end if;

  if v_new.parent_task_id is not null and v_new.parent_task_id is distinct from v_old.parent_task_id then
    select * into v_parent from public.tasks where id = v_new.parent_task_id and project_id = v_proj.id;
    if not found then
      raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
    end if;
    if v_proj.gate_mode and v_parent.stage in ('review', 'done') then
      raise exception 'Paket % sedang diperiksa atau sudah diterima. Buka lagi paketnya dulu untuk menambah sub-task.', v_parent.ref
        using errcode = 'P0001';
    end if;
  end if;

  if p ? 'title' then v_new.title := btrim(p ->> 'title'); end if;
  if p ? 'description' then v_new.description := coalesce(p ->> 'description', ''); end if;
  if p ? 'milestone_id' then v_new.milestone_id := nullif(p ->> 'milestone_id', '')::uuid; end if;
  if p ? 'start_date' then v_new.start_date := (p ->> 'start_date')::date; end if;
  if p ? 'end_date' then v_new.end_date := (p ->> 'end_date')::date; end if;
  if p ? 'assignee_person_id' then v_new.assignee_person_id := nullif(p ->> 'assignee_person_id', '')::uuid; end if;
  if p ? 'validator_person_id' then v_new.validator_person_id := nullif(p ->> 'validator_person_id', '')::uuid; end if;
  if p ? 'proof_requested' then v_new.proof_requested := coalesce(p ->> 'proof_requested', ''); end if;
  if p ? 'owner_function_id' then v_new.owner_function_id := nullif(p ->> 'owner_function_id', '')::uuid; end if;

  if coalesce(v_new.title, '') = '' then
    raise exception 'Isi judul task dulu.' using errcode = 'P0001';
  end if;
  if v_new.start_date is null or v_new.end_date is null then
    raise exception 'Isi tanggal mulai dan selesai.' using errcode = 'P0001';
  end if;
  if v_new.end_date < v_new.start_date then
    raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai.' using errcode = 'P0001';
  end if;

  if p ? 'stage' and p ->> 'stage' is distinct from v_new.stage then
    if v_proj.gate_mode and (p ->> 'stage') not in ('todo', 'progress') then
      raise exception 'Tahap Diperiksa dan Selesai terisi lewat pengajuan dan pemeriksaan.' using errcode = 'P0001';
    end if;
    v_new.stage := p ->> 'stage';
  end if;
  if not v_proj.gate_mode then
    v_new.done_at := case when v_new.stage = 'done' then coalesce(v_old.done_at, now()) end;
  end if;

  -- Commitment: any change of dates or PIC clears it unless the same call commits.
  if v_proj.gate_mode then
    v_changed := v_is_new
      or v_new.start_date is distinct from v_old.start_date
      or v_new.end_date is distinct from v_old.end_date
      or v_new.assignee_person_id is distinct from v_old.assignee_person_id;
    if v_commit = 'on' then
      if v_new.assignee_person_id is null
         or not (coalesce(v_new.assignee_person_id = v_me, false)
                 or ((select pe.user_id from public.people pe where pe.id = v_new.assignee_person_id) is null and v_admin)) then
        raise exception 'Hanya PIC yang bisa mengomit tanggal ini.' using errcode = '42501';
      end if;
      if not v_is_new and private.has_children(v_new.id) then
        raise exception 'Paket mengikuti sub-task-nya. Komit tanggal di setiap sub-task.' using errcode = 'P0001';
      end if;
      if v_changed or not v_new.committed then
        v_new.committed := true;
        v_new.committed_at := now();
        v_new.committed_by := v_me;
      end if;
    elsif v_commit = 'off' or v_changed then
      v_new.committed := false;
      v_new.committed_at := null;
      v_new.committed_by := null;
    end if;
  end if;

  if v_is_new then
    insert into public.tasks values (v_new.*);
  else
    update public.tasks set
      title = v_new.title, description = v_new.description, milestone_id = v_new.milestone_id,
      parent_task_id = v_new.parent_task_id,
      start_date = v_new.start_date, end_date = v_new.end_date,
      assignee_person_id = v_new.assignee_person_id, validator_person_id = v_new.validator_person_id,
      proof_requested = v_new.proof_requested, owner_function_id = v_new.owner_function_id,
      stage = v_new.stage, done_at = v_new.done_at,
      committed = v_new.committed, committed_at = v_new.committed_at, committed_by = v_new.committed_by
    where id = v_new.id;
  end if;

  if p ? 'deps' then
    delete from public.task_deps where task_id = v_new.id;
    for v_dep in select x from jsonb_array_elements(coalesce(p -> 'deps', '[]'::jsonb)) x loop
      if jsonb_typeof(v_dep) = 'object' then
        v_dep_id := (v_dep ->> 'task_id')::uuid;
        v_dep_kind := coalesce(nullif(v_dep ->> 'kind', ''), 'start');
      else
        v_dep_id := (v_dep #>> '{}')::uuid;
        v_dep_kind := 'start';
      end if;
      insert into public.task_deps (project_id, task_id, depends_on_task_id, kind)
      values (v_proj.id, v_new.id, v_dep_id, v_dep_kind)
      on conflict (task_id, depends_on_task_id) do update set kind = excluded.kind;
    end loop;
  end if;

  if p ? 'steps' then
    delete from public.task_steps where task_id = v_new.id;
    for v_code in select distinct x from jsonb_array_elements_text(coalesce(p -> 'steps', '[]'::jsonb)) x loop
      select s.id into v_step from public.template_steps s
       where s.template_id = v_proj.step_template_id and s.code = v_code;
      if v_step is null then
        raise exception 'Step value chain "%" tidak ada di template project.', v_code using errcode = '23514';
      end if;
      insert into public.task_steps (task_id, template_step_id) values (v_new.id, v_step);
    end loop;
  end if;

  return v_new.id;
end
$$;

create or replace function public.delete_task(p_task uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
begin
  perform private.assert_project(v.project_id, true);
  perform private.require_admin(v.project_id);
  update public.reminders set status = 'dibatalkan', note = 'Task dihapus'
   where status = 'menunggu' and task_id in (select c.id from public.tasks c where c.id = v.id or c.parent_task_id = v.id);
  delete from public.tasks where id = v.id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Tasks: workflow transitions
-- ---------------------------------------------------------------------------------------

create or replace function public.commit_task_dates(p_task uuid, p_start date default null, p_end date default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
  v_me uuid := private.current_person_id();
  v_start date := coalesce(p_start, v.start_date);
  v_end date := coalesce(p_end, v.end_date);
begin
  perform private.assert_gated(v_proj);
  if v.stage in ('review', 'done') then
    raise exception 'Tanggal task yang sedang diperiksa atau sudah diterima tidak bisa dikomit.' using errcode = 'P0001';
  end if;
  if v.assignee_person_id is null then
    raise exception 'Pilih PIC dulu. Tanggal baru bisa dikomit oleh PIC-nya.' using errcode = 'P0001';
  end if;
  if not (coalesce(v.assignee_person_id = v_me, false)
          or ((select pe.user_id from public.people pe where pe.id = v.assignee_person_id) is null
              and private.is_project_admin(v.project_id))) then
    raise exception 'Hanya % yang bisa mengomit tanggal ini.', private.person_name(v.assignee_person_id) using errcode = '42501';
  end if;
  if private.has_children(v.id) then
    raise exception 'Paket mengikuti sub-task-nya. Komit tanggal di setiap sub-task.' using errcode = 'P0001';
  end if;
  if v_end < v_start then
    raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai.' using errcode = 'P0001';
  end if;
  update public.tasks
     set start_date = v_start, end_date = v_end, committed = true, committed_at = now(), committed_by = v_me
   where id = v.id;
end
$$;

-- Gated: todo ⇄ progress only. Light mode: any stage. Starting needs 'start' prerequisites
-- accepted; finishing (light mode) needs every prerequisite and every sub-task.
create or replace function public.set_task_stage(p_task uuid, p_stage text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
  v_wait text;
begin
  if p_stage not in ('todo', 'progress', 'review', 'done') then
    raise exception 'Tahap tidak dikenal.' using errcode = 'P0001';
  end if;
  if not (coalesce(v.assignee_person_id = private.current_person_id(), false) or private.is_project_admin(v.project_id)) then
    raise exception 'Hanya PIC atau Project Admin yang bisa memindahkan task ini.' using errcode = '42501';
  end if;
  if v.stage = 'todo' and p_stage <> 'todo' then
    v_wait := private.open_deps(v.id, array['start']);
    if v_wait is not null then
      raise exception 'Belum bisa mulai: menunggu % diterima.', v_wait using errcode = 'P0001';
    end if;
  end if;
  if v_proj.gate_mode then
    if p_stage not in ('todo', 'progress') then
      raise exception 'Tahap Diperiksa dan Selesai terisi lewat pengajuan dan pemeriksaan.' using errcode = 'P0001';
    end if;
    if v.stage not in ('todo', 'progress') then
      raise exception 'Task ini sedang diperiksa atau sudah diterima.' using errcode = 'P0001';
    end if;
    update public.tasks set stage = p_stage where id = v.id;
  else
    if p_stage = 'done' and v.stage <> 'done' then
      v_wait := private.open_children(v.id);
      if v_wait is not null then
        raise exception 'Selesaikan sub-task dulu: %.', v_wait using errcode = 'P0001';
      end if;
      v_wait := private.open_deps(v.id, array['start', 'accept']);
      if v_wait is not null then
        raise exception 'Belum bisa selesai: menunggu % selesai.', v_wait using errcode = 'P0001';
      end if;
    end if;
    update public.tasks
       set stage = p_stage, done_at = case when p_stage = 'done' then coalesce(v.done_at, now()) end
     where id = v.id;
  end if;
end
$$;

create or replace function public.submit_task(p_task uuid, p_evidence text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
  v_evidence text;
  v_wait text;
begin
  perform private.assert_gated(v_proj);
  if v.stage not in ('todo', 'progress') then
    raise exception 'Task ini sudah diajukan atau sudah diterima.' using errcode = 'P0001';
  end if;
  if v.assignee_person_id is null then
    raise exception 'Tentukan PIC dulu sebelum mengajukan.' using errcode = 'P0001';
  end if;
  if not private.can_act_for(v.assignee_person_id, v.project_id) then
    raise exception 'Hanya PIC (%) yang bisa mengajukan task ini.', private.person_name(v.assignee_person_id) using errcode = '42501';
  end if;
  if btrim(v.proof_requested) = '' then
    raise exception 'Bukti yang diminta belum ditentukan. Lengkapi task-nya dulu supaya pemeriksa punya patokan.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.task_blockers b where b.task_id = v.id and b.resolved_at is null) then
    raise exception 'Task ini masih terhambat. Tandai hambatannya selesai dulu.' using errcode = 'P0001';
  end if;
  v_wait := private.open_children(v.id);
  if v_wait is not null then
    raise exception 'Paket baru bisa diajukan setelah semua sub-task diterima. Belum: %.', v_wait using errcode = 'P0001';
  end if;
  v_wait := private.open_deps(v.id, array['start']);
  if v_wait is not null then
    raise exception 'Belum bisa diajukan: menunggu % diterima.', v_wait using errcode = 'P0001';
  end if;
  v_evidence := private.required_text(p_evidence, 'Isi bukti dulu. Pemeriksa butuh sesuatu untuk dicek.');
  update public.tasks
     set stage = 'review', evidence = v_evidence, submitted_at = now(),
         submitted_by = coalesce(private.current_person_id(), v.assignee_person_id)
   where id = v.id;
end
$$;

create or replace function public.withdraw_submission(p_task uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
begin
  perform private.assert_gated(v_proj);
  if v.stage <> 'review' then
    raise exception 'Task ini tidak sedang diajukan.' using errcode = 'P0001';
  end if;
  if not private.can_act_for(v.assignee_person_id, v.project_id) then
    raise exception 'Hanya PIC yang bisa menarik pengajuan.' using errcode = '42501';
  end if;
  update public.tasks set stage = 'progress' where id = v.id;
end
$$;

create or replace function public.review_task(p_task uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
  v_me uuid := private.current_person_id();
  v_reason text;
  v_wait text;
begin
  perform private.assert_gated(v_proj);
  if v.stage <> 'review' then
    raise exception 'Task ini tidak sedang menunggu pemeriksaan.' using errcode = 'P0001';
  end if;
  perform private.assert_can_validate(v);
  if p_decision = 'accept' then
    v_wait := private.open_children(v.id);
    if v_wait is not null then
      raise exception 'Paket belum bisa diterima: sub-task % belum diterima.', v_wait using errcode = 'P0001';
    end if;
    v_wait := private.open_deps(v.id, array['start', 'accept']);
    if v_wait is not null then
      raise exception 'Belum bisa diterima: menunggu % diterima.', v_wait using errcode = 'P0001';
    end if;
    update public.tasks
       set stage = 'done', accepted_at = now(), accepted_by = v_me, reject_reason = null, done_at = now()
     where id = v.id;
  elsif p_decision = 'reject' then
    v_reason := private.required_text(p_reason, 'Tulis alasan supaya PIC tahu apa yang harus diperbaiki.');
    update public.tasks
       set stage = 'progress', reject_reason = v_reason, rejected_at = now(), rejected_by = v_me
     where id = v.id;
  else
    raise exception 'Keputusan pemeriksaan harus accept atau reject.' using errcode = 'P0001';
  end if;
end
$$;

-- reopen_task keeps its phase-1 body (validator only, never the PIC); the reopened sub-task
-- reopens its package through the trigger below.

-- An accepted package whose sub-task is reopened is no longer accepted.
create function private.reopen_parent() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.tasks
     set stage = 'progress', accepted_at = null, accepted_by = null, done_at = null
   where id = new.parent_task_id and stage = 'done';
  return null;
end
$$;
create trigger tasks_reopen_parent after update of stage on public.tasks
  for each row when (new.parent_task_id is not null and old.stage = 'done' and new.stage <> 'done')
  execute function private.reopen_parent();

-- ---------------------------------------------------------------------------------------
-- Blockers (Terhambat)
-- ---------------------------------------------------------------------------------------

create function public.raise_blocker(
  p_task uuid, p_reason text, p_need text default '', p_from_person uuid default null,
  p_from_function uuid default null, p_target date default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_id uuid;
begin
  perform private.assert_project(v.project_id, true);
  if not (private.can_act_for(v.assignee_person_id, v.project_id) or private.is_project_admin(v.project_id)) then
    raise exception 'Hanya PIC atau Project Admin yang bisa menandai task ini terhambat.' using errcode = '42501';
  end if;
  if v.stage = 'done' then
    raise exception 'Task ini sudah selesai.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.task_blockers b where b.task_id = v.id and b.resolved_at is null) then
    raise exception 'Task ini sudah ditandai terhambat.' using errcode = 'P0001';
  end if;
  insert into public.task_blockers (project_id, task_id, reason, need, needed_from_person_id, needed_from_function_id,
                                    target_date, raised_by)
  values (v.project_id, v.id, private.required_text(p_reason, 'Tulis apa yang menghambat.'), coalesce(btrim(p_need), ''),
          p_from_person, p_from_function, p_target, private.current_person_id())
  returning id into v_id;
  return v_id;
end
$$;

create function private.load_blocker(p_blocker uuid) returns public.task_blockers
language plpgsql stable security definer set search_path = ''
as $$
declare
  v public.task_blockers;
begin
  select * into v from public.task_blockers where id = p_blocker;
  if not found or not private.can_read_project(v.project_id) then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  return v;
end
$$;

create function public.resolve_blocker(p_blocker uuid, p_resolution text default '') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  b public.task_blockers := private.load_blocker(p_blocker);
  v public.tasks := private.load_task(b.task_id);
  v_me uuid := private.current_person_id();
begin
  perform private.assert_project(b.project_id, true);
  -- Viewers never write, whoever raised the blocker or is named in it.
  perform private.require_contributor(b.project_id);
  if b.resolved_at is not null then
    raise exception 'Hambatan ini sudah selesai.' using errcode = 'P0001';
  end if;
  if not (private.can_act_for(v.assignee_person_id, v.project_id) or private.is_project_admin(b.project_id)
          or coalesce(v_me = b.raised_by, false) or coalesce(v_me = b.needed_from_person_id, false)) then
    raise exception 'Hanya PIC, Project Admin, atau orang yang dibutuhkan yang bisa menandai hambatan ini selesai.' using errcode = '42501';
  end if;
  update public.task_blockers
     set resolved_at = now(), resolved_by = v_me, resolution = nullif(btrim(coalesce(p_resolution, '')), '')
   where id = b.id;
end
$$;

-- "Angkat menjadi Keputusan": a Keputusan in the same project, linked to the blocked task.
-- p keys: question, context, decider_person_id, due.
create function public.escalate_blocker(p_blocker uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  b public.task_blockers := private.load_blocker(p_blocker);
  v public.tasks := private.load_task(b.task_id);
  v_ask uuid;
begin
  perform private.assert_project(b.project_id, true);
  if b.resolved_at is not null then
    raise exception 'Hambatan ini sudah selesai.' using errcode = 'P0001';
  end if;
  if b.ask_id is not null then
    raise exception 'Hambatan ini sudah diangkat menjadi Keputusan.' using errcode = 'P0001';
  end if;
  if not (private.can_act_for(v.assignee_person_id, v.project_id) or private.is_project_admin(b.project_id)) then
    raise exception 'Hanya PIC atau Project Admin yang bisa mengangkat hambatan ini.' using errcode = '42501';
  end if;
  v_ask := public.save_ask(jsonb_build_object(
    'project_id', b.project_id,
    'milestone_id', v.milestone_id,
    'question', coalesce(nullif(btrim(p ->> 'question'), ''), b.reason),
    'context', coalesce(p ->> 'context', 'Hambatan pada ' || v.ref || ' · ' || v.title || E'\n' || b.reason ||
                        case when b.need <> '' then E'\nDibutuhkan: ' || b.need else '' end),
    'decider_person_id', p ->> 'decider_person_id',
    'due', coalesce(p ->> 'due', b.target_date::text),
    'task_ids', jsonb_build_array(v.id)));
  update public.task_blockers set ask_id = v_ask where id = b.id;
  return v_ask;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------------------

create function public.add_comment(p_target text, p_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_project uuid;
  v_id uuid;
begin
  perform private.require_user();
  if p_target = 'task' then
    select t.project_id into v_project from public.tasks t where t.id = p_id;
  elsif p_target = 'ask' then
    select a.project_id into v_project from public.asks a where a.id = p_id;
  else
    raise exception 'Komentar hanya untuk task dan Keputusan.' using errcode = 'P0001';
  end if;
  if v_project is null or not private.can_read_project(v_project) then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  perform private.require_contributor(v_project);
  insert into public.comments (project_id, task_id, ask_id, author_person_id, author_user_id, body)
  values (v_project, case when p_target = 'task' then p_id end, case when p_target = 'ask' then p_id end,
          private.current_person_id(), auth.uid(), private.required_text(p_body, 'Tulis komentarnya dulu.'))
  returning id into v_id;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Milestones (gates)
-- ---------------------------------------------------------------------------------------

create or replace function public.save_milestone(p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_is_new boolean := nullif(p ->> 'id', '') is null;
  v public.milestones;
  v_proj public.projects;
begin
  if v_is_new then
    v_proj := private.assert_project((p ->> 'project_id')::uuid, true);
    v.id := gen_random_uuid();
    v.project_id := v_proj.id;
    v.mode := 'slow';
    v.criteria := '';
    v.trigger := '';
    v.fallback := '';
    v.created_at := now();
    select case when coalesce(p ->> 'position', 'before') = 'after' then max(m.sort_order) + 1 else min(m.sort_order) - 1 end
      into v.sort_order from public.milestones m where m.project_id = v_proj.id;
    v.sort_order := coalesce(v.sort_order, 0);
  else
    select * into v from public.milestones where id = (p ->> 'id')::uuid;
    if not found then
      raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
    end if;
    v_proj := private.assert_project(v.project_id, true);
  end if;
  perform private.require_admin(v_proj.id);

  if p ? 'title' then v.title := btrim(p ->> 'title'); end if;
  if p ? 'target' then v.target := nullif(p ->> 'target', '')::date; end if;
  if p ? 'criteria' then v.criteria := coalesce(p ->> 'criteria', ''); end if;
  if p ? 'trigger' then v.trigger := coalesce(p ->> 'trigger', ''); end if;
  if p ? 'fallback' then v.fallback := coalesce(p ->> 'fallback', ''); end if;
  if p ? 'approver_person_id' then v.approver_person_id := nullif(p ->> 'approver_person_id', '')::uuid; end if;
  if p ? 'mode' then v.mode := p ->> 'mode'; end if;
  if p ? 'code' then v.code := nullif(btrim(p ->> 'code'), ''); end if;
  if coalesce(v.title, '') = '' then
    raise exception 'Isi kondisi milestone.' using errcode = 'P0001';
  end if;

  if v_is_new then
    insert into public.milestones values (v.*);
  else
    update public.milestones set
      title = v.title, target = v.target, criteria = v.criteria, trigger = v.trigger, fallback = v.fallback,
      approver_person_id = v.approver_person_id, mode = v.mode, code = v.code
    where id = v.id;
  end if;
  return v.id;
end
$$;

create or replace function public.move_milestone(p_milestone uuid, p_dir int) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.milestones;
  v_other public.milestones;
begin
  select * into v from public.milestones where id = p_milestone;
  if not found then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  perform private.assert_project(v.project_id, true);
  perform private.require_admin(v.project_id);
  if p_dir < 0 then
    select * into v_other from public.milestones m
     where m.project_id = v.project_id and (m.sort_order, m.id::text) < (v.sort_order, v.id::text)
     order by m.sort_order desc, m.id::text desc limit 1;
  else
    select * into v_other from public.milestones m
     where m.project_id = v.project_id and (m.sort_order, m.id::text) > (v.sort_order, v.id::text)
     order by m.sort_order, m.id::text limit 1;
  end if;
  if v_other.id is null then
    return;
  end if;
  update public.milestones set sort_order = v_other.sort_order where id = v.id;
  update public.milestones set sort_order = v.sort_order where id = v_other.id;
end
$$;

create or replace function public.delete_milestone(p_milestone uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.milestones;
begin
  select * into v from public.milestones where id = p_milestone;
  if not found then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  perform private.assert_project(v.project_id, true);
  perform private.require_admin(v.project_id);
  delete from public.milestones where id = v.id;
end
$$;

-- The effective pemutus decides; a project admin may record the forum's decision for them
-- (decider, forum and date are stored separately from who recorded it).
create or replace function public.decide_gate(
  p_milestone uuid, p_decision text, p_note text,
  p_decider_name text default '', p_forum text default '', p_decided_on date default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.milestones;
  v_note text;
begin
  select * into v from public.milestones where id = p_milestone;
  if not found then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  perform private.assert_project(v.project_id, true);
  if not (private.can_act_for(private.approver_of(v.id), v.project_id) or private.is_project_admin(v.project_id)) then
    raise exception 'Hanya pemutus (%) yang bisa memutuskan milestone ini.', private.person_name(private.approver_of(v.id))
      using errcode = '42501';
  end if;
  if p_decision not in ('lulus', 'rescope', 'stop') then
    raise exception 'Pilih keputusan dulu.' using errcode = 'P0001';
  end if;
  v_note := private.required_text(p_note, 'Tulis catatan keputusannya.');
  if p_decision = 'lulus' and (
       not exists (select 1 from public.tasks t where t.milestone_id = v.id)
       or exists (select 1 from public.tasks t where t.milestone_id = v.id and t.stage <> 'done')) then
    raise exception 'Lulus baru bisa dipilih setelah semua task di milestone ini diterima.' using errcode = 'P0001';
  end if;
  update public.milestones
     set status = case when p_decision = 'rescope' then null else p_decision end, last_decision = p_decision
   where id = v.id;
  insert into public.decisions (project_id, milestone_id, kind, status, note, recorded_by, decider_name, forum, decided_on)
  values (v.project_id, v.id, 'gate', p_decision, v_note, private.current_person_id(),
          coalesce(btrim(p_decider_name), ''), coalesce(btrim(p_forum), ''),
          coalesce(p_decided_on, private.today_jakarta()));
end
$$;

-- ---------------------------------------------------------------------------------------
-- Keputusan (asks)
-- ---------------------------------------------------------------------------------------

-- p keys: id?, project_id (new), question, context, options (text[]), recommendation,
-- decider_person_id, due, milestone_id, task_ids (uuid[]). Members raise; the creator or a
-- project admin edits while open.
create or replace function public.save_ask(p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_is_new boolean := nullif(p ->> 'id', '') is null;
  v public.asks;
  v_proj public.projects;
  v_task uuid;
begin
  if v_is_new then
    v_proj := private.assert_project((p ->> 'project_id')::uuid, true);
    perform private.require_contributor(v_proj.id);
    v.id := gen_random_uuid();
    v.project_id := v_proj.id;
    v.status := 'open';
    v.decider_name := '';
    v.forum := '';
    v.context := '';
    v.options := '{}';
    v.recommendation := '';
    v.rationale := '';
    v.created_at := now();
    v.created_by := private.current_person_id();
  else
    select * into v from public.asks where id = (p ->> 'id')::uuid;
    if not found then
      raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
    end if;
    v_proj := private.assert_project(v.project_id, true);
    if not (private.is_project_admin(v_proj.id)
            or (coalesce(v.created_by = private.current_person_id(), false) and private.can_contribute(v_proj.id))) then
      perform private.require_admin(v_proj.id);
    end if;
    if v.status = 'decided' then
      raise exception 'Keputusan ini sudah diambil. Buka lagi dulu untuk mengubahnya.' using errcode = 'P0001';
    end if;
  end if;

  if p ? 'question' then v.question := btrim(p ->> 'question'); end if;
  if p ? 'context' then v.context := coalesce(p ->> 'context', ''); end if;
  if p ? 'recommendation' then v.recommendation := coalesce(p ->> 'recommendation', ''); end if;
  if p ? 'options' then
    select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}') into v.options
      from jsonb_array_elements_text(coalesce(p -> 'options', '[]'::jsonb)) x;
  end if;
  if p ? 'decider_person_id' then v.decider_person_id := nullif(p ->> 'decider_person_id', '')::uuid; end if;
  if p ? 'due' then v.due := nullif(p ->> 'due', '')::date; end if;
  if p ? 'milestone_id' then v.milestone_id := nullif(p ->> 'milestone_id', '')::uuid; end if;
  if coalesce(v.question, '') = '' then
    raise exception 'Tulis apa yang harus diputuskan.' using errcode = 'P0001';
  end if;

  if v_is_new then
    insert into public.asks values (v.*);
  else
    update public.asks
       set question = v.question, context = v.context, options = v.options, recommendation = v.recommendation,
           decider_person_id = v.decider_person_id, due = v.due, milestone_id = v.milestone_id
     where id = v.id;
  end if;

  if p ? 'task_ids' then
    delete from public.ask_tasks where ask_id = v.id;
    for v_task in select distinct x::uuid from jsonb_array_elements_text(coalesce(p -> 'task_ids', '[]'::jsonb)) x loop
      insert into public.ask_tasks (project_id, ask_id, task_id) values (v.project_id, v.id, v_task);
    end loop;
  end if;
  return v.id;
end
$$;

drop function public.decide_ask(uuid, text, text, text, date);
create function public.decide_ask(
  p_ask uuid, p_answer text, p_decider_name text default '', p_forum text default '', p_decided_on date default null,
  p_rationale text default ''
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.asks;
  v_answer text;
  v_on date := coalesce(p_decided_on, private.today_jakarta());
begin
  select * into v from public.asks where id = p_ask;
  if not found then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  perform private.assert_project(v.project_id, true);
  if v.status = 'decided' then
    raise exception 'Keputusan ini sudah diambil.' using errcode = 'P0001';
  end if;
  if not private.can_act_for(private.decider_of(v.id), v.project_id) then
    raise exception 'Hanya pemutus (%) yang bisa memutuskan ini.', private.person_name(private.decider_of(v.id))
      using errcode = '42501';
  end if;
  v_answer := private.required_text(p_answer, 'Tulis jawaban keputusannya dulu.');
  update public.asks
     set status = 'decided', answer = v_answer, rationale = coalesce(btrim(p_rationale), ''),
         decided_at = now(), decided_by = private.current_person_id(),
         decider_name = coalesce(btrim(p_decider_name), ''), forum = coalesce(btrim(p_forum), ''), decided_on = v_on
   where id = v.id;
  insert into public.decisions (project_id, milestone_id, kind, status, note, rationale, recorded_by,
                                decider_name, forum, decided_on, ask_id)
  values (v.project_id, v.milestone_id, 'ask', 'decided', v_answer, coalesce(btrim(p_rationale), ''),
          private.current_person_id(), coalesce(btrim(p_decider_name), ''), coalesce(btrim(p_forum), ''), v_on, v.id);
end
$$;

-- Reopening clears the open object; the earlier decision stays in the decision log.
drop function public.reopen_ask(uuid);
create function public.reopen_ask(p_ask uuid, p_reason text default '') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.asks;
begin
  select * into v from public.asks where id = p_ask;
  if not found then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  perform private.assert_project(v.project_id, true);
  if v.status <> 'decided' then
    raise exception 'Keputusan ini masih terbuka.' using errcode = 'P0001';
  end if;
  if not private.can_act_for(private.decider_of(v.id), v.project_id) then
    raise exception 'Hanya pemutus (%) yang bisa membuka lagi keputusan ini.', private.person_name(private.decider_of(v.id))
      using errcode = '42501';
  end if;
  update public.asks
     set status = 'open', answer = null, rationale = '', decided_at = null, decided_by = null,
         decider_name = '', forum = '', decided_on = null
   where id = v.id;
  insert into public.decisions (project_id, milestone_id, kind, status, note, recorded_by, decided_on, ask_id)
  values (v.project_id, v.milestone_id, 'ask', 'reopened', coalesce(nullif(btrim(p_reason), ''), 'Keputusan dibuka lagi'),
          private.current_person_id(), private.today_jakarta(), v.id);
end
$$;

create or replace function public.delete_ask(p_ask uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.asks;
begin
  select * into v from public.asks where id = p_ask;
  if not found then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  perform private.assert_project(v.project_id, true);
  perform private.require_admin(v.project_id);
  delete from public.asks where id = v.id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------------------

-- Project wizard (super admin). The PM becomes project_admin; the pemeriksa and each PIC become
-- members (judgment no longer needs administration). p keys: name, code?, entity_code, outcome,
-- measure, pm_person_id, gate_mode, maturity, color, step_template_id, parallel_gates,
-- validator_person_id, milestones: [{title, target}], tasks: [{milestone_index, title,
-- assignee_person_id, start_date, end_date}].
create or replace function public.create_project(p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid;
  v_id uuid := gen_random_uuid();
  v_pm uuid := nullif(p ->> 'pm_person_id', '')::uuid;
  v_val uuid := nullif(p ->> 'validator_person_id', '')::uuid;
  v_gate boolean := coalesce((p ->> 'gate_mode')::boolean, true);
  v_ms_ids uuid[] := '{}'::uuid[];
  v_ms jsonb;
  v_t jsonb;
  v_i int := 0;
  v_pic uuid;
  v_ms_id uuid;
  v_code text := nullif(upper(btrim(coalesce(p ->> 'code', ''))), '');
begin
  perform private.require_user();
  if not private.is_super_admin() then
    raise exception 'Hanya super admin yang bisa membuat project baru.' using errcode = '42501';
  end if;
  v_me := private.current_person_id();
  if v_pm is null then
    raise exception 'Pilih PM-nya.' using errcode = 'P0001';
  end if;
  if v_code is not null and exists (select 1 from public.projects x where x.code = v_code) then
    raise exception 'Kode project % sudah dipakai.', v_code using errcode = 'P0001';
  end if;

  insert into public.projects (id, code, name, entity_code, outcome, measure, status, maturity, gate_mode, parallel_gates,
                               color, step_template_id, created_by)
  values (v_id, v_code, btrim(p ->> 'name'), p ->> 'entity_code', coalesce(p ->> 'outcome', ''), coalesce(p ->> 'measure', ''),
          'aktif', coalesce(nullif(p ->> 'maturity', ''), 'release'), v_gate,
          coalesce((p ->> 'parallel_gates')::boolean, false), coalesce(nullif(p ->> 'color', ''), 'samb3'),
          nullif(p ->> 'step_template_id', '')::uuid, v_me);

  -- One "project created" event is enough; the setup rows stay out of the feed.
  perform set_config('app.quiet_events', 'on', true);
  insert into public.project_members (project_id, person_id, role) values (v_id, v_pm, 'project_admin');
  if v_gate and v_val is not null then
    insert into public.project_members (project_id, person_id, role) values (v_id, v_val, 'member')
    on conflict (project_id, person_id) do nothing;
  end if;
  for v_pic in
    select distinct nullif(x ->> 'assignee_person_id', '')::uuid from jsonb_array_elements(coalesce(p -> 'tasks', '[]')) x
  loop
    if v_pic is not null then
      insert into public.project_members (project_id, person_id, role) values (v_id, v_pic, 'member')
      on conflict (project_id, person_id) do nothing;
    end if;
  end loop;
  update public.projects set pm_person_id = v_pm where id = v_id;

  for v_ms in select * from jsonb_array_elements(coalesce(p -> 'milestones', '[]')) loop
    insert into public.milestones (project_id, title, target, sort_order)
    values (v_id, btrim(v_ms ->> 'title'), nullif(v_ms ->> 'target', '')::date, v_i)
    returning id into v_ms_id;
    v_ms_ids := v_ms_ids || v_ms_id;
    v_i := v_i + 1;
  end loop;

  for v_t in select * from jsonb_array_elements(coalesce(p -> 'tasks', '[]')) loop
    v_pic := nullif(v_t ->> 'assignee_person_id', '')::uuid;
    insert into public.tasks (project_id, milestone_id, title, start_date, end_date, assignee_person_id,
                              validator_person_id, created_by)
    values (v_id, v_ms_ids[(v_t ->> 'milestone_index')::int + 1], btrim(v_t ->> 'title'),
            (v_t ->> 'start_date')::date, (v_t ->> 'end_date')::date, v_pic,
            case when v_gate and v_val is distinct from v_pic then v_val end, v_me);
  end loop;
  perform set_config('app.quiet_events', '', true);
  return v_id;
end
$$;

create or replace function public.update_project(p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.projects := private.assert_project((p ->> 'id')::uuid, true);
begin
  perform private.require_admin(v.id);
  if ((p ? 'parallel_gates' and (p ->> 'parallel_gates')::boolean is distinct from v.parallel_gates)
      or (p ? 'step_template_id' and nullif(p ->> 'step_template_id', '')::uuid is distinct from v.step_template_id))
     and not private.is_super_admin() then
    raise exception 'Hanya super admin yang bisa mengubah template value chain dan mode milestone paralel.' using errcode = '42501';
  end if;
  -- Turning the review flow off would let a PIC tick their own work done (light mode), so only
  -- the super admin may do it. Turning it on is always allowed.
  if v.gate_mode and p ? 'gate_mode' and not (p ->> 'gate_mode')::boolean and not private.is_super_admin() then
    raise exception 'Hanya super admin yang bisa mematikan alur pemeriksaan: tanpa itu PIC bisa menyelesaikan task-nya sendiri.'
      using errcode = '42501';
  end if;
  update public.projects set
    name = case when p ? 'name' then btrim(p ->> 'name') else name end,
    entity_code = case when p ? 'entity_code' then p ->> 'entity_code' else entity_code end,
    outcome = case when p ? 'outcome' then coalesce(p ->> 'outcome', '') else outcome end,
    measure = case when p ? 'measure' then coalesce(p ->> 'measure', '') else measure end,
    pm_person_id = case when p ? 'pm_person_id' then nullif(p ->> 'pm_person_id', '')::uuid else pm_person_id end,
    gate_mode = case when p ? 'gate_mode' then (p ->> 'gate_mode')::boolean else gate_mode end,
    maturity = case when p ? 'maturity' then p ->> 'maturity' else maturity end,
    color = case when p ? 'color' then p ->> 'color' else color end,
    parallel_gates = case when p ? 'parallel_gates' then (p ->> 'parallel_gates')::boolean else parallel_gates end,
    step_template_id = case when p ? 'step_template_id' then nullif(p ->> 'step_template_id', '')::uuid else step_template_id end
  where id = v.id;
end
$$;

create or replace function private.set_project_status(
  p_project uuid, p_mode text, p_note text, p_decider_name text, p_forum text, p_decided_on date
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.projects := private.assert_project(p_project, false);
  v_me uuid := private.current_person_id();
  v_status text := case p_mode when 'close' then 'selesai' when 'stop' then 'dihentikan' else 'aktif' end;
  v_note text;
  v_on date := coalesce(p_decided_on, private.today_jakarta());
begin
  if not private.is_project_admin(v.id) then
    raise exception 'Hanya Project Admin (%) yang bisa melakukan ini.', private.person_name(private.pm_of(v.id)) using errcode = '42501';
  end if;
  if p_mode in ('close', 'stop') and v.status <> 'aktif' then
    raise exception 'Project ini sudah ditutup atau dihentikan.' using errcode = 'P0001';
  end if;
  if p_mode = 'reopen' and v.status = 'aktif' then
    raise exception 'Project ini masih aktif.' using errcode = 'P0001';
  end if;
  if p_mode = 'close' and (
       not exists (select 1 from public.milestones m where m.project_id = v.id)
       or exists (select 1 from public.milestones m where m.project_id = v.id and m.status is distinct from 'lulus')) then
    raise exception 'Project baru bisa ditutup setelah semua milestone lulus.' using errcode = 'P0001';
  end if;
  v_note := private.required_text(p_note, case when p_mode = 'close' then 'Isi bukti hasil akhir dulu.' else 'Tulis alasannya dulu.' end);

  if p_mode = 'reopen' then
    update public.projects
       set status = 'aktif', closed_at = null, closed_by = null, close_note = null,
           close_decider_name = null, close_forum = null, close_decided_on = null
     where id = v.id;
  else
    update public.projects
       set status = v_status, closed_at = now(), closed_by = v_me, close_note = v_note,
           close_decider_name = coalesce(btrim(p_decider_name), ''), close_forum = coalesce(btrim(p_forum), ''),
           close_decided_on = v_on
     where id = v.id;
  end if;
  insert into public.decisions (project_id, kind, status, note, recorded_by, decider_name, forum, decided_on)
  values (v.id, 'project', v_status, v_note, v_me, coalesce(btrim(p_decider_name), ''), coalesce(btrim(p_forum), ''), v_on);
end
$$;

create or replace function public.delete_project(p_project uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_project(p_project, false);
  if not private.is_super_admin() then
    raise exception 'Hanya super admin yang bisa menghapus project. Project Admin bisa menghentikannya.' using errcode = '42501';
  end if;
  delete from public.projects where id = p_project;
end
$$;

create or replace function public.create_reminder(p_task uuid, p_message text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_id uuid;
  v_message text;
begin
  perform private.assert_project(v.project_id, true);
  if not private.is_project_admin(v.project_id) then
    raise exception 'Hanya Project Admin yang bisa mengirim pengingat.' using errcode = '42501';
  end if;
  if v.stage = 'done' then
    raise exception 'Task ini sudah selesai.' using errcode = 'P0001';
  end if;
  if v.assignee_person_id is null then
    raise exception 'Tentukan PIC dulu lewat Edit task, baru pengingat bisa dikirim.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.people_contact c where c.person_id = v.assignee_person_id) then
    raise exception '% belum punya email. Super admin perlu mengisinya di Admin.', private.person_name(v.assignee_person_id)
      using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reminders r
              where r.task_id = v.id and r.status = 'menunggu' and r.to_person_id = v.assignee_person_id) then
    raise exception 'Pengingat untuk task ini masih menunggu dikirim.' using errcode = 'P0001';
  end if;
  v_message := private.required_text(p_message, 'Tulis pesannya.');
  insert into public.reminders (project_id, task_id, to_person_id, message, created_by)
  values (v.project_id, v.id, v.assignee_person_id, v_message, private.current_person_id())
  returning id into v_id;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Membership and accounts
-- ---------------------------------------------------------------------------------------

-- Add, change or remove (p_role null) a person's access to a project.
--   super admin: any role.  project admin (own project): member/viewer only, never their own row,
--   never an existing project admin.  Removing access keeps the person, the login and history.
create function public.set_member_role(p_project uuid, p_person uuid, p_role text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_cur text;
begin
  perform private.assert_project(p_project, false);
  perform private.require_admin(p_project);
  if p_role is not null and p_role not in ('project_admin', 'member', 'viewer') then
    raise exception 'Peran tidak dikenal.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.people pe where pe.id = p_person) then
    raise exception 'Orang ini tidak ditemukan.' using errcode = 'P0002';
  end if;
  v_cur := private.person_role(p_person, p_project);
  if not private.is_super_admin() then
    -- Someone the caller cannot see does not exist for them, whatever role is asked for.
    if v_cur is null and not p_person in (select private.visible_person_ids()) then
      raise exception 'Orang ini tidak ditemukan.' using errcode = 'P0002';
    end if;
    if coalesce(p_person = private.current_person_id(), false) then
      raise exception 'Kamu tidak bisa mengubah aksesmu sendiri.' using errcode = '42501';
    end if;
    if v_cur = 'project_admin' or p_role = 'project_admin' then
      raise exception 'Hanya super admin yang bisa memberi atau mencabut peran Project Admin.' using errcode = '42501';
    end if;
  end if;
  if p_role is null then
    delete from public.project_members where project_id = p_project and person_id = p_person;
  elsif v_cur is null then
    insert into public.project_members (project_id, person_id, role) values (p_project, p_person, p_role);
  elsif v_cur <> p_role then
    update public.project_members set role = p_role where project_id = p_project and person_id = p_person;
  end if;
end
$$;

-- Super admin: grant or withdraw the super admin system role for a person's login.
create function public.set_system_role(p_person uuid, p_role text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform private.require_user();
  if not private.is_super_admin() then
    raise exception 'Hanya super admin yang bisa mengubah peran sistem.' using errcode = '42501';
  end if;
  if p_role not in ('super_admin', 'user') then
    raise exception 'Peran sistem tidak dikenal.' using errcode = 'P0001';
  end if;
  select pe.user_id into v_user from public.people pe where pe.id = p_person;
  if v_user is null then
    raise exception 'Orang ini belum punya akun. Undang dulu.' using errcode = 'P0001';
  end if;
  insert into public.profiles (user_id, system_role) values (v_user, p_role)
  on conflict (user_id) do update set system_role = excluded.system_role;
end
$$;

create function public.resolve_migration_flag(p_flag bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_project uuid;
begin
  select f.project_id into v_project from public.migration_flags f where f.id = p_flag;
  -- Migration notes are visible to project admins only; to anyone else they do not exist.
  if v_project is null or not private.is_project_admin(v_project) then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  update public.migration_flags set resolved_at = now(), resolved_by = private.current_person_id()
   where id = p_flag and resolved_at is null;
end
$$;

create or replace function public.admin_people_status() returns table (person_id uuid, user_id uuid, email text, last_sign_in_at timestamptz, invited_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'Hanya super admin yang bisa melihat status akun.' using errcode = '42501';
  end if;
  return query
    select p.id, p.user_id, c.email::text, u.last_sign_in_at, u.invited_at
      from public.people p
      left join public.people_contact c on c.person_id = p.id
      left join auth.users u on u.id = p.user_id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Retire phase-1 helper names (every body above uses the new ones).
-- ---------------------------------------------------------------------------------------

drop function private.require_pm(uuid);
drop function private.pm_only(uuid, uuid);
drop function private.is_project_pm(uuid);
drop function private.is_owner();
drop function private.is_group_viewer();

-- ---------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon;
grant execute on function
  public.whoami(),
  public.save_task(jsonb), public.delete_task(uuid),
  public.commit_task_dates(uuid, date, date), public.set_task_stage(uuid, text),
  public.submit_task(uuid, text), public.withdraw_submission(uuid),
  public.review_task(uuid, text, text), public.reopen_task(uuid),
  public.raise_blocker(uuid, text, text, uuid, uuid, date), public.resolve_blocker(uuid, text),
  public.escalate_blocker(uuid, jsonb), public.add_comment(text, uuid, text),
  public.save_milestone(jsonb), public.move_milestone(uuid, int), public.delete_milestone(uuid),
  public.decide_gate(uuid, text, text, text, text, date),
  public.save_ask(jsonb), public.decide_ask(uuid, text, text, text, date, text), public.reopen_ask(uuid, text),
  public.delete_ask(uuid),
  public.create_project(jsonb), public.update_project(jsonb),
  public.close_project(uuid, text, text, text, date), public.stop_project(uuid, text, text, text, date),
  public.reopen_project(uuid, text, text, text, date), public.delete_project(uuid),
  public.create_reminder(uuid, text),
  public.set_member_role(uuid, uuid, text), public.set_system_role(uuid, text),
  public.resolve_migration_flag(bigint), public.admin_people_status()
to authenticated;

revoke all on all functions in schema private from public, anon;
grant execute on function private.is_super_admin(), private.is_project_admin(uuid), private.can_contribute(uuid),
  private.readable_project_ids(), private.visible_person_ids(), private.contact_visible(uuid),
  private.current_person_id(), private.member_role(uuid), private.can_read_project(uuid) to authenticated;
