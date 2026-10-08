-- Finishes the production upgrade to migrations 20261007000100-600 (SAMB Project Board).
-- Run once in Supabase Dashboard -> SQL Editor on project samb-project-board (befiqvgeidqycwamritn).
-- One transaction: if anything fails, nothing changes. Generated from the repository files on 8 Oct 2026.
--
-- State this script expects: everything up to and including migration name `extract_structure_p01`
-- has been applied through the Supabase MCP connector. What is left is exactly the set of statements
-- that connector refuses to run without an interactive confirmation (bodies containing DELETE, and
-- DROP FUNCTION): the RPCs below, the retirement of the phase-1 helper names, and the migration
-- history rewrite. Every statement is verbatim from supabase/migrations/20261007000400_rpcs.sql and
-- 20261007000500_invitations.sql.
begin;

-- Guard: only on the state this script was built for.
do $guard$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where name = 'extract_structure_p01')
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000400') then
    raise exception 'Unexpected migration state: this script is not for this database (or already ran).';
  end if;
end
$guard$;

-- ===== Remaining statements of 20261007000400_rpcs =====
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

-- ---------------------------------------------------------------------------------------
-- Retire phase-1 helper names (every body above uses the new ones).
-- ---------------------------------------------------------------------------------------

drop function private.require_pm(uuid);
drop function private.pm_only(uuid, uuid);
drop function private.is_project_pm(uuid);
drop function private.is_owner();
drop function private.is_group_viewer();

-- ===== Remaining statements of 20261007000500_invitations =====
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

-- ===== Migration history: one row per file, as `supabase db push` / `migration repair` record them =====
delete from supabase_migrations.schema_migrations
 where name ~ '^(roles|structure|history|rpcs|invitations|extract_structure)_p[0-9]+[abc]?$'
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
