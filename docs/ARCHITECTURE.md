# Architecture and decision record

SAMB Project Board is SAMB's **system of record for commitments, evidence and decisions** on its
transformation projects. Structured execution (ownership, commitments, evidence, validation, gates,
blockers, decisions, history, access) lives here. Working artefacts (models, decks, notes, folders)
stay outside and are referenced by link.

This document is the decision record for the second architecture pass (October 2026). It was
written before the code changed, then kept in step with what was built. `BRIEF.md` remains the
phase-1 spec; where this document differs, this document is the later decision by the owner.

---

## A. Earlier findings that were verified against the repository

| # | Finding | Evidence in the repo before this pass |
|---|---|---|
| A | Execution structure is trapped in prose. | The 59 seed tasks carry **120 inchstone lines** (`MB05.1 · …` + `Bukti: … · Fungsi → Fungsi · tanggal · Dep: … · Kalau meleset: …`), **161 prerequisite references** in `Prasyarat (acceptance only, boleh jalan paralel): …` lines, **101 `Dep:` references** between inchstones, and an `Owner (fungsi)` line per package naming 12 business functions. Only 3 dependencies (`task_deps`) were structured. |
| B | Records are not addressable. | `src/app/ui.ts` routes only `#/p/<uuid>/<tab>`; tasks, gates and asks open through modal state (`flows.openTask`, `openGate`, `openAsk`). The digest links to the app root. |
| C | History is latest-state. | `submit_task` overwrites `evidence`/`submitted_at`; `review_task` overwrites `reject_reason`; `commit_task_dates` and `save_task` overwrite dates and commitment; `reopen_ask` clears the answer. `activity_log` keeps raw row images, owner-only. |
| D | Surfaces re-implement the same questions. | Dashboard, Minggu ini, Tim and the digest each compute "late", "mine" and workload with their own filters; only `inbox()` is shared. |
| E | Progress is accepted tasks / all tasks. | `rules.prog()`. |
| F | Owner function is missing as structure. | Only `people.job_title` (free text) and the prose `Owner (fungsi)` line. |
| G | Officers cannot say "I am blocked". | No blocker concept; the officer RPCs are commit, start, submit, withdraw. |
| H | Judgment is tied to the PM role. | Triggers require pemeriksa, pemutus and ask deciders to be `pm` members (BRIEF §3). |

## B. Findings that changed

None of the findings above had been fixed. Two details were sharper than the earlier report:
- The prerequisites are all explicitly **acceptance-only** ("boleh jalan paralel"), while the
  inchstone `Dep:` references are finish-to-start. The two dependency types map one-to-one.
- `people.job_title` of every seeded person equals the business function they own packages for
  (Dika: Project Finance, David: GM, Muti: Accounting, Yani: Commercial), so person → function
  can be migrated by exact match.

## C. Target object model

| Object | Table | Notes |
|---|---|---|
| Person | `people` (+ `people_contact`) | May exist without a login. `function_id` = primary business function. |
| Account | `profiles` | One row per login: `user_id`, `system_role` (`super_admin` \| `user`). Replaces `app_roles`. |
| Function | `functions` | Org reference data (Accounting, Commercial, …). Written by super admin. |
| Project | `projects` | New immutable `code` (e.g. `MB`). |
| Membership | `project_members` | `project_role`: `project_admin` \| `member` \| `viewer` (renamed from `pm`/`officer`/`viewer`). |
| Gate / milestone | `milestones` | New immutable `ref` (e.g. `G3`). |
| Task | `tasks` | New `ref`, `parent_task_id` (one level), `owner_function_id`. |
| Dependency | `task_deps` | New `kind`: `start` (finish-to-start) \| `accept` (acceptance only). Same project only. |
| Value-chain step | `task_steps` | Unchanged; a child task without its own steps inherits its parent's. |
| Keputusan | `asks` | New `ref`, `context`, `options`, `recommendation`, `rationale`; `ask_tasks` links affected tasks. |
| Decision log | `decisions` | Immutable; now also records ask decisions and reopenings (`kind = 'ask'`). |
| Review round | `task_reviews` | One row per submission: evidence, submitter, reviewer, verdict, feedback. |
| Commitment history | `task_commitments` | One row per commitment; the first row is the baseline. |
| Blocker | `task_blockers` | At most one open per task; resolve/escalate keeps the row. |
| Comment | `comments` | On tasks and Keputusan only. Append-only. |
| Event | `project_events` | Human-readable, project-scoped, append-only, written by triggers. |
| Audit | `activity_log` | Unchanged forensic row log. |
| Invitation | `invitations`, `invitation_projects` | Lifecycle `pending` → `accepted` \| `revoked` \| `expired`. |
| Migration flag | `migration_flags` | Uncertain mappings found while extracting structure from prose. |

