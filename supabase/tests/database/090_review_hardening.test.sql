-- Regressions from the security review of the architecture pass (docs/ARCHITECTURE.md §K):
-- login links stay inside a project admin's reach, revokes cannot touch other people's access or
-- logins, viewers never resolve blockers, the review flow cannot be switched off to self-accept,
-- history is append-only, and refusals do not reveal what the caller cannot see.
-- Fixture: _fixture.psql (Bimo administers BMG only; David administers MB and MAM).
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- ---------------------------------------------------------------------------------------
-- Login links: only for someone wholly inside the caller's projects
-- ---------------------------------------------------------------------------------------
select pg_temp.login('bimo');
select throws_ok($$ select public.invite_member(jsonb_build_object('email', 'rina@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'viewer')))) $$,
  '42501', null, 'a project admin cannot invite a member of another project (no link to her account)');
select throws_ok($$ select public.invite_member(jsonb_build_object('email', 'david@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'viewer')))) $$,
  '42501', null, '… nor another project''s admin whose login was never used');
select is((select count(*) from public.invitations where email in ('rina@samb.test', 'david@samb.test')), 0::bigint,
  '… and nothing was written');
reset role;
insert into public.pending_system_roles (email, system_role) values ('boss@samb.test', 'super_admin');
select pg_temp.login('bimo');
select throws_ok($$ select public.invite_member(jsonb_build_object('email', 'boss@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'viewer')))) $$,
  '42501', null, '… nor an address reserved for a super admin');

-- An invitation someone else made is not his to send or revoke.
select pg_temp.login('dika');
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'x1@samb.test', 'assignments', '[]'::jsonb)) $$,
  'the super admin invites someone without projects');
select pg_temp.login('bimo');
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'x1@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'viewer')))) $$,
  'a project admin adds that person to his project');
select throws_ok($$ select public.login_link_target((select person_id from public.invitations where email = 'x1@samb.test')) $$,
  '42501', null, '… but gets no login link for an invitation he did not make');
select throws_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'x1@samb.test')) $$,
  '42501', null, '… and cannot revoke it');

-- His own invitation stops being his to send once the person has access elsewhere.
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'x2@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'member')))) $$,
  'a project admin invites a new person');
select ok(public.login_link_target((select person_id from public.invitations where email = 'x2@samb.test')) ->> 'email' = 'x2@samb.test',
  '… and may send the link');
reset role;
insert into public.project_members (project_id, person_id, role)
select pg_temp.prj('MB'), person_id, 'viewer' from public.invitations where email = 'x2@samb.test';
select pg_temp.login('bimo');
select throws_ok($$ select public.login_link_target((select person_id from public.invitations where email = 'x2@samb.test')) $$,
  '42501', null, '… until the person also has access to a project he does not run');
select throws_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'x2@samb.test')) $$,
  '42501', null, '… after which only the super admin revokes');

-- ---------------------------------------------------------------------------------------
-- Revoking: never Project Admin rights, never someone else's login
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'newadm@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'project_admin')))) $$,
  'the super admin invites a new Project Admin');
select pg_temp.login('david');
select throws_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'newadm@samb.test')) $$,
  '42501', null, 'another project admin cannot revoke it');
select is((select pm.role from public.project_members pm join public.invitations i on i.person_id = pm.person_id
            where i.email = 'newadm@samb.test' and pm.project_id = pg_temp.prj('MB')), 'project_admin', '… the role stays');

-- A login the person already had is not deleted by revoking a later invitation.
reset role;
insert into public.people (id, display_name, job_title) values (pg_temp.p('pre'), 'Pre', 'Staf');
insert into public.people_contact (person_id, email) values (pg_temp.p('pre'), 'pre@samb.test');
insert into auth.users (id, email) values (pg_temp.u('pre'), 'pre@samb.test');
insert into public.project_members (project_id, person_id, role) values (pg_temp.prj('MB'), pg_temp.p('pre'), 'member');
select pg_temp.login('david');
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'pre@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'viewer')))) $$,
  'a project admin invites someone whose login exists but was never used');
select lives_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'pre@samb.test')) $$,
  '… and revokes it');
reset role;
select ok(exists (select 1 from auth.users where id = pg_temp.u('pre')), '… the login the person already had stays');
select is(private.person_role(pg_temp.p('pre'), pg_temp.prj('MB')), 'member', '… and the earlier role comes back');

-- A login created for the invitation (and never used) goes with it.
select pg_temp.login('david');
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'neu@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'member')))) $$,
  'a project admin invites a new person');
reset role;
insert into auth.users (id, email) values (pg_temp.u('neu'), 'neu@samb.test');
select pg_temp.login('david');
select lives_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'neu@samb.test')) $$,
  '… the link created a login; he revokes');
reset role;
select ok(not exists (select 1 from auth.users where id = pg_temp.u('neu')), '… and that unused login is deleted');

-- ---------------------------------------------------------------------------------------
-- Blockers: viewers never act
-- ---------------------------------------------------------------------------------------
select pg_temp.login('muti');
select throws_ok($$ select public.raise_blocker(pg_temp.t('muti'), 'Menunggu data', '', pg_temp.p('vera')) $$, '23514', null,
  'a blocker cannot be needed from a viewer');
select lives_ok($$ select public.raise_blocker(pg_temp.t('muti'), 'Menunggu data', '', pg_temp.p('yani')) $$,
  'Muti raises a blocker needed from Yani');
reset role;
update public.project_members set role = 'viewer' where project_id = pg_temp.prj('MB') and person_id in (pg_temp.p('muti'), pg_temp.p('yani'));
select pg_temp.login('muti');
select throws_ok($$ select public.resolve_blocker((select id from public.task_blockers where task_id = pg_temp.t('muti'))) $$,
  '42501', null, 'the raiser, now a viewer, cannot resolve it');
