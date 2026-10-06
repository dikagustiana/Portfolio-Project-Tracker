
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"after": Json | null,"at": string,"before": Json | null,"id": number,"row_id": string | null,"table_name": string
                  }
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: never,"row_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: never,"row_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_roles": {
                  Row: {
                    "role": string,"user_id": string
                  }
                  Insert: {
                    "role": string,"user_id": string
                  }
                  Update: {
                    "role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"asks": {
                  Row: {
                    "answer": string | null,"created_at": string,"created_by": string | null,"decided_at": string | null,"decided_by": string | null,"decided_on": string | null,"decider_name": string,"decider_person_id": string | null,"due": string | null,"forum": string,"id": string,"legacy_id": string | null,"milestone_id": string | null,"project_id": string,"question": string,"status": string
                  }
                  Insert: {
                    "answer"?: string | null,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decided_on"?: string | null,"decider_name"?: string,"decider_person_id"?: string | null,"due"?: string | null,"forum"?: string,"id"?: string,"legacy_id"?: string | null,"milestone_id"?: string | null,"project_id": string,"question": string,"status"?: string
                  }
                  Update: {
                    "answer"?: string | null,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decided_on"?: string | null,"decider_name"?: string,"decider_person_id"?: string | null,"due"?: string | null,"forum"?: string,"id"?: string,"legacy_id"?: string | null,"milestone_id"?: string | null,"project_id"?: string,"question"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "asks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asks_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asks_decider_person_id_fkey"
      columns: ["decider_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asks_milestone_same_project"
      columns: ["milestone_id","project_id"]
isOneToOne: false
      referencedRelation: "milestones"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "asks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"decisions": {
                  Row: {
                    "decided_on": string | null,"decider_name": string,"forum": string,"id": string,"kind": string,"milestone_id": string | null,"note": string,"project_id": string,"recorded_at": string,"recorded_by": string | null,"status": string
                  }
                  Insert: {
                    "decided_on"?: string | null,"decider_name"?: string,"forum"?: string,"id"?: string,"kind": string,"milestone_id"?: string | null,"note"?: string,"project_id": string,"recorded_at"?: string,"recorded_by"?: string | null,"status": string
                  }
                  Update: {
                    "decided_on"?: string | null,"decider_name"?: string,"forum"?: string,"id"?: string,"kind"?: string,"milestone_id"?: string | null,"note"?: string,"project_id"?: string,"recorded_at"?: string,"recorded_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "decisions_milestone_same_project"
      columns: ["milestone_id","project_id"]
isOneToOne: false
      referencedRelation: "milestones"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "decisions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisions_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"email_log": {
                  Row: {
                    "created_at": string,"id": string,"provider": string,"results": NonNullable<Json>,"run_date": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"provider": string,"results"?: NonNullable<Json>,"run_date": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"provider"?: string,"results"?: NonNullable<Json>,"run_date"?: string
                  }
                  Relationships: [
                    
                  ]
                },"entities": {
                  Row: {
                    "code": string,"label": string,"legal_name": string | null,"sort": number
                  }
                  Insert: {
                    "code": string,"label": string,"legal_name"?: string | null,"sort"?: number
                  }
                  Update: {
                    "code"?: string,"label"?: string,"legal_name"?: string | null,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"holidays": {
                  Row: {
                    "date": string,"name": string,"source": string,"type": string
                  }
                  Insert: {
                    "date": string,"name": string,"source"?: string,"type": string
                  }
                  Update: {
                    "date"?: string,"name"?: string,"source"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"milestones": {
                  Row: {
                    "approver_person_id": string | null,"code": string | null,"created_at": string,"criteria": string,"fallback": string,"id": string,"last_decision": string | null,"legacy_id": string | null,"mode": string,"project_id": string,"sort_order": number,"status": string | null,"target": string | null,"title": string,"trigger": string
                  }
                  Insert: {
                    "approver_person_id"?: string | null,"code"?: string | null,"created_at"?: string,"criteria"?: string,"fallback"?: string,"id"?: string,"last_decision"?: string | null,"legacy_id"?: string | null,"mode"?: string,"project_id": string,"sort_order"?: number,"status"?: string | null,"target"?: string | null,"title": string,"trigger"?: string
                  }
                  Update: {
                    "approver_person_id"?: string | null,"code"?: string | null,"created_at"?: string,"criteria"?: string,"fallback"?: string,"id"?: string,"last_decision"?: string | null,"legacy_id"?: string | null,"mode"?: string,"project_id"?: string,"sort_order"?: number,"status"?: string | null,"target"?: string | null,"title"?: string,"trigger"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_approver_person_id_fkey"
      columns: ["approver_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"org_settings": {
                  Row: {
                    "app_url": string,"cuti_bersama_is_workday": boolean,"email_paused": boolean,"email_provider": string,"email_time": string,"id": boolean,"timezone": string
                  }
                  Insert: {
                    "app_url"?: string,"cuti_bersama_is_workday"?: boolean,"email_paused"?: boolean,"email_provider"?: string,"email_time"?: string,"id"?: boolean,"timezone"?: string
                  }
                  Update: {
                    "app_url"?: string,"cuti_bersama_is_workday"?: boolean,"email_paused"?: boolean,"email_provider"?: string,"email_time"?: string,"id"?: boolean,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pending_app_roles": {
                  Row: {
                    "created_at": string,"email": string,"role": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"role": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"people": {
                  Row: {
                    "created_at": string,"display_name": string,"email_daily": boolean,"id": string,"job_title": string,"legacy_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"display_name": string,"email_daily"?: boolean,"id"?: string,"job_title"?: string,"legacy_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"email_daily"?: boolean,"id"?: string,"job_title"?: string,"legacy_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"people_contact": {
                  Row: {
                    "email": string,"person_id": string
                  }
                  Insert: {
                    "email": string,"person_id": string
                  }
                  Update: {
                    "email"?: string,"person_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "people_contact_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"project_members": {
                  Row: {
                    "person_id": string,"project_id": string,"role": string
                  }
                  Insert: {
                    "person_id": string,"project_id": string,"role": string
                  }
                  Update: {
                    "person_id"?: string,"project_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_members_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "close_decided_on": string | null,"close_decider_name": string | null,"close_forum": string | null,"close_note": string | null,"closed_at": string | null,"closed_by": string | null,"color": string,"created_at": string,"created_by": string | null,"entity_code": string,"gate_mode": boolean,"id": string,"legacy_id": string | null,"maturity": string,"measure": string,"name": string,"outcome": string,"parallel_gates": boolean,"pm_person_id": string | null,"status": string,"step_template_id": string | null
                  }
                  Insert: {
                    "close_decided_on"?: string | null,"close_decider_name"?: string | null,"close_forum"?: string | null,"close_note"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"entity_code": string,"gate_mode"?: boolean,"id"?: string,"legacy_id"?: string | null,"maturity"?: string,"measure"?: string,"name": string,"outcome"?: string,"parallel_gates"?: boolean,"pm_person_id"?: string | null,"status"?: string,"step_template_id"?: string | null
                  }
                  Update: {
                    "close_decided_on"?: string | null,"close_decider_name"?: string | null,"close_forum"?: string | null,"close_note"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"entity_code"?: string,"gate_mode"?: boolean,"id"?: string,"legacy_id"?: string | null,"maturity"?: string,"measure"?: string,"name"?: string,"outcome"?: string,"parallel_gates"?: boolean,"pm_person_id"?: string | null,"status"?: string,"step_template_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_entity_code_fkey"
      columns: ["entity_code"]
isOneToOne: false
      referencedRelation: "entities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "projects_pm_person_id_fkey"
      columns: ["pm_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_step_template_id_fkey"
      columns: ["step_template_id"]
isOneToOne: false
      referencedRelation: "step_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"message": string,"note": string | null,"project_id": string,"sent_at": string | null,"status": string,"task_id": string | null,"to_person_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"message": string,"note"?: string | null,"project_id": string,"sent_at"?: string | null,"status"?: string,"task_id"?: string | null,"to_person_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"message"?: string,"note"?: string | null,"project_id"?: string,"sent_at"?: string | null,"status"?: string,"task_id"?: string | null,"to_person_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_task_same_project"
      columns: ["task_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "reminders_to_person_id_fkey"
      columns: ["to_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"step_templates": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"task_deps": {
                  Row: {
                    "depends_on_task_id": string,"project_id": string,"task_id": string
                  }
                  Insert: {
                    "depends_on_task_id": string,"project_id": string,"task_id": string
                  }
                  Update: {
                    "depends_on_task_id"?: string,"project_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_deps_dep_fk"
      columns: ["depends_on_task_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "task_deps_task_fk"
      columns: ["task_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    }
                  ]
                },"task_steps": {
                  Row: {
                    "task_id": string,"template_step_id": string
                  }
                  Insert: {
                    "task_id": string,"template_step_id": string
                  }
                  Update: {
                    "task_id"?: string,"template_step_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_steps_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_steps_template_step_id_fkey"
      columns: ["template_step_id"]
isOneToOne: false
      referencedRelation: "template_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"assignee_person_id": string | null,"committed": boolean,"committed_at": string | null,"committed_by": string | null,"created_at": string,"created_by": string | null,"description": string,"done_at": string | null,"end_date": string,"evidence": string | null,"id": string,"legacy_id": string | null,"milestone_id": string | null,"project_id": string,"proof_requested": string,"reject_reason": string | null,"rejected_at": string | null,"rejected_by": string | null,"stage": string,"start_date": string,"submitted_at": string | null,"submitted_by": string | null,"title": string,"validator_person_id": string | null
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"assignee_person_id"?: string | null,"committed"?: boolean,"committed_at"?: string | null,"committed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"done_at"?: string | null,"end_date": string,"evidence"?: string | null,"id"?: string,"legacy_id"?: string | null,"milestone_id"?: string | null,"project_id": string,"proof_requested"?: string,"reject_reason"?: string | null,"rejected_at"?: string | null,"rejected_by"?: string | null,"stage"?: string,"start_date": string,"submitted_at"?: string | null,"submitted_by"?: string | null,"title": string,"validator_person_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"assignee_person_id"?: string | null,"committed"?: boolean,"committed_at"?: string | null,"committed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"done_at"?: string | null,"end_date"?: string,"evidence"?: string | null,"id"?: string,"legacy_id"?: string | null,"milestone_id"?: string | null,"project_id"?: string,"proof_requested"?: string,"reject_reason"?: string | null,"rejected_at"?: string | null,"rejected_by"?: string | null,"stage"?: string,"start_date"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"title"?: string,"validator_person_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_assignee_person_id_fkey"
      columns: ["assignee_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_committed_by_fkey"
      columns: ["committed_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_milestone_same_project"
      columns: ["milestone_id","project_id"]
isOneToOne: false
      referencedRelation: "milestones"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_rejected_by_fkey"
      columns: ["rejected_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_validator_person_id_fkey"
      columns: ["validator_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"template_steps": {
                  Row: {
                    "code": string,"id": string,"kind": string,"label_no": string,"name": string,"need": string,"sort": number,"template_id": string
                  }
                  Insert: {
                    "code": string,"id"?: string,"kind": string,"label_no"?: string,"name": string,"need"?: string,"sort"?: number,"template_id": string
                  }
                  Update: {
                    "code"?: string,"id"?: string,"kind"?: string,"label_no"?: string,"name"?: string,"need"?: string,"sort"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_steps_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "step_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"user_calendar": {
                  Row: {
                    "added_at": string,"end_date": string,"provider": string | null,"task_id": string,"title": string,"user_id": string
                  }
                  Insert: {
                    "added_at"?: string,"end_date": string,"provider"?: string | null,"task_id": string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "added_at"?: string,"end_date"?: string,"provider"?: string | null,"task_id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_people_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"invited_at": string,"last_sign_in_at": string,"person_id": string,"user_id": string
            }[]
                           },
"close_project":
{ Args: { "p_decided_on"?: string,"p_decider_name"?: string,"p_forum"?: string,"p_note": string,"p_project": string }; Returns: undefined
                           },
"commit_task_dates":
{ Args: { "p_end"?: string,"p_start"?: string,"p_task": string }; Returns: undefined
                           },
"create_project":
{ Args: { "p": Json }; Returns: string
                           },
"create_reminder":
{ Args: { "p_message": string,"p_task": string }; Returns: string
                           },
"decide_ask":
{ Args: { "p_answer": string,"p_ask": string,"p_decided_on"?: string,"p_decider_name"?: string,"p_forum"?: string }; Returns: undefined
                           },
"decide_gate":
{ Args: { "p_decided_on"?: string,"p_decider_name"?: string,"p_decision": string,"p_forum"?: string,"p_milestone": string,"p_note": string }; Returns: undefined
                           },
"delete_ask":
{ Args: { "p_ask": string }; Returns: undefined
                           },
"delete_milestone":
{ Args: { "p_milestone": string }; Returns: undefined
                           },
"delete_project":
{ Args: { "p_project": string }; Returns: undefined
                           },
"delete_task":
{ Args: { "p_task": string }; Returns: undefined
                           },
"move_milestone":
{ Args: { "p_dir": number,"p_milestone": string }; Returns: undefined
                           },
"reopen_ask":
{ Args: { "p_ask": string }; Returns: undefined
                           },
"reopen_project":
{ Args: { "p_decided_on"?: string,"p_decider_name"?: string,"p_forum"?: string,"p_note": string,"p_project": string }; Returns: undefined
                           },
"reopen_task":
{ Args: { "p_task": string }; Returns: undefined
                           },
"review_task":
{ Args: { "p_decision": string,"p_reason"?: string,"p_task": string }; Returns: undefined
                           },
"save_ask":
{ Args: { "p": Json }; Returns: string
                           },
"save_milestone":
{ Args: { "p": Json }; Returns: string
                           },
"save_task":
{ Args: { "p": Json }; Returns: string
                           },
"set_task_stage":
{ Args: { "p_stage": string,"p_task": string }; Returns: undefined
                           },
"stop_project":
{ Args: { "p_decided_on"?: string,"p_decider_name"?: string,"p_forum"?: string,"p_note": string,"p_project": string }; Returns: undefined
                           },
"submit_task":
{ Args: { "p_evidence": string,"p_task": string }; Returns: undefined
                           },
"update_project":
{ Args: { "p": Json }; Returns: undefined
                           },
"whoami":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"withdraw_submission":
{ Args: { "p_task": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
