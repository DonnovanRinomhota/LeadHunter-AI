-- LeadHunter AI initial multi-tenant schema
-- Review and test in a development Supabase project before production use.
-- Requires Supabase auth schema.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','reviewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.business_profiles (
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

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  service_name text not null,
  description text,
  keywords text[] not null default '{}',
  capability_level text not null default 'confirmed'
    check (capability_level in ('confirmed','developing','not_offered')),
  minimum_price numeric(12,2),
  currency char(3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, service_name)
);

create table if not exists public.source_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null,
  display_name text not null,
  access_method text not null check (access_method in ('official_api','licensed_feed','rss','manual','inbound')),
  permission_reference text,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_config_id uuid references public.source_configs(id) on delete set null,
  source_type text not null,
  source_record_id text,
  source_url text,
  author_handle text,
  organisation_name text,
  original_content text not null,
  content_hash text,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  industry text,
  project_title text,
  project_description text,
  service_categories text[] not null default '{}',
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
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists leads_source_record_unique
  on public.leads(workspace_id, source_type, source_record_id)
  where source_record_id is not null;

create index if not exists leads_workspace_status_idx on public.leads(workspace_id, status);
create index if not exists leads_workspace_score_idx on public.leads(workspace_id, lead_score desc);
create index if not exists leads_discovered_at_idx on public.leads(discovered_at desc);
create index if not exists leads_source_url_idx on public.leads(workspace_id, source_url);

create table if not exists public.lead_analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  model_provider text,
  model_name text,
  prompt_version text not null,
  is_business_opportunity boolean,
  problem_summary text,
  service_matches text[] not null default '{}',
  intent_evidence jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  total_score integer check (total_score between 0 and 100),
  recommended_action text check (recommended_action in ('review','reject','needs_information')),
  raw_structured_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_analyses_lead_created_idx
  on public.lead_analyses(lead_id, created_at desc);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null,
  message text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','sent_manually','sent_via_authorized_integration','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  draft_id uuid references public.outreach_drafts(id) on delete set null,
  event_type text not null check (event_type in ('draft_approved','draft_rejected','contacted','reply_received','opt_out','meeting_booked','note')),
  channel text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  value_amount numeric(12,2),
  value_currency char(3),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.automation_runs (
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

-- Membership helper. SECURITY DEFINER avoids recursive RLS checks on workspace_members.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.business_profiles enable row level security;
alter table public.services enable row level security;
alter table public.source_configs enable row level security;
alter table public.leads enable row level security;
alter table public.lead_analyses enable row level security;
alter table public.outreach_drafts enable row level security;
alter table public.contact_events enable row level security;
alter table public.pipeline_events enable row level security;
alter table public.automation_runs enable row level security;

create policy "profiles_select_self" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_select_member" on public.workspaces for select using (public.is_workspace_member(id));
create policy "workspaces_insert_creator" on public.workspaces for insert with check (created_by = auth.uid());
create policy "workspaces_update_admin" on public.workspaces for update using (public.has_workspace_role(id, array['owner','admin'])) with check (public.has_workspace_role(id, array['owner','admin']));

create policy "workspace_members_select_member" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "workspace_members_insert_admin" on public.workspace_members for insert with check (public.has_workspace_role(workspace_id, array['owner','admin']));
create policy "workspace_members_update_admin" on public.workspace_members for update using (public.has_workspace_role(workspace_id, array['owner','admin'])) with check (public.has_workspace_role(workspace_id, array['owner','admin']));
create policy "workspace_members_delete_admin" on public.workspace_members for delete using (public.has_workspace_role(workspace_id, array['owner','admin']));

create policy "business_profiles_member_all" on public.business_profiles for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "services_member_all" on public.services for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "source_configs_member_all" on public.source_configs for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "leads_member_all" on public.leads for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "lead_analyses_member_all" on public.lead_analyses for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "outreach_drafts_member_all" on public.outreach_drafts for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "contact_events_member_all" on public.contact_events for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "pipeline_events_member_all" on public.pipeline_events for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "automation_runs_member_all" on public.automation_runs for all using (workspace_id is not null and public.is_workspace_member(workspace_id)) with check (workspace_id is not null and public.is_workspace_member(workspace_id));

-- Profiles are created by the application or an auth.users trigger in a later migration.
-- Workspace creation + owner membership should be performed transactionally by a
-- trusted server-side function / route after verifying the authenticated user.
