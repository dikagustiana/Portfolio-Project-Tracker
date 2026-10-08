-- Access test matrix A1–A17 (BRIEF §3, as amended by docs/ARCHITECTURE.md §D). Fixture: _fixture.psql.
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- ---------------------------------------------------------------------------------------
-- A1–A5 · David (project_admin on MB and MAM)
-- ---------------------------------------------------------------------------------------
select pg_temp.login('david');

select is((select count(*) from public.tasks where project_id = pg_temp.prj('BMG')), 0::bigint, 'A1 David sees no BMG tasks');
select is((select count(*) from public.milestones where project_id = pg_temp.prj('BMG')), 0::bigint, 'A1 David sees no BMG milestones');
select is((select count(*) from public.asks where project_id = pg_temp.prj('BMG')), 0::bigint, 'A1 David sees no BMG asks');
select is((select count(*) from public.decisions where project_id = pg_temp.prj('BMG')), 0::bigint, 'A1 David sees no BMG decisions');
select is((select count(*) from public.project_members where project_id = pg_temp.prj('BMG')), 0::bigint, 'A1 David sees no BMG memberships');
select is((select count(*) from public.task_steps ts join public.tasks t on t.id = ts.task_id where t.project_id = pg_temp.prj('BMG')), 0::bigint, 'A1 David sees no BMG task steps');

select set_eq($$ select id from public.projects $$, $$ values (pg_temp.prj('MB')), (pg_temp.prj('MAM')) $$,
  'A2 David sees exactly Margin Bridge and MAM');

select set_eq($$ select id from public.people $$,
  $$ select pg_temp.p(n) from unnest(array['dika', 'david', 'muti', 'yani', 'vera', 'rina', 'mira']) n $$,
  'A3 David sees only people sharing MB or MAM with him');
select set_eq($$ select person_id from public.people_contact $$,
  $$ select pg_temp.p(n) from unnest(array['dika', 'david', 'muti', 'yani', 'vera', 'rina', 'mira']) n $$,
  'A3 David (project admin on both) sees e-mails of people on MB and MAM, not Bimo or Gita');

reset role;
update public.project_members set role = 'member' where project_id = pg_temp.prj('MAM') and person_id = pg_temp.p('david');
select pg_temp.login('david');
select ok(exists (select 1 from public.people where id = pg_temp.p('mira')), 'A3 as member on MAM, David still sees Mira''s name');
select ok(not exists (select 1 from public.people_contact where person_id = pg_temp.p('mira')), 'A3 … but not Mira''s e-mail (he is not project admin on her project)');
reset role;
update public.project_members set role = 'project_admin' where project_id = pg_temp.prj('MAM') and person_id = pg_temp.p('david');
update public.projects set pm_person_id = pg_temp.p('david') where id = pg_temp.prj('MAM');
select pg_temp.login('david');

select throws_ok(
  $$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'title', 'Sisipan', 'start_date', '2026-10-07', 'end_date', '2026-10-08')) $$,
  'P0002', null, 'A4 David cannot create a task in BMG through the RPC (looks like it does not exist)');
select throws_ok(
  $$ insert into public.tasks (project_id, title, start_date, end_date) values (pg_temp.prj('BMG'), 'Sisipan', '2026-10-07', '2026-10-08') $$,
  '42501', null, 'A4 David cannot insert into tasks directly');

select lives_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'rescope', 'Jadwal G1 digeser') $$,
  'A5 David can decide an MB gate');
select is((select recorded_by from public.decisions where milestone_id = pg_temp.ms('MB-G1') order by recorded_at desc, note = 'Jadwal G1 digeser' desc limit 1),
  pg_temp.p('david'), 'A5 the decision is recorded by David');
select throws_ok($$ select public.decide_gate(pg_temp.ms('BMG-B1'), 'stop', 'x') $$, 'P0002', null,
  'A5 … but not a BMG gate');

-- ---------------------------------------------------------------------------------------
-- A6–A10 · Muti (member on MB)
-- ---------------------------------------------------------------------------------------
select pg_temp.login('muti');

select lives_ok($$ select public.commit_task_dates(pg_temp.t('muti'), '2026-10-08', '2026-10-12') $$,
  'A6 Muti commits dates on her own MB task');
select ok((select committed and committed_by = pg_temp.p('muti') and end_date = '2026-10-12' from public.tasks where id = pg_temp.t('muti')),
  'A6 the commitment and the new dates are stored');

select throws_ok($$ select public.commit_task_dates(pg_temp.t('yani'), null, null) $$, '42501', null,
  'A7 Muti cannot commit dates on Yani''s task');

