-- M1 · Schema (BRIEF §4). UUID keys; prototype ids kept in legacy_id.
-- Cross-row integrity that a CHECK cannot express (membership roles, same-project links,
-- cycles) lives in triggers (…_triggers.sql). Access lives in …_access.sql.

create extension if not exists citext with schema extensions;

create schema if not exists private;
comment on schema private is 'Internal helpers for RLS and RPCs. Not exposed through the Data API.';

-- ---------------------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------------------

create table public.entities (
  code text primary key check (code ~ '^[A-Za-z][A-Za-z0-9_-]{0,15}$'),
  label text not null check (length(label) between 1 and 80),
  legal_name text check (length(legal_name) <= 200),
  sort int not null default 0
);

create table public.holidays (
  date date primary key,
  type text not null check (type in ('libur', 'cuti')),
  name text not null check (length(name) between 1 and 120),
  source text not null default '' check (length(source) <= 500)
);

create table public.step_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.step_templates (id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_-]{0,31}$'),
  label_no text not null default '' check (length(label_no) <= 8),
  name text not null check (length(name) between 1 and 80),
  need text not null default '' check (length(need) <= 500),
  kind text not null check (kind in ('chain', 'output', 'side')),
  sort int not null default 0,
  unique (template_id, code),
  unique (id, template_id)
);

create table public.org_settings (
  id boolean primary key default true check (id),
  cuti_bersama_is_workday boolean not null default false,
  email_paused boolean not null default false,
  email_time time not null default '07:00',
  timezone text not null default 'Asia/Jakarta',
  email_provider text not null default 'none' check (email_provider in ('none', 'graph')),
  -- Link to the app used in e-mails and calendar entries (owner sets it after deploy).
  app_url text not null default '' check (length(app_url) <= 300)
);
insert into public.org_settings default values;

-- ---------------------------------------------------------------------------------------
-- People and access
-- ---------------------------------------------------------------------------------------

create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  job_title text not null default '' check (length(job_title) <= 120),
  user_id uuid unique references auth.users (id) on delete set null,
  email_daily boolean not null default true,
  legacy_id text unique,
  created_at timestamptz not null default now()
);

