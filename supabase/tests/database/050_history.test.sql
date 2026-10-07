-- History is kept, not overwritten (docs/ARCHITECTURE.md §F): events, review rounds,
-- commitment baselines and the decision log. Fixture: _fixture.psql.
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- ---------------------------------------------------------------------------------------
-- Review rounds: submit → reject → resubmit → accept keeps both submissions
-- ---------------------------------------------------------------------------------------
select pg_temp.login('muti');
select lives_ok($$ select public.submit_task(pg_temp.t('muti'), 'https://drive.example/v1') $$, 'Muti submits round 1');
select pg_temp.login('david');
select lives_ok($$ select public.review_task(pg_temp.t('muti'), 'reject', 'Total belum tie ke TB') $$, 'David rejects round 1');
select pg_temp.login('muti');
select lives_ok($$ select public.submit_task(pg_temp.t('muti'), 'https://drive.example/v2') $$, 'Muti submits round 2');
select pg_temp.login('david');
select lives_ok($$ select public.review_task(pg_temp.t('muti'), 'accept') $$, 'David accepts round 2');

select is((select string_agg(round || ':' || evidence || ':' || coalesce(verdict, '-') || ':' || coalesce(feedback, '-'), ' | ' order by round)
             from public.task_reviews where task_id = pg_temp.t('muti')),
  '1:https://drive.example/v1:rejected:Total belum tie ke TB | 2:https://drive.example/v2:accepted:-',
  'both rounds are kept with their own evidence, verdict and feedback');
select ok((select bool_and(submitted_by = pg_temp.p('muti') and reviewer_person_id = pg_temp.p('david') and reviewed_at is not null)
             from public.task_reviews where task_id = pg_temp.t('muti')),
  'each round records who submitted, who reviewed and when');
select is((select evidence from public.tasks where id = pg_temp.t('muti')), 'https://drive.example/v2',
  'the task itself still shows the latest evidence (current state unchanged)');

select lives_ok($$ select public.reopen_task(pg_temp.t('muti')) $$, 'David reopens the accepted task');
select ok((select reopened_at is not null and reopened_by = pg_temp.p('david') from public.task_reviews
            where task_id = pg_temp.t('muti') and round = 2), 'the accepted round records that it was reopened, and by whom');
select pg_temp.login('muti');
select lives_ok($$ select public.submit_task(pg_temp.t('muti'), 'https://drive.example/v3') $$, 'Muti submits round 3');
select lives_ok($$ select public.withdraw_submission(pg_temp.t('muti')) $$, '… and withdraws it');
select is((select verdict from public.task_reviews where task_id = pg_temp.t('muti') and round = 3), 'withdrawn',
  'a withdrawn round stays in the history');
select is((select count(*) from public.task_reviews where task_id = pg_temp.t('muti')), 3::bigint, 'three rounds, none overwritten');

-- ---------------------------------------------------------------------------------------
-- Commitment baseline survives rescheduling
-- ---------------------------------------------------------------------------------------
select pg_temp.login('yani');
select lives_ok($$ select public.commit_task_dates(pg_temp.t('yani'), '2026-10-07', '2026-10-10') $$, 'Yani commits 10 Okt');
select pg_temp.login('dika');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'end_date', '2026-10-17')) $$,
  'the deadline moves (commitment cleared)');
select pg_temp.login('yani');
select lives_ok($$ select public.commit_task_dates(pg_temp.t('yani'), null, null) $$, 'Yani commits the new date, 17 Okt');

select is((select string_agg(end_date::text, ',' order by seq) from public.task_commitments where task_id = pg_temp.t('yani')),
  '2026-10-10,2026-10-17', 'both commitments are kept; the first is the baseline');
select is((select (meta ->> 'slip_days')::int from public.project_events
            where object_id = pg_temp.t('yani') and verb = 'commitment_changed'), 7,
  'the change is an event with original 10 Okt, current 17 Okt, slip 7 days');
select is((select meta ->> 'baseline_end' from public.project_events where object_id = pg_temp.t('yani') and verb = 'commitment_changed'),
  '2026-10-10', '… and names the baseline');
select ok(exists (select 1 from public.project_events where object_id = pg_temp.t('yani') and verb = 'commitment_cleared'),
  'clearing the commitment by a reschedule is an event too');

-- ---------------------------------------------------------------------------------------
-- Event stream: readable, attributed, immutable
-- ---------------------------------------------------------------------------------------
select pg_temp.login('vera');
select is((select string_agg(verb, ',' order by id) from public.project_events
            where object_id = pg_temp.t('muti') and verb like 'task_%'),
  'task_created,task_submitted,task_rejected,task_submitted,task_accepted,task_reopened,task_submitted,task_withdrawn',
  'a viewer reads the full lifecycle of a task in order');
