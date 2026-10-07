-- Second architecture pass · 3/6 · History, blockers, Keputusan, comments (docs/ARCHITECTURE.md §C, §F).
--
-- Nothing important is overwritten any more:
--   * project_events  human-readable, project-scoped, append-only feed (separate from activity_log)
--   * task_reviews    one row per submission round: evidence, reviewer, verdict, feedback
--   * task_commitments one row per commitment; the first is the baseline, so slip is measurable
--   * decisions       now also the immutable log of Keputusan decisions and reopenings
-- All of them are written by triggers on the base tables, so every write path (RPC, import,
-- super-admin edit) produces the same history.

-- ---------------------------------------------------------------------------------------
-- Keputusan (asks) upgrade and the decision log
-- ---------------------------------------------------------------------------------------

alter table public.asks
  add column context text not null default '' check (length(context) <= 5000),
  add column options text[] not null default '{}' check (cardinality(options) <= 10),
  add column recommendation text not null default '' check (length(recommendation) <= 5000),
  add column rationale text not null default '' check (length(rationale) <= 5000),
  add constraint asks_id_project_key unique (id, project_id);
comment on column public.asks.answer is 'The final decision (keputusan akhir).';

-- Tasks a Keputusan blocks or concerns.
create table public.ask_tasks (
  project_id uuid not null,
  ask_id uuid not null,
  task_id uuid not null,
  primary key (ask_id, task_id),
  constraint ask_tasks_ask_fk foreign key (ask_id, project_id) references public.asks (id, project_id) on delete cascade,
  constraint ask_tasks_task_fk foreign key (task_id, project_id) references public.tasks (id, project_id) on delete cascade
);
create index ask_tasks_task_idx on public.ask_tasks (task_id);

alter table public.decisions
  add column ask_id uuid,
  add column rationale text not null default '' check (length(rationale) <= 5000),
  add constraint decisions_ask_same_project foreign key (ask_id, project_id)
    references public.asks (id, project_id) on delete set null (ask_id);
alter table public.decisions drop constraint decisions_kind_check;
alter table public.decisions add constraint decisions_kind_check check (kind in ('gate', 'project', 'ask'));
alter table public.decisions drop constraint decisions_status_by_kind;
alter table public.decisions add constraint decisions_status_by_kind check (
  (kind = 'gate' and status in ('lulus', 'rescope', 'stop'))
  or (kind = 'project' and status in ('aktif', 'selesai', 'dihentikan'))
  or (kind = 'ask' and status in ('decided', 'reopened'))
);
create index decisions_ask_idx on public.decisions (ask_id);
-- Decisions recorded in one transaction (a decision and an automatic gate reopen) keep their order.
alter table public.decisions alter column recorded_at set default clock_timestamp();

-- ---------------------------------------------------------------------------------------
-- History tables
-- ---------------------------------------------------------------------------------------

create table public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid not null,
  round int not null check (round >= 1),
  submitted_by uuid references public.people (id) on delete set null,
  submitted_at timestamptz not null,
  evidence text not null check (length(evidence) <= 20000),
  reviewer_person_id uuid references public.people (id) on delete set null,
  reviewed_at timestamptz,
  verdict text check (verdict in ('accepted', 'rejected', 'withdrawn')),
  feedback text check (length(feedback) <= 5000),
  reopened_at timestamptz,
  reopened_by uuid references public.people (id) on delete set null,
  unique (task_id, round),
  constraint task_reviews_task_fk foreign key (task_id, project_id) references public.tasks (id, project_id) on delete cascade
);
create index task_reviews_project_idx on public.task_reviews (project_id);

create table public.task_commitments (
  id uuid primary key default gen_random_uuid(),
  -- Insertion order: several commitments can share one transaction timestamp.
  seq bigint generated always as identity,
  project_id uuid not null,
  task_id uuid not null,
  start_date date not null,
  end_date date not null,
  committed_by uuid references public.people (id) on delete set null,
  committed_at timestamptz not null default now(),
  constraint task_commitments_task_fk foreign key (task_id, project_id) references public.tasks (id, project_id) on delete cascade
);
create index task_commitments_task_idx on public.task_commitments (task_id, committed_at);
create index task_commitments_project_idx on public.task_commitments (project_id);

