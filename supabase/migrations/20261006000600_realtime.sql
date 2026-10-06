-- Live updates (BRIEF §2.3). Realtime checks each subscriber's SELECT policies before sending a
-- change, so the RLS above also governs what streams. Contact details, roles and logs are not
-- published; the client refetches them after its own admin writes.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

alter publication supabase_realtime add table
  public.projects, public.project_members, public.people, public.milestones, public.tasks,
  public.task_deps, public.task_steps, public.asks, public.decisions, public.reminders,
  public.holidays, public.entities, public.step_templates, public.template_steps,
  public.org_settings, public.user_calendar;