## D. Permission model

**System role** (`profiles.system_role`): `super_admin` sees and administers everything;
`user` sees only projects with a membership. `group_viewer` is retired: its holders (if any) get an
explicit `viewer` membership on every existing project, so nobody loses access silently and every
grant becomes visible in the access matrix.

**Core rule: no membership = the project does not exist.** Every project-scoped table is filtered by
`private.can_read_project()` in RLS; every RPC answers "not found" (P0002) for a project the caller
cannot read, exactly as for a missing one. Search, counts, people, events and digests are built
from RLS-filtered rows, so restricted projects cannot enter them.

**Project role** (`project_members.role`):

| Role | Can |
|---|---|
| `project_admin` | Plan (tasks, gates, Keputusan), close/stop/reopen, send reminders, manage `member`/`viewer` access to this project and invite people to it. |
| `member` | Work on items they hold: commit, start, submit, withdraw; create and edit sub-tasks under their own task; raise and resolve blockers on their tasks; raise Keputusan; comment. Can be PIC, pemeriksa, pemutus or decider. |
| `viewer` | Read only. |

The super admin acts as `project_admin` everywhere. Granting or removing `project_admin` is
super-admin only; a project admin never gains rights outside their project and cannot change
their own role.

**Record-level rights** stay separate from project roles:

| Right | Who |
|---|---|
| Validate (accept/reject/reopen) | The task's effective pemeriksa, or a project admin acting for a pemeriksa without a login. **Never the PIC.** |
| Decide a gate | The gate's effective pemutus, or a project admin recording the decision for the forum (with decider, forum and date attribution). |
| Decide a Keputusan | Its effective decider, or a project admin acting for a decider without a login. |
| Commit / submit / withdraw | The PIC, or a project admin acting for a PIC without a login. |

Pemeriksa, pemutus and deciders must be `project_admin` **or `member`** (no longer only PM); never
a viewer. Effective pemeriksa: task's own → parent task's effective pemeriksa (sub-tasks) →
gate pemutus → project PM. The project PM (`projects.pm_person_id`) must be a `project_admin`.

## E. Progress

- **Unit = leaf task**: a task with no sub-tasks. A parent with sub-tasks is a package; its own
  row is never counted as a unit.
- `progress = accepted leaves / all leaves`, rounded to a whole percent. No effort weighting.
- A gate is `siap` when every task in it (packages included) is accepted. A package can only be
  submitted or accepted once all its sub-tasks are accepted.
- Value-chain step progress uses the leaves whose effective steps include the step.
- Commitment is per leaf: a package with sub-tasks needs no commitment of its own.
- Late, workload and "Kerja saya" counts use leaves too, so a package and its sub-tasks are not
  counted twice.
- One implementation (`src/domain/rules.ts`, `prog`/`leaves`) drives the sidebar, portfolio,
  header, Beranda, reports and the value chain. Projects without sub-tasks compute exactly as
  before (golden parity holds).

## F. Event and history model

- `project_events (project_id, object_type, object_id, object_ref, object_title, verb, actor, at, meta)`
  is written only by `SECURITY DEFINER` triggers on tasks, blockers, decisions, asks, memberships,
  comments, commitments and projects, so every write path produces the same history. Rows are
  immutable. Bulk imports set `app.quiet_events = on` to stay out of the feed.
- Verbs: `task_created`, `task_started`, `task_submitted`, `task_withdrawn`, `task_accepted`,
  `task_completed`, `task_rejected`, `task_reopened`, `task_deleted`, `pic_changed`,
  `commitment_made`, `commitment_changed`, `commitment_cleared`, `blocker_raised`,
  `blocker_resolved`, `blocker_escalated`, `gate_passed`, `gate_stopped`, `gate_rescoped`,
  `decision_requested`, `decision_made`, `decision_reopened`, `project_created`,
  `project_closed`, `project_stopped`, `project_reopened`, `member_added`,
  `member_role_changed`, `member_removed`, `comment_added`.
- `task_reviews` and `task_commitments` are maintained by the same triggers from task state
  changes, so a resubmission or rescheduling appends instead of overwriting. Slip =
  latest committed end − first committed end.
