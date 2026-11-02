
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
            "automation_runs": {
                  Row: {
                    "error_summary": string | null,"execution_reference": string | null,"finished_at": string | null,"id": string,"metadata": NonNullable<Json>,"records_processed": number,"started_at": string,"status": string,"workflow_name": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "error_summary"?: string | null,"execution_reference"?: string | null,"finished_at"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"records_processed"?: number,"started_at"?: string,"status": string,"workflow_name": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "error_summary"?: string | null,"execution_reference"?: string | null,"finished_at"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"records_processed"?: number,"started_at"?: string,"status"?: string,"workflow_name"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_runs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"business_profiles": {
                  Row: {
                    "company_name": string,"created_at": string,"description": string | null,"excluded_segments": (string)[],"id": string,"ideal_customer_profile": NonNullable<Json>,"target_geographies": (string)[],"target_industries": (string)[],"updated_at": string,"website_url": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_name": string,"created_at"?: string,"description"?: string | null,"excluded_segments"?: (string)[],"id"?: string,"ideal_customer_profile"?: NonNullable<Json>,"target_geographies"?: (string)[],"target_industries"?: (string)[],"updated_at"?: string,"website_url"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "company_name"?: string,"created_at"?: string,"description"?: string | null,"excluded_segments"?: (string)[],"id"?: string,"ideal_customer_profile"?: NonNullable<Json>,"target_geographies"?: (string)[],"target_industries"?: (string)[],"updated_at"?: string,"website_url"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_profiles_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_events": {
                  Row: {
                    "channel": string | null,"created_by": string | null,"draft_id": string | null,"event_type": string,"id": string,"lead_id": string,"notes": string | null,"occurred_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel"?: string | null,"created_by"?: string | null,"draft_id"?: string | null,"event_type": string,"id"?: string,"lead_id": string,"notes"?: string | null,"occurred_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "channel"?: string | null,"created_by"?: string | null,"draft_id"?: string | null,"event_type"?: string,"id"?: string,"lead_id"?: string,"notes"?: string | null,"occurred_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_events_workspace_id_draft_id_fkey"
      columns: ["workspace_id","draft_id"]
isOneToOne: false
      referencedRelation: "outreach_drafts"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "contact_events_workspace_id_lead_id_fkey"
      columns: ["workspace_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"data_erasures": {
                  Row: {
                    "erased_at": string,"erased_by": string | null,"erased_lead_id": string,"id": string,"reason": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "erased_at"?: string,"erased_by"?: string | null,"erased_lead_id": string,"id"?: string,"reason": string,"workspace_id": string
                  }
                  Update: {
                    "erased_at"?: string,"erased_by"?: string | null,"erased_lead_id"?: string,"id"?: string,"reason"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_erasures_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"ingestion_records": {
                  Row: {
                    "created_at": string,"idempotency_key": string,"lead_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"idempotency_key": string,"lead_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"idempotency_key"?: string,"lead_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingestion_records_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingestion_records_workspace_id_lead_id_fkey"
      columns: ["workspace_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"lead_analyses": {
                  Row: {
                    "budget_currency": string | null,"budget_max": number | null,"budget_min": number | null,"buying_intent": string,"confidence": number,"created_at": string,"disqualifier": string | null,"evidence": NonNullable<Json>,"id": string,"input_tokens": number | null,"is_business_opportunity": boolean,"lead_id": string,"lead_summary": string | null,"missing_information": NonNullable<Json>,"model_name": string,"model_provider": string,"organisation_name": string | null,"output_tokens": number | null,"problem_summary": string | null,"prompt_version": string,"raw_structured_output": NonNullable<Json>,"recommended_action": string,"requirements": NonNullable<Json>,"score_budget_evidence": number,"score_buying_intent": number,"score_capability_match": number,"score_project_clarity": number,"score_recency": number,"score_service_relevance": number,"total_score": number | null,"urgency": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_currency"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"buying_intent": string,"confidence": number,"created_at"?: string,"disqualifier"?: string | null,"evidence"?: NonNullable<Json>,"id"?: string,"input_tokens"?: number | null,"is_business_opportunity": boolean,"lead_id": string,"lead_summary"?: string | null,"missing_information"?: NonNullable<Json>,"model_name": string,"model_provider": string,"organisation_name"?: string | null,"output_tokens"?: number | null,"problem_summary"?: string | null,"prompt_version": string,"raw_structured_output"?: NonNullable<Json>,"recommended_action": string,"requirements"?: NonNullable<Json>,"score_budget_evidence": number,"score_buying_intent": number,"score_capability_match": number,"score_project_clarity": number,"score_recency": number,"score_service_relevance": number,"total_score"?: never,"urgency": string,"workspace_id": string
                  }
                  Update: {
                    "budget_currency"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"buying_intent"?: string,"confidence"?: number,"created_at"?: string,"disqualifier"?: string | null,"evidence"?: NonNullable<Json>,"id"?: string,"input_tokens"?: number | null,"is_business_opportunity"?: boolean,"lead_id"?: string,"lead_summary"?: string | null,"missing_information"?: NonNullable<Json>,"model_name"?: string,"model_provider"?: string,"organisation_name"?: string | null,"output_tokens"?: number | null,"problem_summary"?: string | null,"prompt_version"?: string,"raw_structured_output"?: NonNullable<Json>,"recommended_action"?: string,"requirements"?: NonNullable<Json>,"score_budget_evidence"?: number,"score_buying_intent"?: number,"score_capability_match"?: number,"score_project_clarity"?: number,"score_recency"?: number,"score_service_relevance"?: number,"total_score"?: never,"urgency"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_analyses_workspace_id_lead_id_fkey"
      columns: ["workspace_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"lead_analysis_services": {
                  Row: {
                    "analysis_id": string,"evidence": NonNullable<Json>,"service_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analysis_id": string,"evidence"?: NonNullable<Json>,"service_id": string,"workspace_id": string
                  }
                  Update: {
                    "analysis_id"?: string,"evidence"?: NonNullable<Json>,"service_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_analysis_services_workspace_id_analysis_id_fkey"
      columns: ["workspace_id","analysis_id"]
isOneToOne: false
      referencedRelation: "lead_analyses"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "lead_analysis_services_workspace_id_service_id_fkey"
      columns: ["workspace_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "author_handle": string | null,"budget_currency": string | null,"budget_max": number | null,"budget_min": number | null,"buying_intent": string | null,"canonical_url": string | null,"confidence": number | null,"contact_channel": string | null,"contact_hash": string,"contact_value": string | null,"content_hash": string | null,"country_code": string | null,"created_at": string,"created_by": string | null,"discovered_at": string,"disqualification_reason": string | null,"id": string,"industry": string | null,"lead_score": number | null,"next_action_at": string | null,"organisation_name": string | null,"original_content": string,"project_description": string | null,"project_title": string | null,"published_at": string | null,"qualification_attempts": number,"qualification_claimed_at": string | null,"qualification_last_error": string | null,"requirements": NonNullable<Json>,"retain_until": string | null,"service_categories": (string)[],"source_config_id": string | null,"source_record_id": string | null,"source_type": string,"source_url": string | null,"status": string,"updated_at": string,"urgency": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_handle"?: string | null,"budget_currency"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"buying_intent"?: string | null,"canonical_url"?: string | null,"confidence"?: number | null,"contact_channel"?: string | null,"contact_hash": string,"contact_value"?: string | null,"content_hash"?: string | null,"country_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"discovered_at"?: string,"disqualification_reason"?: string | null,"id"?: string,"industry"?: string | null,"lead_score"?: number | null,"next_action_at"?: string | null,"organisation_name"?: string | null,"original_content": string,"project_description"?: string | null,"project_title"?: string | null,"published_at"?: string | null,"qualification_attempts"?: number,"qualification_claimed_at"?: string | null,"qualification_last_error"?: string | null,"requirements"?: NonNullable<Json>,"retain_until"?: string | null,"service_categories"?: (string)[],"source_config_id"?: string | null,"source_record_id"?: string | null,"source_type": string,"source_url"?: string | null,"status"?: string,"updated_at"?: string,"urgency"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "author_handle"?: string | null,"budget_currency"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"buying_intent"?: string | null,"canonical_url"?: string | null,"confidence"?: number | null,"contact_channel"?: string | null,"contact_hash"?: string,"contact_value"?: string | null,"content_hash"?: string | null,"country_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"discovered_at"?: string,"disqualification_reason"?: string | null,"id"?: string,"industry"?: string | null,"lead_score"?: number | null,"next_action_at"?: string | null,"organisation_name"?: string | null,"original_content"?: string,"project_description"?: string | null,"project_title"?: string | null,"published_at"?: string | null,"qualification_attempts"?: number,"qualification_claimed_at"?: string | null,"qualification_last_error"?: string | null,"requirements"?: NonNullable<Json>,"retain_until"?: string | null,"service_categories"?: (string)[],"source_config_id"?: string | null,"source_record_id"?: string | null,"source_type"?: string,"source_url"?: string | null,"status"?: string,"updated_at"?: string,"urgency"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_workspace_id_source_config_id_fkey"
      columns: ["workspace_id","source_config_id"]
isOneToOne: false
      referencedRelation: "source_configs"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"outreach_drafts": {
                  Row: {
                    "ai_original_message": string,"analysis_id": string,"approved_at": string | null,"approved_by": string | null,"channel": string,"created_at": string,"edited_at": string | null,"edited_by": string | null,"id": string,"lead_id": string,"message": string,"prompt_version": string,"rejected_at": string | null,"rejected_by": string | null,"rejection_reason": string | null,"sent_at": string | null,"status": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_original_message": string,"analysis_id": string,"approved_at"?: string | null,"approved_by"?: string | null,"channel": string,"created_at"?: string,"edited_at"?: string | null,"edited_by"?: string | null,"id"?: string,"lead_id": string,"message": string,"prompt_version": string,"rejected_at"?: string | null,"rejected_by"?: string | null,"rejection_reason"?: string | null,"sent_at"?: string | null,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ai_original_message"?: string,"analysis_id"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"channel"?: string,"created_at"?: string,"edited_at"?: string | null,"edited_by"?: string | null,"id"?: string,"lead_id"?: string,"message"?: string,"prompt_version"?: string,"rejected_at"?: string | null,"rejected_by"?: string | null,"rejection_reason"?: string | null,"sent_at"?: string | null,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_drafts_workspace_id_analysis_id_fkey"
      columns: ["workspace_id","analysis_id"]
isOneToOne: false
      referencedRelation: "lead_analyses"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "outreach_drafts_workspace_id_lead_id_fkey"
      columns: ["workspace_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"pipeline_events": {
                  Row: {
                    "created_at": string,"created_by": string | null,"from_status": string | null,"id": string,"lead_id": string,"reason": string | null,"to_status": string,"value_amount": number | null,"value_currency": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"from_status"?: string | null,"id"?: string,"lead_id": string,"reason"?: string | null,"to_status": string,"value_amount"?: number | null,"value_currency"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"from_status"?: string | null,"id"?: string,"lead_id"?: string,"reason"?: string | null,"to_status"?: string,"value_amount"?: number | null,"value_currency"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipeline_events_workspace_id_lead_id_fkey"
      columns: ["workspace_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"capability_level": string,"created_at": string,"currency": string | null,"description": string | null,"id": string,"is_priority": boolean,"keywords": (string)[],"minimum_price": number | null,"service_name": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"capability_level"?: string,"created_at"?: string,"currency"?: string | null,"description"?: string | null,"id"?: string,"is_priority"?: boolean,"keywords"?: (string)[],"minimum_price"?: number | null,"service_name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"capability_level"?: string,"created_at"?: string,"currency"?: string | null,"description"?: string | null,"id"?: string,"is_priority"?: boolean,"keywords"?: (string)[],"minimum_price"?: number | null,"service_name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"source_configs": {
                  Row: {
                    "access_method": string,"config": NonNullable<Json>,"country_codes": (string)[],"created_at": string,"display_name": string,"enabled": boolean,"id": string,"last_run_at": string | null,"permission_reference": string | null,"source_type": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_method": string,"config"?: NonNullable<Json>,"country_codes"?: (string)[],"created_at"?: string,"display_name": string,"enabled"?: boolean,"id"?: string,"last_run_at"?: string | null,"permission_reference"?: string | null,"source_type": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "access_method"?: string,"config"?: NonNullable<Json>,"country_codes"?: (string)[],"created_at"?: string,"display_name"?: string,"enabled"?: boolean,"id"?: string,"last_run_at"?: string | null,"permission_reference"?: string | null,"source_type"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_configs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"suppression_list": {
                  Row: {
                    "contact_hash": string,"created_at": string,"created_by": string | null,"reason": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_hash": string,"created_at"?: string,"created_by"?: string | null,"reason"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "contact_hash"?: string,"created_at"?: string,"created_by"?: string | null,"reason"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppression_list_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "approve_draft":
{ Args: { "p_draft": string }; Returns: undefined
                           },
"create_outreach_draft":
{ Args: { "p_analysis": string,"p_channel": string,"p_lead": string,"p_message": string,"p_prompt_version": string }; Returns: string
                           },
"edit_draft":
{ Args: { "p_draft": string,"p_message": string }; Returns: undefined
                           },
"erase_lead":
{ Args: { "p_lead": string,"p_reason": string }; Returns: undefined
                           },
"ingest_lead":
{ Args: { "p_author_handle": string,"p_canonical_url": string,"p_contact_channel": string,"p_contact_value": string,"p_content_hash": string,"p_country_code": string,"p_idempotency_key": string,"p_organisation_name": string,"p_original_content": string,"p_published_at": string,"p_source_config_id": string,"p_source_record_id": string,"p_source_type": string,"p_source_url": string,"p_workspace": string }; Returns: {
              "lead_id": string,"outcome": string
            }[]
                           },
"mark_draft_sent":
{ Args: { "p_draft": string }; Returns: undefined
                           },
"reject_draft":
{ Args: { "p_draft": string,"p_reason": string }; Returns: undefined
                           },
"suppress_contact":
{ Args: { "p_contact": string,"p_reason"?: string,"p_workspace": string }; Returns: undefined
                           },
"transition_lead":
{ Args: { "p_currency"?: string,"p_lead": string,"p_reason"?: string,"p_to": string,"p_value"?: number }; Returns: undefined
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
