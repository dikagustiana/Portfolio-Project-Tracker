-- "No membership = the project does not exist" (docs/ARCHITECTURE.md §D) across every
-- project-scoped table and RPC, plus super admin reach. Fixture: _fixture.psql.
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- Give BMG (David has no access) a full set of history rows to hide.
select pg_temp.login('bimo');
select lives_ok($$ select public.add_comment('task', pg_temp.t('bmg'), 'Rahasia BMG') $$, 'Bimo comments on a BMG task');
select lives_ok($$ select public.raise_blocker(pg_temp.t('bmg'), 'Data standar belum ada') $$, 'Bimo marks the BMG task blocked');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('bmg'), 'assignee_person_id', pg_temp.p('bimo'))) $$, 'Bimo takes the BMG task');
select lives_ok($$ select public.commit_task_dates(pg_temp.t('bmg'), null, null) $$, 'Bimo commits it');
select lives_ok($$ select public.save_ask(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'question', 'Boleh?', 'task_ids', jsonb_build_array(pg_temp.t('bmg')))) $$,
  'Bimo raises a Keputusan linked to the task');
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'tamu.bmg@samb.test', 'name', 'Tamu BMG',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'viewer')))) $$,
  'Bimo invites a BMG viewer');
reset role;
insert into public.migration_flags (project_id, object_type, ref, code, detail) values (pg_temp.prj('BMG'), 'task', 'BMG01', 'test', 'BMG note');
insert into public.task_reviews (project_id, task_id, round, submitted_at, evidence)
values (pg_temp.prj('BMG'), pg_temp.t('bmg'), 1, now(), 'bukti BMG');
select set_config('test.blocker', (select id::text from public.task_blockers where task_id = pg_temp.t('bmg')), true);
select set_config('test.flag', (select id::text from public.migration_flags where project_id = pg_temp.prj('BMG')), true);

-- ---------------------------------------------------------------------------------------
-- David (no BMG membership): every project-scoped table returns nothing of BMG.
-- ---------------------------------------------------------------------------------------
select pg_temp.login('david');
select is((select count(*) from public.projects where id = pg_temp.prj('BMG')), 0::bigint, 'projects: BMG does not exist for David');
select is((select count(*) from public.projects where code = 'BMG'), 0::bigint, '… not even by its short code');
select is((select count(*) from public.tasks where project_id = pg_temp.prj('BMG')), 0::bigint, 'tasks');
select is((select count(*) from public.milestones where project_id = pg_temp.prj('BMG')), 0::bigint, 'milestones');
select is((select count(*) from public.asks where project_id = pg_temp.prj('BMG')), 0::bigint, 'asks');
select is((select count(*) from public.ask_tasks where project_id = pg_temp.prj('BMG')), 0::bigint, 'ask_tasks');
select is((select count(*) from public.decisions where project_id = pg_temp.prj('BMG')), 0::bigint, 'decisions');
select is((select count(*) from public.project_events where project_id = pg_temp.prj('BMG')), 0::bigint, 'project_events');
select is((select count(*) from public.comments where project_id = pg_temp.prj('BMG')), 0::bigint, 'comments');
select is((select count(*) from public.task_reviews where project_id = pg_temp.prj('BMG')), 0::bigint, 'task_reviews');
select is((select count(*) from public.task_commitments where project_id = pg_temp.prj('BMG')), 0::bigint, 'task_commitments');
select is((select count(*) from public.task_blockers where project_id = pg_temp.prj('BMG')), 0::bigint, 'task_blockers');
select is((select count(*) from public.migration_flags where project_id = pg_temp.prj('BMG')), 0::bigint, 'migration_flags');
select is((select count(*) from public.project_members where project_id = pg_temp.prj('BMG')), 0::bigint, 'project_members');
select is((select count(*) from public.invitation_projects where project_id = pg_temp.prj('BMG')), 0::bigint, 'invitation_projects');
select is((select count(*) from public.invitations where email = 'tamu.bmg@samb.test'), 0::bigint, 'invitations to BMG only');
select ok(not exists (select 1 from public.people where display_name in ('Bimo', 'Tamu BMG')), 'people of BMG only are invisible');
select is((select count(*) from public.project_events where object_title like '%BMG%' or meta::text like '%BMG%'), 0::bigint,
  'no event anywhere mentions BMG');