- `activity_log` stays the forensic log and is not merged with events.

## G. Routing and short IDs

| Record | Short ID policy | Route |
|---|---|---|
| Project | `code`: from task-ID prefix or name initials, 2–6 letters, unique, immutable (`MB`) | `#/p/MB` (`#/p/MB/<tab>`) |
| Task | `ref`: legacy id if any (`MB12`, `TB-OKT`); new top-level `<CODE><nn>` (next number); sub-task `<parent>.<n>` | `#/p/MB/t/MB12` |
| Gate | `ref`: legacy id (`G3`); new `<prefix><n>` following the project's existing prefix, default `M` | `#/p/MB/g/G3` |
| Keputusan | `ref`: legacy id (`K01`); new `K<nn>` | `#/p/MB/k/K01` |

Refs are unique per project and never change. The display code of a gate is its editable `code`,
else its `ref`. UUID routes (`#/p/<uuid>`) still resolve. A list click opens the record in a
**side peek** (`?peek=` in the hash, so refresh keeps it); a direct URL opens the **full record**.
Both render the same `RecordView`.

## H. View-spec architecture

`src/domain/views.ts` defines product-owned views as data (source, filter, sort, group, columns,
layout, empty state) evaluated by one function over the RLS-filtered board:
`perlu-tindakan`, `kerja-saya`, `milik-fungsi`, `menunggu`, `minggu-ini`, `blocked`,
`waiting-review`, `keputusan-menunggu`, `portfolio`, `project-tasks`, `milestone-tasks`,
`unstaffed`. A count shown anywhere is the length of the view it opens. The sidebar badge,
Beranda, Minggu ini and the digest all read `perlu-tindakan` (the digest keeps its golden text by
building on the same `inbox()` the view extends). No user-defined views yet.

## I. Migration plan

Additive migrations on top of the phase-1 ones (`supabase/migrations/202610070001xx_*.sql`):

1. **Roles**: create `profiles`; `owner` → `super_admin`; `group_viewer` → explicit viewer
   memberships; `pm` → `project_admin`, `officer` → `member`; bootstrap `dika.g.irawan@gmail.com`
   as super admin (pending until that login exists). Drop `app_roles`/`pending_app_roles`.
2. **Structure**: `functions`, codes and refs (backfilled deterministically), `parent_task_id`,
   `task_deps.kind`, title limit 200.
3. **History**: events, reviews, commitments, blockers, comments, Keputusan fields, decision log
   for asks; backfill current review rounds, commitments and decided asks.
4. **RPCs**: every write RPC rewritten for the new role model; new RPCs for blockers, comments,
   membership, invitations, sub-tasks.
5. **Extraction**: `private.extract_structure(project)` parses inchstones, prerequisites, `Dep:`
   lines, `Record: K..` links and owner functions out of task descriptions, idempotently. It runs
   for existing projects in the migration and after the seed import. What it cannot map
   reliably goes to `migration_flags`, never into invented data. Descriptions are kept verbatim.

## J. Implementation sequence

Foundation (database, tests) → domain (types, progress, views, search, routes) → record view,
peek and routes → Beranda, Portofolio, Minggu ini, Keputusan, Tinjauan → project tabs (Keputusan,
Aktivitas, Anggota) → blockers, comments, contextual creation → invitations, access matrix,
people cleanup → scripts, Edge Functions, e2e, docs → visual QA → second-pass review.

## K. Explicit decisions

