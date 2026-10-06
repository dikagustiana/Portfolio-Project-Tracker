-- M1 · Triggers: integrity rules a CHECK cannot express, the gate auto-reopen (BRIEF §5),
-- membership clean-up, auth-user linking, and the append-only activity log (BRIEF §6.8).

create function private.person_role(p_person uuid, p_project uuid) returns text
language sql stable security definer set search_path = ''
as $$ select m.role from public.project_members m where m.project_id = p_project and m.person_id = p_person $$;

-- ---------------------------------------------------------------------------------------
-- Role rules on references (BRIEF §3). Checked when the reference is set or changed.
-- ---------------------------------------------------------------------------------------

create function private.tasks_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Task tidak bisa dipindah ke project lain.' using errcode = '23514';
  end if;
  if new.validator_person_id is not null
     and (tg_op = 'INSERT' or new.validator_person_id is distinct from old.validator_person_id)
     and private.person_role(new.validator_person_id, new.project_id) is distinct from 'pm' then
    raise exception 'Pemeriksa harus Project Manager di project ini.' using errcode = '23514';
  end if;
  if new.assignee_person_id is not null
     and (tg_op = 'INSERT' or new.assignee_person_id is distinct from old.assignee_person_id)
     and coalesce(private.person_role(new.assignee_person_id, new.project_id), 'viewer') = 'viewer' then
    raise exception 'PIC harus anggota project ini sebagai Project Manager atau Officer.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger tasks_integrity before insert or update on public.tasks
  for each row execute function private.tasks_integrity();

create function private.milestones_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Milestone tidak bisa dipindah ke project lain.' using errcode = '23514';
  end if;
  if new.approver_person_id is not null
     and (tg_op = 'INSERT' or new.approver_person_id is distinct from old.approver_person_id)
     and private.person_role(new.approver_person_id, new.project_id) is distinct from 'pm' then
    raise exception 'Pemutus harus Project Manager di project ini.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger milestones_integrity before insert or update on public.milestones
  for each row execute function private.milestones_integrity();

create function private.asks_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Keputusan tidak bisa dipindah ke project lain.' using errcode = '23514';
  end if;
  if new.decider_person_id is not null
     and (tg_op = 'INSERT' or new.decider_person_id is distinct from old.decider_person_id)
     and private.person_role(new.decider_person_id, new.project_id) is distinct from 'pm' then
    raise exception 'Pemutus harus Project Manager di project ini.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger asks_integrity before insert or update on public.asks
  for each row execute function private.asks_integrity();

create function private.projects_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.pm_person_id is not null
     and (tg_op = 'INSERT' or new.pm_person_id is distinct from old.pm_person_id)
     and private.person_role(new.pm_person_id, new.id) is distinct from 'pm' then
    raise exception 'PM project harus anggota project ini sebagai Project Manager.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger projects_integrity before insert or update on public.projects
  for each row execute function private.projects_integrity();

-- A changed template drops step links that no longer belong to it.
create function private.projects_template_changed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.task_steps ts
   using public.tasks t
   where ts.task_id = t.id and t.project_id = new.id
     and not exists (
       select 1 from public.template_steps s
        where s.id = ts.template_step_id and s.template_id = new.step_template_id
     );
  return null;
end
$$;
create trigger projects_template_changed after update of step_template_id on public.projects
  for each row when (new.step_template_id is distinct from old.step_template_id)
  execute function private.projects_template_changed();

create function private.task_deps_no_cycle() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    with recursive reach (id) as (
      select new.depends_on_task_id
      union
      select d.depends_on_task_id from public.task_deps d join reach r on d.task_id = r.id
    )
    select 1 from reach where id = new.task_id
  ) then
    raise exception 'Ketergantungan melingkar: task yang dipilih sudah menunggu task ini.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger task_deps_no_cycle before insert or update on public.task_deps
  for each row execute function private.task_deps_no_cycle();

create function private.task_steps_in_template() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      join public.template_steps s on s.template_id = p.step_template_id
     where t.id = new.task_id and s.id = new.template_step_id
  ) then
    raise exception 'Step value chain ini tidak ada di template project.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger task_steps_in_template before insert or update on public.task_steps
  for each row execute function private.task_steps_in_template();

-- ---------------------------------------------------------------------------------------
-- Membership changes: a person who stops being PM can no longer be PM, pemeriksa or pemutus
-- (prototype clearPMRefs); a person who leaves (or becomes viewer) is no longer PIC.
-- ---------------------------------------------------------------------------------------