-- Blocker: an overlay on a task (not a stage). At most one open per task; resolving or
-- escalating keeps the row. A future first-class Issue can generalise this table.
create table public.task_blockers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid not null,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  need text not null default '' check (length(need) <= 2000),
  needed_from_person_id uuid references public.people (id) on delete set null,
  needed_from_function_id uuid references public.functions (id) on delete set null,
  target_date date,
  raised_by uuid references public.people (id) on delete set null,
  raised_at timestamptz not null default now(),
  resolved_by uuid references public.people (id) on delete set null,
  resolved_at timestamptz,
  resolution text check (length(resolution) <= 2000),
  ask_id uuid,
  constraint task_blockers_task_fk foreign key (task_id, project_id) references public.tasks (id, project_id) on delete cascade,
  constraint task_blockers_ask_fk foreign key (ask_id, project_id) references public.asks (id, project_id) on delete set null (ask_id)
);
create unique index task_blockers_one_open on public.task_blockers (task_id) where resolved_at is null;
create index task_blockers_project_idx on public.task_blockers (project_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid,
  ask_id uuid,
  author_person_id uuid references public.people (id) on delete set null,
  author_user_id uuid,
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint comments_one_target check ((task_id is null) <> (ask_id is null)),
  constraint comments_task_fk foreign key (task_id, project_id) references public.tasks (id, project_id) on delete cascade,
  constraint comments_ask_fk foreign key (ask_id, project_id) references public.asks (id, project_id) on delete cascade
);
create index comments_task_idx on public.comments (task_id);
create index comments_ask_idx on public.comments (ask_id);
create index comments_project_idx on public.comments (project_id);

create table public.project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  object_type text not null check (object_type in ('project', 'task', 'milestone', 'ask', 'member')),
  object_id uuid,
  object_ref text,
  object_title text not null default '',
  verb text not null check (verb in (
    'task_created', 'task_started', 'task_submitted', 'task_withdrawn', 'task_accepted', 'task_completed',
    'task_rejected', 'task_reopened', 'task_deleted', 'pic_changed',
    'commitment_made', 'commitment_changed', 'commitment_cleared',
    'blocker_raised', 'blocker_resolved', 'blocker_escalated',
    'gate_passed', 'gate_stopped', 'gate_rescoped',
    'decision_requested', 'decision_made', 'decision_reopened',
    'project_created', 'project_closed', 'project_stopped', 'project_reopened',
    'member_added', 'member_role_changed', 'member_removed', 'comment_added')),
  actor_person_id uuid references public.people (id) on delete set null,
  actor_user_id uuid,
  actor_name text not null default '',
  at timestamptz not null default clock_timestamp(),
  meta jsonb not null default '{}'::jsonb
);
create index project_events_project_idx on public.project_events (project_id, at desc);
create index project_events_object_idx on public.project_events (object_id, at desc);

