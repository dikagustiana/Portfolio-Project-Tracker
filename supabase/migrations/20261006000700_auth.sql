-- M3 · Invite-only sign-in (BRIEF §1, §3).
--
-- Sign-up is closed in Auth settings (config.toml enable_signup = false; the same switch must be
-- off in the hosted dashboard). As a second line, the database itself refuses to create a login
-- for an e-mail that is not on file: a person's contact address, or a pending app role.
--
-- pending_app_roles lets the owner (or the seed import) grant 'owner' / 'group_viewer' to an
-- e-mail before that person has a login; the role is granted when the login is created.

create table public.pending_app_roles (
  email extensions.citext not null check (email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role text not null check (role in ('owner', 'group_viewer')),
  created_at timestamptz not null default now(),
  primary key (email, role)
);
alter table public.pending_app_roles enable row level security;
grant select, insert, update, delete on public.pending_app_roles to authenticated;
create policy pending_app_roles_owner on public.pending_app_roles for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create function private.allow_only_known_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null
     or not (exists (select 1 from public.people_contact c where lower(c.email::text) = lower(new.email))
             or exists (select 1 from public.pending_app_roles r where lower(r.email::text) = lower(new.email))) then
    raise exception 'Email ini belum terdaftar. Minta owner mengundangmu.' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger on_auth_user_gate before insert on auth.users
  for each row execute function private.allow_only_known_emails();

-- Extend linking: grant pending app roles when the login appears.
create or replace function private.link_auth_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null then
    return null;
  end if;
  insert into public.app_roles (user_id, role)
  select new.id, r.role from public.pending_app_roles r where lower(r.email::text) = lower(new.email)
  on conflict do nothing;
  delete from public.pending_app_roles r where lower(r.email::text) = lower(new.email);

  if not exists (select 1 from public.people x where x.user_id = new.id) then
    update public.people p set user_id = new.id
      from public.people_contact c
     where c.person_id = p.id and p.user_id is null and lower(c.email::text) = lower(new.email);
  end if;
  return null;
end
$$;

-- Owner admin view of logins: which people have signed in, and when (no auth.users exposure).
create function public.admin_people_status() returns table (person_id uuid, user_id uuid, email text, last_sign_in_at timestamptz, invited_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'Hanya owner yang bisa melihat status akun.' using errcode = '42501';
  end if;
  return query
    select p.id, p.user_id, c.email::text, u.last_sign_in_at, u.invited_at
      from public.people p
      left join public.people_contact c on c.person_id = p.id
      left join auth.users u on u.id = p.user_id;
end
$$;

revoke all on all functions in schema private from public, anon;
revoke all on function public.admin_people_status() from public, anon;
grant execute on function public.admin_people_status() to authenticated;
