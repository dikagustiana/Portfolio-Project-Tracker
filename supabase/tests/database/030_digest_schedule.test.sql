-- Daily digest schedule (BRIEF §10 M6): weekdays at org_settings.email_time WIB via pg_cron.
begin;
create extension if not exists pgtap with schema extensions;

select * from no_plan();

select is((select schedule from cron.job where jobname = 'daily-digest'), '0 0 * * 1-5',
  'the digest runs on weekdays at 07.00 WIB (00.00 UTC)');
select is((select command from cron.job where jobname = 'daily-digest'), 'select private.invoke_daily_digest()',
  'the job calls the Edge Function through pg_net');

update public.org_settings set email_time = '06:30';
select is((select schedule from cron.job where jobname = 'daily-digest'), '30 23 * * 0-4',
  'an earlier send time moves to the previous UTC day, still Monday–Friday in Jakarta');
update public.org_settings set email_time = '07:00';
select is((select schedule from cron.job where jobname = 'daily-digest'), '0 0 * * 1-5', 'changing back restores the schedule');

select is((select count(*) from vault.secrets where name in ('digest_function_url', 'digest_service_key')), 0::bigint,
  'no endpoint or key is stored in migrations');
select is(private.invoke_daily_digest(), null::bigint, 'without Vault secrets the job does nothing');

select * from finish();
rollback;