select throws_ok($$ update public.tasks set stage = 'done' where id = pg_temp.t('muti') $$, '42501', null,
  'A8 Muti cannot update tasks directly');
select throws_ok($$ select public.set_task_stage(pg_temp.t('muti'), 'done') $$, 'P0001', null,
  'A8 Muti cannot set her own task to done through set_task_stage');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('muti'), 'stage', 'done')) $$, '42501', null,
  'A8 Muti cannot reach done through save_task');
select lives_ok($$ select public.submit_task(pg_temp.t('muti'), 'https://drive.example/bukti') $$,
  'A8 Muti can submit her task for review');
select throws_ok($$ select public.review_task(pg_temp.t('muti'), 'accept') $$, '42501', null,
  'A8/A9 Muti cannot accept her own submission');

reset role;
select pg_temp.login('yani');
select lives_ok($$ select public.submit_task(pg_temp.t('yani'), 'Ringkasan hasil') $$, 'Yani submits her task');
select pg_temp.login('muti');
select throws_ok($$ select public.review_task(pg_temp.t('yani'), 'accept') $$, '42501', null,
  'A9 Muti cannot review Yani''s task');
select throws_ok($$ select public.review_task(pg_temp.t('yani'), 'reject', 'kurang') $$, '42501', null,
  'A9 Muti cannot reject Yani''s task');

select is((select count(*) from public.people_contact), 0::bigint, 'A10 Muti reads no e-mail addresses');
select ok((select count(*) from public.people) > 0, 'A10 … while she still sees names and job titles');

-- ---------------------------------------------------------------------------------------
-- A11 · Viewer on MB: every write path is closed
-- ---------------------------------------------------------------------------------------
select pg_temp.login('vera');

