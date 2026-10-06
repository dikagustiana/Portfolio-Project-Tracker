-- M1 · RPCs: the only write path for project data (BRIEF §2.5, §5).
-- Every function: SECURITY DEFINER, empty search_path, checks visibility (an invisible
-- project looks exactly like a missing one), the project lock, and the caller's role.
-- Error codes: 42501 not allowed · P0002 not found / not visible · P0001 workflow rule ·
-- 23514 integrity rule (from constraints/triggers).

-- ---------------------------------------------------------------------------------------
-- Internal helpers (private schema; no grants)
-- ---------------------------------------------------------------------------------------

create function private.require_user() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Kamu perlu masuk dulu.' using errcode = '42501';
  end if;
  return auth.uid();
end
$$;

create function private.today_jakarta() returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- Loads a project the caller may read; optionally requires it to be active (prototype locked()).
create function private.assert_project(p_project uuid, p_need_active boolean) returns public.projects
language plpgsql stable security definer set search_path = ''
as $$
declare
  v public.projects;
begin
  perform private.require_user();
  select * into v from public.projects where id = p_project;
  if not found or not private.can_read_project(p_project) then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  if p_need_active and v.status <> 'aktif' then
    raise exception 'Project ini sudah ditutup atau dihentikan. Buka lagi project-nya untuk mengubah.' using errcode = 'P0001';
  end if;
  return v;
end
$$;

