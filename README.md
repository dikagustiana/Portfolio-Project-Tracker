# SAMB Project Board

A multi-user web app for running SAMB Group projects with per-project access control. Each person sees and acts only on the projects they belong to. It ports the reviewed single-file prototype in `reference/prototype.html` to a Supabase backend, where access is enforced in Postgres.

The spec is [`BRIEF.md`](BRIEF.md). Where the brief says nothing, the prototype's behaviour is the spec. Deployment steps are in [`docs/deploy.md`](docs/deploy.md). The generated list of tables, policies and RPCs is in [`docs/access-policies.md`](docs/access-policies.md).

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
| M6 | Daily digest, dry run | Done locally | Edge Function run for a workday and a holiday matches the golden digest |

## Stack

- Client: Vite, React 19, TypeScript, Tailwind CSS 4 (utilities only; the prototype's reviewed CSS is ported verbatim in `src/styles/board.css`), TanStack Query, Supabase Realtime.
- Backend: Supabase (Postgres, Auth, RLS, RPC, Edge Functions, `pg_cron`), in a dedicated project used only for SAMB data.
- Hosting: Vercel (`vercel.json` sets security headers).

## How access works

- `anon` can do nothing.
- Signed-in users can **read** project data only for projects they are members of. The owner and group viewers can read everything.
- Every **write** to project data goes through a `SECURITY DEFINER` RPC. Each RPC checks visibility, the project lock and the caller's role. The rules are in BRIEF §3 and §5.
- People, memberships, entities, holidays, templates and settings are written only by the owner.
- Logins are by invitation only. Public sign-up is off, and the database also refuses to create a login for an e-mail that is not on file.
- Realtime events only trigger refetches, so every row still arrives through RLS.

## Getting started

Prerequisites: Node 22.12 or newer and Docker.

```sh
npm install
npm run db:start                     # local Supabase; copy the URL and keys it prints
cp .env.example .env.local           # fill VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
node scripts/import-seed.ts run --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --owner-email dika@samb.test --email m-david=david@samb.test --email m-muti=muti@samb.test --email m-yani=yani@samb.test
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
| Domain | `tests/golden-parity.test.ts`, `domain-*.test.ts` | Every prototype rule reproduces the golden file. Switches and permissions are covered too. |
| Database | `supabase/tests/database/*.test.sql` | Access matrix A1–A17, workflow rules, triggers, schema guard, digest schedule |
| Integration | `tests/integration/*.test.ts` (needs a local stack) | The seed round-trips to the golden file. A PM sees no other project's rows over REST, RPC or Realtime. The digest dry run matches the golden digest. |
| Browser | `e2e/*.spec.ts` (Playwright, local stack) | The owner grants two projects and the person sees exactly those. The task form saves the chosen pemeriksa. An officer commits and submits, and the pemeriksa accepts. |

CI (`.github/workflows/ci.yml`) runs three jobs on every push:
1. Lint, typecheck, Vitest, build, and the Deno check.
2. pgTAP, db lint, and a check that the policy report is current.
3. The integration and browser suites against a local Supabase stack, including the seed verification report.

## Layout

```
src/domain/          prototype rules as pure TypeScript (also used by the Edge Function)
src/data/            Supabase rows → domain, table loading, Realtime, typed RPC wrappers
src/app/             shell, sidebar, routing, dialogs host, shared UI pieces, flows
src/views/           Dashboard, Minggu ini, Tim, Project, Admin
src/modals/          dialogs (task, review, gate, ask, close, wizard, …)
supabase/migrations/ schema, access, triggers, RPCs, reference data, Realtime, auth, digest schedule
supabase/functions/  invite-person, daily-digest (+ _shared/email.ts EmailProvider)
supabase/tests/      pgTAP
scripts/             seed import, reference data, local sign-in links, access report
reference/, seed/    frozen prototype package and seed data (read-only spec)
```

## Decisions taken while the open questions were pending

These defaults are listed for the owner to confirm or change. Each is a small change in one place.

1. **Accept, reject and reopen** belong to the task's effective validator. A PM may act for a validator who has no login. Nobody else may, not even the owner or the PIC.
2. **Asks** are decided by their pemutus, or by a PM acting for a pemutus without a login. Only PMs record asks.
3. **Light mode:** the PIC may tick their own task done. BRIEF §2.5 applies to gated projects.
4. **Officers** change their own task's dates only by committing them (`commit_task_dates`). They don't edit other fields.
5. **Cuti bersama as workday** also removes the holiday flags and warnings on those days. The Gantt still shades them.
6. **Deleting:** PMs delete tasks, milestones and asks; only the owner deletes a project or creates one with the wizard. The wizard adds the memberships it implies: the PM and the pemeriksa become PMs, PICs become officers.
7. **The PIC** must be a PM or officer member of the project.
8. **Gate decisions** can be taken by any PM member of the project. "Project PM" in BRIEF §5 is read as any PM member, which test A5 requires.