select ok(exists (select 1 from public.tasks where project_id = pg_temp.prj('MB')), 'A11 Vera can read MB');
select throws_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'title', 'x', 'start_date', '2026-10-07', 'end_date', '2026-10-07')) $$, '42501', null, 'A11 save_task');
select throws_ok($$ select public.commit_task_dates(pg_temp.t('rina'), null, null) $$, '42501', null, 'A11 commit_task_dates');
select throws_ok($$ select public.set_task_stage(pg_temp.t('rina'), 'progress') $$, '42501', null, 'A11 set_task_stage');
select throws_ok($$ select public.submit_task(pg_temp.t('rina'), 'bukti') $$, '42501', null, 'A11 submit_task');
select throws_ok($$ select public.review_task(pg_temp.t('yani'), 'accept') $$, '42501', null, 'A11 review_task');
select throws_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'stop', 'x') $$, '42501', null, 'A11 decide_gate');
select throws_ok($$ select public.save_milestone(jsonb_build_object('project_id', pg_temp.prj('MB'), 'title', 'x')) $$, '42501', null, 'A11 save_milestone');
select throws_ok($$ select public.save_ask(jsonb_build_object('project_id', pg_temp.prj('MB'), 'question', 'x')) $$, '42501', null, 'A11 save_ask');
select throws_ok($$ select public.decide_ask(pg_temp.ask('MB'), 'ya') $$, '42501', null, 'A11 decide_ask');
select throws_ok($$ select public.create_reminder(pg_temp.t('muti'), 'halo') $$, '42501', null, 'A11 create_reminder');
select throws_ok($$ select public.update_project(jsonb_build_object('id', pg_temp.prj('MB'), 'name', 'x')) $$, '42501', null, 'A11 update_project');
select throws_ok($$ select public.stop_project(pg_temp.prj('MB'), 'x') $$, '42501', null, 'A11 stop_project');
select throws_ok($$ select public.create_project(jsonb_build_object('name', 'x')) $$, '42501', null, 'A11 create_project');
select throws_ok($$ insert into public.tasks (project_id, title, start_date, end_date) values (pg_temp.prj('MB'), 'x', '2026-10-07', '2026-10-07') $$, '42501', null, 'A11 insert tasks');
select throws_ok($$ delete from public.tasks where project_id = pg_temp.prj('MB') $$, '42501', null, 'A11 delete tasks');
select throws_ok($$ update public.milestones set status = 'lulus' $$, '42501', null, 'A11 update milestones');
select throws_ok($$ insert into public.decisions (project_id, kind, status) values (pg_temp.prj('MB'), 'gate', 'lulus') $$, '42501', null, 'A11 insert decisions');
select throws_ok($$ insert into public.project_members values (pg_temp.prj('MB'), pg_temp.p('vera'), 'project_admin') $$, '42501', null, 'A11 cannot promote herself');
select throws_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('vera'), 'member') $$, '42501', null, 'A11 cannot promote herself through the RPC');
select throws_ok($$ insert into public.profiles values (pg_temp.u('vera'), 'super_admin') $$, '42501', null, 'A11 cannot make herself super admin');
select throws_ok($$ select public.set_system_role(pg_temp.p('vera'), 'super_admin') $$, '42501', null, 'A11 … not through the RPC either');
select throws_ok($$ select public.add_comment('task', pg_temp.t('muti'), 'halo') $$, '42501', null, 'A11 add_comment');
select throws_ok($$ select public.raise_blocker(pg_temp.t('muti'), 'x') $$, '42501', null, 'A11 raise_blocker');
select throws_ok($$ select public.invite_member(jsonb_build_object('email', 'x@samb.test', 'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'viewer')))) $$, '42501', null, 'A11 invite_member');
select throws_ok($$ insert into public.people (display_name) values ('x') $$, '42501', null, 'A11 insert people');
select throws_ok($$ insert into public.people_contact values (pg_temp.p('vera'), 'x@y.z') $$, '42501', null, 'A11 insert people_contact');
select throws_ok($$ insert into public.activity_log (table_name, action) values ('tasks', 'insert') $$, '42501', null, 'A11 insert activity_log');
update public.people set display_name = 'Diubah' where id = pg_temp.p('muti');
update public.project_members set role = 'project_admin' where person_id = pg_temp.p('vera');
update public.org_settings set email_paused = true;
delete from public.project_members where project_id = pg_temp.prj('MB');
reset role;
select is((select display_name from public.people where id = pg_temp.p('muti')), 'Muti', 'A11 update on people changed nothing');
select is((select role from public.project_members where person_id = pg_temp.p('vera')), 'viewer', 'A11 update on memberships changed nothing');
select is((select email_paused from public.org_settings), false, 'A11 update on settings changed nothing');
select is((select count(*) from public.project_members where project_id = pg_temp.prj('MB')), 6::bigint, 'A11 delete on memberships removed nothing');

-- ---------------------------------------------------------------------------------------
-- A12 · Anonymous: no table, no RPC
-- ---------------------------------------------------------------------------------------
select pg_temp.login_anon();
select throws_ok(format('select * from public.%I', c.relname), '42501', null, 'A12 anon cannot read public.' || c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relname;
select throws_ok($$ select public.whoami() $$, '42501', null, 'A12 anon cannot call RPCs');
select throws_ok($$ select public.save_task('{}'::jsonb) $$, '42501', null, 'A12 anon cannot call save_task');
reset role;

-- ---------------------------------------------------------------------------------------
-- A13 · Validator = assignee is rejected, even for the super admin. Judgment no longer needs
-- the project admin role (ARCHITECTURE §D): a member may be pemeriksa, a viewer may not.
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'validator_person_id', pg_temp.p('rina'))) $$,
  '23514', null, 'A13 super admin cannot set the validator to the PIC (a member)');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'validator_person_id', pg_temp.p('vera'))) $$,
  '23514', null, 'A13 a viewer cannot be pemeriksa');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'validator_person_id', pg_temp.p('mira'))) $$,
  '23514', null, 'A13 a non-member cannot be pemeriksa');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'validator_person_id', pg_temp.p('yani'))) $$,
  'A13 a member who is not the PIC can be pemeriksa without being project admin');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'validator_person_id', pg_temp.p('dika'))) $$,
  'A13 (pemeriksa back to Dika)');
reset role;
update public.project_members set role = 'project_admin' where project_id = pg_temp.prj('MB') and person_id = pg_temp.p('rina');
select pg_temp.login('dika');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'validator_person_id', pg_temp.p('rina'))) $$,
  '23514', null, 'A13 super admin cannot set validator = assignee, even when the PIC is a project admin');
reset role;
select throws_ok($$ update public.tasks set validator_person_id = assignee_person_id where id = pg_temp.t('rina') $$,
  '23514', null, 'A13 the check constraint holds for privileged writes too');
update public.project_members set role = 'member' where project_id = pg_temp.prj('MB') and person_id = pg_temp.p('rina');

-- ---------------------------------------------------------------------------------------
-- A14 · activity_log is append-only for everyone
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select ok((select count(*) from public.activity_log) > 0, 'A14 the super admin can read the activity log');
select throws_ok($$ update public.activity_log set action = 'delete' $$, '42501', null, 'A14 super admin cannot update activity_log');
select throws_ok($$ delete from public.activity_log $$, '42501', null, 'A14 super admin cannot delete activity_log');
select pg_temp.login('david');
select throws_ok($$ update public.activity_log set action = 'delete' $$, '42501', null, 'A14 project admin cannot update activity_log');
select throws_ok($$ delete from public.activity_log $$, '42501', null, 'A14 project admin cannot delete activity_log');
reset role;
select throws_ok($$ update public.activity_log set action = 'delete' $$, '42501', null, 'A14 not even a privileged role can update activity_log');
select throws_ok($$ delete from public.activity_log $$, '42501', null, 'A14 … or delete from it');
select throws_ok($$ truncate public.activity_log $$, '42501', null, 'A14 … or truncate it');

