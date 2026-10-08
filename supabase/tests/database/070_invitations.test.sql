-- Invitations and membership management (docs/ARCHITECTURE.md §K). Fixture: _fixture.psql.
begin;
create extension if not exists pgtap with schema extensions;
\ir _fixture.psql

select * from no_plan();

-- ---------------------------------------------------------------------------------------
-- Super admin invites a new e-mail to several projects, a different role on each
-- ---------------------------------------------------------------------------------------
select pg_temp.login('dika');
select is((public.invite_member(jsonb_build_object('email', 'Teddy@SAMB.test', 'name', 'Teddy',
  'assignments', jsonb_build_array(
    jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'project_admin'),
    jsonb_build_object('project_id', pg_temp.prj('MAM'), 'role', 'member'),
    jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'viewer')))) ->> 'mode'), 'invited',
  'a new e-mail is invited');
select is((select count(*) from public.people p join public.people_contact c on c.person_id = p.id where c.email = 'teddy@samb.test'), 1::bigint,
  'one person is created, with the e-mail in lower case');
select is((select string_agg(pr.code || ':' || m.role, ',' order by pr.code)
             from public.project_members m join public.projects pr on pr.id = m.project_id
             join public.people_contact c on c.person_id = m.person_id where c.email = 'teddy@samb.test'),
  'BMG:viewer,MAM:member,MB:project_admin', 'each project gets its own role, at once');
select is((select status from public.invitations where email = 'teddy@samb.test'), 'pending', 'the invitation is pending');
select is((select count(*) from public.invitation_projects ip join public.invitations i on i.id = ip.invitation_id where i.email = 'teddy@samb.test'),
  3::bigint, 'with one normalised row per project');
select ok((select expires_at > now() + interval '13 days' from public.invitations where email = 'teddy@samb.test'), 'it expires in 14 days');

-- Inviting the same e-mail again updates the pending invitation instead of duplicating.
select is((public.invite_member(jsonb_build_object('email', 'teddy@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MAM'), 'role', 'viewer')))) ->> 'mode'), 'invited',
  'a second invitation to the same e-mail');
select is((select count(*) from public.invitations where email = 'teddy@samb.test'), 1::bigint, '… keeps one pending invitation');
select is((select role from public.project_members m join public.people_contact c on c.person_id = m.person_id
            where c.email = 'teddy@samb.test' and m.project_id = pg_temp.prj('MAM')), 'viewer', '… and changes the role on MAM');

-- Acceptance: the login is created (link), then used (first sign-in).
reset role;
insert into auth.users (id, email) values (pg_temp.u('teddy'), 'teddy@samb.test');
select is((select status from public.invitations where email = 'teddy@samb.test'), 'pending',
  'creating the login (generating a link) is not acceptance yet');
update auth.users set last_sign_in_at = now() where id = pg_temp.u('teddy');
select is((select status from public.invitations where email = 'teddy@samb.test'), 'accepted', 'the first sign-in accepts the invitation');
select pg_temp.login('teddy');
select is((select string_agg(code, ',' order by code) from public.projects), 'BMG,MAM,MB', 'Teddy sees exactly his three projects');
select is((select count(*) from public.projects where id not in (pg_temp.prj('MB'), pg_temp.prj('MAM'), pg_temp.prj('BMG'))), 0::bigint,
  '… and nothing else');

-- ---------------------------------------------------------------------------------------
-- Existing accounts: no duplicate, memberships updated
-- ---------------------------------------------------------------------------------------
reset role;
update auth.users set last_sign_in_at = now() where id = pg_temp.u('muti');
select pg_temp.login('dika');
select is((public.invite_member(jsonb_build_object('email', 'muti@samb.test',
  'assignments', jsonb_build_array(
    jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'viewer'),
    jsonb_build_object('project_id', pg_temp.prj('MAM'), 'role', 'member')))) ->> 'mode'), 'updated',
  'inviting an existing account updates its access');
select is((select count(*) from public.people_contact where email = 'muti@samb.test'), 1::bigint, 'no duplicate person');
select is((select count(*) from public.invitations where email = 'muti@samb.test'), 0::bigint, 'no invitation for an existing account');
select is((select string_agg(pr.code || ':' || m.role, ',' order by pr.code) from public.project_members m join public.projects pr on pr.id = m.project_id
            where m.person_id = pg_temp.p('muti')), 'MAM:member,MB:viewer', 'existing role changed and a project added');

-- ---------------------------------------------------------------------------------------
-- Revoke: undo the access it granted; the never-used login goes too
-- ---------------------------------------------------------------------------------------
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'rina@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'project_admin'),
                                   jsonb_build_object('project_id', pg_temp.prj('MAM'), 'role', 'viewer')))) $$,
  'Rina (a person without a login, member on MB) is invited');
select is((select role from public.project_members where person_id = pg_temp.p('rina') and project_id = pg_temp.prj('MB')), 'project_admin',
  'her MB role is raised at once');
reset role;
insert into auth.users (id, email) values (pg_temp.u('rina'), 'rina@samb.test');
select pg_temp.login('dika');
select lives_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'rina@samb.test')) $$, 'the invitation is revoked');
select is((select role from public.project_members where person_id = pg_temp.p('rina') and project_id = pg_temp.prj('MB')), 'member',
  'MB goes back to the role she had before');
select is((select count(*) from public.project_members where person_id = pg_temp.p('rina') and project_id = pg_temp.prj('MAM')), 0::bigint,
  'MAM access it added is removed');
