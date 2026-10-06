-- Workflow rules (BRIEF §5) and integrity triggers. Fixture: _fixture.psql.
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- ---------------------------------------------------------------------------------------
-- Task stages and review
-- ---------------------------------------------------------------------------------------
select pg_temp.login('muti');
select lives_ok($$ select public.set_task_stage(pg_temp.t('muti'), 'progress') $$, 'PIC moves todo → progress');
select lives_ok($$ select public.set_task_stage(pg_temp.t('muti'), 'todo') $$, 'PIC moves progress → todo');
select throws_ok($$ select public.submit_task(pg_temp.t('muti'), '   ') $$, 'P0001', 'Isi bukti dulu. Pemeriksa butuh sesuatu untuk dicek.',
  'submit needs evidence');
select lives_ok($$ select public.submit_task(pg_temp.t('muti'), 'https://drive.example/a') $$, 'PIC submits with evidence');
select ok((select stage = 'review' and submitted_by = pg_temp.p('muti') and evidence = 'https://drive.example/a'
             from public.tasks where id = pg_temp.t('muti')), 'submit sets review, evidence and submitted_by');
select throws_ok($$ select public.set_task_stage(pg_temp.t('muti'), 'progress') $$, 'P0001', null,
  'a task in review cannot be moved with set_task_stage');
select lives_ok($$ select public.withdraw_submission(pg_temp.t('muti')) $$, 'PIC withdraws the submission');
select is((select stage from public.tasks where id = pg_temp.t('muti')), 'progress', 'withdraw returns the task to progress');
select lives_ok($$ select public.submit_task(pg_temp.t('muti'), 'https://drive.example/b') $$, 'PIC submits again');

select pg_temp.login('david');
select throws_ok($$ select public.review_task(pg_temp.t('muti'), 'reject', '') $$, 'P0001', null, 'reject needs a reason');
select lives_ok($$ select public.review_task(pg_temp.t('muti'), 'reject', 'Total belum cocok') $$, 'validator rejects with a reason');
select ok((select stage = 'progress' and reject_reason = 'Total belum cocok' and rejected_by = pg_temp.p('david')
             from public.tasks where id = pg_temp.t('muti')), 'reject returns the task to progress with the reason');
select pg_temp.login('muti');
select lives_ok($$ select public.submit_task(pg_temp.t('muti'), 'https://drive.example/c') $$, 'PIC resubmits after rejection');
select pg_temp.login('david');
select lives_ok($$ select public.review_task(pg_temp.t('muti'), 'accept') $$, 'validator accepts');
select ok((select stage = 'done' and accepted_by = pg_temp.p('david') and reject_reason is null and done_at is not null
             from public.tasks where id = pg_temp.t('muti')), 'accept sets done, accepted_by, done_at and clears the reason');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('muti'), 'title', 'Ubah')) $$, 'P0001', null,
  'an accepted task cannot be edited in a gated project');

-- ---------------------------------------------------------------------------------------
-- Commitment
-- ---------------------------------------------------------------------------------------
select pg_temp.login('yani');
select lives_ok($$ select public.commit_task_dates(pg_temp.t('yani'), null, null) $$, 'Yani commits her dates');
select pg_temp.login('dika');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'end_date', '2026-10-13')) $$, 'PM moves the deadline');
select is((select committed from public.tasks where id = pg_temp.t('yani')), false, 'changing the dates clears the commitment');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'commit', 'on')) $$, '42501', null,
  'a PM cannot commit for a PIC who has a login');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'end_date', '2026-10-15', 'commit', 'on')) $$,
  'a PM can commit for a PIC without a login, in the same save');
select ok((select committed and committed_by = pg_temp.p('dika') from public.tasks where id = pg_temp.t('rina')),
  'commitment for the PIC without a login is recorded with the PM as committer');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'assignee_person_id', pg_temp.p('muti'))) $$,
  'PM reassigns the task');
select is((select committed from public.tasks where id = pg_temp.t('rina')), false, 'changing the PIC clears the commitment');

-- ---------------------------------------------------------------------------------------
-- Gates: decision rules and auto-reopen
-- ---------------------------------------------------------------------------------------
select throws_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'lulus', 'Semua beres') $$, 'P0001', null,
  'lulus needs every task in the gate accepted');
select throws_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'rescope', '  ') $$, 'P0001', 'Tulis catatan keputusannya.',
  'a gate decision needs a note');
