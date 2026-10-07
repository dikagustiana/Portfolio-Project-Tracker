# SAMB Project Board

A multi-user system of record for SAMB Group projects: commitments, evidence and decisions, with per-project access control. Each person sees and acts only on the projects they belong to; a project without your membership does not exist for you. It started as a port of the reviewed single-file prototype in `reference/prototype.html` to a Supabase backend, where access is enforced in Postgres.

The spec is [`BRIEF.md`](BRIEF.md). Where the brief says nothing, the prototype's behaviour is the spec. The architecture pass (roles, short ids and record routes, sub-tasks, typed prerequisites, history, invitations, product views) and every decision it took are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Deployment steps are in [`docs/deploy.md`](docs/deploy.md). The generated list of tables, policies and RPCs is in [`docs/access-policies.md`](docs/access-policies.md).

> **Confidential.** This repository holds staff names and internal plan content. It must be private. Never commit `.env` files or keys.

## Status

| # | Milestone | State | Proof |
|---|---|---|---|
| M0 | Repo scaffold, CI | Done | CI green |
| M1 | Schema, RLS, workflow RPCs, triggers | Done | pgTAP: access matrix A1–A17, workflow and schema guard (222 assertions); `docs/access-policies.md` |
| M2 | Domain port in `src/domain` | Done | Golden parity 100% (111 cases); switch tests |
| M3 | Invite-only magic-link auth, owner admin | Done locally | Database sign-up gate; isolation test over REST, RPC and Realtime |
| M4 | UI parity on Realtime data | Built; owner walkthrough pending | All screens and dialogs ported. Browser tests: access grant, task form pemeriksa (§6.7), commit → submit → accept |
| M5 | Seed import, Vercel preview | Import done; cloud waiting on owner | Verification report; DB round-trip matches the golden file. Cloud deploy needs a free Supabase project slot (`docs/deploy.md`) |
| M6 | Daily digest, dry run | Done locally | Edge Function run for a workday and a holiday matches the domain; the summary matches the golden digest |
| A1 | Architecture pass (docs/ARCHITECTURE.md) | Done locally; migrations not applied to any cloud project | pgTAP 550 assertions; integration 16; browser 10; unit/domain 381 |

## Stack