-- Uncertain mappings found while extracting structure from prose (§I.5). Never silently invented.
create table public.migration_flags (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  object_type text not null check (object_type in ('project', 'task', 'milestone', 'ask', 'person')),
  object_id uuid,
  ref text,
  code text not null check (code ~ '^[a-z_]{1,40}$'),
  detail text not null check (length(detail) <= 2000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.people (id) on delete set null,
  unique nulls not distinct (project_id, ref, code, detail)
);

-- ---------------------------------------------------------------------------------------
-- Event writer
-- ---------------------------------------------------------------------------------------

-- Bulk loads (seed import, structure extraction, project creation) set app.quiet_events = on.
create function private.quiet() returns boolean
language sql stable set search_path = ''
as $$ select coalesce(current_setting('app.quiet_events', true), '') = 'on' $$;

create function private.emit(
  p_project uuid, p_type text, p_id uuid, p_ref text, p_title text, p_verb text, p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_person uuid := private.current_person_id();
begin
  -- Skip quiet loads, and rows cascading away with a deleted project.
  if private.quiet() or not exists (select 1 from public.projects p where p.id = p_project) then
    return;
  end if;
  insert into public.project_events (project_id, object_type, object_id, object_ref, object_title, verb,
                                     actor_person_id, actor_user_id, actor_name, meta)
  values (p_project, p_type, p_id, p_ref, coalesce(p_title, ''), p_verb, v_person, auth.uid(),
          coalesce((select pe.display_name from public.people pe where pe.id = v_person),
                   case when auth.uid() is null then 'Sistem' else '' end),
          coalesce(p_meta, '{}'::jsonb));
end
$$;

create function private.events_immutable() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Deleting a person nulls their id here (ON DELETE SET NULL); the line keeps its name snapshot.
  if tg_op = 'UPDATE' then
    if new.actor_person_id is null and (to_jsonb(new) - 'actor_person_id') = (to_jsonb(old) - 'actor_person_id') then
      return new;
    end if;
  end if;
  raise exception 'Riwayat project hanya bisa ditambah, tidak bisa diubah.' using errcode = '42501';
end
$$;
create trigger project_events_no_update before update on public.project_events
  for each row execute function private.events_immutable();
create trigger project_events_no_truncate before truncate on public.project_events
  for each statement execute function private.events_immutable();

-- ---------------------------------------------------------------------------------------
-- Task history: events, review rounds and commitments from task state changes
-- ---------------------------------------------------------------------------------------

create function private.task_history() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_gated boolean;
  v_round int;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    perform private.emit(old.project_id, 'task', old.id, old.ref, old.title, 'task_deleted',
                         jsonb_build_object('parent', (select t.ref from public.tasks t where t.id = old.parent_task_id)));
    return null;
  end if;

  -- Commitment history: every new commitment is a row; the first is the baseline.
  if new.committed and (tg_op = 'INSERT' or not old.committed or new.committed_at is distinct from old.committed_at
                        or new.start_date <> old.start_date or new.end_date <> old.end_date) then
    insert into public.task_commitments (project_id, task_id, start_date, end_date, committed_by, committed_at)
    values (new.project_id, new.id, new.start_date, new.end_date, new.committed_by, coalesce(new.committed_at, now()));
  end if;

  if tg_op = 'INSERT' then
    perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'task_created',
                         jsonb_build_object('parent', (select t.ref from public.tasks t where t.id = new.parent_task_id)));
    return null;
  end if;

  if old.committed and not new.committed then
    perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'commitment_cleared',
      jsonb_build_object('start', old.start_date, 'end', old.end_date, 'new_start', new.start_date, 'new_end', new.end_date));
  end if;

  if new.assignee_person_id is distinct from old.assignee_person_id then
    perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'pic_changed',
      jsonb_build_object('from', (select pe.display_name from public.people pe where pe.id = old.assignee_person_id),
                         'to', (select pe.display_name from public.people pe where pe.id = new.assignee_person_id)));
  end if;

  if new.stage is distinct from old.stage then
    select p.gate_mode into v_gated from public.projects p where p.id = new.project_id;
    select max(r.round) into v_round from public.task_reviews r where r.task_id = new.id;

    if new.stage = 'review' then
      insert into public.task_reviews (project_id, task_id, round, submitted_by, submitted_at, evidence)
      values (new.project_id, new.id, coalesce(v_round, 0) + 1, new.submitted_by, coalesce(new.submitted_at, now()),
              coalesce(new.evidence, ''));
      perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'task_submitted',
                           jsonb_build_object('round', coalesce(v_round, 0) + 1));
    elsif old.stage = 'review' and new.stage = 'done' then
      update public.task_reviews
         set verdict = 'accepted', reviewer_person_id = new.accepted_by, reviewed_at = coalesce(new.accepted_at, now())
       where task_id = new.id and round = v_round and verdict is null;
      perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'task_accepted',
                           jsonb_build_object('round', v_round));
    elsif old.stage = 'review' and new.rejected_at is distinct from old.rejected_at then
      update public.task_reviews
         set verdict = 'rejected', reviewer_person_id = new.rejected_by, reviewed_at = coalesce(new.rejected_at, now()),
             feedback = new.reject_reason
       where task_id = new.id and round = v_round and verdict is null;
      perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'task_rejected',
                           jsonb_build_object('round', v_round, 'reason', new.reject_reason));
    elsif old.stage = 'review' then
      update public.task_reviews set verdict = 'withdrawn', reviewed_at = now()
       where task_id = new.id and round = v_round and verdict is null;
      perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'task_withdrawn',
                           jsonb_build_object('round', v_round));
    elsif new.stage = 'done' then
      perform private.emit(new.project_id, 'task', new.id, new.ref, new.title,
                           case when v_gated then 'task_accepted' else 'task_completed' end, '{}'::jsonb);
    elsif old.stage = 'done' then
      update public.task_reviews set reopened_at = now(), reopened_by = private.current_person_id()
       where task_id = new.id and round = v_round and verdict = 'accepted';
      perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'task_reopened', '{}'::jsonb);
    elsif old.stage = 'todo' and new.stage = 'progress' then
      perform private.emit(new.project_id, 'task', new.id, new.ref, new.title, 'task_started', '{}'::jsonb);
    end if;
  end if;
  return null;