reset role;
insert into public.milestones (id, project_id, code, title, sort_order)
values (pg_temp.ms('MB-G3'), pg_temp.prj('MB'), 'G3', 'Laporan pertama terbit', 3);
insert into public.tasks (id, project_id, milestone_id, title, start_date, end_date, assignee_person_id, validator_person_id, stage, done_at, accepted_at)
values (pg_temp.t('g3'), pg_temp.prj('MB'), pg_temp.ms('MB-G3'), 'Task G3', '2026-10-07', '2026-10-09', pg_temp.p('muti'), pg_temp.p('david'), 'done', now(), now());
select pg_temp.login('dika');
select lives_ok($$ select public.decide_gate(pg_temp.ms('MB-G3'), 'lulus', 'Laporan ditandatangani', 'Pak Sponsor', 'Weekly review GM', '2026-10-12') $$,
  'PM passes the gate with decider attribution');
select ok((select status = 'lulus' and last_decision = 'lulus' from public.milestones where id = pg_temp.ms('MB-G3')), 'gate is lulus');
select ok((select decider_name = 'Pak Sponsor' and forum = 'Weekly review GM' and decided_on = '2026-10-12' and recorded_by = pg_temp.p('dika')
             from public.decisions where milestone_id = pg_temp.ms('MB-G3') and status = 'lulus'),
  'the decision stores who decided, where and when, separately from who recorded it');

select pg_temp.login('david');
select lives_ok($$ select public.reopen_task(pg_temp.t('g3')) $$, 'validator reopens an accepted task in a lulus gate');
select is((select status from public.milestones where id = pg_temp.ms('MB-G3')), null, 'auto-reopen: the gate status clears');
select is((select note from public.decisions where milestone_id = pg_temp.ms('MB-G3') and status = 'rescope'),
  'Keputusan dibuka lagi otomatis karena task dibuka lagi: Task G3', 'auto-reopen logs a rescope decision (task reopened)');
select is((select recorded_by from public.decisions where milestone_id = pg_temp.ms('MB-G3') and status = 'rescope'),
  pg_temp.p('david'), 'the automatic decision is recorded under the person who reopened the task');

reset role;
update public.tasks set stage = 'done' where id = pg_temp.t('g3');
update public.milestones set status = 'lulus' where id = pg_temp.ms('MB-G3');
select pg_temp.login('dika');
select lives_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'milestone_id', pg_temp.ms('MB-G3'),
  'title', 'Task tambahan', 'start_date', '2026-10-20', 'end_date', '2026-10-21')) $$, 'PM adds a task to a lulus gate');
select is((select status from public.milestones where id = pg_temp.ms('MB-G3')), null, 'auto-reopen on a new task');
select ok(exists (select 1 from public.decisions where note = 'Keputusan dibuka lagi otomatis karena ada task baru: Task tambahan'),
  'auto-reopen logs a rescope decision (new task)');
select is((select description || '|' || proof_requested || '|' || stage from public.tasks where title = 'Task tambahan'), '||todo',
  'a new task gets the column defaults');

select lives_ok($$ select public.decide_gate(pg_temp.ms('MB-G2'), 'stop', 'Data pilot tidak tersedia') $$, 'PM stops a gate');
select is((select status from public.milestones where id = pg_temp.ms('MB-G2')), 'stop', 'gate is stopped');
select lives_ok($$ select public.decide_gate(pg_temp.ms('MB-G2'), 'rescope', 'Jalankan rencana cadangan') $$, 'PM re-decides a stopped gate');
select is((select status from public.milestones where id = pg_temp.ms('MB-G2')), null, 'rescope clears the gate status');

-- ---------------------------------------------------------------------------------------
-- Asks
-- ---------------------------------------------------------------------------------------
select pg_temp.login('david');
select throws_ok($$ select public.decide_ask(pg_temp.ask('MB'), 'Pallet-days') $$, '42501', null,
  'only the decider (project PM Dika, who has a login) decides an ask');
select pg_temp.login('dika');
select lives_ok($$ select public.decide_ask(pg_temp.ask('MB'), 'Pallet-days', 'Pak David', 'Weekly review GM', '2026-10-12') $$, 'the decider decides');
select ok((select status = 'decided' and answer = 'Pallet-days' and decider_name = 'Pak David' and decided_by = pg_temp.p('dika')
             from public.asks where id = pg_temp.ask('MB')), 'decide_ask stores the answer and attribution');
select throws_ok($$ select public.save_ask(jsonb_build_object('id', pg_temp.ask('MB'), 'question', 'x')) $$, 'P0001', null,
  'a decided ask cannot be edited');
select lives_ok($$ select public.reopen_ask(pg_temp.ask('MB')) $$, 'the decider reopens the ask');
select ok((select status = 'open' and answer is null and decided_at is null and decider_name = '' and forum = '' and decided_on is null
             from public.asks where id = pg_temp.ask('MB')), 'reopening clears the answer and the attribution');