create function private.require_pm(p_project uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_project_pm(p_project) then
    raise exception 'Hanya Project Manager yang bisa melakukan ini.' using errcode = '42501';
  end if;
end
$$;

create function private.load_task(p_task uuid) returns public.tasks
language plpgsql stable security definer set search_path = ''
as $$
declare
  v public.tasks;
begin
  select * into v from public.tasks where id = p_task;
  if not found then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  return v;
end
$$;

create function private.person_name(p_person uuid) returns text
language sql stable security definer set search_path = ''
as $$ select coalesce((select pe.display_name from public.people pe where pe.id = p_person), 'Project Manager') $$;

-- Fallback chains, as in the prototype: validator → milestone approver → project PM.
create function private.pm_only(p_person uuid, p_project uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select case when private.person_role(p_person, p_project) = 'pm' then p_person end $$;

create function private.pm_of(p_project uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select private.pm_only(p.pm_person_id, p.id) from public.projects p where p.id = p_project $$;

create function private.approver_of(p_milestone uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.pm_only(m.approver_person_id, m.project_id), private.pm_of(m.project_id))
    from public.milestones m where m.id = p_milestone
$$;

create function private.validator_of(p_task uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    private.pm_only(t.validator_person_id, t.project_id),
    case when t.milestone_id is not null then private.approver_of(t.milestone_id) else private.pm_of(t.project_id) end
  )
    from public.tasks t where t.id = p_task
$$;

create function private.decider_of(p_ask uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.pm_only(a.decider_person_id, a.project_id), private.pm_of(a.project_id))
    from public.asks a where a.id = p_ask
$$;

-- Prototype canAct(): the person themself, or a PM acting for someone without a login
-- (or for nobody in particular, when the role falls back to "Project Manager").
create function private.can_act_for(p_person uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_person is not null and p_person = private.current_person_id() then true
    else (p_person is null or (select pe.user_id from public.people pe where pe.id = p_person) is null)
         and private.is_project_pm(p_project)
  end
$$;

-- Accept / reject / reopen permission (BRIEF §5, A16, A17): never the PIC, never when the
-- effective validator is the PIC, otherwise the effective validator or a PM acting for one
-- without a login.
create function private.assert_can_validate(t public.tasks) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_val uuid := private.validator_of(t.id);
begin
  if t.assignee_person_id is not null and t.assignee_person_id = private.current_person_id() then
    raise exception 'PIC tidak bisa memeriksa task-nya sendiri.' using errcode = '42501';
  end if;
  if v_val is not null and v_val = t.assignee_person_id then
    raise exception 'Pemeriksa task ini sama dengan PIC-nya. Pilih pemeriksa lain dulu.' using errcode = 'P0001';
  end if;
  if not private.can_act_for(v_val, t.project_id) then
    raise exception 'Hanya pemeriksa (%) yang bisa melakukan ini.', private.person_name(v_val) using errcode = '42501';
  end if;
end
$$;

create function private.assert_gated(p public.projects) returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if not p.gate_mode then
    raise exception 'Project ini memakai mode ringan, tanpa pemeriksaan dan komit tanggal.' using errcode = 'P0001';
  end if;
end
$$;

create function private.required_text(p_value text, p_message text) returns text
language plpgsql immutable set search_path = ''
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    raise exception '%', p_message using errcode = 'P0001';
  end if;
  return btrim(p_value);
end
$$;

-- ---------------------------------------------------------------------------------------
-- Who am I
-- ---------------------------------------------------------------------------------------

create function public.whoami() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'person_id', private.current_person_id(),
    'is_owner', private.is_owner(),
    'is_group_viewer', private.is_group_viewer()
  )
$$;

-- ---------------------------------------------------------------------------------------
-- Tasks: planning (PM)
-- ---------------------------------------------------------------------------------------

-- Create or edit a task. p keys: id?, project_id (new), milestone_id, title, description,
-- start_date, end_date, assignee_person_id, validator_person_id, proof_requested, stage,
-- deps (uuid[]), steps (step codes), commit ('on' | 'off'). Missing keys keep their value.
create function public.save_task(p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid;
  v_old public.tasks;
  v_new public.tasks;
  v_proj public.projects;
  v_is_new boolean := nullif(p ->> 'id', '') is null;
  v_changed boolean;
  v_commit text := nullif(p ->> 'commit', '');
  v_code text;
  v_step uuid;
  v_dep uuid;
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
  else
    v_old := private.load_task((p ->> 'id')::uuid);
    v_proj := private.assert_project(v_old.project_id, true);
    v_new := v_old;
    if v_proj.gate_mode and v_old.stage in ('review', 'done') then
      raise exception 'Task yang sedang diperiksa atau sudah diterima tidak bisa diedit.' using errcode = 'P0001';
    end if;
  end if;
  perform private.require_pm(v_proj.id);

  if p ? 'title' then v_new.title := btrim(p ->> 'title'); end if;
  if p ? 'description' then v_new.description := coalesce(p ->> 'description', ''); end if;
  if p ? 'milestone_id' then v_new.milestone_id := nullif(p ->> 'milestone_id', '')::uuid; end if;
  if p ? 'start_date' then v_new.start_date := (p ->> 'start_date')::date; end if;
  if p ? 'end_date' then v_new.end_date := (p ->> 'end_date')::date; end if;
  if p ? 'assignee_person_id' then v_new.assignee_person_id := nullif(p ->> 'assignee_person_id', '')::uuid; end if;
  if p ? 'validator_person_id' then v_new.validator_person_id := nullif(p ->> 'validator_person_id', '')::uuid; end if;
  if p ? 'proof_requested' then v_new.proof_requested := coalesce(p ->> 'proof_requested', ''); end if;

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

  -- Commitment (prototype saveTask, tightened per BRIEF §5: any change of dates or PIC clears it).
  if v_proj.gate_mode then
    v_changed := v_is_new
      or v_new.start_date is distinct from v_old.start_date
      or v_new.end_date is distinct from v_old.end_date
      or v_new.assignee_person_id is distinct from v_old.assignee_person_id;
    if v_commit = 'on' then
      if v_new.assignee_person_id is null
         or not (v_new.assignee_person_id = v_me
                 or (select pe.user_id from public.people pe where pe.id = v_new.assignee_person_id) is null) then
        raise exception 'Hanya PIC yang bisa mengomit tanggal ini.' using errcode = '42501';
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
      start_date = v_new.start_date, end_date = v_new.end_date,
      assignee_person_id = v_new.assignee_person_id, validator_person_id = v_new.validator_person_id,
      proof_requested = v_new.proof_requested, stage = v_new.stage, done_at = v_new.done_at,
      committed = v_new.committed, committed_at = v_new.committed_at, committed_by = v_new.committed_by
    where id = v_new.id;
  end if;

  if p ? 'deps' then
    delete from public.task_deps where task_id = v_new.id;
    for v_dep in select distinct x::uuid from jsonb_array_elements_text(coalesce(p -> 'deps', '[]'::jsonb)) x loop
      insert into public.task_deps (project_id, task_id, depends_on_task_id) values (v_proj.id, v_new.id, v_dep);
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

create function public.delete_task(p_task uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
begin
  perform private.assert_project(v.project_id, true);
  perform private.require_pm(v.project_id);
  update public.reminders set status = 'dibatalkan', note = 'Task dihapus'
   where task_id = v.id and status = 'menunggu';
  delete from public.tasks where id = v.id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Tasks: workflow transitions (BRIEF §5 table)
-- ---------------------------------------------------------------------------------------

create function public.commit_task_dates(p_task uuid, p_start date default null, p_end date default null)
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
  if not (v.assignee_person_id = v_me
          or ((select pe.user_id from public.people pe where pe.id = v.assignee_person_id) is null
              and private.is_project_pm(v.project_id))) then
    raise exception 'Hanya % yang bisa mengomit tanggal ini.', private.person_name(v.assignee_person_id) using errcode = '42501';
  end if;
  if v_end < v_start then
    raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai.' using errcode = 'P0001';
  end if;
  update public.tasks
     set start_date = v_start, end_date = v_end, committed = true, committed_at = now(), committed_by = v_me
   where id = v.id;
end
$$;

-- Gated: todo ⇄ progress only. Light mode: any stage (prototype onCheck/moveTo).
create function public.set_task_stage(p_task uuid, p_stage text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
begin
  if p_stage not in ('todo', 'progress', 'review', 'done') then
    raise exception 'Tahap tidak dikenal.' using errcode = 'P0001';
  end if;
  if not ((v.assignee_person_id is not null and v.assignee_person_id = private.current_person_id())
          or private.is_project_pm(v.project_id)) then
    raise exception 'Hanya PIC atau Project Manager yang bisa memindahkan task ini.' using errcode = '42501';
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
    update public.tasks
       set stage = p_stage, done_at = case when p_stage = 'done' then coalesce(v.done_at, now()) end
     where id = v.id;
  end if;
end
$$;

create function public.submit_task(p_task uuid, p_evidence text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
  v_evidence text;
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
  v_evidence := private.required_text(p_evidence, 'Isi bukti dulu. Pemeriksa butuh sesuatu untuk dicek.');
  update public.tasks
     set stage = 'review', evidence = v_evidence, submitted_at = now(),
         submitted_by = coalesce(private.current_person_id(), v.assignee_person_id)
   where id = v.id;
end
$$;

create function public.withdraw_submission(p_task uuid) returns void
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

create function public.review_task(p_task uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
  v_me uuid := private.current_person_id();
  v_reason text;
begin
  perform private.assert_gated(v_proj);
  if v.stage <> 'review' then
    raise exception 'Task ini tidak sedang menunggu pemeriksaan.' using errcode = 'P0001';
  end if;
  perform private.assert_can_validate(v);
  if p_decision = 'accept' then
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

create function public.reopen_task(p_task uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_proj public.projects := private.assert_project(v.project_id, true);
begin
  perform private.assert_gated(v_proj);
  if v.stage <> 'done' then
    raise exception 'Task ini belum diterima.' using errcode = 'P0001';
  end if;
  -- Same gate as accept/reject (prototype openReview: reopen needs canValidate).
  if (v.assignee_person_id is not null and v.assignee_person_id = private.current_person_id())
     or not private.can_act_for(private.validator_of(v.id), v.project_id) then
    raise exception 'Task yang sudah diterima hanya bisa dibuka lagi oleh pemeriksanya.' using errcode = '42501';
  end if;
  perform private.assert_can_validate(v);
  update public.tasks
     set stage = 'progress', accepted_at = null, accepted_by = null, done_at = null
   where id = v.id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Milestones (gates)
-- ---------------------------------------------------------------------------------------

-- p keys: id?, project_id (new), title, target, criteria, trigger, fallback,
-- approver_person_id, mode, code, position ('before' | 'after', new only).
create function public.save_milestone(p jsonb) returns uuid
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
  perform private.require_pm(v_proj.id);

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

create function public.move_milestone(p_milestone uuid, p_dir int) returns void
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
  perform private.require_pm(v.project_id);
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

create function public.delete_milestone(p_milestone uuid) returns void
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
  perform private.require_pm(v.project_id);
  delete from public.milestones where id = v.id;
end
$$;

create function public.decide_gate(
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
  if not private.is_project_pm(v.project_id) then
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
-- Asks (Keputusan dibutuhkan)
-- ---------------------------------------------------------------------------------------

-- p keys: id?, project_id (new), question, decider_person_id, due, milestone_id.
create function public.save_ask(p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_is_new boolean := nullif(p ->> 'id', '') is null;
  v public.asks;
  v_proj public.projects;
begin
  if v_is_new then
    v_proj := private.assert_project((p ->> 'project_id')::uuid, true);
    v.id := gen_random_uuid();
    v.project_id := v_proj.id;
    v.status := 'open';
    v.decider_name := '';
    v.forum := '';
    v.created_at := now();
    v.created_by := private.current_person_id();
  else
    select * into v from public.asks where id = (p ->> 'id')::uuid;
    if not found then
      raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
    end if;
    v_proj := private.assert_project(v.project_id, true);
    if v.status = 'decided' then
      raise exception 'Keputusan ini sudah diambil. Buka lagi dulu untuk mengubahnya.' using errcode = 'P0001';
    end if;
  end if;
  perform private.require_pm(v_proj.id);

  if p ? 'question' then v.question := btrim(p ->> 'question'); end if;
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
       set question = v.question, decider_person_id = v.decider_person_id, due = v.due, milestone_id = v.milestone_id
     where id = v.id;
  end if;
  return v.id;
end
$$;

create function public.decide_ask(
  p_ask uuid, p_answer text, p_decider_name text default '', p_forum text default '', p_decided_on date default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.asks;
  v_answer text;
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
     set status = 'decided', answer = v_answer, decided_at = now(), decided_by = private.current_person_id(),
         decider_name = coalesce(btrim(p_decider_name), ''), forum = coalesce(btrim(p_forum), ''),
         decided_on = coalesce(p_decided_on, private.today_jakarta())
   where id = v.id;
end
$$;

-- Reopening clears the answer and the attribution (BRIEF §5); the assigned decider stays.
create function public.reopen_ask(p_ask uuid) returns void
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
     set status = 'open', answer = null, decided_at = null, decided_by = null,
         decider_name = '', forum = '', decided_on = null
   where id = v.id;
end
$$;

create function public.delete_ask(p_ask uuid) returns void
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
  perform private.require_pm(v.project_id);
  delete from public.asks where id = v.id;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------------------

-- Project wizard (owner only: creating a project grants access, BRIEF §3). Memberships follow
-- from the plan: the PM and the pemeriksa become 'pm', each PIC becomes 'officer'.
-- p keys: name, entity_code, outcome, measure, pm_person_id, gate_mode, maturity, color,
-- step_template_id, parallel_gates, validator_person_id,
-- milestones: [{title, target}] in order, tasks: [{milestone_index, title, assignee_person_id, start_date, end_date}].
create function public.create_project(p jsonb) returns uuid
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
begin
  perform private.require_user();
  if not private.is_owner() then
    raise exception 'Hanya owner yang bisa membuat project baru.' using errcode = '42501';
  end if;
  v_me := private.current_person_id();
  if v_pm is null then
    raise exception 'Pilih PM-nya.' using errcode = 'P0001';
  end if;

  insert into public.projects (id, name, entity_code, outcome, measure, status, maturity, gate_mode, parallel_gates,
                               color, step_template_id, created_by)
  values (v_id, btrim(p ->> 'name'), p ->> 'entity_code', coalesce(p ->> 'outcome', ''), coalesce(p ->> 'measure', ''),
          'aktif', coalesce(nullif(p ->> 'maturity', ''), 'release'), v_gate,
          coalesce((p ->> 'parallel_gates')::boolean, false), coalesce(nullif(p ->> 'color', ''), 'samb3'),
          nullif(p ->> 'step_template_id', '')::uuid, v_me);

  insert into public.project_members (project_id, person_id, role) values (v_id, v_pm, 'pm');
  if v_gate and v_val is not null then
    insert into public.project_members (project_id, person_id, role) values (v_id, v_val, 'pm')
    on conflict (project_id, person_id) do nothing;
  end if;
  for v_pic in
    select distinct nullif(x ->> 'assignee_person_id', '')::uuid from jsonb_array_elements(coalesce(p -> 'tasks', '[]')) x
  loop
    if v_pic is not null then
      insert into public.project_members (project_id, person_id, role) values (v_id, v_pic, 'officer')
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
  return v_id;
end
$$;

-- p keys: id, name, entity_code, outcome, measure, pm_person_id, gate_mode, maturity, color;
-- owner only: parallel_gates, step_template_id.
create function public.update_project(p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.projects := private.assert_project((p ->> 'id')::uuid, true);
begin
  perform private.require_pm(v.id);
  if ((p ? 'parallel_gates' and (p ->> 'parallel_gates')::boolean is distinct from v.parallel_gates)
      or (p ? 'step_template_id' and nullif(p ->> 'step_template_id', '')::uuid is distinct from v.step_template_id))
     and not private.is_owner() then
    raise exception 'Hanya owner yang bisa mengubah template value chain dan mode milestone paralel.' using errcode = '42501';
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

create function private.set_project_status(
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
  if not private.is_project_pm(v.id) then
    raise exception 'Hanya PM (%) yang bisa melakukan ini.', private.person_name(private.pm_of(v.id)) using errcode = '42501';
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

create function public.close_project(
  p_project uuid, p_note text, p_decider_name text default '', p_forum text default '', p_decided_on date default null
) returns void
language sql security definer set search_path = ''
as $$ select private.set_project_status(p_project, 'close', p_note, p_decider_name, p_forum, p_decided_on) $$;

create function public.stop_project(
  p_project uuid, p_note text, p_decider_name text default '', p_forum text default '', p_decided_on date default null
) returns void
language sql security definer set search_path = ''
as $$ select private.set_project_status(p_project, 'stop', p_note, p_decider_name, p_forum, p_decided_on) $$;

create function public.reopen_project(
  p_project uuid, p_note text, p_decider_name text default '', p_forum text default '', p_decided_on date default null
) returns void
language sql security definer set search_path = ''
as $$ select private.set_project_status(p_project, 'reopen', p_note, p_decider_name, p_forum, p_decided_on) $$;

create function public.delete_project(p_project uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_project(p_project, false);
  if not private.is_owner() then
    raise exception 'Hanya owner yang bisa menghapus project. Project Manager bisa menghentikannya.' using errcode = '42501';
  end if;
  delete from public.projects where id = p_project;
end
$$;

-- ---------------------------------------------------------------------------------------
-- Reminders (queued; sending is phase 2)
-- ---------------------------------------------------------------------------------------

create function public.create_reminder(p_task uuid, p_message text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v public.tasks := private.load_task(p_task);
  v_id uuid;
  v_message text;
begin
  perform private.assert_project(v.project_id, true);
  if not private.is_project_pm(v.project_id) then
    raise exception 'Hanya Project Manager yang bisa mengirim pengingat.' using errcode = '42501';
  end if;
  if v.stage = 'done' then
    raise exception 'Task ini sudah selesai.' using errcode = 'P0001';
  end if;
  if v.assignee_person_id is null then
    raise exception 'Tentukan PIC dulu lewat Edit task, baru pengingat bisa dikirim.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.people_contact c where c.person_id = v.assignee_person_id) then
    raise exception '% belum punya email. Owner perlu mengisinya di menu Tim.', private.person_name(v.assignee_person_id)
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
-- Grants: RPCs are for signed-in users only.
-- ---------------------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon;
grant execute on function
  public.whoami(),
  public.save_task(jsonb), public.delete_task(uuid),
  public.commit_task_dates(uuid, date, date), public.set_task_stage(uuid, text),
  public.submit_task(uuid, text), public.withdraw_submission(uuid),
  public.review_task(uuid, text, text), public.reopen_task(uuid),
  public.save_milestone(jsonb), public.move_milestone(uuid, int), public.delete_milestone(uuid),
  public.decide_gate(uuid, text, text, text, text, date),
  public.save_ask(jsonb), public.decide_ask(uuid, text, text, text, date), public.reopen_ask(uuid), public.delete_ask(uuid),
  public.create_project(jsonb), public.update_project(jsonb),
  public.close_project(uuid, text, text, text, date), public.stop_project(uuid, text, text, text, date),
  public.reopen_project(uuid, text, text, text, date), public.delete_project(uuid),
  public.create_reminder(uuid, text)
to authenticated;

-- Internal functions: PostgreSQL grants EXECUTE to PUBLIC on every new function, and a
-- schema-level default cannot take that away, so revoke explicitly. The policy helpers keep
-- their explicit grant to authenticated (…_access.sql); everything else in private runs only
-- inside SECURITY DEFINER code or as a trigger.
revoke all on all functions in schema private from public, anon;
