# SAMB Project Board — build brief for Claude Code

Owner: Dika (Project Finance, SAMB Group). Package prepared 6 Oct 2026.

This package turns a working single-file prototype into a multi-user web app with real per-project access control. The prototype's behaviour is already reviewed and in use. Your job is to port it faithfully, add a proper backend, and enforce access in the database.

---

## 0. Start here

### Package contents

| Path | What it is |
|---|---|
| `BRIEF.md` | This document. The spec. |
| `reference/prototype.html` | The live prototype (Claude artifact). **Behavioural spec**: when this brief is silent, match the prototype. Opens offline in a browser (local mode, data in `localStorage`). |
| `reference/email-runner.js` | How the prototype composes the daily e-mail digest: it runs the page's own `GPM.digestAll()` so the e-mail uses exactly the same rules as the "Minggu ini" page. Keep that principle. |
| `reference/golden/prototype-golden.json` | Golden outputs of the prototype's domain functions on the seed data, with the clock fixed at `2026-10-07T08:00:00+07:00`. Your domain port must reproduce these (section 9). |
| `seed/board-export.json` | Full export of the prototype's database on 6 Oct 2026: 1 project, 13 milestones, 59 tasks, 8 asks, 4 members. Decisions, reminders, settings and e-mail log are empty. |
| `seed/holidays.json` | Indonesian national holidays (libur) and collective leave (cuti bersama) for 2026–2027, from the SKB 3 Menteri, with source per year. |
| `seed/entities.json` | The 13 entity codes (11 from the prototype + MAM + Group). |
| `seed/step-template-trading-samb.json` | The "Trading SAMB" value-chain template from the Margin Bridge kick-off deck, page 4. |

### First message to Claude Code

> Read `BRIEF.md` end to end, then open `reference/prototype.html` and skim its `<script>`. Restate in your own words: the access model (section 3), the workflow state machine (section 5), and the build gates (section 10). List anything in the brief that contradicts the prototype. Then start milestone M0 only, and stop at its gate.

---

## 1. Outcome and scope

**Outcome:** one app where the owner runs every SAMB Group project, and each colleague sees and acts only on the projects they are a member of.

The first concrete case:
- Pak David sees Project Margin Bridge and MAM, and nothing else.
- The owner later adds BMG, KGR, NMG and other projects that David must not receive.

**Phase 1 (this brief):**
- Schema, row-level security (RLS) and workflow RPCs.
- Domain logic port with parity tests.
- Invite-only magic-link login.
- Owner admin screens.
- Full UI parity with the prototype.
- Seed import and a Vercel deployment.
- E-mail digest in preview and dry-run mode (nothing is sent).

**Phase 2 (backlog, do not build now):**
- Sending the digest and manual reminders through Outlook (Microsoft Graph).
- Microsoft (Entra ID) login.

Both need an app registration and admin consent from SAMB IT (section 11).

**Out of scope:** native mobile apps, AI features, file uploads (evidence stays as text or links), and editing the source Excel.

---

## 2. Hard constraints

1. **Private repository.** It contains names of SAMB staff and internal plan content. Never make it public. Never commit `.env`. Ship a `.env.example`.
2. **New, dedicated Supabase project.** Do not reuse any existing Supabase project the owner has (Personal OS, dikagustiana.com). SAMB data stays separate.
3. **Stack**, matching the owner's other projects:
   - Vite + React + TypeScript + Tailwind on the client.
   - Supabase: Postgres, Auth, RLS, RPC, Edge Functions, `pg_cron`.
   - Hosting on Vercel.
   - TanStack Query plus Supabase Realtime for live updates. The prototype is live-synced; keep that feel.
4. **Security lives in Postgres.** Every table has RLS enabled. `anon` reads nothing.
   - The client never holds the service-role key.
   - Hiding something in the UI is never the control. It may be a convenience on top of RLS.
5. **Workflow transitions go through RPCs** (section 5), not direct table updates. An officer must not be able to set their own task to `done` by any route.
6. **UI language is Bahasa Indonesia.** Reuse the prototype's wording, which has been reviewed.
   - Dates are in `Asia/Jakarta` and display as `id-ID` (`7 Okt 2026`).
   - Numbers use period for thousands and comma for decimals.