| Question | Decision | Why |
|---|---|---|
| Who may validate | Effective pemeriksa (any `project_admin` or `member`, never a viewer), or a project admin for a pemeriksa without login. Never the PIC (constraint + RPC). | Spec §18 separates administration from judgment; PIC ≠ pemeriksa is kept everywhere. |
| Who may decide | Gate: effective pemutus, or a project admin recording for the forum with attribution. Keputusan: effective decider, or a project admin for a decider without login. | Keeps the phase-1 "PM records the forum's decision" practice (test A5) while letting non-admin pemutus decide. |
| Project admins manage membership | Yes, for `member`/`viewer` in their own projects, including invitations. `project_admin` grants stay with the super admin. | Spec §22; conservative on who can create new administrators. |
| Dependency types | `start` (cannot start or be submitted before the prerequisite is accepted) and `accept` (may run in parallel, cannot be accepted before the prerequisite is accepted). | Matches the workbook's two kinds exactly. |
| Cross-project dependencies | **Forbidden** (composite foreign key). Cross-project coordination goes through Keputusan or a blocker "needed from" a function. | Keeps project isolation and "no membership = does not exist" provable. |
| Sub-task progress | Leaves only; packages count through their sub-tasks; a package is accepted only after all its sub-tasks. | Spec §10, §12. |
| Sub-task PIC on migration | The package's PIC when the inchstone's function equals the package's function (or reads "Owner paket"); otherwise unassigned and owned by its function. | Uses only the app's own accountable person; no names are guessed. |
| Blocker semantics | An overlay on the task, not a stage. One open blocker per task with reason, need, optional person/function and target date. PIC or project admin raise it; PIC, project admin, raiser or the person it is needed from resolve it. "Angkat menjadi Keputusan" creates a linked Keputusan. | Spec §42; history kept as rows and events. |
| Invitation semantics | An invitation resolves to one person (existing by e-mail, else created). Project assignments apply to memberships **immediately** (a person without a login can already be planned with but cannot sign in). The invitation governs the login: pending (14 days) → accepted on first login, or revoked/expired. Revoking a pending invitation also removes the memberships it granted that were not changed since, and deletes a login only if the invitation itself created it and it was never used. Existing accounts are not re-invited; their memberships are updated. Removing access never deletes the person, the login, history or attribution. | Spec §19–21; one person record, explicit opt-in, meaningful revoke. |
| Who holds login links | A login link is a key to the account. The super admin may create one for anyone. A Project Admin only for their **own** pending invitation of someone **within reach**: every membership of that person is Member/Viewer in a project the caller administers, and the person holds no system role, granted or pending (`private.login_within_reach`, re-checked when the link is made and when revoking). Addresses reserved for a system role are invited by the super admin only. Inviting an existing address may still reveal that it exists (low risk; documented). | Security review: without this, a Project Admin could take over accounts in other projects or a pending super admin. |
| Switching the review flow off | Only the super admin may turn `gate_mode` off; anyone who administers the project may turn it on. | In light mode the PIC ticks their own work done; toggling it off and on again would bypass the pemeriksa. |
| Retired `group_viewer` | Converted to explicit viewer memberships. | Spec §14 core rule. |
| Comments | Append-only (no edit/delete) in this pass. | Audit simplicity; mentions later. |
| Drafts | A task may be saved without PIC, pemeriksa or requested proof ("Draf"); commit needs a PIC; submission needs a PIC and requested proof. | Spec §47. |
| Short ids on insert | `code`/`ref` columns default to `''` and the insert trigger always replaces an empty value, so writers (RPCs, imports, tests) may omit them and the generated insert types say so. Once assigned they never change. | Addresses must be stable; the database owns numbering under an advisory lock. |
| Deleting a person | Allowed for the super admin. Ids in append-only history are cleared (`ON DELETE SET NULL`); events keep the actor's name snapshot, comments keep text and time. | History is a record of what happened; it must survive staff changes. |
| Append-only history | `project_events`, `decisions`, `task_commitments` and `comments` cannot be updated, deleted or truncated, by any role. The only changes allowed come from foreign keys: clearing a reference to a deleted person, milestone or Keputusan, and cascading deletes when the project or record the history belongs to is deleted (`private.history_append_only`). | Audit trail; enforced in the database, not by grants alone. |
| Packages in the UI | A package (task with sub-tasks) is not started or paused by hand and cannot be submitted, by button or checkbox, until all its sub-tasks are accepted. | Its work happens in the sub-tasks; the database already refuses it. |
| "Menunggu orang lain" | Lists what the person waits on from others: review, blockers, Keputusan they raised, and prerequisites owned by **someone else**. A prerequisite they own themselves is their own work and appears under Kerja saya instead. | Real-data QA showed people "waiting on themselves". |
| Titles that repeat their id | Imported titles such as "K01 · Sahkan …" are shown without the leading id where the id is already shown as a tag. Stored text is not changed. | Readability without rewriting source data. |
| Daily e-mail text | The plain-text digest keeps the prototype's format (titles, no ids) so it stays comparable with the golden file; the HTML version links every line to its record. | Golden parity for the text; addresses where they help. |
| Seed import | Runs quietly (no "task created" events), sets the project code `MB`, Project Admin/Member roles, the super admin by e-mail, then the structure extraction. Re-running replaces only what the export holds (finish-to-start links between exported tasks, their steps) and leaves derived structure alone. | Idempotent and verifiable: `import-seed.ts run` prints the counts it expects. |