select pg_temp.login('muti');
select throws_ok($$ select public.save_ask(jsonb_build_object('project_id', pg_temp.prj('MB'), 'question', 'Boleh?')) $$, '42501', null,
  'an officer cannot record asks');

-- ---------------------------------------------------------------------------------------
-- Integrity: memberships, dependencies, steps
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'assignee_person_id', pg_temp.p('vera'))) $$,
  '23514', null, 'a viewer cannot be PIC');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'assignee_person_id', pg_temp.p('bimo'))) $$,
  '23514', null, 'a non-member cannot be PIC');
select throws_ok($$ select public.save_milestone(jsonb_build_object('id', pg_temp.ms('MB-G2'), 'approver_person_id', pg_temp.p('muti'))) $$,
  '23514', null, 'an officer cannot be pemutus');
select throws_ok($$ select public.save_ask(jsonb_build_object('id', pg_temp.ask('MB'), 'decider_person_id', pg_temp.p('bimo'))) $$,
  '23514', null, 'a non-member cannot decide an ask');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'deps', jsonb_build_array(pg_temp.t('mam')))) $$,
  '23503', null, 'a dependency on another project''s task is rejected');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'deps', jsonb_build_array(pg_temp.t('rina')))) $$,
  'a same-project dependency is accepted');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'deps', jsonb_build_array(pg_temp.t('yani')))) $$,
  '23514', null, 'a circular dependency is rejected');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'steps', jsonb_build_array('store'))) $$,
  '23514', null, 'value-chain steps need a template on the project');
reset role;
update public.projects set step_template_id = (select id from public.step_templates where name = 'Trading SAMB') where id = pg_temp.prj('MB');
select pg_temp.login('dika');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'steps', jsonb_build_array('store', 'lp'))) $$,
  'steps from the project template are accepted');
select is((select count(*) from public.task_steps where task_id = pg_temp.t('yani')), 2::bigint, 'task_steps rows are written');

reset role;
delete from public.project_members where project_id = pg_temp.prj('MB') and person_id = pg_temp.p('david');
select ok((select count(*) = 0 from public.tasks where project_id = pg_temp.prj('MB') and validator_person_id = pg_temp.p('david')),
  'removing a PM clears them as pemeriksa');
select is((select approver_person_id from public.milestones where id = pg_temp.ms('MB-G2')), null, '… and as pemutus');
select is((select assignee_person_id from public.tasks where id = pg_temp.t('davidpic')), null, '… and as PIC');
update public.project_members set role = 'viewer' where project_id = pg_temp.prj('MB') and person_id = pg_temp.p('yani');
select is((select assignee_person_id from public.tasks where id = pg_temp.t('yani')), null, 'demoting an officer to viewer clears them as PIC');

-- ---------------------------------------------------------------------------------------
-- Projects: close, stop, reopen, lock, delete
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select throws_ok($$ select public.close_project(pg_temp.prj('MB'), 'bukti') $$, 'P0001', null,
  'a project closes only when every milestone is lulus');
select throws_ok($$ select public.stop_project(pg_temp.prj('MB'), '') $$, 'P0001', 'Tulis alasannya dulu.', 'stopping needs a reason');
select lives_ok($$ select public.stop_project(pg_temp.prj('MB'), 'Prioritas berubah', 'Pak Sponsor', 'Rapat direksi') $$, 'PM stops the project');
select ok((select status = 'dihentikan' and close_note = 'Prioritas berubah' and close_decider_name = 'Pak Sponsor' and closed_by = pg_temp.p('dika')
             from public.projects where id = pg_temp.prj('MB')), 'stop records the reason and attribution');
select ok(exists (select 1 from public.decisions where project_id = pg_temp.prj('MB') and kind = 'project' and status = 'dihentikan'),
  'stop writes a project decision');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'title', 'x')) $$, 'P0001', null,
  'a stopped project is read-only');
select throws_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'rescope', 'x') $$, 'P0001', null, '… for gate decisions too');
select lives_ok($$ select public.reopen_project(pg_temp.prj('MB'), 'Prioritas kembali') $$, 'PM reopens the project');
select ok((select status = 'aktif' and closed_at is null and close_note is null from public.projects where id = pg_temp.prj('MB')),
  'reopen clears the close fields');

reset role;
update public.tasks set stage = 'done' where project_id = pg_temp.prj('MAM');
update public.milestones set status = 'lulus' where project_id = pg_temp.prj('MAM');
select pg_temp.login('david');
select throws_ok($$ select public.close_project(pg_temp.prj('MAM'), ' ') $$, 'P0001', 'Isi bukti hasil akhir dulu.', 'closing needs evidence');
select lives_ok($$ select public.close_project(pg_temp.prj('MAM'), 'https://drive.example/laporan') $$, 'PM closes a project whose gates all passed');
select is((select status from public.projects where id = pg_temp.prj('MAM')), 'selesai', 'project is selesai');
select throws_ok($$ select public.delete_project(pg_temp.prj('MAM')) $$, '42501', null, 'a PM cannot delete a project');
select pg_temp.login('dika');
select lives_ok($$ select public.delete_project(pg_temp.prj('MAM')) $$, 'the owner can delete a project');