end
$$;
create trigger tasks_history after insert or update or delete on public.tasks
  for each row execute function private.task_history();

create function private.commitment_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev public.task_commitments;
  v_base public.task_commitments;
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  select * into v_prev from public.task_commitments c
   where c.task_id = new.task_id and c.id <> new.id
   order by c.seq desc limit 1;
  select * into v_base from public.task_commitments c
   where c.task_id = new.task_id order by c.seq limit 1;
  if v_prev.id is not null and (v_prev.start_date <> new.start_date or v_prev.end_date <> new.end_date) then
    perform private.emit(new.project_id, 'task', new.task_id, v_task.ref, v_task.title, 'commitment_changed',
      jsonb_build_object('prev_start', v_prev.start_date, 'prev_end', v_prev.end_date,
                         'start', new.start_date, 'end', new.end_date,
                         'baseline_end', v_base.end_date, 'slip_days', new.end_date - v_base.end_date));
  else
    perform private.emit(new.project_id, 'task', new.task_id, v_task.ref, v_task.title, 'commitment_made',
      jsonb_build_object('start', new.start_date, 'end', new.end_date, 'recommit', v_prev.id is not null));
  end if;
  return null;
end
$$;
create trigger task_commitments_event after insert on public.task_commitments
  for each row execute function private.commitment_event();

-- ---------------------------------------------------------------------------------------
-- Other events
-- ---------------------------------------------------------------------------------------

create function private.blocker_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  if tg_op = 'INSERT' then
    perform private.emit(new.project_id, 'task', new.task_id, v_task.ref, v_task.title, 'blocker_raised',
      jsonb_build_object('blocker', new.id, 'reason', new.reason, 'need', new.need,
        'from', (select pe.display_name from public.people pe where pe.id = new.needed_from_person_id),
        'function', (select f.name from public.functions f where f.id = new.needed_from_function_id),
        'target', new.target_date));
  else
    if new.ask_id is not null and old.ask_id is null then
      perform private.emit(new.project_id, 'task', new.task_id, v_task.ref, v_task.title, 'blocker_escalated',
        jsonb_build_object('blocker', new.id, 'ask', (select a.ref from public.asks a where a.id = new.ask_id)));
    end if;
    if new.resolved_at is not null and old.resolved_at is null then
      perform private.emit(new.project_id, 'task', new.task_id, v_task.ref, v_task.title, 'blocker_resolved',
        jsonb_build_object('blocker', new.id, 'reason', new.reason, 'resolution', new.resolution,
                           'days', (new.resolved_at::date - new.raised_at::date)));
    end if;
  end if;
  return null;
end
$$;
create trigger task_blockers_event after insert or update on public.task_blockers
  for each row execute function private.blocker_event();

create function private.decision_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms public.milestones;
  v_ask public.asks;
  v_meta jsonb := jsonb_build_object('note', new.note, 'decider', new.decider_name, 'forum', new.forum,
                                     'decided_on', new.decided_on, 'decision', new.id);
