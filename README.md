# SAMB Project Board

A multi-user web app for running SAMB Group projects with per-project access control. Each person sees and acts only on the projects they belong to. It ports the reviewed single-file prototype in `reference/prototype.html` to a Supabase backend, where access is enforced in Postgres.

The spec is [`BRIEF.md`](BRIEF.md). Where the brief says nothing, the prototype's behaviour is the spec.

> **Confidential.** This repository holds staff names and internal plan content. It must stay private. Never commit `.env` files or keys.

## Status

Work proceeds gate by gate (BRIEF §10). Each gate waits for the owner's sign-off before the next one starts.

| # | Milestone | Status |
|---|---|---|
| M0 | Repo scaffold, CI, `.env.example`, README | In review |
| M1 | Schema, RLS, workflow RPCs, triggers | Not started |
| M2 | Domain port with golden parity | Not started |
| M3 | Invite-only magic-link auth, owner admin | Not started |
| M4 | UI parity on Realtime data | Not started |
| M5 | Seed import, Vercel preview | Not started |
| M6 | Daily digest, dry run | Not started |

## Stack

- Client: Vite, React, TypeScript, Tailwind CSS, TanStack Query, Supabase Realtime.
- Backend: Supabase (Postgres, Auth, RLS, RPC, Edge Functions, `pg_cron`), in a dedicated Supabase project used only for SAMB data.
- Hosting: Vercel.

## Getting started

Prerequisites: Node 22.12 or newer (see `.nvmrc`) and Docker (for the local Supabase stack).

```sh
npm install
cp .env.example .env.local    # then fill in the values
npm run db:start              # local Supabase; prints the local URL and keys
npm run dev                   # http://localhost:5173
```

The browser build uses the publishable key only. The service-role key is for server-side scripts and Edge Functions. It must never be put in a `VITE_` variable or under `src/`. A test enforces this.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run lint` | ESLint with type-aware rules, zero warnings allowed |
| `npm run typecheck` | `tsc -b` across the app and tooling configs |
| `npm test` | Vitest (runs in `Asia/Jakarta`, like the golden file) |
| `npm run check` | Lint, typecheck and tests in one go |
| `npm run db:start` / `db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Recreate the local database from `supabase/migrations` |
| `npm run db:test` | Run the pgTAP suite in `supabase/tests/database` |

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request. It has two jobs:

- **app**: checks that no `.env` file is tracked, then runs lint, typecheck, Vitest and the production build.
- **db**: starts a local Supabase Postgres with the Supabase CLI pinned in `package.json`, applies the migrations, and runs `supabase test db`.

The pgTAP suite opens with a schema-wide guard. It fails if any table in `public` lacks row-level security, if `anon` holds any table privilege, or if a view could bypass RLS. The access matrix A1–A17 (BRIEF §3) joins it in M1. Golden parity (BRIEF §9) joins Vitest in M2.

## Layout

```
src/                     React client
  components/            UI components
  lib/supabase.ts        the single browser Supabase client
supabase/
  config.toml            local stack configuration
  migrations/            schema, RLS, RPCs and triggers (from M1)
  tests/database/        pgTAP tests
tests/                   Vitest suites that read the reference package
reference/               frozen prototype, golden outputs, e-mail runner (read-only spec)
seed/                    data exported from the prototype on 6 Oct 2026, plus holidays, entities and the step template
```

## Security rules

These rules come from BRIEF §2:

1. Every table has RLS enabled, and `anon` reads nothing.
2. Workflow transitions go through RPCs, never direct table updates.
3. Hiding something in the UI is never the access control.
4. Stored text is untrusted. It is rendered as text, and only `http(s)` URLs are linkified.
