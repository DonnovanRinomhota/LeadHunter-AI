-- LeadHunter AI core schema.
-- Rules and permissions are added by the two migrations that follow this one.

create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  company_name text not null,
  website_url text,
  description text,
  target_geographies text[] not null default '{}',
  target_industries text[] not null default '{}',
  ideal_customer_profile jsonb not null default '{}'::jsonb,
  excluded_segments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  service_name text not null,
  description text,
  keywords text[] not null default '{}',
  capability_level text not null default 'developing'
    check (capability_level in ('confirmed','developing','not_offered')),
  is_priority boolean not null default false,
  minimum_price numeric(12,2),
  currency char(3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, service_name),
  unique (workspace_id, id)
);

-- Never store credentials in config. They belong in n8n's credential store.
create table public.source_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null,
  display_name text not null,
  access_method text not null check (access_method in ('official_api','licensed_feed','rss','manual','inbound')),
  permission_reference text,
  country_codes text[] not null default '{}',
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint enabled_source_needs_permission
    check (not enabled or nullif(btrim(permission_reference), '') is not null)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_config_id uuid,
  source_type text not null,
  source_record_id text,
  source_url text,
  canonical_url text,
  author_handle text,
  organisation_name text,
  country_code char(2) check (country_code ~ '^[A-Z]{2}$'),
  contact_channel text,
  contact_value text,
  contact_hash text not null,
  original_content text not null check (btrim(original_content) <> ''),
  content_hash text,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  industry text,
  project_title text,
  project_description text,
  service_categories uuid[] not null default '{}',
  requirements jsonb not null default '[]'::jsonb,
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  budget_currency char(3),
  urgency text check (urgency in ('low','medium','high','unknown')),
  buying_intent text check (buying_intent in ('low','medium','high','unknown')),
  lead_score integer check (lead_score between 0 and 100),
  confidence numeric(4,3) check (confidence between 0 and 1),
  status text not null default 'new'
    check (status in ('new','qualifying','qualified','disqualified','draft_ready','approved','contacted','replied','meeting','proposal','won','lost','archived')),
  disqualification_reason text,
  next_action_at timestamptz,
  retain_until timestamptz,
  qualification_attempts integer not null default 0 check (qualification_attempts >= 0),
  qualification_last_error text,
  qualification_claimed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, source_config_id)
    references public.source_configs(workspace_id, id) on delete set null (source_config_id),
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

-- Null source_record_id values stay distinct, so this also suits on conflict upserts.
create unique index leads_source_record_unique
  on public.leads(workspace_id, source_type, source_record_id);
create unique index leads_canonical_url_unique
  on public.leads(workspace_id, canonical_url)
  where source_record_id is null and canonical_url is not null;
create unique index leads_content_hash_unique
  on public.leads(workspace_id, content_hash)
  where source_record_id is null and content_hash is not null;

create index leads_workspace_status_idx on public.leads(workspace_id, status);
create index leads_workspace_score_idx on public.leads(workspace_id, lead_score desc);
create index leads_workspace_discovered_idx on public.leads(workspace_id, discovered_at desc);
create index leads_contact_hash_idx on public.leads(workspace_id, contact_hash);
create index leads_next_action_idx on public.leads(workspace_id, next_action_at) where next_action_at is not null;
create index leads_retain_until_idx on public.leads(retain_until) where retain_until is not null;
create index leads_source_config_idx on public.leads(workspace_id, source_config_id);
create index leads_created_by_idx on public.leads(created_by);

-- The total is calculated by the database, so it can never disagree with its parts.
create table public.lead_analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lead_id uuid not null,
  model_provider text not null,
  model_name text not null,
  prompt_version text not null,
  is_business_opportunity boolean not null,
  lead_summary text,
  problem_summary text,
  organisation_name text,
  requirements jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  buying_intent text not null check (buying_intent in ('low','medium','high','unknown')),
  urgency text not null check (urgency in ('low','medium','high','unknown')),
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  budget_currency char(3),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  score_service_relevance integer not null check (score_service_relevance between 0 and 25),
  score_buying_intent integer not null check (score_buying_intent between 0 and 25),
  score_project_clarity integer not null check (score_project_clarity between 0 and 15),
  score_capability_match integer not null check (score_capability_match between 0 and 20),
  score_budget_evidence integer not null check (score_budget_evidence between 0 and 10),
  score_recency integer not null check (score_recency between 0 and 5),
  total_score integer generated always as (
    score_service_relevance + score_buying_intent + score_project_clarity
    + score_capability_match + score_budget_evidence + score_recency
  ) stored,
  disqualifier text,
  recommended_action text not null
    check (recommended_action in ('review','reject','needs_information','compliance_review')),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  raw_structured_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete cascade,
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create index lead_analyses_lead_created_idx on public.lead_analyses(workspace_id, lead_id, created_at desc);