select ok(exists (select 1 from public.people where id = pg_temp.p('rina')), 'the person stays');
select is((select status from public.invitations where email = 'rina@samb.test'), 'revoked', 'status revoked');
reset role;
select is((select count(*) from auth.users where id = pg_temp.u('rina')), 0::bigint, 'the unused login created for the invitation is deleted');
select throws_ok($$ insert into auth.users (id, email) values (gen_random_uuid(), 'rina@samb.test') $$, '42501', null,
  'a revoked invitation cannot be used to create a login');
select pg_temp.login('dika');
select throws_ok($$ select public.login_link_target(pg_temp.p('rina')) $$, 'P0001', null, '… nor to send a login link');
select throws_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'teddy@samb.test')) $$, 'P0001', null,
  'an accepted invitation cannot be revoked');

-- ---------------------------------------------------------------------------------------
-- Expiry
-- ---------------------------------------------------------------------------------------
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'lama@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'viewer')))) $$, 'an invitation');
reset role;
update public.invitations set expires_at = now() - interval '1 day' where email = 'lama@samb.test';
select throws_ok($$ insert into auth.users (id, email) values (gen_random_uuid(), 'lama@samb.test') $$, '42501', null,
  'an expired invitation cannot create a login');
select pg_temp.login('dika');
select throws_ok($$ select public.login_link_target((select person_id from public.invitations where email = 'lama@samb.test')) $$, 'P0001', null,
  'no login link for an expired invitation');
select is((public.invite_member(jsonb_build_object('email', 'lama@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'viewer')))) ->> 'mode'), 'invited',
  're-inviting creates a fresh pending invitation');
select is((select string_agg(status, ',' order by created_at) from public.invitations where email = 'lama@samb.test'), 'expired,pending',
  '… and keeps the expired one in the history');

-- ---------------------------------------------------------------------------------------
-- Project admins: own project, member/viewer only
-- ---------------------------------------------------------------------------------------
select pg_temp.login('bimo');
select is((public.invite_member(jsonb_build_object('email', 'staf.bmg@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'member')))) ->> 'mode'), 'invited',
  'a project admin invites a member to his project');
select throws_ok($$ select public.invite_member(jsonb_build_object('email', 'x@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('BMG'), 'role', 'project_admin')))) $$, '42501', null,
  '… but not as project admin');
select throws_ok($$ select public.invite_member(jsonb_build_object('email', 'x@samb.test', 'assignments', '[]'::jsonb)) $$, 'P0001', null,
  '… and not without a project');
select ok(public.login_link_target((select person_id from public.invitations where email = 'staf.bmg@samb.test')) ->> 'email' = 'staf.bmg@samb.test',
  '… and may send that person a login link');
select throws_ok($$ select public.login_link_target(pg_temp.p('muti')) $$, '42501', null, '… but not to anyone else');
select throws_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'lama@samb.test')) $$, 'P0002', null,
  'he cannot see invitations of other projects');
select lives_ok($$ select public.revoke_invitation((select id from public.invitations where email = 'staf.bmg@samb.test')) $$,
  'he revokes his own project''s invitation');

select pg_temp.login('david');
select lives_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('yani'), 'viewer') $$, 'a project admin changes a member to viewer');
select lives_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('yani'), null) $$, '… and removes her');
select throws_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('yani'), 'member') $$, 'P0002', null,
  '… someone he can no longer see is not offered by id');
select lives_ok($$ select public.invite_member(jsonb_build_object('email', 'yani@samb.test',
  'assignments', jsonb_build_array(jsonb_build_object('project_id', pg_temp.prj('MB'), 'role', 'member')))) $$,
  '… he adds her back by e-mail');
select is((select role from public.project_members where person_id = pg_temp.p('yani') and project_id = pg_temp.prj('MB')), 'member',
  '… with the role he chose');
select throws_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('dika'), 'member') $$, '42501', null,
  '… but cannot demote another project admin');
select throws_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('yani'), 'project_admin') $$, '42501', null,
  '… nor create a project admin');
select throws_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('david'), 'viewer') $$, '42501', null,
  '… nor change his own access');
select throws_ok($$ select public.set_member_role(pg_temp.prj('MB'), pg_temp.p('bimo'), 'viewer') $$, 'P0002', null,
  '… nor add someone he cannot see');
select throws_ok($$ select public.set_member_role(pg_temp.prj('BMG'), pg_temp.p('yani'), 'viewer') $$, 'P0002', null,
  '… and has no rights outside his projects');

select pg_temp.login('muti');
select throws_ok($$ select public.set_member_role(pg_temp.prj('MAM'), pg_temp.p('yani'), 'viewer') $$, '42501', null, 'a member manages no access');

-- System roles
select pg_temp.login('dika');
select lives_ok($$ select public.set_system_role(pg_temp.p('david'), 'super_admin') $$, 'the super admin makes David super admin');
select pg_temp.login('david');
select is((select count(*) from public.projects), 3::bigint, '… who now reads every project');
select lives_ok($$ select public.set_system_role(pg_temp.p('david'), 'user') $$, '… and can step down while another super admin remains');
select pg_temp.login('dika');
select throws_ok($$ select public.set_system_role(pg_temp.p('dika'), 'user') $$, '23514', null, 'the last super admin cannot step down');
select throws_ok($$ select public.set_system_role(pg_temp.p('rina'), 'super_admin') $$, 'P0001', null, 'a person without a login cannot get a system role');

select * from finish();
rollback;
