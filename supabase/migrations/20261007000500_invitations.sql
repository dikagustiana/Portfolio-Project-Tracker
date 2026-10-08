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