create function private.on_membership_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_new_role text;
begin
  if tg_op = 'UPDATE' then
    if new.project_id <> old.project_id or new.person_id <> old.person_id then
      raise exception 'Ubah keanggotaan dengan menghapus lalu menambah lagi.' using errcode = '23514';
    end if;
    if new.role = old.role then
      return null;
    end if;
    v_new_role := new.role;
  end if;

  if old.role = 'pm' and v_new_role is distinct from 'pm' then
    update public.projects set pm_person_id = null
     where id = old.project_id and pm_person_id = old.person_id;
    update public.milestones set approver_person_id = null
     where project_id = old.project_id and approver_person_id = old.person_id;
    update public.tasks set validator_person_id = null
     where project_id = old.project_id and validator_person_id = old.person_id;
    update public.asks set decider_person_id = null
     where project_id = old.project_id and decider_person_id = old.person_id and status = 'open';
  end if;

  if v_new_role is null or v_new_role = 'viewer' then
    update public.tasks
       set assignee_person_id = null, committed = false, committed_at = null, committed_by = null
     where project_id = old.project_id and assignee_person_id = old.person_id;
  end if;
  return null;
end
$$;
create trigger project_members_changed after update or delete on public.project_members
  for each row execute function private.on_membership_change();

-- ---------------------------------------------------------------------------------------
-- Gate auto-reopen (BRIEF §5): a not-done task added to, or reopened in, a 'lulus' gate clears
-- the gate and logs a rescope decision. Mirrors prototype put('tasks').
-- ---------------------------------------------------------------------------------------

create function private.auto_reopen_gate() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms public.milestones;
  v_why text;
begin
  if new.milestone_id is null or new.stage = 'done' then
    return null;
  end if;
  select * into v_ms from public.milestones where id = new.milestone_id;
  if v_ms.status is distinct from 'lulus' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    v_why := 'ada task baru: ';
  elsif old.milestone_id is distinct from new.milestone_id then
    v_why := 'ada task baru: ';
  else
    v_why := 'task dibuka lagi: ';
  end if;
  update public.milestones set status = null where id = v_ms.id;
  insert into public.decisions (project_id, milestone_id, kind, status, note, recorded_by)
  values (v_ms.project_id, v_ms.id, 'gate', 'rescope',
          'Keputusan dibuka lagi otomatis karena ' || v_why || new.title, private.current_person_id());
  return null;
end
$$;
create trigger tasks_auto_reopen_gate after insert or update on public.tasks
  for each row execute function private.auto_reopen_gate();

-- ---------------------------------------------------------------------------------------
-- Linking logins to people by e-mail (invite-only sign-up, M3).
-- ---------------------------------------------------------------------------------------

create function private.link_auth_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null or exists (select 1 from public.people x where x.user_id = new.id) then
    return null;
  end if;
  update public.people p set user_id = new.id
    from public.people_contact c
   where c.person_id = p.id and p.user_id is null and lower(c.email::text) = lower(new.email);
  return null;
end
$$;
create trigger on_auth_user_link after insert or update of email on auth.users
  for each row execute function private.link_auth_user();

create function private.link_contact_to_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.people p set user_id = u.id
    from auth.users u
   where p.id = new.person_id and p.user_id is null and lower(u.email) = lower(new.email::text)
     and not exists (select 1 from public.people x where x.user_id = u.id);
  return null;
end
$$;
create trigger people_contact_link after insert or update of email on public.people_contact
  for each row execute function private.link_contact_to_user();

-- There is always at least one owner.
create function private.keep_one_owner() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.user_id <> old.user_id)
     and not exists (select 1 from public.app_roles r where r.role = 'owner' and r.user_id <> old.user_id) then
    raise exception 'Harus ada minimal satu owner.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
create trigger app_roles_keep_one_owner before update or delete on public.app_roles
  for each row execute function private.keep_one_owner();

-- ---------------------------------------------------------------------------------------
-- Activity log: every insert, update or delete on the audited tables; append-only.
-- ---------------------------------------------------------------------------------------

create function private.log_activity() returns trigger
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
    coalesce(v_src ->> 'id', (v_src ->> 'project_id') || ':' || (v_src ->> 'person_id')),
    lower(tg_op), v_before, v_after
  );
  return null;
end
$$;

create trigger tasks_activity after insert or update or delete on public.tasks
  for each row execute function private.log_activity();
create trigger milestones_activity after insert or update or delete on public.milestones
  for each row execute function private.log_activity();
create trigger asks_activity after insert or update or delete on public.asks
  for each row execute function private.log_activity();
create trigger decisions_activity after insert or update or delete on public.decisions
  for each row execute function private.log_activity();
create trigger projects_activity after insert or update or delete on public.projects
  for each row execute function private.log_activity();
create trigger project_members_activity after insert or update or delete on public.project_members
  for each row execute function private.log_activity();

create function private.activity_log_immutable() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'activity_log hanya bisa ditambah, tidak bisa diubah atau dihapus.' using errcode = '42501';
end
$$;
create trigger activity_log_no_change before update or delete on public.activity_log
  for each row execute function private.activity_log_immutable();
create trigger activity_log_no_truncate before truncate on public.activity_log
  for each statement execute function private.activity_log_immutable();
