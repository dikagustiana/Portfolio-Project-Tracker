-- Finishes the production upgrade to migrations 20261007000100-600 (SAMB Project Board).
-- Run once in Supabase Dashboard -> SQL Editor on project samb-project-board. One transaction:
-- if anything fails, nothing changes. Generated from the repository files on 8 Oct 2026.
begin;

-- Guard: only on the half-applied state this script was built for.
do $guard$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where name = 'rpcs_p02a')
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000400') then
    raise exception 'Unexpected migration state: this script is not for this database (or already ran).';
  end if;
end
$guard$;

-- ===== Remaining parts of 20261007000400_rpcs, then 20261007000500_invitations and
-- ===== 20261007000600_extract_structure, verbatim =====
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
  -- A closed or stopped project is read-only, discussion included.
  perform private.assert_project(v_project, true);
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
-- Second architecture pass · 5/6 · Invitations (docs/ARCHITECTURE.md §K "Invitation semantics").
--
--   * An invitation resolves to one person: the existing person with that e-mail, else a new one.
--     No duplicates.
--   * Its project assignments (invitation_projects, one row per project with its own role) apply
--     to memberships immediately, so the person can be planned with at once; without a login
--     they still cannot read anything.
--   * The invitation governs the login: pending (14 days) → accepted at the first sign-in, or
--     revoked / expired. Revoking a pending invitation removes the access it granted (where nobody
--     changed it since) and deletes a login that was created for it but never used.
--   * An existing account is never re-invited: its memberships are updated directly.
--   * Super admin: any project, any role. Project admin: own projects, member/viewer only.
--   * A login link is a key to the account. A project admin may only obtain one (invite, link,
--     revoke) for someone whose whole access lies inside the projects they administer, who is not
--     a Project Admin anywhere and holds no system role (private.login_within_reach), and only for
--     invitations they made themselves. Everyone else is invited by the super admin.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null check (email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  display_name text not null default '' check (length(display_name) <= 80),
  person_id uuid references public.people (id) on delete cascade,
  invited_by uuid references public.people (id) on delete set null,
  invited_by_user uuid,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.people (id) on delete set null,
  -- Whether the person already had a login when invited: a revoke deletes only a login the
  -- invitation itself created (and that was never used).
  login_existed boolean not null default false
);
create unique index invitations_one_pending on public.invitations (email) where status = 'pending';
create index invitations_person_idx on public.invitations (person_id);

create table public.invitation_projects (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  project_role text not null check (project_role in ('project_admin', 'member', 'viewer')),
  -- Role the person had before this invitation applied (null = no access), so a revoke can undo it.
  previous_role text check (previous_role in ('project_admin', 'member', 'viewer')),
  primary key (invitation_id, project_id)
);
create index invitation_projects_project_idx on public.invitation_projects (project_id);

create trigger invitations_activity after insert or update or delete on public.invitations
  for each row execute function private.log_activity();
create trigger invitation_projects_activity after insert or update or delete on public.invitation_projects
  for each row execute function private.log_activity();

alter table public.invitations enable row level security;
alter table public.invitation_projects enable row level security;
grant select on public.invitations, public.invitation_projects to authenticated;

-- Project admins see invitations that touch their projects, and only those project rows.
create function private.can_see_invitation(p_invitation uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.invitation_projects ip
     where ip.invitation_id = p_invitation and private.is_project_admin(ip.project_id)
  )
$$;
grant execute on function private.can_see_invitation(uuid) to authenticated;

create policy invitations_read on public.invitations for select to authenticated
  using (private.can_see_invitation(id));
create policy invitation_projects_read on public.invitation_projects for select to authenticated
  using ((select private.is_super_admin()) or private.is_project_admin(project_id));

-- ---------------------------------------------------------------------------------------
-- Lifecycle helpers
-- ---------------------------------------------------------------------------------------

create function private.expire_invitations() returns void
language sql security definer set search_path = ''
as $$ update public.invitations set status = 'expired' where status = 'pending' and expires_at < now() $$;

