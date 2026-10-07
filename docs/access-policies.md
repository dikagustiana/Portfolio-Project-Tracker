# Access policies

Generated from the database catalog by `scripts/access-report.sql` (`npm run db:report`). Do not edit by hand.

## Table privileges

`anon` has no privileges anywhere. `service_role` (server-side only) bypasses RLS and is not listed.

| Table | RLS | authenticated may |
|---|---|---|
| `activity_log` | on | select |
| `ask_tasks` | on | select |
| `asks` | on | select |
| `comments` | on | select |
| `decisions` | on | select |
| `email_log` | on | select |
| `entities` | on | delete, insert, select, update |
| `functions` | on | delete, insert, select, update |
| `holidays` | on | delete, insert, select, update |
| `invitation_projects` | on | select |
| `invitations` | on | select |
| `migration_flags` | on | select |
| `milestones` | on | select |
| `org_settings` | on | select, update |
| `pending_system_roles` | on | delete, insert, select |
| `people` | on | delete, insert, select, update |
| `people_contact` | on | delete, insert, select, update |
| `profiles` | on | select |
| `project_events` | on | select |
| `project_members` | on | delete, insert, select, update |
| `projects` | on | select |
| `reminders` | on | select |
| `step_templates` | on | delete, insert, select, update |
| `task_blockers` | on | select |
| `task_commitments` | on | select |
| `task_deps` | on | select |
| `task_reviews` | on | select |
| `task_steps` | on | select |
| `tasks` | on | select |
| `template_steps` | on | delete, insert, select, update |
| `user_calendar` | on | delete, insert, select, update |

## Row-level security policies

| Table | Policy | For | Using | With check |
|---|---|---|---|---|
| `activity_log` | activity_log_admin_read | select | `( SELECT private.is_super_admin() AS is_super_admin)` |  |
| `ask_tasks` | ask_tasks_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `asks` | asks_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `comments` | comments_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `decisions` | decisions_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `email_log` | email_log_admin_read | select | `( SELECT private.is_super_admin() AS is_super_admin)` |  |
| `entities` | entities_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `entities` | entities_read | select | `true` |  |
| `functions` | functions_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `functions` | functions_read | select | `true` |  |
| `holidays` | holidays_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `holidays` | holidays_read | select | `true` |  |
| `invitation_projects` | invitation_projects_read | select | `(( SELECT private.is_super_admin() AS is_super_admin) OR private.is_project_admin(project_id))` |  |
| `invitations` | invitations_read | select | `private.can_see_invitation(id)` |  |
| `migration_flags` | migration_flags_read | select | `private.is_project_admin(project_id)` |  |
| `milestones` | milestones_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `org_settings` | org_settings_admin_update | update | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `org_settings` | org_settings_read | select | `true` |  |
| `pending_system_roles` | pending_system_roles_admin | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `people` | people_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `people` | people_read | select | `(id IN ( SELECT private.visible_person_ids() AS visible_person_ids))` |  |
| `people_contact` | people_contact_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `people_contact` | people_contact_read | select | `private.contact_visible(person_id)` |  |
| `profiles` | profiles_read | select | `((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_super_admin() AS is_super_admin))` |  |
| `project_events` | project_events_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `project_members` | project_members_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `project_members` | project_members_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `projects` | projects_read | select | `(id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `reminders` | reminders_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `step_templates` | step_templates_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `step_templates` | step_templates_read | select | `true` |  |
| `task_blockers` | task_blockers_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `task_commitments` | task_commitments_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `task_deps` | task_deps_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `task_reviews` | task_reviews_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `task_steps` | task_steps_read | select | `(task_id IN ( SELECT t.id FROM tasks t WHERE (t.project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))))` |  |
| `tasks` | tasks_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `template_steps` | template_steps_admin_write | all | `( SELECT private.is_super_admin() AS is_super_admin)` | `( SELECT private.is_super_admin() AS is_super_admin)` |
| `template_steps` | template_steps_read | select | `true` |  |
| `user_calendar` | user_calendar_own | all | `(user_id = ( SELECT auth.uid() AS uid))` | `(user_id = ( SELECT auth.uid() AS uid))` |

## RPCs (the only write path for project data)

All are `SECURITY DEFINER` with an empty `search_path`; each checks visibility, the project lock and the caller's role before writing.

| Function | Arguments | Executable by |
|---|---|---|
| `add_comment` | p_target text, p_id uuid, p_body text | authenticated |
| `admin_people_status` |  | authenticated |
| `close_project` | p_project uuid, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `commit_task_dates` | p_task uuid, p_start date, p_end date | authenticated |
| `create_project` | p jsonb | authenticated |
| `create_reminder` | p_task uuid, p_message text | authenticated |
| `decide_ask` | p_ask uuid, p_answer text, p_decider_name text, p_forum text, p_decided_on date, p_rationale text | authenticated |
| `decide_gate` | p_milestone uuid, p_decision text, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `delete_ask` | p_ask uuid | authenticated |
| `delete_milestone` | p_milestone uuid | authenticated |
| `delete_project` | p_project uuid | authenticated |
| `delete_task` | p_task uuid | authenticated |
| `escalate_blocker` | p_blocker uuid, p jsonb | authenticated |
| `invite_member` | p jsonb | authenticated |
| `login_link_target` | p_person uuid | authenticated |
| `move_milestone` | p_milestone uuid, p_dir integer | authenticated |
| `raise_blocker` | p_task uuid, p_reason text, p_need text, p_from_person uuid, p_from_function uuid, p_target date | authenticated |
| `reopen_ask` | p_ask uuid, p_reason text | authenticated |
| `reopen_project` | p_project uuid, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `reopen_task` | p_task uuid | authenticated |
| `resolve_blocker` | p_blocker uuid, p_resolution text | authenticated |
| `resolve_migration_flag` | p_flag bigint | authenticated |
| `review_task` | p_task uuid, p_decision text, p_reason text | authenticated |
| `revoke_invitation` | p_invitation uuid | authenticated |
| `save_ask` | p jsonb | authenticated |
| `save_milestone` | p jsonb | authenticated |
| `save_task` | p jsonb | authenticated |
| `set_member_role` | p_project uuid, p_person uuid, p_role text | authenticated |
| `set_system_role` | p_person uuid, p_role text | authenticated |
| `set_task_stage` | p_task uuid, p_stage text | authenticated |
| `stop_project` | p_project uuid, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `submit_task` | p_task uuid, p_evidence text | authenticated |
| `update_project` | p jsonb | authenticated |
| `whoami` |  | authenticated |
| `withdraw_submission` | p_task uuid | authenticated |

## Realtime

Published tables (each subscriber only receives rows its SELECT policies allow):

- `ask_tasks`
- `asks`
- `comments`
- `decisions`
- `entities`
- `functions`
- `holidays`
- `milestones`
- `org_settings`
- `people`
- `project_events`
- `project_members`
- `projects`
- `reminders`
- `step_templates`
- `task_blockers`
- `task_commitments`
- `task_deps`
- `task_reviews`
- `task_steps`
- `tasks`
- `template_steps`
- `user_calendar`