-- Direct RPC calls on BMG records answer exactly like a missing record (P0002), never 42501.
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('bmg'), 'title', 'x')) $$, 'P0002', null, 'save_task on a BMG task');
select throws_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'title', 'x', 'start_date', '2026-10-07', 'end_date', '2026-10-07')) $$, 'P0002', null, 'save_task into BMG');
select throws_ok($$ select public.submit_task(pg_temp.t('bmg'), 'x') $$, 'P0002', null, 'submit_task');
select throws_ok($$ select public.review_task(pg_temp.t('bmg'), 'accept') $$, 'P0002', null, 'review_task');
select throws_ok($$ select public.raise_blocker(pg_temp.t('bmg'), 'x') $$, 'P0002', null, 'raise_blocker');
select throws_ok($$ select public.resolve_blocker(current_setting('test.blocker')::uuid, '') $$, 'P0002', null,
  'resolve_blocker on the BMG blocker');
select throws_ok($$ select public.escalate_blocker(current_setting('test.blocker')::uuid, '{}'::jsonb) $$, 'P0002', null,
  'escalate_blocker on the BMG blocker');
select throws_ok($$ select public.add_comment('task', pg_temp.t('bmg'), 'x') $$, 'P0002', null, 'add_comment on a BMG task');
select throws_ok($$ select public.add_comment('ask', pg_temp.ask('BMG'), 'x') $$, 'P0002', null, 'add_comment on a BMG Keputusan');
select throws_ok($$ select public.decide_gate(pg_temp.ms('BMG-B1'), 'stop', 'x') $$, 'P0002', null, 'decide_gate');
select throws_ok($$ select public.decide_ask(pg_temp.ask('BMG'), 'x') $$, 'P0002', null, 'decide_ask');
select throws_ok($$ select public.save_ask(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'question', 'x')) $$, 'P0002', null, 'save_ask into BMG');
select throws_ok($$ select public.set_member_role(pg_temp.prj('BMG'), pg_temp.p('david'), 'viewer') $$, 'P0002', null,
  'set_member_role cannot grant himself BMG');
select throws_ok($$ select public.invite_member(jsonb_build_object('email', 'x@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'viewer')))) $$, 'P0002', null,
  'invite_member into BMG');
select throws_ok($$ select public.update_project(jsonb_build_object('id', pg_temp.prj('BMG'), 'name', 'x')) $$, 'P0002', null, 'update_project');
select throws_ok($$ select public.close_project(pg_temp.prj('BMG'), 'x') $$, 'P0002', null, 'close_project');
select throws_ok($$ select public.resolve_migration_flag(current_setting('test.flag')::bigint) $$, 'P0002', null,
  'resolve_migration_flag');

-- ---------------------------------------------------------------------------------------
-- A login without memberships sees no project data at all.
-- ---------------------------------------------------------------------------------------
select pg_temp.login('gita');
select is((select count(*) from public.projects) + (select count(*) from public.tasks) + (select count(*) from public.milestones)
        + (select count(*) from public.asks) + (select count(*) from public.decisions) + (select count(*) from public.project_events)
        + (select count(*) from public.comments) + (select count(*) from public.task_reviews) + (select count(*) from public.task_blockers)
        + (select count(*) from public.task_commitments) + (select count(*) from public.project_members) + (select count(*) from public.invitations),
  0::bigint, 'no rows of any project table');
select is((public.whoami() ->> 'system_role'), 'user', 'whoami: a plain user');

-- ---------------------------------------------------------------------------------------
-- Project admin reach: own project only.
-- ---------------------------------------------------------------------------------------
select pg_temp.login('bimo');
select ok(exists (select 1 from public.migration_flags where project_id = pg_temp.prj('BMG')), 'a project admin reads his project''s migration notes');
select ok(exists (select 1 from public.invitations where email = 'tamu.bmg@samb.test'), '… and invitations to his project');
select is((select count(*) from public.projects), 1::bigint, '… and still only his own project');

select pg_temp.login('muti');
select is((select count(*) from public.migration_flags), 0::bigint, 'a member does not read migration notes');
select is((select count(*) from public.invitations), 0::bigint, '… nor invitations');

-- ---------------------------------------------------------------------------------------
-- Super admin: everything, and full project-admin powers everywhere.
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select is((select count(*) from public.projects), 3::bigint, 'super admin sees all projects without being a member of BMG');
select ok(exists (select 1 from public.project_events where project_id = pg_temp.prj('BMG')), '… and their events');
select ok(exists (select 1 from public.invitations where email = 'tamu.bmg@samb.test'), '… and every invitation');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('bmg'), 'title', 'Diubah super admin')) $$,
  'super admin plans in a project he is not a member of');
select throws_ok($$ select public.review_task(pg_temp.t('bmg'), 'accept') $$, 'P0001', null,
  '… but record-level judgment still follows the record (the task is not in review)');

reset role;
select * from finish();
rollback;