-- ---------------------------------------------------------------------------------------
-- Light mode (gate_mode = false)
-- ---------------------------------------------------------------------------------------
reset role;
update public.projects set gate_mode = false where id = pg_temp.prj('BMG');
update public.tasks set assignee_person_id = pg_temp.p('bimo') where id = pg_temp.t('bmg');
select pg_temp.login('bimo');
select lives_ok($$ select public.set_task_stage(pg_temp.t('bmg'), 'done') $$, 'light mode: ticking sets done');
select ok((select stage = 'done' and done_at is not null from public.tasks where id = pg_temp.t('bmg')), 'light mode done stamps done_at');
select lives_ok($$ select public.set_task_stage(pg_temp.t('bmg'), 'progress') $$, 'light mode: ticking again reopens');
select ok((select stage = 'progress' and done_at is null from public.tasks where id = pg_temp.t('bmg')), 'light mode reopen clears done_at');
select throws_ok($$ select public.submit_task(pg_temp.t('bmg'), 'x') $$, 'P0001', null, 'light mode has no submission');
select throws_ok($$ select public.commit_task_dates(pg_temp.t('bmg'), null, null) $$, 'P0001', null, 'light mode has no commitment');

-- ---------------------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select lives_ok($$ select public.create_reminder(pg_temp.t('rina'), 'Halo, mohon diselesaikan.') $$, 'PM queues a reminder');
select throws_ok($$ select public.create_reminder(pg_temp.t('rina'), 'Lagi') $$, 'P0001', 'Pengingat untuk task ini masih menunggu dikirim.',
  'only one pending reminder per task');
select lives_ok($$ select public.delete_task(pg_temp.t('rina')) $$, 'PM deletes the task');
select ok((select status = 'dibatalkan' and note = 'Task dihapus' from public.reminders where to_person_id = pg_temp.p('muti')),
  'deleting a task cancels its pending reminder');

-- ---------------------------------------------------------------------------------------
-- Activity log, owner guard, auth linking
-- ---------------------------------------------------------------------------------------
reset role;
select ok(exists (select 1 from public.activity_log where table_name = 'tasks' and action = 'update' and actor_user_id = pg_temp.u('muti')),
  'activity log records task updates with the acting user');
select ok(exists (select 1 from public.activity_log where table_name = 'project_members' and action = 'delete'
                   and row_id = pg_temp.prj('MB') || ':' || pg_temp.p('david')), 'activity log records membership removals');
select ok(exists (select 1 from public.activity_log where table_name = 'decisions' and action = 'insert'), 'activity log records decisions');
select ok(exists (select 1 from public.activity_log where table_name = 'projects' and action = 'delete'), 'activity log records project deletions');

select throws_ok($$ delete from public.app_roles where role = 'owner' $$, '23514', null, 'the last owner cannot be removed');

insert into public.people (id, display_name) values (pg_temp.p('nadia'), 'Nadia');
insert into public.people_contact values (pg_temp.p('nadia'), 'Nadia@Samb.test');
insert into auth.users (id, email) values (pg_temp.u('nadia'), 'nadia@samb.test');
select is((select user_id from public.people where id = pg_temp.p('nadia')), pg_temp.u('nadia'),
  'an invited login links to its person by e-mail (case-insensitive)');

select throws_ok($$ insert into auth.users (id, email) values (gen_random_uuid(), 'orang.asing@contoh.test') $$,
  '42501', 'Email ini belum terdaftar. Minta owner mengundangmu.', 'no login can be created for an unknown e-mail');
select is((select user_id from public.app_roles where role = 'owner'), pg_temp.u('dika'),
  'a pending owner role is granted when that login is created');
select is((select count(*) from public.pending_app_roles), 0::bigint, '… and the pending grant is consumed');
select is((select user_id from public.people where id = pg_temp.p('david')), pg_temp.u('david'),
  'logins link to people by e-mail');
select pg_temp.login('muti');
select throws_ok($$ select * from public.admin_people_status() $$, '42501', null, 'only the owner sees login status');
select pg_temp.login('dika');
select is((select count(*) from public.admin_people_status() where user_id is not null), 9::bigint, 'owner sees which people have a login (8 in the fixture plus Nadia)');
reset role;

select * from finish();
rollback;