7. **Treat stored text as untrusted.** Task descriptions, evidence and answers are rendered as text. Linkify `http(s)` URLs only, as the prototype does with `linkify()`.

---

## 3. Users, roles and access

### Roles

| Level | Role | Can |
|---|---|---|
| App | `owner` | Everything across all projects. Only role that manages people, memberships, entities, holidays, templates and settings. The owner (Dika) is the one who grants access. |
| App | `group_viewer` | Read-only on every project. Intended for group principals; who gets it is an open decision (section 12). |
| Project | `pm` | Plan the project (milestones, tasks, asks), act as pemeriksa (validator) and pemutus (approver), decide gates and asks, close/stop/reopen the project, send reminders. |
| Project | `officer` | See the project. On tasks where they are PIC: commit dates, move todo↔progress, submit with evidence. |
| Project | `viewer` | Read-only on that project. |

A person can hold different roles on different projects, for example PM on Margin Bridge and nothing on BMG.

### People are not the same as login users

The prototype supports team members who never log in: the PM commits and acts on their behalf (`canCommit`, `canAct`). Keep this with two tables:
- `people`: named persons, optionally linked to `auth.users` via `user_id`.
- `project_members`: person × project × role.

Tasks, asks and approvals point at `people`, not at auth users.

### Rules the database must enforce

- **Validator.** A task's validator (pemeriksa) must be a `pm` member of that project and must not be the task's assignee (PIC). The prototype allows the fallback validator `validatorOf(t)` (validator → milestone approver → project PM); keep that fallback in the domain layer.
- **Approver.** A milestone approver (pemutus) and an ask's decider must be a `pm` member of the project, or null (null means the project PM).
- **Dependencies.** Task dependencies may only point at tasks in the same project.
- **E-mail addresses** of people are readable only by the owner and by PMs of a project the person belongs to. Everyone else sees name and job title only.

### Required access test matrix (pgTAP, run with `supabase test db`)

Fixture:
- Owner Dika.
- David is `pm` on Margin Bridge and on MAM.
- Muti and Yani are `officer` on Margin Bridge.
- A BMG project has no David, Muti or Yani.
- One `viewer` on Margin Bridge.
- One anonymous session.

| # | Actor | Action | Expected |
|---|---|---|---|
| A1 | David | select tasks/milestones/asks/decisions of BMG | 0 rows |
| A2 | David | select projects | exactly Margin Bridge + MAM |
| A3 | David | select people | only people sharing MB or MAM with him; e-mails visible only for people on projects where he is PM |
| A4 | David | insert task into BMG | denied |
| A5 | David | `decide_gate` on an MB milestone | allowed |
| A6 | Muti | `commit_task_dates` on her own MB task | allowed |
| A7 | Muti | `commit_task_dates` on Yani's task | denied |
| A8 | Muti | direct `update tasks set stage='done'` on her own task | denied |
| A9 | Muti | `review_task` on any task | denied |
| A10 | Muti | read people e-mails | denied |
| A11 | Viewer | any write on MB | denied |
| A12 | Anonymous | select from every table | 0 rows |
| A13 | Owner | set validator = assignee | rejected by constraint/trigger |
| A14 | Anyone | update or delete `activity_log` | denied |
| A15 | Owner | select everything | allowed |
| A16 | A PM who is not the task's validator | `reopen_task` on an accepted task | denied |
| A17 | Validator | `review_task` on a task where they are also the PIC | denied |

---

## 4. Data model (target schema)

Use UUID primary keys. Keep the prototype's ids in `legacy_id` (for example `MB01`, `G3`, `K04`, `m-dika`) for traceability back to the source workbook.

