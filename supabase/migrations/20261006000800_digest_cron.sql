-- M6 · Daily digest schedule (BRIEF §10). pg_cron calls the daily-digest Edge Function through
-- pg_net on weekdays at org_settings.email_time (WIB, default 07:00). The function itself skips
-- national holidays (and cuti bersama unless counted as workdays) and logs why.
--
-- The endpoint and key live in Vault, set once after deploy (see docs/deploy.md):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/daily-digest', 'digest_function_url');
--   select vault.create_secret('<service role key>', 'digest_service_key');
-- Without them the job runs and does nothing but warn.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function private.invoke_daily_digest() returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'digest_function_url';
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'digest_service_key';
  if v_url is null or v_key is null then
    raise warning 'daily-digest: Vault secret digest_function_url / digest_service_key belum diisi.';
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end
$$;

-- Weekday schedule in UTC for the WIB send time (WIB = UTC+7, no daylight saving). Before 07:00 WIB
-- the UTC day is the previous one, so the weekday range shifts with it.
create function private.digest_cron_expr(p_time time) returns text
language sql immutable set search_path = ''
as $$
  select format('%s %s * * %s',
    extract(minute from p_time)::int,
    (extract(hour from p_time)::int + 17) % 24,
    case when extract(hour from p_time)::int >= 7 then '1-5' else '0-4' end)
$$;

create function private.schedule_daily_digest() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_time time := coalesce((select s.email_time from public.org_settings s limit 1), '07:00');
begin
  perform cron.schedule('daily-digest', private.digest_cron_expr(v_time), 'select private.invoke_daily_digest()');
end
$$;

create function private.on_email_time_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.schedule_daily_digest();
  return null;
end
$$;
create trigger org_settings_email_time after update of email_time on public.org_settings
  for each row when (new.email_time is distinct from old.email_time)
  execute function private.on_email_time_change();

select private.schedule_daily_digest();

revoke all on all functions in schema private from public, anon;
