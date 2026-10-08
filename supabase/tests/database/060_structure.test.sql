-- Structure (docs/ARCHITECTURE.md §C, §E, §G): short ids, sub-tasks, typed dependencies and the
-- extraction of structure from workbook prose. Fixture: _fixture.psql.
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- ---------------------------------------------------------------------------------------
-- Short ids
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select lives_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'milestone_id', pg_temp.ms('MB-G1'),
  'title', 'Task baru', 'start_date', '2026-10-07', 'end_date', '2026-10-08')) $$, 'a new task');
select is((select ref from public.tasks where title = 'Task baru'), 'MB05', 'gets the next number after MB01…MB04 under the project code');
select lives_ok($$ select public.save_milestone(jsonb_build_object('project_id', pg_temp.prj('MB'), 'title', 'Gate baru', 'position', 'after')) $$,
  'a new gate');
select is((select ref from public.milestones where title = 'Gate baru'), 'G3', 'follows the project''s own G-numbering');
select lives_ok($$ select public.save_ask(jsonb_build_object('project_id', pg_temp.prj('MB'), 'question', 'Ask baru')) $$, 'a new Keputusan');
select is((select ref from public.asks where question = 'Ask baru'), 'K02', 'K numbering');
reset role;
select throws_ok($$ update public.tasks set ref = 'MB99' where id = pg_temp.t('muti') $$, '23514', null, 'a task ref never changes');
select throws_ok($$ update public.projects set code = 'MBX' where id = pg_temp.prj('MB') $$, '23514', null, 'a project code never changes');
insert into public.projects (id, name, entity_code) values (md5('project:BT')::uuid, 'Budget Transformation', 'SAMB');
select is((select code from public.projects where name = 'Budget Transformation'), 'BT', 'a new project gets its initials as code');
insert into public.projects (id, name, entity_code) values (md5('project:BT2')::uuid, 'Project Budget Tracking', 'SAMB');
select is((select code from public.projects where name = 'Project Budget Tracking'), 'BT2', 'a taken code gets a number');
insert into public.tasks (project_id, title, start_date, end_date) values (md5('project:BT')::uuid, 'Pertama', '2026-10-07', '2026-10-07');
select is((select ref from public.tasks where title = 'Pertama'), 'BT01', 'the first task of a new project');
insert into public.tasks (project_id, ref, title, start_date, end_date) values (md5('project:BT')::uuid, '', 'Kedua', '2026-10-07', '2026-10-07');
select is((select ref from public.tasks where title = 'Kedua'), 'BT02', 'an empty ref (the column default) also asks for the next one');
insert into public.projects (id, name, entity_code, code) values (md5('project:KS')::uuid, 'Kas Sentral', 'SAMB', '');
select is((select code from public.projects where id = md5('project:KS')::uuid), 'KS', 'an empty code (the column default) is assigned too');

-- ---------------------------------------------------------------------------------------
-- Sub-tasks
-- ---------------------------------------------------------------------------------------
select pg_temp.login('yani');
select lives_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'parent_task_id', pg_temp.t('yani'),
  'title', 'Inchstone A', 'start_date', '2026-10-07', 'end_date', '2026-10-07', 'assignee_person_id', pg_temp.p('yani'), 'proof_requested', 'Memo')) $$,
  'the PIC of a task creates a sub-task under it (member, not project admin)');
select lives_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'parent_task_id', pg_temp.t('yani'),
  'title', 'Inchstone B', 'start_date', '2026-10-08', 'end_date', '2026-10-08', 'assignee_person_id', pg_temp.p('muti'), 'proof_requested', 'Tabel')) $$,
  '… and a second one for Muti');
select is((select string_agg(ref, ',' order by ref) from public.tasks where parent_task_id = pg_temp.t('yani')), 'MB02.1,MB02.2',
  'sub-tasks are numbered under the package');
select is((select count(*) from public.tasks where parent_task_id = pg_temp.t('yani') and milestone_id = pg_temp.ms('MB-G1')), 2::bigint,
  'sub-tasks inherit the package''s gate');
select lives_ok($$ select public.save_task(jsonb_build_object('id', (select id from public.tasks where ref = 'MB02.2' and project_id = pg_temp.prj('MB')), 'title', 'Inchstone B2')) $$,
  'the package PIC edits a sub-task');
select throws_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'parent_task_id', pg_temp.t('muti'),
  'title', 'x', 'start_date', '2026-10-07', 'end_date', '2026-10-07')) $$, '42501', null, '… but not under somebody else''s task');
select throws_ok($$ select public.save_task(jsonb_build_object('id', (select id from public.tasks where ref = 'MB02.1' and project_id = pg_temp.prj('MB')), 'stage', 'progress')) $$,
  '42501', null, '… and not the stage (that goes through the workflow RPCs)');
select throws_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'parent_task_id', (select id from public.tasks where ref = 'MB02.1' and project_id = pg_temp.prj('MB')),
  'title', 'x', 'start_date', '2026-10-07', 'end_date', '2026-10-07')) $$, '42501', null, 'no sub-task under a sub-task (as member)');
