-- Finishes the production upgrade to migrations 20261007000100-600 (SAMB Project Board).
-- Run once in Supabase Dashboard -> SQL Editor on project samb-project-board (befiqvgeidqycwamritn).
-- One transaction: if anything fails, nothing changes. Generated from the repository files on 8 Oct 2026.
--
-- State this script expects: everything up to and including migration name `rpcs_p02j` has been
-- applied through the Supabase MCP connector. What is left is exactly what that connector refuses
-- without an interactive confirmation: function bodies that delete rows of tasks, asks, milestones
-- or projects (their phase-1 bodies are still in place and working), DROP FUNCTION for the retired
-- phase-1 helpers and for the two signatures set aside as decide_ask_legacy / reopen_ask_legacy,
-- and the migration history rewrite. Function bodies are verbatim from
-- supabase/migrations/20261007000400_rpcs.sql; grants from 20261007000500_invitations.sql.
begin;

-- Guard: only on the state this script was built for.
do $guard$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where name = 'rpcs_p02j')
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000400') then
    raise exception 'Unexpected migration state: this script is not for this database (or already ran).';
  end if;
end
$guard$;

-- ===== Remaining function bodies of 20261007000400_rpcs =====
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

-- ---------------------------------------------------------------------------------------
-- Retire phase-1 helper names (every body above uses the new ones).
-- ---------------------------------------------------------------------------------------

drop function private.require_pm(uuid);
drop function private.pm_only(uuid, uuid);
drop function private.is_project_pm(uuid);
drop function private.is_owner();
drop function private.is_group_viewer();

-- The phase-1 signatures of decide_ask and reopen_ask, set aside by migration rpcs_p02j.
drop function public.decide_ask_legacy(uuid, text, text, text, date);
drop function public.reopen_ask_legacy(uuid);

-- ===== Grants, restated in full (20261007000500_invitations) =====
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
 where name ~ '^(roles|structure|history|rpcs|invitations|extract_structure)_p[0-9]+[a-z]?$'
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