begin
  if new.kind = 'gate' then
    select * into v_ms from public.milestones where id = new.milestone_id;
    perform private.emit(new.project_id, 'milestone', new.milestone_id, v_ms.ref, v_ms.title,
      case new.status when 'lulus' then 'gate_passed' when 'stop' then 'gate_stopped' else 'gate_rescoped' end, v_meta);
  elsif new.kind = 'project' then
    perform private.emit(new.project_id, 'project', new.project_id, null,
      (select p.name from public.projects p where p.id = new.project_id),
      case new.status when 'selesai' then 'project_closed' when 'dihentikan' then 'project_stopped' else 'project_reopened' end, v_meta);
  else
    select * into v_ask from public.asks where id = new.ask_id;
    perform private.emit(new.project_id, 'ask', new.ask_id, v_ask.ref, v_ask.question,
      case new.status when 'decided' then 'decision_made' else 'decision_reopened' end,
      v_meta || jsonb_build_object('rationale', new.rationale));
  end if;
  return null;
end
$$;
create trigger decisions_event after insert on public.decisions
  for each row execute function private.decision_event();

create function private.ask_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.emit(new.project_id, 'ask', new.id, new.ref, new.question, 'decision_requested',
    jsonb_build_object('due', new.due, 'decider', (select pe.display_name from public.people pe where pe.id = new.decider_person_id)));
  return null;
end
$$;
create trigger asks_event after insert on public.asks
  for each row execute function private.ask_event();