select pg_temp.login('dika');
select throws_ok($$ select public.save_task(jsonb_build_object('project_id', pg_temp.prj('MB'), 'parent_task_id', (select id from public.tasks where ref = 'MB02.1' and project_id = pg_temp.prj('MB')),
  'title', 'x', 'start_date', '2026-10-07', 'end_date', '2026-10-07')) $$, '23514', null, 'sub-tasks are one level deep, even for admins');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'parent_task_id', pg_temp.t('muti'))) $$,
  '23514', null, 'a package with sub-tasks cannot become a sub-task');
select throws_ok($$ select public.commit_task_dates(pg_temp.t('yani'), null, null) $$, '42501', null,
  'commitment belongs to the PIC (Dika is not Yani)');
select pg_temp.login('yani');
select throws_ok($$ select public.commit_task_dates(pg_temp.t('yani'), null, null) $$, 'P0001',
  'Paket mengikuti sub-task-nya. Komit tanggal di setiap sub-task.', 'a package with sub-tasks is not committed itself');

-- A package is submitted and accepted only after its sub-tasks.
select throws_ok($$ select public.submit_task(pg_temp.t('yani'), 'paket') $$, 'P0001', null, 'the package cannot be submitted while sub-tasks are open');
select lives_ok($$ select public.submit_task((select id from public.tasks where ref = 'MB02.1' and project_id = pg_temp.prj('MB')), 'memo A') $$, 'Yani submits MB02.1');
select pg_temp.login('muti');
select lives_ok($$ select public.submit_task((select id from public.tasks where ref = 'MB02.2' and project_id = pg_temp.prj('MB')), 'tabel B') $$, 'Muti submits MB02.2');
select pg_temp.login('david');
select lives_ok($$ select public.review_task((select id from public.tasks where ref = 'MB02.1' and project_id = pg_temp.prj('MB')), 'accept') $$,
  'the package''s pemeriksa (David) is the sub-task''s effective pemeriksa');
select lives_ok($$ select public.review_task((select id from public.tasks where ref = 'MB02.2' and project_id = pg_temp.prj('MB')), 'accept') $$, '… and accepts MB02.2');
select pg_temp.login('yani');
select lives_ok($$ select public.submit_task(pg_temp.t('yani'), 'paket lengkap') $$, 'now the package can be submitted');
select pg_temp.login('david');
select lives_ok($$ select public.review_task(pg_temp.t('yani'), 'accept') $$, '… and accepted');
select lives_ok($$ select public.reopen_task((select id from public.tasks where ref = 'MB02.2' and project_id = pg_temp.prj('MB'))) $$, 'reopening a sub-task');
select is((select stage from public.tasks where id = pg_temp.t('yani')), 'progress', '… reopens its accepted package');
select pg_temp.login('dika');

-- Moving a package moves its sub-tasks.
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('yani'), 'milestone_id', pg_temp.ms('MB-G2'))) $$, 'the package moves to G2');
select is((select count(*) from public.tasks where parent_task_id = pg_temp.t('yani') and milestone_id = pg_temp.ms('MB-G2')), 2::bigint,
  '… and its sub-tasks with it');

-- ---------------------------------------------------------------------------------------
-- Typed dependencies
-- ---------------------------------------------------------------------------------------
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'),
  'deps', jsonb_build_array(jsonb_build_object('task_id', pg_temp.t('muti'), 'kind', 'start')))) $$, 'Rina''s task waits to start for Muti''s');
select throws_ok($$ select public.set_task_stage(pg_temp.t('rina'), 'progress') $$, 'P0001', 'Belum bisa mulai: menunggu MB01 diterima.',
  'a start dependency blocks starting');
select throws_ok($$ select public.submit_task(pg_temp.t('rina'), 'bukti') $$, 'P0001', null, '… and submitting');
select lives_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'),
  'deps', jsonb_build_array(jsonb_build_object('task_id', pg_temp.t('muti'), 'kind', 'accept')))) $$, 'the dependency becomes acceptance-only');
select lives_ok($$ select public.set_task_stage(pg_temp.t('rina'), 'progress') $$, 'an acceptance dependency lets the work start');
select lives_ok($$ select public.submit_task(pg_temp.t('rina'), 'bukti') $$, '… and be submitted (Dika acts for Rina, who has no login)');
reset role;
update public.tasks set validator_person_id = pg_temp.p('david') where id = pg_temp.t('rina');
select pg_temp.login('david');
select throws_ok($$ select public.review_task(pg_temp.t('rina'), 'accept') $$, 'P0001', 'Belum bisa diterima: menunggu MB01 diterima.',
  '… but not be accepted before its prerequisite');
select lives_ok($$ select public.review_task(pg_temp.t('rina'), 'reject', 'Tunggu MB01') $$, 'rejection is not blocked');
select is((select kind from public.task_deps where task_id = pg_temp.t('rina')), 'accept', 'the dependency kind is stored');
select throws_ok($$ select public.save_task(jsonb_build_object('id', pg_temp.t('rina'), 'deps', jsonb_build_array(pg_temp.t('mam')))) $$,
  '23503', null, 'cross-project dependencies are refused (ARCHITECTURE §K)');