-- Split from people so RLS can hide addresses (BRIEF §3).
create table public.people_contact (
  person_id uuid primary key references public.people (id) on delete cascade,
  email extensions.citext not null unique check (email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create table public.app_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'group_viewer')),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null check (length(btrim(name)) between 1 and 80),
  entity_code text not null references public.entities (code) on update cascade,
  outcome text not null default '' check (length(outcome) <= 2000),
  measure text not null default '' check (length(measure) <= 2000),
  pm_person_id uuid references public.people (id) on delete set null,
  status text not null default 'aktif' check (status in ('aktif', 'selesai', 'dihentikan')),
  maturity text not null default 'release' check (maturity in ('prototype', 'release', 'decision', 'bau')),
  gate_mode boolean not null default true,
  parallel_gates boolean not null default false,
  color text not null default 'samb3' check (color in ('samb1', 'samb2', 'samb3', 'samb4', 'teal', 'slate')),
  step_template_id uuid references public.step_templates (id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.people (id) on delete set null,
  close_note text check (length(close_note) <= 5000),
  close_decider_name text check (length(close_decider_name) <= 80),
  close_forum text check (length(close_forum) <= 120),
  close_decided_on date,
  created_at timestamptz not null default now(),
  created_by uuid references public.people (id) on delete set null
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role text not null check (role in ('pm', 'officer', 'viewer')),
  primary key (project_id, person_id)
);
create index project_members_person_idx on public.project_members (person_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  legacy_id text,
  code text check (length(code) <= 12),
  title text not null check (length(btrim(title)) between 1 and 140),
  target date,
  criteria text not null default '' check (length(criteria) <= 5000),
  trigger text not null default '' check (length(trigger) <= 5000),
  fallback text not null default '' check (length(fallback) <= 5000),
  approver_person_id uuid references public.people (id) on delete set null,
  mode text not null default 'slow' check (mode in ('slow', 'fast')),
  sort_order int not null default 0,
  status text check (status in ('lulus', 'stop')),
  last_decision text check (last_decision in ('lulus', 'rescope', 'stop')),
  created_at timestamptz not null default now(),
  unique (project_id, legacy_id),
  unique (id, project_id)
);
create index milestones_project_idx on public.milestones (project_id, sort_order);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid,
  legacy_id text,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 20000),
  start_date date not null,
  end_date date not null,
  assignee_person_id uuid references public.people (id) on delete set null,
  validator_person_id uuid references public.people (id) on delete set null,
  proof_requested text not null default '' check (length(proof_requested) <= 2000),
  stage text not null default 'todo' check (stage in ('todo', 'progress', 'review', 'done')),
  committed boolean not null default false,
  committed_at timestamptz,
  committed_by uuid references public.people (id) on delete set null,
  evidence text check (length(evidence) <= 20000),
  submitted_at timestamptz,
  submitted_by uuid references public.people (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references public.people (id) on delete set null,
  reject_reason text check (length(reject_reason) <= 5000),
  rejected_at timestamptz,
  rejected_by uuid references public.people (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.people (id) on delete set null,
  constraint tasks_dates_ordered check (end_date >= start_date),
  -- BRIEF §3: the pemeriksa is never the PIC (access test A13).
  constraint tasks_validator_not_assignee check (validator_person_id is null or validator_person_id is distinct from assignee_person_id),
  constraint tasks_commit_needs_assignee check (not committed or assignee_person_id is not null),
  constraint tasks_milestone_same_project foreign key (milestone_id, project_id)
    references public.milestones (id, project_id) on delete set null (milestone_id),
  unique (project_id, legacy_id),
  unique (id, project_id)
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_milestone_idx on public.tasks (milestone_id);
create index tasks_assignee_idx on public.tasks (assignee_person_id);

-- Finish-to-start dependencies; both ends in the same project (BRIEF §3).
create table public.task_deps (
  project_id uuid not null,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  primary key (task_id, depends_on_task_id),
  constraint task_deps_not_self check (task_id <> depends_on_task_id),
  constraint task_deps_task_fk foreign key (task_id, project_id)
    references public.tasks (id, project_id) on delete cascade,
  constraint task_deps_dep_fk foreign key (depends_on_task_id, project_id)
    references public.tasks (id, project_id) on delete cascade
);
create index task_deps_dep_idx on public.task_deps (depends_on_task_id);

create table public.task_steps (
  task_id uuid not null references public.tasks (id) on delete cascade,
  template_step_id uuid not null references public.template_steps (id) on delete cascade,
  primary key (task_id, template_step_id)
);

create table public.asks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid,
  legacy_id text,
  question text not null check (length(btrim(question)) between 1 and 2000),
  decider_person_id uuid references public.people (id) on delete set null,
  due date,
  status text not null default 'open' check (status in ('open', 'decided')),
  answer text check (length(answer) <= 10000),
  decided_at timestamptz,
  decided_by uuid references public.people (id) on delete set null,
  decider_name text not null default '' check (length(decider_name) <= 80),
  forum text not null default '' check (length(forum) <= 120),
  decided_on date,
  created_at timestamptz not null default now(),
  created_by uuid references public.people (id) on delete set null,
  constraint asks_milestone_same_project foreign key (milestone_id, project_id)
    references public.milestones (id, project_id) on delete set null (milestone_id),
  unique (project_id, legacy_id)
);
create index asks_project_idx on public.asks (project_id);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid,
  kind text not null check (kind in ('gate', 'project')),
  status text not null,
  note text not null default '' check (length(note) <= 10000),
  recorded_by uuid references public.people (id) on delete set null,
  recorded_at timestamptz not null default now(),
  decider_name text not null default '' check (length(decider_name) <= 80),
  forum text not null default '' check (length(forum) <= 120),
  decided_on date,
  constraint decisions_status_by_kind check (
    (kind = 'gate' and status in ('lulus', 'rescope', 'stop'))
    or (kind = 'project' and status in ('aktif', 'selesai', 'dihentikan'))
  ),
  constraint decisions_milestone_same_project foreign key (milestone_id, project_id)
    references public.milestones (id, project_id) on delete set null (milestone_id)
);
create index decisions_project_idx on public.decisions (project_id, recorded_at desc);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid,
  to_person_id uuid references public.people (id) on delete set null,
  message text not null check (length(btrim(message)) between 1 and 5000),
  note text check (length(note) <= 500),
  status text not null default 'menunggu' check (status in ('menunggu', 'terkirim', 'gagal', 'dibatalkan')),
  created_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint reminders_task_same_project foreign key (task_id, project_id)
    references public.tasks (id, project_id) on delete set null (task_id)
);
create index reminders_task_idx on public.reminders (task_id);

-- ---------------------------------------------------------------------------------------
-- E-mail, calendar, audit
-- ---------------------------------------------------------------------------------------

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  provider text not null,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index email_log_run_date_idx on public.email_log (run_date desc);

-- Private per user, like the prototype's CAL: the deadline and title as added, so the app can
-- tell the user when a deadline moved or the task disappeared. No FK on task_id on purpose:
-- the row must outlive the task to report "Task ini sudah dihapus".
create table public.user_calendar (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  provider text check (provider in ('google', 'outlook365')),
  end_date date not null,
  title text not null check (length(title) <= 200),
  added_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

-- Append-only audit trail, written by triggers (BRIEF §6.8).
create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb
);
create index activity_log_table_row_idx on public.activity_log (table_name, row_id);