-- ---------------------------------------------------------------------------------------
-- A15 · Super admin reads everything
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select is((select count(*) from public.projects), 3::bigint, 'A15 super admin sees all projects');
select is((select count(*) from public.tasks), 6::bigint, 'A15 super admin sees all tasks');
select is((select count(*) from public.people), 9::bigint, 'A15 super admin sees all people');
select is((select count(*) from public.people_contact), 9::bigint, 'A15 super admin sees all e-mail addresses');
select is((select count(*) from public.profiles), 8::bigint, 'A15 super admin sees every account''s system role');
select is((select count(*) from public.decisions where project_id = pg_temp.prj('BMG')), 1::bigint, 'A15 super admin sees BMG decisions');
select lives_ok($$ select count(*) from public.email_log $$, 'A15 super admin can read the e-mail log');
select is((public.whoami() ->> 'system_role'), 'super_admin', 'A15 whoami reports the system role');

-- ---------------------------------------------------------------------------------------
-- A16 · Only the validator reopens an accepted task
-- ---------------------------------------------------------------------------------------
select pg_temp.login('david');
select lives_ok($$ select public.review_task(pg_temp.t('muti'), 'accept') $$, 'David (validator) accepts Muti''s task');
select pg_temp.login('dika');
select throws_ok($$ select public.reopen_task(pg_temp.t('muti')) $$, '42501', null,
  'A16 a project admin who is not the validator (here also the super admin) cannot reopen it');
select throws_ok($$ select public.review_task(pg_temp.t('yani'), 'accept') $$, '42501', null,
  'A16 … nor accept a task whose validator (David) has a login');
select pg_temp.login('david');
select lives_ok($$ select public.reopen_task(pg_temp.t('muti')) $$, 'A16 the validator can reopen it');
select is((select stage from public.tasks where id = pg_temp.t('muti')), 'progress', 'A16 the reopened task is back in progress');

-- A project admin may act for a validator who has no login (prototype canAct).
reset role;
update public.tasks set validator_person_id = pg_temp.p('david') where id = pg_temp.t('rina');
update public.people set user_id = null where id = pg_temp.p('david');
select pg_temp.login('dika');
select lives_ok($$ select public.submit_task(pg_temp.t('rina'), 'bukti atas nama Rina') $$, 'a project admin submits for a PIC without a login');
select lives_ok($$ select public.review_task(pg_temp.t('rina'), 'accept') $$, 'a project admin reviews for a validator without a login');
reset role;
update public.people set user_id = pg_temp.u('david') where id = pg_temp.p('david');

-- ---------------------------------------------------------------------------------------
-- A17 · A validator who is also the PIC cannot review
-- ---------------------------------------------------------------------------------------
select pg_temp.login('david');
select lives_ok($$ select public.submit_task(pg_temp.t('davidpic'), 'bukti David') $$, 'David submits his own task');
select throws_ok($$ select public.review_task(pg_temp.t('davidpic'), 'accept') $$, '42501', null,
  'A17 David is the effective validator (G2 approver) and the PIC: he cannot accept');
select pg_temp.login('dika');
select throws_ok($$ select public.review_task(pg_temp.t('davidpic'), 'accept') $$, 'P0001', null,
  'A17 nobody can accept while the effective validator is the PIC');

-- ---------------------------------------------------------------------------------------
-- Outsiders: no membership = the project does not exist
-- ---------------------------------------------------------------------------------------
select pg_temp.login('gita');
select is((select count(*) from public.projects), 0::bigint, 'a login without memberships reads no project');
select is((select count(*) from public.people), 1::bigint, '… sees only herself among people');
select is((select count(*) from public.people_contact), 0::bigint, '… reads no e-mail addresses');
select throws_ok($$ select public.set_task_stage(pg_temp.t('bmg'), 'progress') $$, 'P0002', null, '… and a write on a project she cannot see looks like a missing row');
select pg_temp.login('bimo');
select is((select count(*) from public.tasks where project_id <> pg_temp.prj('BMG')), 0::bigint, 'Bimo sees only BMG tasks');
select is((public.whoami() ->> 'person_id')::uuid, pg_temp.p('bimo'), 'whoami resolves the signed-in person');
reset role;

select * from finish();
rollback;