```
entities(code pk, label, legal_name null, sort)
people(id, display_name, job_title, user_id null unique → auth.users, email_daily bool default true, legacy_id, created_at)
people_contact(person_id pk → people, email citext unique)          -- split out so RLS can hide it
app_roles(user_id → auth.users, role in ('owner','group_viewer'))
projects(id, legacy_id, name, entity_code → entities, outcome, measure, pm_person_id → people,
         status in ('aktif','selesai','dihentikan'), maturity in ('prototype','release','decision','bau'),
         gate_mode bool default true, parallel_gates bool default false, color text,
         step_template_id null → step_templates,
         closed_at, closed_by → people, close_note, close_decider_name, close_forum, close_decided_on,
         created_at, created_by)
project_members(project_id, person_id, role in ('pm','officer','viewer'), primary key(project_id, person_id))
milestones(id, project_id, legacy_id, code null, title, target date null, criteria, trigger, fallback,
           approver_person_id null, mode in ('slow','fast'), sort_order int,
           status null | 'lulus' | 'stop', last_decision, created_at)
tasks(id, project_id, milestone_id null, legacy_id, title, description, start_date, end_date,
      assignee_person_id null, validator_person_id null, proof_requested,
      stage in ('todo','progress','review','done'),
      committed bool, committed_at, committed_by,
      evidence, submitted_at, submitted_by,
      accepted_at, accepted_by, reject_reason, rejected_at, rejected_by, done_at, created_at)
task_deps(task_id, depends_on_task_id)                               -- finish-to-start, same project
step_templates(id, name)
template_steps(id, template_id, code, label_no, name, need, kind in ('chain','output','side'), sort)
task_steps(task_id, template_step_id)                                -- a task may sit in several steps
asks(id, project_id, milestone_id null, legacy_id, question, decider_person_id null, due date,
     status in ('open','decided'), answer, decided_at, decided_by, decider_name, forum, decided_on,
     created_at, created_by)
decisions(id, project_id, milestone_id null, kind in ('gate','project'), status, note,
          recorded_by, recorded_at, decider_name, forum, decided_on)
reminders(id, project_id, task_id, to_person_id, message, note, status, created_by, created_at, sent_at)
holidays(date pk, type in ('libur','cuti'), name, source)
org_settings(singleton: cuti_bersama_is_workday bool default false, email_paused bool, email_time '07:00',
             timezone 'Asia/Jakarta', email_provider in ('none','graph') default 'none')
email_log(id, run_date, provider, results jsonb, created_at)
user_calendar(user_id, task_id, provider, added_at)                  -- private per user, like the prototype's CAL
activity_log(id, at, actor_user_id, table_name, row_id, action, before jsonb, after jsonb)   -- append-only, via triggers
```

**Decision attribution** came out of review: the person who clicks is not always the person who decided. `decisions`, `asks` and the project close fields therefore separate:
- `recorded_by`: who clicked.
- `decider_name`, `forum`, `decided_on`: who actually decided, where, and when. Empty means the recorder decided.

The log renders this as `Pak X · Weekly review GM · 12 Okt · dicatat Dika`. See `decWho()` in the prototype.

---

## 5. Workflow rules (from the prototype; port exactly)

### Task stages

`todo → progress → review → done`. Applies when the project's `gate_mode` is true; otherwise see "light mode" below.

| Transition | RPC | Who | Effect |
|---|---|---|---|
| Commit dates | `commit_task_dates(task, start, end)` | PIC, or a PM acting for a PIC without login | `committed=true`, `committed_at`, `committed_by`. Changing start, end or PIC later clears the commitment (prototype `saveTask`). |
| Start or pause | `set_task_stage(task,'progress'\|'todo')` | PIC or PM | todo ↔ progress. The prototype does not check who; tighten it here. |
| Withdraw | `withdraw_submission(task)` | PIC (PM for a PIC without login) | review → progress (prototype: "Hanya PIC yang bisa menarik pengajuan") |
| Submit | `submit_task(task, evidence)` | PIC (PM for a PIC without login) | Requires a PIC and non-empty evidence. Sets stage `review`, `evidence`, `submitted_at`, `submitted_by`. |
| Accept | `review_task(task,'accept')` | The task's effective validator, must not be the PIC | stage `done`, `accepted_at/by`, `done_at`, clears `reject_reason` |
| Reject | `review_task(task,'reject', reason)` | Same | stage `progress`, `reject_reason`, `rejected_at/by`. The task reappears in the PIC's inbox as rejected. |
| Reopen accepted | `reopen_task(task)` | The task's effective validator only (prototype: "Task yang sudah diterima hanya bisa dibuka lagi oleh pemeriksanya") | done → progress, clears `accepted_at/by` and `done_at`; triggers gate auto-reopen if its gate was `lulus` |

**Light mode** (`gate_mode=false`): no validator and no commitment. Ticking the task toggles done ↔ progress (prototype `onCheck`).

### Milestones (gates)