- Client: Vite, React 19, TypeScript, Tailwind CSS 4 (utilities only; the prototype's reviewed CSS is ported verbatim in `src/styles/board.css`), TanStack Query, Supabase Realtime.
- Backend: Supabase (Postgres, Auth, RLS, RPC, Edge Functions, `pg_cron`), in a dedicated project used only for SAMB data.
- Hosting: Vercel at `https://project-tracker.dikagustiana.com` (owner's choice for BRIEF §12.5; `vercel.json` sets security headers).

## How access works

- Two **system roles** (`profiles.system_role`): `super_admin` (the Owner; every project, administration) and `user`. The first super admin is bootstrapped by e-mail in a migration; after that the source of truth is the login's user id and its profile row. There are no e-mail checks in the client.
- Three **project roles** (`project_members.role`): `project_admin` (runs the project and manages Member/Viewer access), `member` (does the work, submits evidence, raises blockers and Keputusan), `viewer` (reads only).
- **No membership = the project does not exist.** Every table, RPC, search result, count, history line and e-mail is filtered in the database (`private.readable_project_ids()`); a direct link to a project you cannot read looks the same as one that does not exist (`P0002`).
- **Record-level judgment is not an admin power.** Who accepts a task (pemeriksa) and who decides a milestone or Keputusan (pemutus) is set on the record and may be any Project Admin or Member. The PIC never accepts their own work.
- Every **write** to project data goes through a `SECURITY DEFINER` RPC. Each RPC checks visibility, the project lock and the caller's rights. Errors: `42501` not allowed, `P0002` not found or not visible, `P0001` workflow rule, `23514` integrity.
- Logins are by **invitation** only: e-mail, optional name, projects (all unchecked) with a role each, review, send. Invitations are pending, accepted, expired (14 days) or revoked; an existing account is updated, never duplicated. Removing someone from a project keeps their account and history.
- Realtime events only trigger refetches, so every row still arrives through RLS.

## Routes

Every record has a short id (project code + number) and an address. Lists open records in a side peek; a direct link opens the full page.

| Address | Screen |
|---|---|
| `#/` · `#/minggu` · `#/keputusan` · `#/portofolio` · `#/tinjauan` · `#/orang` | Beranda, Minggu ini, Keputusan, Portofolio, Tinjauan mingguan, Orang |
| `#/p/MB` · `#/p/MB/list` · `/pipeline` · `/gantt` · `/vc` · `/keputusan` · `/aktivitas` · `/anggota` | A project and its tabs |
| `#/p/MB/t/MB05.1` · `#/p/MB/g/G3` · `#/p/MB/k/K01` | A task, milestone (gate) or Keputusan, full page |
| `…?peek=MB/t/MB05.1` | The same record in the side peek over any screen |
| `#/admin/<tab>` · `#/simulasi` | Super admin only: administration and the process simulation lab |

Quick Find (`/` or Ctrl/⌘ K) searches projects, tasks, gates, Keputusan and people you can read; an exact short id ranks first.

## Getting started

Prerequisites: Node 22.12 or newer and Docker.

```sh
npm install
npm run db:start                     # local Supabase; copy the URL and keys it prints
cp .env.example .env.local           # fill VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
node scripts/import-seed.ts run --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --owner-email dika@samb.test --email m-david=david@samb.test --email m-muti=muti@samb.test --email m-yani=yani@samb.test
# --owner-email makes that address a super admin (now, or when its login is created). The import
# also runs the structure extraction: sub-tasks, prerequisites, Keputusan links and functions.
node --env-file=.env.local scripts/dev-login.ts   # prints a one-time sign-in link per person (local only)
npm run dev                          # http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev server, production build, preview |
| `npm run lint` / `typecheck` / `test` | ESLint (type-aware, zero warnings), `tsc -b`, Vitest |
| `npm run fn:check` | Type-check the Edge Functions with Deno |
| `npm run e2e` | Playwright browser tests (local stack; set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase stack |
| `npm run db:test` | pgTAP suite (`supabase/tests/database`) |
| `npm run db:lint` | plpgsql_check over every function |
| `npm run db:report` | Regenerate `docs/access-policies.md` from the catalog |
| `npm run db:types` | Regenerate `src/data/database.types.ts` |
| `node scripts/import-seed.ts run --db-url …` | Seed import plus the BRIEF §7 verification report |
| `node scripts/reference-sql.ts` | Regenerate the reference-data migration from `seed/*.json` |

## Tests

| Layer | Where | What it proves |
|---|---|---|
| Domain | `tests/golden-parity.test.ts`, `domain-*.test.ts` | Every prototype rule reproduces the golden file. Leaf progress, packages, typed prerequisites, slip, product views, Quick Find, addresses and record-level rights (`domain-architecture.test.ts`). |
| Database | `supabase/tests/database/*.test.sql` | Access matrix, workflow rules, visibility (no membership = nothing), history and events, short ids and sub-tasks, invitations, blockers, Keputusan and comments, schema guard, digest schedule |
| Integration | `tests/integration/*.test.ts` (needs a local stack) | The exported seed round-trips to the golden file and the derived structure is intact. A Project Admin sees no other project's rows, people or history over REST, RPC or Realtime. Login links follow the invitation rules. The digest dry run matches the domain. |
| Browser | `e2e/*.spec.ts` (Playwright, local stack) | The super admin grants two projects and the person sees exactly those, everywhere. Deep links, refresh, Quick Find and the peek. Beranda by role. A Project Admin invites and revokes. A member commits and submits a sub-task and the pemeriksa accepts. A blocker becomes a Keputusan. |

CI (`.github/workflows/ci.yml`) runs three jobs on every push:
1. Lint, typecheck, Vitest, build, and the Deno check.
2. pgTAP, db lint, and a check that the policy report is current.
3. The integration and browser suites against a local Supabase stack, including the seed verification report.

## Layout

```
src/domain/          rules as pure TypeScript (also used by the Edge Function); views.ts and search.ts
                     hold the product views (Perlu tindakan, Kerja saya, …) and addressing
src/data/            Supabase rows → domain, table loading, Realtime, typed RPC wrappers
src/app/             shell, sidebar, routing (ui.ts, nav.ts), Quick Find, dialogs host, flows
src/views/           Beranda, Minggu ini, Keputusan, Portofolio, Tinjauan, Orang, Project (+ tabs),
                     record/ (one record view: side peek and full page), Admin
src/modals/          dialogs (task, gate, Keputusan, blocker, invite, close, wizard, …)
supabase/migrations/ schema, access, triggers, RPCs, reference data, Realtime, auth, digest schedule
supabase/functions/  invite-person, daily-digest (+ _shared/email.ts EmailProvider)
supabase/tests/      pgTAP
scripts/             seed import, reference data, local sign-in links, access report
reference/, seed/    frozen prototype package and seed data (read-only spec)
```

## Decisions

The architecture pass records its decisions in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §K. The earlier defaults, as they stand now:

1. **Accept, reject and reopen** belong to the task's effective pemeriksa (own → package's → gate pemutus → PM). A Project Admin may act for a pemeriksa who has no login. Nobody else may, and the PIC never.
2. **Keputusan** are raised by any Project Admin or Member and decided by their pemutus (any Project Admin or Member), or by a Project Admin acting for one without a login. The decision records who decided, in which forum and when, apart from who typed it.
3. **Light mode:** the PIC may tick their own task done. BRIEF §2.5 applies to gated projects.
4. **Members** change their own task's dates only by committing them (`commit_task_dates`). A package's PIC may plan its sub-tasks.
5. **Cuti bersama as workday** also removes the holiday flags and warnings on those days. The Gantt still shades them.
6. **Deleting:** Project Admins delete tasks, milestones and Keputusan; only the super admin creates (wizard) or deletes a project. The wizard makes the PM a Project Admin and the pemeriksa and PICs Members.
7. **The PIC** must be a Project Admin or Member of the project.
8. **Gate decisions** can be taken by the gate's pemutus or any Project Admin of the project.
