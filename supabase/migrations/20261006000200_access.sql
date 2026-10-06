-- M1 · Access (BRIEF §2.4, §3). Security lives here, not in the client.
--
-- Model:
--   * anon: no privileges at all.
--   * authenticated, project data (projects, milestones, tasks, task_deps, task_steps, asks,
--     decisions, reminders): SELECT only, filtered by RLS to the projects the caller may read.
--     Every write goes through a SECURITY DEFINER RPC that checks the caller's role.
--   * authenticated, admin data (people, people_contact, app_roles, project_members, entities,
--     holidays, step templates, org_settings): read per policy, write only as owner.
--   * user_calendar: each user reads and writes only their own rows.
--   * activity_log / email_log: owner reads; nobody updates or deletes the audit trail.

-- ---------------------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can consult membership without recursion)
-- ---------------------------------------------------------------------------------------

create function private.current_person_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select p.id from public.people p where p.user_id = auth.uid() $$;

create function private.has_app_role(p_role text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.app_roles r where r.user_id = auth.uid() and r.role = p_role) $$;

create function private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_app_role('owner') $$;

create function private.is_group_viewer() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_app_role('group_viewer') $$;

-- The caller's project role ('pm' | 'officer' | 'viewer'), or null when not a member.
create function private.member_role(p_project uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select m.role
    from public.project_members m
    join public.people p on p.id = m.person_id
   where m.project_id = p_project and p.user_id = auth.uid()
$$;

-- Projects the caller may read: all for owner and group viewers, otherwise memberships.
create function private.readable_project_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select pr.id from public.projects pr
   where private.is_owner() or private.is_group_viewer()
  union
  select m.project_id
    from public.project_members m
    join public.people p on p.id = m.person_id
   where p.user_id = auth.uid()
$$;

create function private.can_read_project(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select p_project in (select private.readable_project_ids()) $$;

-- PM rights on a project: project role 'pm', or the app owner (BRIEF §3: owner can do everything).
create function private.is_project_pm(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_owner() or coalesce(private.member_role(p_project) = 'pm', false) $$;

-- People the caller may see (A3): everyone for owner/group viewer, otherwise themselves and
-- everyone sharing at least one project with them.
create function private.visible_person_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select pe.id from public.people pe
   where private.is_owner() or private.is_group_viewer() or pe.user_id = auth.uid()
  union
  select other.person_id
    from public.project_members mine
    join public.people me on me.id = mine.person_id and me.user_id = auth.uid()
    join public.project_members other on other.project_id = mine.project_id
$$;

-- E-mail addresses the caller may read (A3, A10): owner, or PM of a project the person is on.
create function private.contact_visible(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_owner() or exists (
    select 1
      from public.project_members theirs
      join public.project_members mine on mine.project_id = theirs.project_id and mine.role = 'pm'
      join public.people me on me.id = mine.person_id and me.user_id = auth.uid()
     where theirs.person_id = p_person
  )
$$;

-- Policies run as the querying role, so it needs these helpers. Later private functions (RPC
-- internals, trigger functions) get no grant; …_rpcs.sql revokes PUBLIC's default EXECUTE.
revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------------------
-- Grants. Start from nothing, then grant exactly what the model above needs.
-- ---------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Project data: read only; writes via RPCs.
grant select on public.projects, public.milestones, public.tasks, public.task_deps, public.task_steps,
  public.asks, public.decisions, public.reminders to authenticated;

-- Reference and admin data: everyone signed in reads (subject to RLS); owner writes (RLS).
grant select, insert, update, delete on public.people, public.people_contact, public.app_roles,
  public.project_members, public.entities, public.holidays, public.step_templates,
  public.template_steps to authenticated;
grant select, update on public.org_settings to authenticated;

grant select, insert, update, delete on public.user_calendar to authenticated;
grant select on public.email_log, public.activity_log to authenticated;

-- ---------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------

alter table public.entities enable row level security;
alter table public.holidays enable row level security;
alter table public.step_templates enable row level security;
alter table public.template_steps enable row level security;
alter table public.org_settings enable row level security;
alter table public.people enable row level security;
alter table public.people_contact enable row level security;
alter table public.app_roles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_deps enable row level security;
alter table public.task_steps enable row level security;
alter table public.asks enable row level security;
alter table public.decisions enable row level security;
alter table public.reminders enable row level security;
alter table public.email_log enable row level security;
alter table public.user_calendar enable row level security;
alter table public.activity_log enable row level security;

-- Reference data: readable by any signed-in user, writable by the owner.
create policy entities_read on public.entities for select to authenticated using (true);
create policy entities_owner_write on public.entities for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy holidays_read on public.holidays for select to authenticated using (true);
create policy holidays_owner_write on public.holidays for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy step_templates_read on public.step_templates for select to authenticated using (true);
create policy step_templates_owner_write on public.step_templates for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy template_steps_read on public.template_steps for select to authenticated using (true);
create policy template_steps_owner_write on public.template_steps for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy org_settings_read on public.org_settings for select to authenticated using (true);
create policy org_settings_owner_update on public.org_settings for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- People: visible per A3; owner manages.
create policy people_read on public.people for select to authenticated
  using (id in (select private.visible_person_ids()));
create policy people_owner_write on public.people for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy people_contact_read on public.people_contact for select to authenticated
  using (private.contact_visible(person_id));
create policy people_contact_owner_write on public.people_contact for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- App roles: a user sees their own roles; the owner sees and manages all.
create policy app_roles_read on public.app_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));
create policy app_roles_owner_write on public.app_roles for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- Memberships: visible with the project; owner-only management in phase 1 (BRIEF §12.6).
create policy project_members_read on public.project_members for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy project_members_owner_write on public.project_members for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- Project data: read where the project is readable. No write policies: RPCs only.
create policy projects_read on public.projects for select to authenticated
  using (id in (select private.readable_project_ids()));
create policy milestones_read on public.milestones for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy tasks_read on public.tasks for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy task_deps_read on public.task_deps for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy task_steps_read on public.task_steps for select to authenticated
  using (task_id in (select t.id from public.tasks t where t.project_id in (select private.readable_project_ids())));
create policy asks_read on public.asks for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy decisions_read on public.decisions for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy reminders_read on public.reminders for select to authenticated
  using (project_id in (select private.readable_project_ids()));

-- Owner-only logs.
create policy email_log_owner_read on public.email_log for select to authenticated
  using ((select private.is_owner()));
create policy activity_log_owner_read on public.activity_log for select to authenticated
  using ((select private.is_owner()));

-- Private calendar.
create policy user_calendar_own on public.user_calendar for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