-- ---------------------------------------------------------------------------------------
-- Extraction of structure from prose
-- ---------------------------------------------------------------------------------------
reset role;
insert into public.tasks (id, project_id, milestone_id, legacy_id, ref, title, description, start_date, end_date, assignee_person_id, proof_requested)
values (md5('task:MB10')::uuid, pg_temp.prj('MB'), pg_temp.ms('MB-G1'), 'MB10', 'MB10', 'Paket uji', E'Paket MB10 · Track Uji\n'
  'Owner (fungsi): Commercial · Nama owner: Yani\nValidator (fungsi): Project Finance\n\n'
  'Prasyarat (acceptance only, boleh jalan paralel): MB01, MB77\n\n'
  'Subtask (inchstone)\n'
  'MB10.1 · Long-list principal pilot: alasan per kandidat\n'
  '   Bukti: Long-list dengan alasan · Commercial → Project Finance · 7 Okt 2026 – 8 Okt 2026 · Record: K01 · Kalau meleset: Eskalasi\n'
  'MB10.2 · Cek kelayakan kontrak LP\n'
  '   Bukti: Catatan kelayakan · Warehouse (LP) → Project Finance · 12 Okt 2026 · Dep: MB10.1, MB01 · Kalau meleset: LP keluar\n'
  'MB10.3 · Review oleh kepala\n'
  '   Bukti: Review note · Head of Accounting → - · 30 Feb 2026 · Dep: MB10.9 · Kalau meleset: -\n\n'
  'Sumber: uji.', '2026-10-07', '2026-10-14', pg_temp.p('yani'), 'Memo');
update public.tasks set owner_function_id = null where id = md5('task:MB10')::uuid;

select is(private.extract_structure(pg_temp.prj('MB')) - 'pic_from_package',
  '{"children": 3, "ask_links": 1, "start_deps": 2, "accept_deps": 1}'::jsonb, 'extraction counts');
select is((select string_agg(ref || '|' || title || '|' || start_date || '|' || end_date || '|' || proof_requested, ' ; ' order by ref)
             from public.tasks where parent_task_id = md5('task:MB10')::uuid),
  'MB10.1|Long-list principal pilot: alasan per kandidat|2026-10-07|2026-10-08|Long-list dengan alasan ; '
  'MB10.2|Cek kelayakan kontrak LP|2026-10-12|2026-10-12|Catatan kelayakan ; '
  'MB10.3|Review oleh kepala|2026-10-07|2026-10-14|Review note',
  'sub-tasks with title, dates (or the package''s dates when unreadable) and requested proof');
select is((select f.name from public.tasks t join public.functions f on f.id = t.owner_function_id where t.id = md5('task:MB10')::uuid),
  'Commercial', 'the package gets its owner function');
select is((select string_agg(t.ref || ':' || coalesce(f.name, '-') || ':' || coalesce(pe.display_name, '-'), ', ' order by t.ref)
             from public.tasks t left join public.functions f on f.id = t.owner_function_id left join public.people pe on pe.id = t.assignee_person_id
            where t.parent_task_id = md5('task:MB10')::uuid),
  'MB10.1:Commercial:Yani, MB10.2:Warehouse (LP):-, MB10.3:Accounting:-',
  'same function as the package → the package PIC; other functions stay unassigned (function-owned)');
select is((select string_agg(dep.ref || '>' || t.ref || ':' || d.kind, ', ' order by t.ref, dep.ref)
             from public.task_deps d join public.tasks t on t.id = d.task_id join public.tasks dep on dep.id = d.depends_on_task_id
            where t.ref like 'MB10%'),
  'MB01>MB10:accept, MB01>MB10.2:start, MB10.1>MB10.2:start', 'acceptance prerequisites and finish-to-start inchstone dependencies');
select ok(exists (select 1 from public.ask_tasks a join public.tasks t on t.id = a.task_id where t.ref = 'MB10.1' and a.ask_id = pg_temp.ask('MB')),
  'Record: K01 links the sub-task to Keputusan K01');
select is((select string_agg(code || ':' || ref, ', ' order by code, ref) from public.migration_flags where ref like 'MB10%'),
  'dates_unparsed:MB10.3, dep_unresolved:MB10, dep_unresolved:MB10.3, function_alias:MB10.3',
  'what could not be mapped is flagged, never invented');
select ok((select description like 'Paket MB10 · Track Uji%' from public.tasks where id = md5('task:MB10')::uuid), 'the description stays verbatim');
select is(private.extract_structure(pg_temp.prj('MB')) - 'pic_from_package',
  '{"children": 0, "ask_links": 0, "start_deps": 0, "accept_deps": 0}'::jsonb, 'extraction is idempotent');
select is((select count(*) from public.project_events where object_title like 'Long-list%'), 0::bigint, 'extraction writes no feed events');

select * from finish();
rollback;