create function private.member_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := (select pe.display_name from public.people pe where pe.id = coalesce(new.person_id, old.person_id));
begin
  if tg_op = 'INSERT' then
    perform private.emit(new.project_id, 'member', new.person_id, null, v_name, 'member_added', jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' then
    perform private.emit(old.project_id, 'member', old.person_id, null, v_name, 'member_removed', jsonb_build_object('role', old.role));
  elsif new.role is distinct from old.role then
    perform private.emit(new.project_id, 'member', new.person_id, null, v_name, 'member_role_changed',
                         jsonb_build_object('role', new.role, 'from', old.role));
  end if;
  return null;
end
$$;
create trigger project_members_event after insert or update or delete on public.project_members
  for each row execute function private.member_event();

create function private.comment_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.task_id is not null then
    perform private.emit(new.project_id, 'task', new.task_id, (select t.ref from public.tasks t where t.id = new.task_id),
      (select t.title from public.tasks t where t.id = new.task_id), 'comment_added',
      jsonb_build_object('comment', new.id, 'excerpt', left(new.body, 140)));
  else
    perform private.emit(new.project_id, 'ask', new.ask_id, (select a.ref from public.asks a where a.id = new.ask_id),
      (select a.question from public.asks a where a.id = new.ask_id), 'comment_added',
      jsonb_build_object('comment', new.id, 'excerpt', left(new.body, 140)));
  end if;
  return null;
end
$$;
create trigger comments_event after insert on public.comments
  for each row execute function private.comment_event();

create function private.project_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.emit(new.id, 'project', new.id, new.code, new.name, 'project_created', '{}'::jsonb);
  return null;
end
$$;
create trigger projects_event after insert on public.projects
  for each row execute function private.project_event();

-- Comments are append-only; blockers keep their history.
create function private.comments_immutable() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Deleting a person nulls the author id (ON DELETE SET NULL); the text and time stay.
  if new.author_person_id is null and (to_jsonb(new) - 'author_person_id') = (to_jsonb(old) - 'author_person_id') then
    return new;
  end if;
  raise exception 'Komentar tidak bisa diubah.' using errcode = '42501';
end
$$;
create trigger comments_no_update before update on public.comments
  for each row execute function private.comments_immutable();

-- A blocker "needed from" person must belong to the project, so they can see it.
create function private.blockers_integrity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.needed_from_person_id is not null
     and (tg_op = 'INSERT' or new.needed_from_person_id is distinct from old.needed_from_person_id)
     and private.person_role(new.needed_from_person_id, new.project_id) is null then
    raise exception 'Orang yang dibutuhkan harus anggota project ini.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger task_blockers_integrity before insert or update on public.task_blockers
  for each row execute function private.blockers_integrity();

-- Audit trail for the new project tables, as for the phase-1 ones.
create trigger task_blockers_activity after insert or update or delete on public.task_blockers
  for each row execute function private.log_activity();
create trigger comments_activity after insert or update or delete on public.comments
  for each row execute function private.log_activity();
create trigger ask_tasks_activity after insert or update or delete on public.ask_tasks
  for each row execute function private.log_activity();
create trigger functions_activity after insert or update or delete on public.functions
  for each row execute function private.log_activity();

-- ---------------------------------------------------------------------------------------
-- Backfill from the latest-state columns (what can be reconstructed, and no more)
-- ---------------------------------------------------------------------------------------

select set_config('app.quiet_events', 'on', true);

-- A rejection older than the current submission: its evidence was overwritten before history
-- existed, so the round is kept with that fact stated instead of invented evidence.
insert into public.task_reviews (project_id, task_id, round, submitted_by, submitted_at, evidence,
                                 reviewer_person_id, reviewed_at, verdict, feedback)
select t.project_id, t.id, 1, null, t.rejected_at, '(Bukti putaran ini tidak tersimpan: ditimpa sebelum riwayat pemeriksaan aktif.)',
       t.rejected_by, t.rejected_at, 'rejected', t.reject_reason
  from public.tasks t
 where t.rejected_at is not null and (t.submitted_at is null or t.rejected_at < t.submitted_at);

insert into public.task_reviews (project_id, task_id, round, submitted_by, submitted_at, evidence,
                                 reviewer_person_id, reviewed_at, verdict, feedback)
select t.project_id, t.id,
       1 + (case when t.rejected_at is not null and t.rejected_at < t.submitted_at then 1 else 0 end),
       t.submitted_by, t.submitted_at, coalesce(t.evidence, ''),
       case when t.stage = 'done' then t.accepted_by
            when t.rejected_at >= t.submitted_at then t.rejected_by end,
       case when t.stage = 'done' then t.accepted_at
            when t.rejected_at >= t.submitted_at then t.rejected_at end,
       case when t.stage = 'done' then 'accepted'
            when t.stage = 'review' then null
            when t.rejected_at >= t.submitted_at then 'rejected'
            else 'withdrawn' end,
       case when t.stage <> 'done' and t.rejected_at >= t.submitted_at then t.reject_reason end
  from public.tasks t
 where t.submitted_at is not null;

insert into public.task_commitments (project_id, task_id, start_date, end_date, committed_by, committed_at)
select t.project_id, t.id, t.start_date, t.end_date, t.committed_by, coalesce(t.committed_at, now())
  from public.tasks t where t.committed;

insert into public.decisions (project_id, milestone_id, kind, status, note, recorded_by, recorded_at,
                              decider_name, forum, decided_on, ask_id)
select a.project_id, a.milestone_id, 'ask', 'decided', coalesce(a.answer, ''), a.decided_by, coalesce(a.decided_at, now()),
       a.decider_name, a.forum, a.decided_on, a.id
  from public.asks a where a.status = 'decided';

select set_config('app.quiet_events', '', true);

-- ---------------------------------------------------------------------------------------
-- Access: read with the project; writes only through RPCs and triggers.
-- ---------------------------------------------------------------------------------------

alter table public.ask_tasks enable row level security;
alter table public.task_reviews enable row level security;
alter table public.task_commitments enable row level security;
alter table public.task_blockers enable row level security;
alter table public.comments enable row level security;
alter table public.project_events enable row level security;
alter table public.migration_flags enable row level security;

grant select on public.ask_tasks, public.task_reviews, public.task_commitments, public.task_blockers,
  public.comments, public.project_events, public.migration_flags to authenticated;

create policy ask_tasks_read on public.ask_tasks for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy task_reviews_read on public.task_reviews for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy task_commitments_read on public.task_commitments for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy task_blockers_read on public.task_blockers for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy comments_read on public.comments for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy project_events_read on public.project_events for select to authenticated
  using (project_id in (select private.readable_project_ids()));
-- Migration notes are working notes for the people who plan the project.
create policy migration_flags_read on public.migration_flags for select to authenticated
  using (private.is_project_admin(project_id));

grant execute on function private.is_project_admin(uuid) to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_super_admin(), private.is_project_admin(uuid), private.can_contribute(uuid),
  private.readable_project_ids(), private.visible_person_ids(), private.contact_visible(uuid),
  private.current_person_id(), private.member_role(uuid), private.can_read_project(uuid) to authenticated;