create table public.lead_analysis_services (
  workspace_id uuid not null,
  analysis_id uuid not null,
  service_id uuid not null,
  evidence jsonb not null default '[]'::jsonb,
  primary key (analysis_id, service_id),
  foreign key (workspace_id, analysis_id) references public.lead_analyses(workspace_id, id) on delete cascade,
  foreign key (workspace_id, service_id) references public.services(workspace_id, id) on delete cascade
);

create index lead_analysis_services_workspace_analysis_idx on public.lead_analysis_services(workspace_id, analysis_id);
create index lead_analysis_services_workspace_service_idx on public.lead_analysis_services(workspace_id, service_id);

create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lead_id uuid not null,
  analysis_id uuid not null,
  prompt_version text not null,
  channel text not null,
  ai_original_message text not null,
  message text not null check (btrim(message) <> ''),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','sent_manually','sent_via_authorized_integration','cancelled')),
  edited_by uuid references auth.users(id) on delete set null,
  edited_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete cascade,
  foreign key (workspace_id, analysis_id) references public.lead_analyses(workspace_id, id) on delete cascade
);

create unique index outreach_drafts_one_active_per_lead
  on public.outreach_drafts(lead_id) where status in ('pending','approved');
create index outreach_drafts_workspace_lead_idx on public.outreach_drafts(workspace_id, lead_id);
create index outreach_drafts_workspace_status_idx on public.outreach_drafts(workspace_id, status);
create index outreach_drafts_workspace_analysis_idx on public.outreach_drafts(workspace_id, analysis_id);
create index outreach_drafts_edited_by_idx on public.outreach_drafts(edited_by);
create index outreach_drafts_approved_by_idx on public.outreach_drafts(approved_by);
create index outreach_drafts_rejected_by_idx on public.outreach_drafts(rejected_by);

create table public.contact_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lead_id uuid not null,
  draft_id uuid,
  event_type text not null
    check (event_type in ('draft_approved','draft_rejected','contacted','reply_received','opt_out','meeting_booked','note')),
  channel text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete cascade,
  foreign key (workspace_id, draft_id) references public.outreach_drafts(workspace_id, id) on delete set null (draft_id)
);

create index contact_events_workspace_lead_idx on public.contact_events(workspace_id, lead_id, occurred_at desc);
create index contact_events_workspace_draft_idx on public.contact_events(workspace_id, draft_id);
create index contact_events_created_by_idx on public.contact_events(created_by);

create table public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lead_id uuid not null,
  from_status text,
  to_status text not null,
  reason text,
  value_amount numeric(12,2),
  value_currency char(3),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete cascade
);

create index pipeline_events_workspace_lead_idx on public.pipeline_events(workspace_id, lead_id, created_at desc);
create index pipeline_events_created_by_idx on public.pipeline_events(created_by);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  workflow_name text not null,
  execution_reference text,
  status text not null check (status in ('running','success','failed','partial')),
  records_processed integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index automation_runs_workspace_started_idx on public.automation_runs(workspace_id, started_at desc);

-- Deliberately has no foreign key to leads, so an opt-out outlives the lead it came from.
create table public.suppression_list (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_hash text not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (workspace_id, contact_hash)
);

create index suppression_list_created_by_idx on public.suppression_list(created_by);

-- Records that an erasure happened, without keeping the personal data erased.
create table public.data_erasures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  erased_lead_id uuid not null,
  reason text not null,
  erased_at timestamptz not null default now(),
  erased_by uuid references auth.users(id) on delete set null
);

create index data_erasures_workspace_idx on public.data_erasures(workspace_id, erased_at desc);
create index data_erasures_erased_by_idx on public.data_erasures(erased_by);

create table public.ingestion_records (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null,
  lead_id uuid,
  created_at timestamptz not null default now(),
  primary key (workspace_id, idempotency_key),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete set null (lead_id)
);

create index ingestion_records_workspace_lead_idx on public.ingestion_records(workspace_id, lead_id);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index workspaces_created_by_idx on public.workspaces(created_by);
