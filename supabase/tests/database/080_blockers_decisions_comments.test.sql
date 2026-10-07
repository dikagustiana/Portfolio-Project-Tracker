-- Blockers (Terhambat), Keputusan, record-level judgment and comments (docs/ARCHITECTURE.md §D, §K).
-- Fixture: _fixture.psql.
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- ---------------------------------------------------------------------------------------
-- Blockers
-- ---------------------------------------------------------------------------------------
select pg_temp.login('yani');
select throws_ok($$ select public.raise_blocker(pg_temp.t('muti'), 'x') $$, '42501', null, 'only the PIC (or a project admin) marks a task blocked');
select throws_ok($$ select public.raise_blocker(pg_temp.t('yani'), '  ') $$, 'P0001', 'Tulis apa yang menghambat.', 'a reason is required');
select lives_ok($$ select public.raise_blocker(pg_temp.t('yani'), 'Data principal belum dikirim', 'Ekstrak SAP Oktober',
  pg_temp.p('muti'), null, '2026-10-10') $$, 'Yani marks her task blocked, needing Muti');
select throws_ok($$ select public.raise_blocker(pg_temp.t('yani'), 'lagi') $$, 'P0001', null, 'one open blocker per task');
select throws_ok($$ select public.raise_blocker(pg_temp.t('muti'), 'x', '', pg_temp.p('mira')) $$, '42501', null,
  '(Yani is not Muti''s PIC)');
select is((select stage from public.tasks where id = pg_temp.t('yani')), 'todo', 'blocked is an overlay, not a stage');
select throws_ok($$ select public.submit_task(pg_temp.t('yani'), 'bukti') $$, 'P0001', 'Task ini masih terhambat. Tandai hambatannya selesai dulu.',
  'a blocked task cannot be submitted');

select pg_temp.login('dika');
select throws_ok($$ select public.raise_blocker(pg_temp.t('muti'), 'x', '', pg_temp.p('mira')) $$, '23514', null,
  'the person a blocker needs must be on the project');

select pg_temp.login('yani');
select lives_ok($$ select public.escalate_blocker((select id from public.task_blockers where task_id = pg_temp.t('yani')),
  jsonb_build_object('question', 'Pakai data September sebagai proxy?', 'decider_person_id', pg_temp.p('david'))) $$,
  '"Angkat menjadi Keputusan": the PIC escalates the blocker');
select ok((select a.question = 'Pakai data September sebagai proxy?' and a.decider_person_id = pg_temp.p('david')
                  and a.milestone_id = pg_temp.ms('MB-G1') and a.created_by = pg_temp.p('yani') and a.due = '2026-10-10'
                  and a.context like 'Hambatan pada MB02%'
             from public.asks a join public.task_blockers b on b.ask_id = a.id where b.task_id = pg_temp.t('yani')),
  'the Keputusan inherits project, gate, task context and target date');
select ok(exists (select 1 from public.ask_tasks x join public.task_blockers b on b.ask_id = x.ask_id
                   where b.task_id = pg_temp.t('yani') and x.task_id = pg_temp.t('yani')), 'and is linked to the blocked task');
select throws_ok($$ select public.escalate_blocker((select id from public.task_blockers where task_id = pg_temp.t('yani')), '{}'::jsonb) $$,
  'P0001', null, 'a blocker is escalated once');

select pg_temp.login('muti');
select lives_ok($$ select public.resolve_blocker((select id from public.task_blockers where task_id = pg_temp.t('yani')), 'Ekstrak dikirim') $$,
  'the person it was needed from resolves the blocker');
select ok((select resolved_by = pg_temp.p('muti') and resolution = 'Ekstrak dikirim' from public.task_blockers where task_id = pg_temp.t('yani')),
  'resolution is recorded, the row is kept');
select is((select string_agg(verb, ',' order by id) from public.project_events where object_id = pg_temp.t('yani') and verb like 'blocker_%'),
  'blocker_raised,blocker_escalated,blocker_resolved', 'blocker history as events');
select lives_ok($$ select public.raise_blocker(pg_temp.t('muti'), 'Akses SAP ditutup') $$, 'Muti can block her own task again later');
select pg_temp.login('vera');
select throws_ok($$ select public.resolve_blocker((select id from public.task_blockers where task_id = pg_temp.t('muti') and resolved_at is null), '') $$,
  '42501', null, 'a viewer resolves nothing');