select pg_temp.login('yani');
select throws_ok($$ select public.resolve_blocker((select id from public.task_blockers where task_id = pg_temp.t('muti'))) $$,
  '42501', null, '… nor can the person it was needed from, now a viewer');
reset role;
update public.project_members set role = 'member' where project_id = pg_temp.prj('MB') and person_id in (pg_temp.p('muti'), pg_temp.p('yani'));

-- ---------------------------------------------------------------------------------------
-- The review flow cannot be switched off to accept one's own work
-- ---------------------------------------------------------------------------------------
select pg_temp.login('david');
select throws_ok($$ select public.update_project(jsonb_build_object('id', pg_temp.prj('MB'), 'gate_mode', false)) $$, '42501', null,
  'a project admin cannot turn the review flow off');
select is((select stage from public.tasks where id = pg_temp.t('davidpic')), 'todo', '… so his own task stays open');
select pg_temp.login('dika');
select lives_ok($$ select public.update_project(jsonb_build_object('id', pg_temp.prj('MB'), 'gate_mode', false)) $$,
  'the super admin can');
select pg_temp.login('david');
select lives_ok($$ select public.update_project(jsonb_build_object('id', pg_temp.prj('MB'), 'gate_mode', true)) $$,
  'a project admin may turn it on');
select lives_ok($$ select public.update_project(jsonb_build_object('id', pg_temp.prj('MB'), 'name', 'Project Margin Bridge')) $$,
  '… and edit the project while it is on');

-- ---------------------------------------------------------------------------------------
-- Refusals reveal nothing about what the caller cannot see
-- ---------------------------------------------------------------------------------------
select pg_temp.login('bimo');
select throws_ok($$ select public.set_member_role(pg_temp.prj('BMG'), pg_temp.p('rina'), 'project_admin') $$, 'P0002', null,
  'an invisible person looks the same as a missing one, whatever role is asked');
select throws_ok($$ select public.set_member_role(pg_temp.prj('BMG'), gen_random_uuid(), 'project_admin') $$, 'P0002', null,
  '… (a missing one)');
reset role;
insert into public.migration_flags (project_id, object_type, code, detail) values (pg_temp.prj('MB'), 'project', 'pic_from_package', 'catatan uji');
select pg_temp.login('muti');
select throws_ok($$ select public.resolve_migration_flag((select id from public.migration_flags where detail = 'catatan uji')) $$,
  'P0002', null, 'a member cannot tell that a migration note exists');

-- ---------------------------------------------------------------------------------------
-- History is append-only, even for privileged roles; cascades and person deletion still work
-- ---------------------------------------------------------------------------------------
reset role;
insert into public.task_commitments (project_id, task_id, start_date, end_date, committed_by)
values (pg_temp.prj('MB'), pg_temp.t('yani'), '2026-10-07', '2026-10-09', pg_temp.p('yani'));
insert into public.comments (project_id, task_id, author_person_id, body) values (pg_temp.prj('MB'), pg_temp.t('yani'), pg_temp.p('yani'), 'Catatan');
select throws_ok($$ update public.decisions set note = 'diubah' where note = 'Catatan MB' $$, '42501', null, 'decisions cannot be edited');
select throws_ok($$ delete from public.decisions where note = 'Catatan MB' $$, '42501', null, '… nor deleted');
select throws_ok($$ update public.task_commitments set end_date = '2026-12-31' where task_id = pg_temp.t('yani') $$, '42501', null,
  'commitments cannot be edited');
select throws_ok($$ delete from public.task_commitments where task_id = pg_temp.t('yani') $$, '42501', null, '… nor deleted');
select throws_ok($$ delete from public.comments where body = 'Catatan' $$, '42501', null, 'comments cannot be deleted');
select throws_ok($$ truncate public.project_events $$, '42501', null, 'the event log cannot be truncated');
select lives_ok($$ delete from public.milestones where id = pg_temp.ms('BMG-B1') $$, 'deleting a milestone keeps its decisions');
select ok(exists (select 1 from public.decisions where note = 'Catatan BMG' and milestone_id is null), '… with the link cleared');
select lives_ok($$ delete from public.people where id = pg_temp.p('yani') $$, 'deleting a person clears their ids in history');
select ok(exists (select 1 from public.task_commitments where task_id = pg_temp.t('yani') and committed_by is null), '… the commitment stays');
select lives_ok($$ delete from public.tasks where id = pg_temp.t('yani') $$, 'deleting a task takes its history with it (cascade)');
select is((select count(*) from public.comments where body = 'Catatan'), 0::bigint, '… comments included');

-- ---------------------------------------------------------------------------------------
-- Codex review: closed projects take no comments; a super admin's person is not deletable
-- ---------------------------------------------------------------------------------------
reset role;
update public.projects set status = 'selesai' where id = pg_temp.prj('MAM');
select pg_temp.login('mira');
select throws_ok($$ select public.add_comment('task', pg_temp.t('mam'), 'Masih bisa?') $$, 'P0001', null,
  'a closed project takes no new comments');
reset role;
select throws_ok($$ delete from public.people where id = pg_temp.p('dika') $$, '23514', null,
  'the person of a super admin cannot be deleted while the role stands');
insert into public.pending_system_roles (email, system_role) values ('gita@samb.test', 'super_admin');
select throws_ok($$ delete from public.people where id = pg_temp.p('gita') $$, '23514', null,
  '… nor one whose e-mail holds a pending super admin role');
delete from public.pending_system_roles where email = 'gita@samb.test';
select lives_ok($$ delete from public.people where id = pg_temp.p('gita') $$, 'once withdrawn, the person can be deleted');

select * from finish();
rollback;
