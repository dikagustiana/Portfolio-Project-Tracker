# Deploying SAMB Project Board

This is the M5 runbook. Steps 1–3 need the owner; the rest can be done by the owner or by Claude Code once a Supabase project exists. Nothing here is secret: keys go into the Supabase and Vercel dashboards, never into the repository.

## 0. Before anything

**Make the GitHub repository private** (Settings → General → Danger Zone → Change visibility). It holds staff names and internal plan content (BRIEF §2.1).

## 1. Supabase project (owner)

The project must be new and used only for SAMB data (BRIEF §2.2).

- On the free plan an account can have only two active projects. Choose one: upgrade the organization to Pro, pause an unused project, or create the project under a SAMB-owned account.
- Create it in region **Southeast Asia (Singapore), `ap-southeast-1`**, named `samb-project-board`.

## 2. Auth settings (owner, Supabase dashboard → Authentication)

| Setting | Value |
|---|---|
| Sign In / Providers → Email | **enabled** (magic links need it) |
| Allow new users to sign up | **off** (invite-only; the database also refuses unknown e-mails) |
| URL Configuration → Site URL | `https://project-tracker.dikagustiana.com` |
| URL Configuration → Redirect URLs | `https://project-tracker.dikagustiana.com/**`, plus `http://localhost:5173/**` for development |
| SMTP Settings | a company mailbox or relay. Without it, Supabase only e-mails members of the Supabase team, so colleagues will not receive login links. Until then, use **Admin → Orang → Buat link** and pass the link on by hand. |

## 3. Vercel project (owner, or Claude Code with the Vercel connector)

1. **Add New → Project**, import `Portfolio-Project-Tracker`. Vercel detects Vite from `vercel.json`; leave the build settings as they are.
2. Environment variables for Production and Preview:
   - `VITE_SUPABASE_URL` = Project URL (Supabase → Project Settings → API)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable key (`sb_publishable_…`)

   Without them the app still deploys and shows a "not configured yet" notice. After adding or changing them, redeploy: Vite bakes them in at build time.
3. Never add the service-role or secret key to Vercel.
4. **Settings → Domains → Add** `project-tracker.dikagustiana.com`. The DNS for `dikagustiana.com` is managed at Hostinger, so add the record Vercel shows there: hPanel → Domains → DNS / Nameservers → add a **CNAME**, name `project-tracker`, target the value Vercel shows (usually `cname.vercel-dns.com`). Vercel issues the HTTPS certificate once the record resolves, usually within minutes.

## 4. Database

```sh
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                      # applies supabase/migrations in order
npx supabase functions deploy invite-person
npx supabase functions deploy daily-digest   # verify_jwt=false from config.toml: it checks callers itself
```

## 5. Seed import (BRIEF §7)

Use the session-pooler connection string from Supabase → Connect. Pass the owner's own login e-mail; the others can be filled in later under Admin → Orang.

```sh
node scripts/import-seed.ts run --db-url "<connection string>" --owner-email <owner e-mail>
```

The script prints the verification report and exits non-zero on any mismatch. It is idempotent: re-running updates planning fields from the export and never resets workflow state.

## 6. Daily digest schedule (M6)

Run once in the SQL editor. The values come from Project Settings → API and stay in Vault.

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/daily-digest', 'digest_function_url');
select vault.create_secret('<service role key>', 'digest_service_key');
update public.org_settings set app_url = 'https://project-tracker.dikagustiana.com';
```

The `daily-digest` cron job (weekdays, 07.00 WIB) was created by the migration. With `email_provider = 'none'` it only writes `email_log`.

## 7. First sign-in

1. In Supabase → Authentication → Users, choose **Invite user** with the owner's e-mail. Supabase can e-mail members of its own team without SMTP.
2. When that login is created it links to the imported person Dika, and the owner role granted in step 5 becomes active.
3. In the app, open **Admin → Orang**: fill in colleagues' e-mails, then **Undang** or **Buat link**.
4. Open **Admin → Akses project**: for example, David gets Margin Bridge and MAM only.

## 8. Checks after deploy

- [ ] Signed in as the owner, Margin Bridge looks as in the prototype (13 milestones, 59 tasks, 8 open asks).
- [ ] A colleague granted two projects sees exactly those two.
- [ ] Admin → Pengaturan shows the digest in dry-run mode, and `email_log` gets a row after 07.00 WIB on a weekday.
- [ ] Freeze the prototype artifact (read-only) and add a pointer to the new app (BRIEF §13).