select is((select actor_name from public.project_events where object_id = pg_temp.t('muti') and verb = 'task_rejected'), 'David',
  'events name the actor');
select is((select object_ref from public.project_events where object_id = pg_temp.t('muti') and verb = 'task_accepted'), 'MB01',
  'events carry the record''s short id');
select throws_ok($$ update public.project_events set verb = 'task_created' $$, '42501', null, 'a viewer cannot change events');
reset role;
select throws_ok($$ update public.project_events set actor_name = 'x' $$, '42501', null, 'nobody can change events');

-- A gate decision, a Keputusan decision and its reopening are events and decision-log rows.
reset role;
update public.tasks set stage = 'done' where milestone_id = pg_temp.ms('MB-G2');
select pg_temp.login('david');
select lives_ok($$ select public.decide_gate(pg_temp.ms('MB-G2'), 'lulus', 'Pilot jalan', 'Pak Sponsor', 'Weekly review', '2026-10-12') $$,
  'David (pemutus) passes G2');
select is((select meta ->> 'decider' from public.project_events where object_id = pg_temp.ms('MB-G2') and verb = 'gate_passed'),
  'Pak Sponsor', 'gate_passed event keeps the actual decider');
select is((select actor_name from public.project_events where object_id = pg_temp.ms('MB-G2') and verb = 'gate_passed'),
  'David', '… and the recorder separately');

select pg_temp.login('dika');
select lives_ok($$ select public.decide_ask(pg_temp.ask('MB'), 'Pallet-days', '', 'Weekly review', null, 'Data pallet sudah ada') $$,
  'Dika decides K01 with a rationale');
select lives_ok($$ select public.reopen_ask(pg_temp.ask('MB'), 'Data CBM baru tersedia') $$, '… and reopens it');
select lives_ok($$ select public.decide_ask(pg_temp.ask('MB'), 'CBM') $$, '… and decides again');
select is((select string_agg(status || ':' || note, ' | ' order by recorded_at, id) from public.decisions where ask_id = pg_temp.ask('MB')),
  'decided:Pallet-days | reopened:Data CBM baru tersedia | decided:CBM', 'the decision log keeps every decision on K01');
select is((select rationale from public.decisions where ask_id = pg_temp.ask('MB') and note = 'Pallet-days'), 'Data pallet sudah ada',
  'the rationale is kept with the decision');
select is((select string_agg(verb, ',' order by id) from public.project_events where object_id = pg_temp.ask('MB')),
  'decision_requested,decision_made,decision_reopened,decision_made', 'Keputusan events, from the request on');

-- ---------------------------------------------------------------------------------------
-- Role changes do not rewrite history
-- ---------------------------------------------------------------------------------------
reset role;
update public.project_members set role = 'viewer' where project_id = pg_temp.prj('MB') and person_id = pg_temp.p('david');
select is((select recorded_by from public.decisions where milestone_id = pg_temp.ms('MB-G2') and status = 'lulus'), pg_temp.p('david'),
  'demoting David keeps him as the recorder of the G2 decision');
select is((select actor_person_id from public.project_events where object_id = pg_temp.t('muti') and verb = 'task_rejected'), pg_temp.p('david'),
  '… and as the actor of his rejection');
select is((select reviewer_person_id from public.task_reviews where task_id = pg_temp.t('muti') and round = 1), pg_temp.p('david'),
  '… and as the reviewer of round 1');
select ok(exists (select 1 from public.project_events where object_id = pg_temp.p('david') and verb = 'member_role_changed'
                   and meta ->> 'from' = 'project_admin' and meta ->> 'role' = 'viewer'), 'the role change itself is an event');
delete from public.project_members where project_id = pg_temp.prj('MB') and person_id = pg_temp.p('david');
select ok(exists (select 1 from public.project_events where object_id = pg_temp.t('muti') and actor_person_id = pg_temp.p('david')),
  'removing his access keeps his events');

-- Quiet bulk loads stay out of the feed.
select set_config('app.quiet_events', 'on', true);
insert into public.tasks (project_id, title, start_date, end_date) values (pg_temp.prj('MB'), 'Impor massal', '2026-10-07', '2026-10-08');
select set_config('app.quiet_events', '', true);
select is((select count(*) from public.project_events where object_title = 'Impor massal'), 0::bigint, 'quiet inserts write no events');

select * from finish();
rollback;