`msState(m)` derives the state:
- `kosong`: no tasks.
- `jalan`: tasks still open.
- `siap`: all tasks accepted, gate ready to decide.
- An explicit status `lulus` or `stop` overrides the derived state.

Deciding a gate uses `decide_gate(milestone, decision, note, decider_name, forum, decided_on)`:

| Decision | Allowed when | Writes |
|---|---|---|
| `lulus` | Every task in the gate is accepted | status `lulus` |
| `rescope` (Ubah rencana) | Any time | status cleared, decision logged |
| `stop` | Any time | status `stop`, decision logged |

The note is mandatory. Only the approver (or project PM) may decide.

**Auto-reopen:** if a gate is `lulus` and a not-done task is added to it, or one of its tasks is reopened, the gate status clears and a `rescope` decision is logged with the note `Keputusan dibuka lagi otomatis karena …`. Implement this in the database (trigger or inside the RPCs), not in the client.

**Sequence check:** `seqConflict()` warns when a task starts on or before the end of the previous gate while that gate has not passed. Skip the check when `projects.parallel_gates` is true. See section 6, item 4.

### Asks (Keputusan dibutuhkan)

An ask carries a question, decider, due date and optional milestone. `decide_ask(ask, answer, decider_name, forum, decided_on)` sets it to `decided`. Reopening clears the answer and the attribution fields.

### Projects

| Action | Allowed when | Requires |
|---|---|---|
| `close_project` | Every milestone is `lulus` (`readyToClose`) | Evidence text against the project's `measure` |
| `stop_project` | Any time | A reason |
| `reopen_project` | After close or stop | A reason |

All three write a `decisions` row and support decider attribution. A closed or stopped project is read-only until reopened (prototype `locked()`).

### Derived views (port as pure functions in `src/domain`)

`inbox(who)`, `health(p)`, `readiness(p)`, `prog(pid)`, `currentMs(p)`, `nextSteps(p)`, `taskFlags(t,p)`, `warnings(t,p)`, `isLate`, `needsCommit`, `validatorOf`, `approverOf`, `selfAccept`, `msDate`, `msLate`, `workdays`, `isWork`, `digestFor(member,date)`, `digestAll(date)`, `vcStat(project,step)`.

Names match the prototype so you can read it side by side. Workdays exclude weekends, `libur`, and `cuti` unless `org_settings.cuti_bersama_is_workday` is true.

---

## 6. Changes versus the prototype (already decided)