-- ---------------------------------------------------------------------------------------
-- Record-level judgment without project administration
-- ---------------------------------------------------------------------------------------
reset role;
update public.tasks set validator_person_id = pg_temp.p('muti') where id = pg_temp.t('rina');
update public.milestones set approver_person_id = pg_temp.p('yani') where id = pg_temp.ms('MB-G1');
update public.asks set decider_person_id = pg_temp.p('yani') where id = pg_temp.ask('MB');

select pg_temp.login('dika');
select lives_ok($$ select public.submit_task(pg_temp.t('rina'), 'bukti Rina') $$, 'Dika submits for Rina (no login)');
select pg_temp.login('muti');
select lives_ok($$ select public.review_task(pg_temp.t('rina'), 'accept') $$,
  'a member who is the task''s pemeriksa accepts it without being project admin');
select pg_temp.login('yani');
select lives_ok($$ select public.decide_ask(pg_temp.ask('MB'), 'Pallet-days') $$, 'a member who is the decider decides the Keputusan');
select pg_temp.login('david');
select throws_ok($$ select public.reopen_ask(pg_temp.ask('MB')) $$, '42501', null,
  'a project admin who is not the decider cannot reopen it (Yani has a login)');
select pg_temp.login('yani');
select throws_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'lulus', 'ok') $$, 'P0001', null,
  'the member pemutus may decide the gate (lulus still needs every task accepted)');
select lives_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'rescope', 'Geser jadwal', 'Rapat GM', 'Weekly', '2026-10-09') $$,
  '… and records a rescope');
select pg_temp.login('muti');
select throws_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'rescope', 'x') $$, '42501', null, 'a member who is not the pemutus cannot');
select pg_temp.login('david');
select lives_ok($$ select public.decide_gate(pg_temp.ms('MB-G1'), 'rescope', 'Dicatat untuk forum', 'Pak Sponsor', 'Weekly', '2026-10-09') $$,
  'a project admin records a forum decision for the pemutus, with attribution');

-- PIC never validates own work, whatever their role.
reset role;
update public.tasks set validator_person_id = null where id = pg_temp.t('davidpic');
update public.milestones set approver_person_id = pg_temp.p('david') where id = pg_temp.ms('MB-G2');
select pg_temp.login('david');
select lives_ok($$ select public.submit_task(pg_temp.t('davidpic'), 'bukti') $$, 'David submits his own task');
select throws_ok($$ select public.review_task(pg_temp.t('davidpic'), 'accept') $$, '42501', null,
  'PIC cannot validate own work, even as project admin and gate pemutus');
select pg_temp.login('dika');
select throws_ok($$ select public.review_task(pg_temp.t('davidpic'), 'accept') $$, 'P0001', null,
  'nobody accepts while the effective pemeriksa is the PIC');

-- ---------------------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------------------
select pg_temp.login('muti');
select lives_ok($$ select public.add_comment('task', pg_temp.t('yani'), 'Ekstrak sudah di folder bersama') $$, 'a member comments on a task');
select lives_ok($$ select public.add_comment('ask', pg_temp.ask('MB'), 'Setuju pallet-days') $$, '… and on a Keputusan');
select throws_ok($$ select public.add_comment('task', pg_temp.t('yani'), '   ') $$, 'P0001', null, 'an empty comment is refused');
select throws_ok($$ select public.add_comment('milestone', pg_temp.ms('MB-G1'), 'x') $$, 'P0001', null, 'comments only on tasks and Keputusan');
select ok((select author_person_id = pg_temp.p('muti') and created_at is not null from public.comments where body = 'Ekstrak sudah di folder bersama'),
  'author and time are kept');
select throws_ok($$ update public.comments set body = 'x' $$, '42501', null, 'comments cannot be edited directly');
reset role;
select throws_ok($$ update public.comments set body = 'x' $$, '42501', null, '… by anyone');
select pg_temp.login('mira');
select is((select count(*) from public.comments), 0::bigint, 'a member of another project reads no MB comments');
select throws_ok($$ select public.add_comment('task', pg_temp.t('yani'), 'x') $$, 'P0002', null, '… and cannot comment there');

select * from finish();
rollback;
