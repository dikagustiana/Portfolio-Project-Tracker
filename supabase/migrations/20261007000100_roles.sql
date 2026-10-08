-- Second architecture pass · 1/6 · System roles and project roles (docs/ARCHITECTURE.md §D).
--
--   * profiles.system_role ('super_admin' | 'user') replaces app_roles ('owner' | 'group_viewer').
--     owner → super_admin. group_viewer is retired: each holder gets an explicit 'viewer'
--     membership on every existing project, so nobody silently loses access and every grant shows
--     in the access matrix. Core rule from here on: no membership = the project does not exist.
--   * Project roles are renamed: pm → project_admin, officer → member (viewer stays).
--   * Judgment (pemeriksa, pemutus, ask decider) needs project_admin or member, no longer PM only.
--   * The bootstrap super admin is dika.g.irawan@gmail.com. The e-mail is used only here; after the
--     login exists the source of truth is profiles.system_role.

-- ---------------------------------------------------------------------------------------
-- Membership trigger first: it must understand both the old and the new role names while the
-- rename below runs (an UPDATE pm → project_admin must not clear anyone's assignments).
-- ---------------------------------------------------------------------------------------

create function private.norm_role(p_role text) returns text
language sql immutable set search_path = ''
as $$ select case p_role when 'pm' then 'project_admin' when 'officer' then 'member' else p_role end $$;

create or replace function private.on_membership_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old text := private.norm_role(old.role);
  v_new text;
begin
  if tg_op = 'UPDATE' then
    if new.project_id <> old.project_id or new.person_id <> old.person_id then
      raise exception 'Ubah keanggotaan dengan menghapus lalu menambah lagi.' using errcode = '23514';
    end if;
    v_new := private.norm_role(new.role);
    if v_new = v_old then
      return null;
    end if;
  end if;

  -- No longer a project admin: no longer the project's PM.
  if v_old = 'project_admin' and v_new is distinct from 'project_admin' then
    update public.projects set pm_person_id = null where id = old.project_id and pm_person_id = old.person_id;
  end if;

  -- Left the project or became a viewer: no PIC, pemeriksa, pemutus or decider role any more.
  if v_new is null or v_new = 'viewer' then
    update public.tasks
       set assignee_person_id = null, committed = false, committed_at = null, committed_by = null
     where project_id = old.project_id and assignee_person_id = old.person_id;
    update public.tasks set validator_person_id = null
     where project_id = old.project_id and validator_person_id = old.person_id;
    update public.milestones set approver_person_id = null
     where project_id = old.project_id and approver_person_id = old.person_id;
    update public.asks set decider_person_id = null
     where project_id = old.project_id and decider_person_id = old.person_id and status = 'open';
  end if;
  return null;
end
$$;

alter table public.project_members drop constraint project_members_role_check;
update public.project_members set role = private.norm_role(role) where role in ('pm', 'officer');
alter table public.project_members add constraint project_members_role_check
  check (role in ('project_admin', 'member', 'viewer'));
comment on column public.project_members.role is
  'project_admin: plans and administers the project · member: works on items they hold · viewer: reads only';

-- ---------------------------------------------------------------------------------------
-- Integrity triggers with the new judgment rule (BRIEF §3 superseded by ARCHITECTURE §D).
-- ---------------------------------------------------------------------------------------

-- May this person judge (pemeriksa, pemutus, decider) in this project: project_admin or member.
create function private.can_judge(p_person uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.person_role(p_person, p_project) in ('project_admin', 'member'), false) $$;

create or replace function private.tasks_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Task tidak bisa dipindah ke project lain.' using errcode = '23514';
  end if;
  if new.validator_person_id is not null
     and (tg_op = 'INSERT' or new.validator_person_id is distinct from old.validator_person_id)
     and not private.can_judge(new.validator_person_id, new.project_id) then
    raise exception 'Pemeriksa harus anggota project ini sebagai Project Admin atau Member.' using errcode = '23514';
  end if;
  if new.assignee_person_id is not null
     and (tg_op = 'INSERT' or new.assignee_person_id is distinct from old.assignee_person_id)
     and not private.can_judge(new.assignee_person_id, new.project_id) then
    raise exception 'PIC harus anggota project ini sebagai Project Admin atau Member.' using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace function private.milestones_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Milestone tidak bisa dipindah ke project lain.' using errcode = '23514';
  end if;
  if new.approver_person_id is not null
     and (tg_op = 'INSERT' or new.approver_person_id is distinct from old.approver_person_id)
     and not private.can_judge(new.approver_person_id, new.project_id) then
    raise exception 'Pemutus harus anggota project ini sebagai Project Admin atau Member.' using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace function private.asks_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Keputusan tidak bisa dipindah ke project lain.' using errcode = '23514';
  end if;
  if new.decider_person_id is not null
     and (tg_op = 'INSERT' or new.decider_person_id is distinct from old.decider_person_id)
     and not private.can_judge(new.decider_person_id, new.project_id) then
    raise exception 'Pemutus harus anggota project ini sebagai Project Admin atau Member.' using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace function private.projects_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.pm_person_id is not null
     and (tg_op = 'INSERT' or new.pm_person_id is distinct from old.pm_person_id)
     and private.person_role(new.pm_person_id, new.id) is distinct from 'project_admin' then
    raise exception 'PM project harus anggota project ini sebagai Project Admin.' using errcode = '23514';
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------------------
-- System roles
-- ---------------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  system_role text not null default 'user' check (system_role in ('super_admin', 'user')),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per login. system_role is the only source of global authority.';

-- A system role granted to an e-mail before its login exists (bootstrap, seed import).
create table public.pending_system_roles (
  email extensions.citext primary key check (email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  system_role text not null check (system_role in ('super_admin')),
  created_at timestamptz not null default now()
);

insert into public.profiles (user_id, system_role)
select u.id,
       case when exists (select 1 from public.app_roles r where r.user_id = u.id and r.role = 'owner')
            then 'super_admin' else 'user' end
  from auth.users u;

insert into public.pending_system_roles (email, system_role)
select r.email, 'super_admin' from public.pending_app_roles r where r.role = 'owner'
on conflict do nothing;

-- group_viewer → explicit viewer memberships on every existing project.
do $$
declare
  r record;
  v_person uuid;
  v_email text;
begin
  for r in
    select a.user_id, u.email::text as email from public.app_roles a join auth.users u on u.id = a.user_id where a.role = 'group_viewer'
    union all
    select null, p.email::text from public.pending_app_roles p where p.role = 'group_viewer'
  loop
    v_email := lower(r.email);
    v_person := null;
    if r.user_id is not null then
      select pe.id into v_person from public.people pe where pe.user_id = r.user_id;
    end if;
    if v_person is null then
      select c.person_id into v_person from public.people_contact c where lower(c.email::text) = v_email;
    end if;
    if v_person is null then
      insert into public.people (display_name, job_title, user_id)
      values (coalesce(nullif(left(split_part(v_email, '@', 1), 80), ''), 'Group viewer'), '', r.user_id)
      returning id into v_person;
      insert into public.people_contact (person_id, email) values (v_person, v_email) on conflict do nothing;
    end if;
    insert into public.project_members (project_id, person_id, role)
    select p.id, v_person, 'viewer' from public.projects p
    on conflict (project_id, person_id) do nothing;
  end loop;
end
$$;

-- Bootstrap super admin (ARCHITECTURE §D): the account owner, by e-mail, once.
do $$
declare
  v_user uuid;
begin
  select u.id into v_user from auth.users u where lower(u.email) = 'dika.g.irawan@gmail.com';
  if v_user is not null then
    insert into public.profiles (user_id, system_role) values (v_user, 'super_admin')
    on conflict (user_id) do update set system_role = 'super_admin';
  else
    insert into public.pending_system_roles (email, system_role) values ('dika.g.irawan@gmail.com', 'super_admin')
    on conflict (email) do update set system_role = 'super_admin';
  end if;
end
$$;

-- There is always at least one super admin.
create function private.keep_one_super_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.system_role = 'super_admin'
     and (tg_op = 'DELETE' or new.system_role <> 'super_admin')
     and not exists (select 1 from public.profiles p where p.system_role = 'super_admin' and p.user_id <> old.user_id) then
    raise exception 'Harus ada minimal satu super admin.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
create trigger profiles_keep_one_super_admin before update or delete on public.profiles
  for each row execute function private.keep_one_super_admin();

-- The system role lives on the login, not on the person. Deleting the person of a super admin
-- (granted, or pending for their e-mail) would leave a super admin no admin screen can show or
-- demote, so the role is withdrawn first.
create function private.people_keep_super_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles pr where pr.user_id = old.user_id and pr.system_role = 'super_admin')
     or exists (select 1 from public.people_contact c
                  join public.pending_system_roles r on lower(r.email::text) = lower(c.email::text)
                 where c.person_id = old.id) then
    raise exception 'Orang ini super admin. Cabut peran super admin-nya dulu sebelum menghapus.' using errcode = '23514';
  end if;
  return old;
end
$$;
create trigger people_keep_super_admin before delete on public.people
  for each row execute function private.people_keep_super_admin();

-- Audit rows of keyless tables carry their natural key (profiles: user_id).
create or replace function private.log_activity() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_src jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_before := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_after := to_jsonb(new);
  end if;
  v_src := coalesce(v_after, v_before);
  insert into public.activity_log (actor_user_id, table_name, row_id, action, before, after)
  values (
    auth.uid(), tg_table_name,
    coalesce(v_src ->> 'id', v_src ->> 'user_id', (v_src ->> 'project_id') || ':' || (v_src ->> 'person_id')),
    lower(tg_op), v_before, v_after
  );
  return null;
end
$$;

create trigger profiles_activity after insert or update or delete on public.profiles
  for each row execute function private.log_activity();

-- ---------------------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------------------

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.system_role = 'super_admin') $$;