-- Expiry is applied lazily by every invitation RPC and hourly by pg_cron, so stored statuses stay current.
select cron.schedule('expire-invitations', '17 * * * *', 'select private.expire_invitations()');

-- A login has been used once its owner signed in.
create function private.login_used(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from auth.users u where u.id = p_user and u.last_sign_in_at is not null) $$;

-- Whether the caller may hold the keys to this person's login: the super admin always; a project
-- admin only when every membership of the person is a Member/Viewer role in a project the caller
-- administers, and the person holds no system role (granted or pending for their e-mail).
create function private.login_within_reach(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_super_admin() or (
        not exists (select 1 from public.project_members m
                     where m.person_id = p_person
                       and (m.role = 'project_admin' or not private.is_project_admin(m.project_id)))
    and not exists (select 1 from public.people pe join public.profiles pr on pr.user_id = pe.user_id
                     where pe.id = p_person and pr.system_role <> 'user')
    and not exists (select 1 from public.people_contact c
                      join public.pending_system_roles r on lower(r.email::text) = lower(c.email::text)
                     where c.person_id = p_person))
$$;

-- p keys: email, name?, assignments: [{project_id, role}]. Returns
-- { mode: 'invited' | 'updated', person_id, invitation_id? }.
create function public.invite_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_super boolean;
  v_person uuid;
  v_user uuid;
  v_inv uuid;
  v_a jsonb;
  v_project uuid;
  v_role text;
  v_cur text;
  v_n int := 0;
begin
  perform private.require_user();
  v_super := private.is_super_admin();
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Format email belum benar, mis. nama@samb.co.id.' using errcode = 'P0001';
  end if;

  -- Check every assignment before writing anything.
  for v_a in select x from jsonb_array_elements(coalesce(p -> 'assignments', '[]'::jsonb)) x loop
    v_project := (v_a ->> 'project_id')::uuid;
    v_role := v_a ->> 'role';
    perform private.assert_project(v_project, false);
    if v_role not in ('project_admin', 'member', 'viewer') then
      raise exception 'Peran tidak dikenal.' using errcode = 'P0001';
    end if;
    if not v_super and not (private.is_project_admin(v_project) and v_role in ('member', 'viewer')) then
      raise exception 'Kamu hanya bisa mengundang ke project yang kamu kelola, sebagai Member atau Viewer.' using errcode = '42501';
    end if;
    v_n := v_n + 1;
  end loop;
  if v_n = 0 and not v_super then
    raise exception 'Pilih minimal satu project.' using errcode = 'P0001';
  end if;

  perform private.expire_invitations();

  select c.person_id into v_person from public.people_contact c where lower(c.email::text) = v_email;
  -- An address reserved for a system role is the super admin's to invite.
  if not v_super and exists (select 1 from public.pending_system_roles r where lower(r.email::text) = v_email) then
    raise exception 'Email ini hanya bisa diundang oleh super admin.' using errcode = '42501';
  end if;
  if v_person is null then
    insert into public.people (display_name, job_title)
    values (coalesce(nullif(left(v_name, 80), ''), left(split_part(v_email, '@', 1), 80)), '')
    returning id into v_person;
    insert into public.people_contact (person_id, email) values (v_person, v_email);
  end if;
  select pe.user_id into v_user from public.people pe where pe.id = v_person;

  -- Existing account (signed in at least once): no invitation, memberships updated directly.
  if v_user is null or not private.login_used(v_user) then
    -- An invitation leads to a login link: only for someone wholly inside the caller's projects.
    if not private.login_within_reach(v_person) then
      raise exception 'Orang ini juga punya akses di luar project yang kamu kelola. Minta super admin mengundangnya.'
        using errcode = '42501';
    end if;
    select i.id into v_inv from public.invitations i where lower(i.email::text) = v_email and i.status = 'pending';
    if v_inv is null then
      insert into public.invitations (email, display_name, person_id, invited_by, invited_by_user, login_existed)
      values (v_email, coalesce(nullif(left(v_name, 80), ''), ''), v_person, private.current_person_id(), auth.uid(),
              v_user is not null)
      returning id into v_inv;
    else
      update public.invitations set expires_at = now() + interval '14 days', person_id = v_person where id = v_inv;
    end if;
  end if;

  for v_a in select x from jsonb_array_elements(coalesce(p -> 'assignments', '[]'::jsonb)) x loop
    v_project := (v_a ->> 'project_id')::uuid;
    v_role := v_a ->> 'role';
    v_cur := private.person_role(v_person, v_project);
    if not v_super and v_cur = 'project_admin' then
      raise exception 'Hanya super admin yang bisa mengubah akses seorang Project Admin.' using errcode = '42501';
    end if;
    if v_inv is not null then
      insert into public.invitation_projects (invitation_id, project_id, project_role, previous_role)
      values (v_inv, v_project, v_role, v_cur)
      on conflict (invitation_id, project_id) do update set project_role = excluded.project_role;
    end if;
    if v_cur is null then
      insert into public.project_members (project_id, person_id, role) values (v_project, v_person, v_role);
    elsif v_cur <> v_role then
      update public.project_members set role = v_role where project_id = v_project and person_id = v_person;
    end if;
  end loop;

  return jsonb_build_object('mode', case when v_inv is null then 'updated' else 'invited' end,
                            'person_id', v_person, 'invitation_id', v_inv);
end
$$;

create function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.invitations;
  r record;
  v_user uuid;
begin
  perform private.require_user();
  perform private.expire_invitations();
  select * into v from public.invitations where id = p_invitation;
  if not found or not private.can_see_invitation(v.id) then
    raise exception 'Data tidak ditemukan atau kamu tidak punya akses.' using errcode = 'P0002';
  end if;
  if not private.is_super_admin() then
    if v.invited_by_user is distinct from auth.uid() then
      raise exception 'Undangan ini dibuat orang lain. Minta dia atau super admin mencabutnya.' using errcode = '42501';
    end if;
    if exists (select 1 from public.invitation_projects ip
                where ip.invitation_id = v.id
                  and (not private.is_project_admin(ip.project_id)
                       or ip.project_role = 'project_admin' or ip.previous_role = 'project_admin')) then
      raise exception 'Undangan ini juga mencakup project lain atau peran Project Admin. Minta super admin mencabutnya.' using errcode = '42501';
    end if;
    if not private.login_within_reach(v.person_id) then
      raise exception 'Orang ini sekarang juga punya akses di luar project yang kamu kelola. Minta super admin mencabutnya.'
        using errcode = '42501';
    end if;
  end if;
  if v.status <> 'pending' then
    raise exception 'Hanya undangan yang masih menunggu yang bisa dicabut.' using errcode = 'P0001';
  end if;
  select pe.user_id into v_user from public.people pe where pe.id = v.person_id;
  if v_user is not null and private.login_used(v_user) then
    raise exception 'Undangan ini sudah dipakai untuk masuk. Atur aksesnya di Anggota project.' using errcode = 'P0001';
  end if;

  -- Undo the access it granted, where nobody changed it since.
  for r in select ip.* from public.invitation_projects ip where ip.invitation_id = v.id loop
    if private.person_role(v.person_id, r.project_id) = r.project_role then
      if r.previous_role is null then
        delete from public.project_members where project_id = r.project_id and person_id = v.person_id;
      else
        update public.project_members set role = r.previous_role where project_id = r.project_id and person_id = v.person_id;
      end if;
    end if;
  end loop;

  update public.invitations set status = 'revoked', revoked_at = now(), revoked_by = private.current_person_id()
   where id = v.id;
  -- A login created for this invitation (not one the person already had) and never used goes with it.
  if v_user is not null and not v.login_existed then
    delete from auth.users u where u.id = v_user and u.last_sign_in_at is null;
  end if;
end
$$;

-- Who may send a login link to a person (Edge Function invite-person): the super admin for any
-- person with an e-mail; a project admin only for their own pending invitation of someone within
-- reach (see private.login_within_reach), checked again now. Returns the e-mail address.
create function public.login_link_target(p_person uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_user uuid;
  v_status text;
begin
  perform private.require_user();
  perform private.expire_invitations();
  select c.email::text into v_email from public.people_contact c where c.person_id = p_person;
  select pe.user_id into v_user from public.people pe where pe.id = p_person;
  if not private.is_super_admin() and not (
       exists (select 1 from public.invitations i
                where i.person_id = p_person and i.status = 'pending' and i.invited_by_user = auth.uid()
                  and exists (select 1 from public.invitation_projects ip
                               where ip.invitation_id = i.id and private.is_project_admin(ip.project_id)))
       and private.login_within_reach(p_person)) then
    raise exception 'Hanya super admin, atau Project Admin yang mengundang orang ini ke project-nya, yang bisa mengirim link masuk.'
      using errcode = '42501';
  end if;
  if v_email is null then
    raise exception 'Orang ini belum punya email kantor. Isi dulu emailnya.' using errcode = 'P0001';
  end if;
  select i.status into v_status from public.invitations i
   where lower(i.email::text) = lower(v_email) order by i.created_at desc limit 1;
  if v_status in ('revoked', 'expired') and (v_user is null or not private.login_used(v_user)) then
    raise exception 'Undangan untuk % sudah %. Undang ulang dulu.', v_email,
      case v_status when 'revoked' then 'dicabut' else 'kedaluwarsa' end using errcode = 'P0001';
  end if;
  return jsonb_build_object('email', v_email, 'has_login', v_user is not null);
end
$$;

-- ---------------------------------------------------------------------------------------
-- Auth: which e-mails may get a login, and acceptance at first sign-in
-- ---------------------------------------------------------------------------------------

create or replace function private.allow_only_known_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_latest text;
begin
  if new.email is null then
    raise exception 'Email ini belum terdaftar. Minta admin mengundangmu.' using errcode = '42501';
  end if;
  if exists (select 1 from public.pending_system_roles r where lower(r.email::text) = lower(new.email))
     or exists (select 1 from public.invitations i
                 where lower(i.email::text) = lower(new.email) and i.status = 'pending' and i.expires_at >= now()) then
    return new;
  end if;
  select i.status into v_latest from public.invitations i
   where lower(i.email::text) = lower(new.email) order by i.created_at desc limit 1;
  if v_latest in ('revoked', 'expired', 'pending') then
    raise exception 'Undangan untuk email ini sudah dicabut atau kedaluwarsa. Minta admin mengundang ulang.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.people_contact c where lower(c.email::text) = lower(new.email)) then
    raise exception 'Email ini belum terdaftar. Minta admin mengundangmu.' using errcode = '42501';
  end if;
  return new;
end
$$;

create function private.accept_invitations() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.invitations i set status = 'accepted', accepted_at = now()
   where lower(i.email::text) = lower(new.email) and i.status in ('pending', 'expired');
  return null;
end
$$;
create trigger on_auth_user_signed_in after update of last_sign_in_at on auth.users
  for each row when (new.last_sign_in_at is not null and old.last_sign_in_at is null)
  execute function private.accept_invitations();

revoke all on all functions in schema public from public, anon;
grant execute on function public.invite_member(jsonb), public.revoke_invitation(uuid), public.login_link_target(uuid)
  to authenticated;
-- Earlier grants survive the revoke above only for authenticated; restate the full RPC list so a
-- fresh database and an upgraded one end up identical.
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
  private.current_person_id(), private.member_role(uuid), private.can_read_project(uuid),
  private.can_see_invitation(uuid) to authenticated;
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

-- ===== Migration history: one row per file, as `supabase db push` / `migration repair` record them =====
delete from supabase_migrations.schema_migrations
 where name ~ '^(roles|structure|history|rpcs|invitations|extract_structure)_p[0-9]+[ab]?$'
    or name like 'connector_probe%';
insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261007000100', 'roles', '{}'),
  ('20261007000200', 'structure', '{}'),
  ('20261007000300', 'history', '{}'),
  ('20261007000400', 'rpcs', '{}'),
  ('20261007000500', 'invitations', '{}'),
  ('20261007000600', 'extract_structure', '{}');

commit;

select version, name from supabase_migrations.schema_migrations order by version;
