# Access policies

Generated from the database catalog by `scripts/access-report.sql` (`npm run db:report`). Do not edit by hand.

## Table privileges

`anon` has no privileges anywhere. `service_role` (server-side only) bypasses RLS and is not listed.

| Table | RLS | authenticated may |
|---|---|---|
| `activity_log` | on | select |
| `app_roles` | on | delete, insert, select, update |
| `asks` | on | select |
| `decisions` | on | select |
| `email_log` | on | select |
| `entities` | on | delete, insert, select, update |
| `holidays` | on | delete, insert, select, update |
| `milestones` | on | select |
| `org_settings` | on | select, update |
| `pending_app_roles` | on | delete, insert, select, update |
| `people` | on | delete, insert, select, update |
| `people_contact` | on | delete, insert, select, update |
| `project_members` | on | delete, insert, select, update |
| `projects` | on | select |
| `reminders` | on | select |
| `step_templates` | on | delete, insert, select, update |
| `task_deps` | on | select |
| `task_steps` | on | select |
| `tasks` | on | select |
| `template_steps` | on | delete, insert, select, update |
| `user_calendar` | on | delete, insert, select, update |

## Row-level security policies

| Table | Policy | For | Using | With check |
|---|---|---|---|---|
| `activity_log` | activity_log_owner_read | select | `( SELECT private.is_owner() AS is_owner)` |  |
| `app_roles` | app_roles_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `app_roles` | app_roles_read | select | `((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_owner() AS is_owner))` |  |
| `asks` | asks_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `decisions` | decisions_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `email_log` | email_log_owner_read | select | `( SELECT private.is_owner() AS is_owner)` |  |
| `entities` | entities_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `entities` | entities_read | select | `true` |  |
| `holidays` | holidays_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `holidays` | holidays_read | select | `true` |  |
| `milestones` | milestones_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `org_settings` | org_settings_owner_update | update | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `org_settings` | org_settings_read | select | `true` |  |
| `pending_app_roles` | pending_app_roles_owner | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `people` | people_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `people` | people_read | select | `(id IN ( SELECT private.visible_person_ids() AS visible_person_ids))` |  |
| `people_contact` | people_contact_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `people_contact` | people_contact_read | select | `private.contact_visible(person_id)` |  |
| `project_members` | project_members_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `project_members` | project_members_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `projects` | projects_read | select | `(id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `reminders` | reminders_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `step_templates` | step_templates_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `step_templates` | step_templates_read | select | `true` |  |
| `task_deps` | task_deps_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `task_steps` | task_steps_read | select | `(task_id IN ( SELECT t.id FROM tasks t WHERE (t.project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))))` |  |
| `tasks` | tasks_read | select | `(project_id IN ( SELECT private.readable_project_ids() AS readable_project_ids))` |  |
| `template_steps` | template_steps_owner_write | all | `( SELECT private.is_owner() AS is_owner)` | `( SELECT private.is_owner() AS is_owner)` |
| `template_steps` | template_steps_read | select | `true` |  |
| `user_calendar` | user_calendar_own | all | `(user_id = ( SELECT auth.uid() AS uid))` | `(user_id = ( SELECT auth.uid() AS uid))` |

## RPCs (the only write path for project data)

All are `SECURITY DEFINER` with an empty `search_path`; each checks visibility, the project lock and the caller's role before writing.

| Function | Arguments | Executable by |
|---|---|---|
| `admin_people_status` |  | authenticated |
| `close_project` | p_project uuid, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `commit_task_dates` | p_task uuid, p_start date, p_end date | authenticated |
| `create_project` | p jsonb | authenticated |
| `create_reminder` | p_task uuid, p_message text | authenticated |
| `decide_ask` | p_ask uuid, p_answer text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `decide_gate` | p_milestone uuid, p_decision text, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `delete_ask` | p_ask uuid | authenticated |
| `delete_milestone` | p_milestone uuid | authenticated |
| `delete_project` | p_project uuid | authenticated |
| `delete_task` | p_task uuid | authenticated |
| `move_milestone` | p_milestone uuid, p_dir integer | authenticated |
| `reopen_ask` | p_ask uuid | authenticated |
| `reopen_project` | p_project uuid, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `reopen_task` | p_task uuid | authenticated |
| `review_task` | p_task uuid, p_decision text, p_reason text | authenticated |
| `save_ask` | p jsonb | authenticated |
| `save_milestone` | p jsonb | authenticated |
| `save_task` | p jsonb | authenticated |
| `set_task_stage` | p_task uuid, p_stage text | authenticated |
| `stop_project` | p_project uuid, p_note text, p_decider_name text, p_forum text, p_decided_on date | authenticated |
| `submit_task` | p_task uuid, p_evidence text | authenticated |
| `update_project` | p jsonb | authenticated |
| `whoami` |  | authenticated |
| `withdraw_submission` | p_task uuid | authenticated |

## Realtime

Published tables (each subscriber only receives rows its SELECT policies allow):

- `asks`
- `decisions`
- `entities`
- `holidays`
- `milestones`
- `org_settings`
- `people`
- `project_members`
- `projects`
- `reminders`
- `step_templates`
- `task_deps`
- `task_steps`
- `tasks`
- `template_steps`
- `user_calendar`