1. **Real per-project access** (sections 3–4). The prototype's single global PM role becomes per-project roles.
2. **Entities are a table.** Seed 13 codes from `seed/entities.json`, including MAM (added at the owner's request) and `Group` for cross-entity projects.
3. **Value chain becomes per-project step templates.**
   - The prototype hard-codes the SAMB trading chain (`VC`, `VC_LP`). Seed it as template "Trading SAMB" and attach it to Margin Bridge.
   - A project without a template shows no Value chain tab or dashboard strip.
   - Other entities (BMG is manufacturing) will get their own templates later from the owner.
   - `kind`: `chain` renders as chevrons, `output` as the outlined Report box, `side` as a separate block (Logistics services).
4. **Per-project `parallel_gates` switch.**
   - Margin Bridge runs gates in parallel by design (G2 starts 7 Okt while G1 runs to 21 Okt). The prototype therefore flags 35 of 59 tasks with "Mulai sebelum Gx selesai".
   - Default is false. Whether Margin Bridge turns it on is open (section 12).
5. **Gate codes.** `msNo()` shows `milestones.code` (G0–G12) when set, otherwise `M1…Mn`.
6. **Holidays are a table** plus the `cuti_bersama_is_workday` setting.
   - The SKB leaves cuti bersama for private companies to company management.
   - Default false matches the prototype.
7. **Validator bug, already fixed in the prototype.** The original task modal saved the selected pemeriksa into a stray `pemeriksa` field, so changes never persisted. Add a regression test: change the validator in the task form, save, and confirm `validator_person_id` changed.
8. **Audit trail:** `activity_log` rows for every insert, update or delete on tasks, milestones, asks, decisions, projects and project_members, written by triggers and append-only.

---

## 7. Seed import

Write an idempotent import script that upserts on `legacy_id`.

| Prototype collection | Target |
|---|---|
| `members` | `people` (`display_name`=name, `job_title`=role, `email_daily`). E-mails are empty in the export; the owner fills them in admin. |
| membership (derived) | `m-dika`: app `owner` once he signs up, plus `pm` on Margin Bridge. `m-david`: `pm`. `m-yani`, `m-muti`: `officer`. |
| `projects/samb-timeline` | `projects`, name "Project Margin Bridge", entity SAMB, color `samb3`, template "Trading SAMB". Keep `legacy_id='samb-timeline'`. |
| `milestones` | `milestones` (`code` from `code`, `sort_order` from `order`) |
| `tasks` | `tasks`. `steps[]` maps to `task_steps` via template step `code`. `deps[]` maps to `task_deps`. `committed` is false for all. |
| `asks` | `asks`. K01–K08 are open; seven are due 9 Okt 2026. |
| `decisions`, `reminders`, `settings`, `emaillog` | Empty in the export; nothing to import. |

**Verification report** (the script prints this and fails on mismatch). Counts were taken from `seed/board-export.json` on 6 Oct 2026:

| Check | Expected |
|---|---|
| projects | 1 |
| milestones | 13 |
| tasks | 59 |
| tasks without milestone (TB-OKT, TB-NOV, TB-DES, TB-JAN) | 4 |
| tasks with an assignee | 39 |
| tasks with a validator | 59 |
| tasks committed | 0 |
| tasks with ≥1 step | 28 |
| `task_steps` rows | 38 |
| `task_deps` rows | 3 (TB-OKT→MB21, CAP-NOV→MB27, TB-NOV→MB27) |
| asks | 8 |
| people | 4 |
| project_members | 4 |

Task descriptions end with a source line back to `SAMB_Ganchart.xlsx` (draft rev9, 4 Okt 2026). Keep them verbatim.

---

## 8. UI parity

Port every screen of the prototype:

| Screen | Contents |
|---|---|
| Dashboard | Stat cards, entity filter, value-chain strip per project with a template, project cards with health ring, Milestone mendatang, Beban kerja tim, closed projects |
| Minggu ini | The action inbox for "me", "as someone" or "everyone"; calendar issues |
| Tim | People, roles, e-mail status, digest preview |
| Project | Header plus tabs Milestone (with "Langkah berikutnya" checklist, Keputusan dibutuhkan, Log keputusan), Value chain, Checklist, Pipeline (drag between stages), Gantt (day/week zoom, holiday and cuti shading, pale dashed bars for uncommitted dates) |
| Modals | Project wizard (planned right-to-left: outcome, then milestones as conditions, then tasks, then validator), task, gate decision, ask, close/stop/reopen, review (accept/reject), reminder, add-to-calendar links (Google/Outlook) |
| Theme | Light, dark and auto |

Open `reference/prototype.html` for layout, copy and interaction details.

### Theme tokens (from samb.co.id, as in the prototype)

| Token | Light | Dark |
|---|---|---|
| bg | `#f1f4f9` | `#0d1222` |
| surface / surface-2 | `#ffffff` / `#f5f7fb` | `#151c30` / `#1b2440` |
| ink / muted / line | `#2b3548` / `#7c88a1` / `#e2e7f0` | `#e5eaf5` / `#93a0bd` / `#26314f` |
| accent / accent-soft | `#3e55d8` / `#e7ebfc` | `#7086f2` / `#1e2852` |
| warn / warn-soft (warnings stay warm) | `#c8661a` / `#fcefe1` | `#f0a060` / `#3a2614` |
| value-chain chevron / outline text | `#2f44b8` / `#2f44b8` | `#3a50c8` / `#a9b7ff` |
| status | todo `#8a95ab`, progress = accent, review `#7656e8`, done `#109e86`, danger `#d9402f` | see prototype |

- Font: Plus Jakarta Sans.
- Project card gradients: `samb1` to `samb4` (the four blues of the samb.co.id service tiles) plus `teal` and `slate`.
- The sidebar uses the SAMB wordmark-and-swoosh SVG from the prototype. The owner may supply the official logo file later.

---

## 9. Parity testing with the golden file

`reference/golden/prototype-golden.json` was produced by loading `prototype.html` in jsdom, injecting `seed/board-export.json`, fixing `Date.now()` to `2026-10-07T08:00:00+07:00` (TZ `Asia/Jakarta`), and recording the direct return values of:

| Prototype functions | Captured for |
|---|---|
| `taskFlags`, `warnings`, `seqConflict`, `isLate`, `needsCommit`, `validatorOf`, `selfAccept`, `durDays`, `workdays` | every task |
| `msNo`, `msState`, `msDate`, `msLate`, `approverOf` | every milestone |
| `prog`, `health`, `readiness`, `currentMs`, `readyToClose` | the project |
| `inbox(who)` | everyone and each member |
| `vcStat` | every value-chain step |
| `digestFor` + `emailFor` (subject and text) per member, and `digestAll` | 2026-10-07 |
| `isWork` / `hol` | a set of edge dates around libur and cuti |
| `workdays` | three month ranges |

**Requirement:** a Vitest suite loads the same seed into your domain model, freezes the clock at the same instant, and asserts deep equality with the golden file, including the Indonesian flag and warning messages. Ids in the golden file are prototype ids (`MB01`, `G3`, `m-dika`); map through `legacy_id`. With `parallel_gates=false` and `cuti_bersama_is_workday=false`, the match must be 100%. Add separate tests for the new behaviour of those two switches.

---

## 10. Build sequence and gates

Work milestone by milestone. At every gate, stop, report what was built and the test output, and wait for the owner's go-ahead ("lanjut").

| # | Milestone | Gate (proof) |
|---|---|---|
| M0 | Repo scaffold, CI (lint, typecheck, Vitest, `supabase test db`), `.env.example`, README | CI green on an empty app |
| M1 | Schema, RLS policies, workflow RPCs, triggers (auto-reopen, constraints, activity log) | Access matrix A1–A17 passes; policy list printed for owner review |
| M2 | Domain port in `src/domain` (pure TS, no I/O) | Golden parity 100% (section 9); switch tests pass |
| M3 | Invite-only magic-link auth (public sign-up disabled), owner admin for people, memberships, entities, holidays, templates and settings | Owner can invite a person and grant MB+MAM only; that person sees only those |
| M4 | UI parity (section 8) on Realtime data | Owner walkthrough against the prototype, screen by screen |
| M5 | Seed import plus verification report (section 7), deploy to a Vercel preview | All counts match; owner signs in and sees Margin Bridge exactly as in the prototype |
| M6 | Digest phase 1: the same `digestFor`/`digestAll` code powers the UI preview and an Edge Function run by `pg_cron` at 07.00 WIB on workdays, `email_provider='none'` (writes `email_log` only) | Dry-run log for a workday and a holiday matches the golden digest |

---

## 11. Phase 2 notes (design for, do not build)

**Outlook e-mail via Microsoft Graph.** Put the sender behind an interface, `EmailProvider.send(to, subject, text, html)`.
- Graph needs an Entra ID app registration with `Mail.Send` and admin consent from the SAMB tenant (SAMB IT, Pak Yulius).
- The sending mailbox is the owner's choice.
- Keep secrets in Supabase Vault, used only by the Edge Function.

**Microsoft login:** Supabase supports the Azure provider. It is the same IT dependency.

---

## 12. Open decisions (do not guess; ask the owner)

1. **Business Plan v1 split.** Margin Bridge currently includes gates G5–G8 (16 planning tasks: MB30–MB44 plus MB47). Whether these move to a separate project "Business Plan v1" depends on decision K02. Import as-is.
2. **`parallel_gates` for Margin Bridge:** on or off.
3. **Cuti bersama as working days** at SAMB.
4. **Group viewers:** who gets `group_viewer`, if anyone.
5. **Hosting domain:** use the Vercel default URL until decided.
6. **PM-managed membership:** may PMs add officers or viewers to their own projects, or only the owner? Phase 1 is owner only.
7. **Margin Bridge measure text.** It reads "…planning closure44 required only if included in signed scope…", copied verbatim from the workbook's MB54 acceptance cell. It probably means MB44; confirm with the owner before anyone edits it.

---

## 13. Definition of done (phase 1)

- Every gate in section 10 is passed and signed off by the owner.
- The access matrix and golden parity suites run in CI on every push.
- The production deployment holds the imported Margin Bridge data and passes the verification report.
- David's account, granted Margin Bridge and MAM only, cannot obtain any row of any other project through the UI, the REST API or Realtime.
- The prototype artifact is frozen (read-only) after migration, with a pointer to the new app.