-- Projects the caller may read: all for the super admin, otherwise memberships. Nothing else.
create or replace function private.readable_project_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select pr.id from public.projects pr where private.is_super_admin()
  union
  select m.project_id
    from public.project_members m
    join public.people p on p.id = m.person_id
   where p.user_id = auth.uid()
$$;

create function private.is_project_admin(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() or coalesce(private.member_role(p_project) = 'project_admin', false) $$;

-- May the caller contribute (comment, raise blockers and Keputusan): super admin, admin or member.
create function private.can_contribute(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() or coalesce(private.member_role(p_project) in ('project_admin', 'member'), false) $$;

create or replace function private.visible_person_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select pe.id from public.people pe
   where private.is_super_admin() or pe.user_id = auth.uid()
  union
  select other.person_id
    from public.project_members mine
    join public.people me on me.id = mine.person_id and me.user_id = auth.uid()
    join public.project_members other on other.project_id = mine.project_id
$$;

-- E-mail addresses: the super admin, or a project admin of a project the person belongs to.
create or replace function private.contact_visible(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1
      from public.project_members theirs
      join public.project_members mine on mine.project_id = theirs.project_id and mine.role = 'project_admin'
      join public.people me on me.id = mine.person_id and me.user_id = auth.uid()
     where theirs.person_id = p_person
  )
$$;

-- Phase-1 names kept as thin aliases until the RPC rewrite (…_000400) drops them.
create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_super_admin() $$;
create or replace function private.is_group_viewer() returns boolean
language sql stable security definer set search_path = ''
as $$ select false $$;
create or replace function private.is_project_pm(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_project_admin(p_project) $$;

-- ---------------------------------------------------------------------------------------
-- Logins: profile on creation, pending system role granted, person linked by e-mail.
-- ---------------------------------------------------------------------------------------

create or replace function private.link_auth_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
begin
  if new.email is null then
    return null;
  end if;
  select r.system_role into v_role from public.pending_system_roles r where lower(r.email::text) = lower(new.email);
  insert into public.profiles (user_id, system_role) values (new.id, coalesce(v_role, 'user'))
  on conflict (user_id) do update
    set system_role = case when excluded.system_role = 'super_admin' then 'super_admin' else public.profiles.system_role end;
  delete from public.pending_system_roles r where lower(r.email::text) = lower(new.email);

  if not exists (select 1 from public.people x where x.user_id = new.id) then
    update public.people p set user_id = new.id
      from public.people_contact c
     where c.person_id = p.id and p.user_id is null and lower(c.email::text) = lower(new.email);
  end if;
  return null;
end
$$;

create or replace function private.allow_only_known_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null
     or not (exists (select 1 from public.people_contact c where lower(c.email::text) = lower(new.email))
             or exists (select 1 from public.pending_system_roles r where lower(r.email::text) = lower(new.email))) then
    raise exception 'Email ini belum terdaftar. Minta admin mengundangmu.' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.whoami() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'person_id', private.current_person_id(),
    'system_role', coalesce((select p.system_role from public.profiles p where p.user_id = auth.uid()), 'user'),
    'is_super_admin', private.is_super_admin()
  )
$$;

-- ---------------------------------------------------------------------------------------
-- Retire app_roles
-- ---------------------------------------------------------------------------------------

drop trigger app_roles_keep_one_owner on public.app_roles;
drop function private.keep_one_owner();
drop table public.app_roles;
drop table public.pending_app_roles;
drop function private.has_app_role(text);

-- ---------------------------------------------------------------------------------------
-- Policies: rebuilt from scratch on the new helpers.
-- ---------------------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.pending_system_roles enable row level security;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.pending_system_roles to authenticated;

-- Reference data: readable by any signed-in user, writable by the super admin.
create policy entities_read on public.entities for select to authenticated using (true);
create policy entities_admin_write on public.entities for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy holidays_read on public.holidays for select to authenticated using (true);
create policy holidays_admin_write on public.holidays for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy step_templates_read on public.step_templates for select to authenticated using (true);
create policy step_templates_admin_write on public.step_templates for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy template_steps_read on public.template_steps for select to authenticated using (true);
create policy template_steps_admin_write on public.template_steps for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy org_settings_read on public.org_settings for select to authenticated using (true);
create policy org_settings_admin_update on public.org_settings for update to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

-- People: names for people sharing a project; e-mails for project admins; the super admin manages.
create policy people_read on public.people for select to authenticated
  using (id in (select private.visible_person_ids()));
create policy people_admin_write on public.people for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy people_contact_read on public.people_contact for select to authenticated
  using (private.contact_visible(person_id));
create policy people_contact_admin_write on public.people_contact for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy profiles_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy pending_system_roles_admin on public.pending_system_roles for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

-- Memberships: visible with the project. Writes go through RPCs (project admins) or, for the
-- super admin, directly; the membership trigger keeps assignments consistent either way.
create policy project_members_read on public.project_members for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy project_members_admin_write on public.project_members for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

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

-- Logs: super admin only.
create policy email_log_admin_read on public.email_log for select to authenticated
  using ((select private.is_super_admin()));
create policy activity_log_admin_read on public.activity_log for select to authenticated
  using ((select private.is_super_admin()));

create policy user_calendar_own on public.user_calendar for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on all functions in schema private from public, anon;
grant execute on function private.is_super_admin(), private.is_project_admin(uuid), private.can_contribute(uuid),
  private.readable_project_ids(), private.visible_person_ids(), private.contact_visible(uuid),
  private.current_person_id(), private.member_role(uuid), private.can_read_project(uuid) to authenticated;
