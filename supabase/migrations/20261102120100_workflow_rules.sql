-- Rules that must hold for every writer, including the service role.
-- Status changes go through the functions below. A person's identity always comes
-- from auth.uid(), and a caller with no user (the server) can never approve a draft.

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','workspaces','business_profiles','services','source_configs','leads','outreach_drafts'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
  end loop;
end;
$$;

create function private.hash_contact(p_value text) returns text
language sql immutable set search_path = '' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(p_value)), 'UTF8')), 'hex');
$$;

create function private.in_workflow() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.current_setting('leadhunter.workflow', true), '') = 'on';
$$;

create function private.set_workflow(p_on boolean) returns void
language sql set search_path = '' as $$
  select pg_catalog.set_config('leadhunter.workflow', case when p_on then 'on' else 'off' end, true);
$$;

-- Depth above 1 means a foreign key cascade is running, such as an erasure or user deletion.
create function private.is_cascade() returns boolean
language sql stable set search_path = '' as $$
  select pg_catalog.pg_trigger_depth() > 1;
$$;

create function private.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'A signed-in person is required' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

-- Helpers used by policies. They read membership directly to avoid recursive policy checks.
create function private.user_workspace_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select wm.workspace_id from public.workspace_members wm where wm.user_id = auth.uid();
$$;

create function private.has_workspace_role(p_workspace uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace and wm.user_id = auth.uid() and wm.role = any (p_roles)
  );
$$;

create function private.shares_workspace(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

create function private.require_member(p_workspace uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := private.require_user();
begin
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace and wm.user_id = v_user
  ) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

-- New sign-ins get a profile automatically.
create function private.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function private.create_profile_for_user();

-- Membership: only owners manage owners, and a workspace keeps at least one owner.
create function private.guard_workspace_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid := coalesce(new.workspace_id, old.workspace_id);
  v_caller_is_owner boolean;
begin
  if tg_op = 'UPDATE' and (new.workspace_id <> old.workspace_id or new.user_id <> old.user_id) then
    raise exception 'Membership cannot be moved' using errcode = '42501';
  end if;

  if v_user is not null then
    v_caller_is_owner := exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = v_workspace and wm.user_id = v_user and wm.role = 'owner'
    );
    if not v_caller_is_owner
       and ((tg_op <> 'INSERT' and old.role = 'owner') or (tg_op <> 'DELETE' and new.role = 'owner')) then
      raise exception 'Only an owner can manage owners' using errcode = '42501';
    end if;
  end if;

  if tg_op <> 'INSERT' and old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and not private.is_cascade()
     and not exists (
       select 1 from public.workspace_members wm
       where wm.workspace_id = old.workspace_id and wm.role = 'owner' and wm.user_id <> old.user_id
     ) then
    raise exception 'A workspace must keep at least one owner' using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger guard_workspace_members
  before insert or update or delete on public.workspace_members
  for each row execute function private.guard_workspace_members();

-- Leads.
create function private.guard_leads() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not private.in_workflow() and not private.is_cascade() then
      raise exception 'Leads are removed with erase_lead()' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'new' then
      raise exception 'A new lead must start with status new' using errcode = '42501';
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    if new.workspace_id <> old.workspace_id or new.id <> old.id then
      raise exception 'A lead cannot be moved' using errcode = '42501';
    end if;
    if new.status <> old.status and not private.in_workflow() then
      raise exception 'Use transition_lead() to change status' using errcode = '42501';
    end if;
  end if;

  new.contact_hash := private.hash_contact(coalesce(
    nullif(pg_catalog.btrim(new.contact_value), ''),
    new.source_type || ':' || nullif(pg_catalog.btrim(new.author_handle), ''),
    'lead:' || new.id::text
  ));
  return new;
end;
$$;

create trigger guard_leads
  before insert or update or delete on public.leads
  for each row execute function private.guard_leads();

-- History tables: rows can be added but not rewritten, except by a cascade.
create function private.forbid_history_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_cascade() then
    raise exception 'History in % cannot be changed', tg_table_name using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['lead_analyses','lead_analysis_services','contact_events','pipeline_events','data_erasures'] loop
    execute format('create trigger forbid_history_change before update or delete on public.%I for each row execute function private.forbid_history_change()', t);
  end loop;
end;
$$;

create function private.guard_workflow_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_workflow() then
    raise exception 'Rows in % are written by the workflow functions', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_pipeline_events_insert
  before insert on public.pipeline_events
  for each row execute function private.guard_workflow_insert();

create function private.set_contact_event_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

create trigger set_contact_event_author
  before insert on public.contact_events
  for each row execute function private.set_contact_event_author();

-- Drafts.
create function private.guard_outreach_drafts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not private.is_cascade() then
      raise exception 'Drafts cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  if not private.in_workflow() and not private.is_cascade() then
    raise exception 'Drafts are changed through the draft functions' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' and new.status <> 'pending' then
    raise exception 'A new draft must be pending' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_outreach_drafts
  before insert or update or delete on public.outreach_drafts
  for each row execute function private.guard_outreach_drafts();

-- Each analysis updates the summary on its lead, and older analyses stay as history.
create function private.apply_analysis_to_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.leads l set
    lead_score = new.total_score,
    buying_intent = new.buying_intent,
    urgency = new.urgency,
    confidence = new.confidence,
    budget_min = new.budget_min,
    budget_max = new.budget_max,
    budget_currency = new.budget_currency,
    requirements = new.requirements,
    project_description = coalesce(new.problem_summary, l.project_description),
    organisation_name = coalesce(l.organisation_name, new.organisation_name)
  where l.id = new.lead_id and l.workspace_id = new.workspace_id;
  return new;
end;
$$;

create trigger apply_analysis_to_lead
  after insert on public.lead_analyses
  for each row execute function private.apply_analysis_to_lead();

-- Allowed lead moves. person: a workspace member. server: the app's server or n8n.
-- workflow: only as a side effect of a draft function, never requested directly.
create table private.lead_transitions (
  from_status text not null,
  to_status text not null,
  actor text not null check (actor in ('person','server','any','workflow')),
  primary key (from_status, to_status)
);

insert into private.lead_transitions (from_status, to_status, actor) values
  ('new','qualifying','server'),
  ('new','disqualified','person'),
  ('new','archived','person'),
  ('qualifying','new','server'),
  ('qualifying','qualified','server'),
  ('qualifying','disqualified','server'),
  ('qualified','disqualified','person'),
  ('qualified','archived','person'),
  ('qualified','draft_ready','workflow'),
  ('disqualified','qualified','person'),
  ('disqualified','new','person'),
  ('disqualified','archived','person'),
  ('draft_ready','approved','workflow'),
  ('draft_ready','qualified','workflow'),
  ('approved','draft_ready','workflow'),
  ('approved','qualified','workflow'),
  ('approved','contacted','workflow'),
  ('contacted','replied','person'),
  ('contacted','meeting','person'),
  ('contacted','lost','person'),
  ('replied','meeting','person'),
  ('replied','proposal','person'),
  ('replied','lost','person'),
  ('meeting','proposal','person'),
  ('meeting','won','person'),
  ('meeting','lost','person'),
  ('proposal','meeting','person'),
  ('proposal','won','person'),
  ('proposal','lost','person'),
  ('lost','replied','person'),
  ('won','archived','person'),
  ('lost','archived','person');

create function private.apply_transition(
  p_lead uuid, p_to text, p_reason text default null,
  p_value numeric default null, p_currency text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_lead public.leads%rowtype;
begin
  select * into v_lead from public.leads where id = p_lead for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  perform private.set_workflow(true);
  update public.leads set
    status = p_to,
    disqualification_reason = case when p_to = 'disqualified' then p_reason else disqualification_reason end
  where id = p_lead;
  insert into public.pipeline_events (workspace_id, lead_id, from_status, to_status, reason, value_amount, value_currency, created_by)
  values (v_lead.workspace_id, p_lead, v_lead.status, p_to, p_reason, p_value, p_currency, auth.uid());
  perform private.set_workflow(false);
end;
$$;

create function public.transition_lead(
  p_lead uuid, p_to text, p_reason text default null,
  p_value numeric default null, p_currency text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_lead public.leads%rowtype;
  v_actor text;
  v_analysis public.lead_analyses%rowtype;
begin
  select * into v_lead from public.leads where id = p_lead for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_user is not null then
    perform private.require_member(v_lead.workspace_id);
  end if;

  select t.actor into v_actor from private.lead_transitions t
  where t.from_status = v_lead.status and t.to_status = p_to;

  if v_actor is null then
    raise exception 'A lead cannot move from % to %', v_lead.status, p_to using errcode = 'P0001';
  end if;
  if v_actor = 'workflow'
     or (v_actor = 'person' and v_user is null)
     or (v_actor = 'server' and v_user is not null) then
    raise exception 'This caller cannot move a lead from % to %', v_lead.status, p_to using errcode = '42501';
  end if;

  -- Decision 6: qualified needs a score of 60 or more and no disqualifier.
  -- A person can still overrule a disqualification, and that is recorded with their name.
  if p_to = 'qualified' and v_user is null then
    select * into v_analysis from public.lead_analyses a
    where a.lead_id = p_lead order by a.created_at desc, a.id desc limit 1;
    if not found or v_analysis.total_score < 60 or v_analysis.disqualifier is not null then
      raise exception 'This lead does not meet the qualified rule' using errcode = 'P0001';
    end if;
  end if;

  perform private.apply_transition(p_lead, p_to, p_reason, p_value, p_currency);
end;
$$;

create function private.is_suppressed(p_workspace uuid, p_hash text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.suppression_list s
    where s.workspace_id = p_workspace and s.contact_hash = p_hash
  );
$$;

create function public.create_outreach_draft(
  p_lead uuid, p_analysis uuid, p_channel text, p_message text, p_prompt_version text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_lead public.leads%rowtype;
  v_analysis public.lead_analyses%rowtype;
  v_draft uuid;
begin
  if auth.uid() is not null then
    raise exception 'Drafts are generated by the server' using errcode = '42501';
  end if;

  select * into v_lead from public.leads where id = p_lead for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if v_lead.status <> 'qualified' then
    raise exception 'Only a qualified lead can get a draft' using errcode = 'P0001';
  end if;
  if private.is_suppressed(v_lead.workspace_id, v_lead.contact_hash) then
    raise exception 'This contact has opted out' using errcode = 'P0001';
  end if;

  select * into v_analysis from public.lead_analyses a
  where a.id = p_analysis and a.lead_id = p_lead and a.workspace_id = v_lead.workspace_id;
  if not found then
    raise exception 'Analysis not found for this lead' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.lead_analyses newer
    where newer.lead_id = p_lead and newer.id <> v_analysis.id
      and (newer.created_at, newer.id) > (v_analysis.created_at, v_analysis.id)
  ) then
    raise exception 'A draft must use the latest analysis' using errcode = 'P0001';
  end if;
  if v_analysis.recommended_action <> 'review' or v_analysis.disqualifier is not null then
    raise exception 'This analysis does not allow a draft' using errcode = 'P0001';
  end if;

  perform private.set_workflow(true);
  insert into public.outreach_drafts (workspace_id, lead_id, analysis_id, prompt_version, channel, ai_original_message, message)
  values (v_lead.workspace_id, p_lead, p_analysis, p_prompt_version, p_channel, p_message, p_message)
  returning id into v_draft;
  perform private.set_workflow(false);

  perform private.apply_transition(p_lead, 'draft_ready');
  return v_draft;
end;
$$;

create function private.lock_draft(p_draft uuid) returns public.outreach_drafts
language plpgsql security definer set search_path = '' as $$
declare v_draft public.outreach_drafts%rowtype;
begin
  select * into v_draft from public.outreach_drafts where id = p_draft for update;
  if not found then
    raise exception 'Draft not found' using errcode = 'P0002';
  end if;
  return v_draft;
end;
$$;

-- Editing an approved draft cancels its approval, so people only ever approve final text.
create function public.edit_draft(p_draft uuid, p_message text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.outreach_drafts%rowtype := private.lock_draft(p_draft);
  v_user uuid := private.require_member(v_draft.workspace_id);
begin
  if v_draft.status not in ('pending','approved') then
    raise exception 'A % draft cannot be edited', v_draft.status using errcode = 'P0001';
  end if;

  perform private.set_workflow(true);
  update public.outreach_drafts set
    message = p_message, status = 'pending', edited_by = v_user, edited_at = now(),
    approved_by = null, approved_at = null
  where id = p_draft;
  perform private.set_workflow(false);

  if v_draft.status = 'approved' then
    perform private.apply_transition(v_draft.lead_id, 'draft_ready', 'Approved draft was edited');
  end if;
end;
$$;

create function public.approve_draft(p_draft uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.outreach_drafts%rowtype := private.lock_draft(p_draft);
  v_user uuid := private.require_member(v_draft.workspace_id);
  v_hash text;
begin
  if v_draft.status <> 'pending' then
    raise exception 'Only a pending draft can be approved' using errcode = 'P0001';
  end if;
  select l.contact_hash into v_hash from public.leads l where l.id = v_draft.lead_id;
  if private.is_suppressed(v_draft.workspace_id, v_hash) then
    raise exception 'This contact has opted out' using errcode = 'P0001';
  end if;

  perform private.set_workflow(true);
  update public.outreach_drafts set status = 'approved', approved_by = v_user, approved_at = now()
  where id = p_draft;
  perform private.set_workflow(false);

  insert into public.contact_events (workspace_id, lead_id, draft_id, event_type, created_by)
  values (v_draft.workspace_id, v_draft.lead_id, p_draft, 'draft_approved', v_user);
  perform private.apply_transition(v_draft.lead_id, 'approved');
end;
$$;

create function public.reject_draft(p_draft uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.outreach_drafts%rowtype := private.lock_draft(p_draft);
  v_user uuid := private.require_member(v_draft.workspace_id);
begin
  if v_draft.status <> 'pending' then
    raise exception 'Only a pending draft can be rejected' using errcode = 'P0001';
  end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception 'A rejection needs a reason' using errcode = 'P0001';
  end if;

  perform private.set_workflow(true);
  update public.outreach_drafts set
    status = 'rejected', rejected_by = v_user, rejected_at = now(), rejection_reason = p_reason
  where id = p_draft;
  perform private.set_workflow(false);

  insert into public.contact_events (workspace_id, lead_id, draft_id, event_type, notes, created_by)
  values (v_draft.workspace_id, v_draft.lead_id, p_draft, 'draft_rejected', p_reason, v_user);
  perform private.apply_transition(v_draft.lead_id, 'qualified', 'Draft rejected');
end;
$$;

-- Records that a person sent the approved text. Nothing here sends a message.
create function public.mark_draft_sent(p_draft uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.outreach_drafts%rowtype := private.lock_draft(p_draft);
  v_user uuid := private.require_member(v_draft.workspace_id);
  v_hash text;
begin
  if v_draft.status <> 'approved' then
    raise exception 'Only an approved draft can be marked as sent' using errcode = 'P0001';
  end if;
  select l.contact_hash into v_hash from public.leads l where l.id = v_draft.lead_id;
  if private.is_suppressed(v_draft.workspace_id, v_hash) then
    raise exception 'This contact has opted out' using errcode = 'P0001';
  end if;

  perform private.set_workflow(true);
  update public.outreach_drafts set status = 'sent_manually', sent_at = now() where id = p_draft;
  perform private.set_workflow(false);

  insert into public.contact_events (workspace_id, lead_id, draft_id, event_type, channel, created_by)
  values (v_draft.workspace_id, v_draft.lead_id, p_draft, 'contacted', v_draft.channel, v_user);
  perform private.apply_transition(v_draft.lead_id, 'contacted');
end;
$$;

-- An opt-out suppresses the contact for the whole workspace and cancels any active draft.
create function private.apply_opt_out() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_status text;
begin
  select l.contact_hash, l.status into v_hash, v_status
  from public.leads l where l.id = new.lead_id;

  insert into public.suppression_list (workspace_id, contact_hash, reason, created_by)
  values (new.workspace_id, v_hash, 'opt_out', new.created_by)
  on conflict (workspace_id, contact_hash) do nothing;

  perform private.set_workflow(true);
  update public.outreach_drafts set status = 'cancelled'
  where lead_id = new.lead_id and status in ('pending','approved');
  perform private.set_workflow(false);

  if v_status in ('draft_ready','approved') then
    perform private.apply_transition(new.lead_id, 'qualified', 'Contact opted out');
  end if;
  return new;
end;
$$;

create trigger apply_opt_out
  after insert on public.contact_events
  for each row when (new.event_type = 'opt_out')
  execute function private.apply_opt_out();

create function public.suppress_contact(p_workspace uuid, p_contact text, p_reason text default 'opt_out') returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user();
begin
  if not private.has_workspace_role(p_workspace, array['owner','admin']) then
    raise exception 'Only an owner or admin can do this' using errcode = '42501';
  end if;
  insert into public.suppression_list (workspace_id, contact_hash, reason, created_by)
  values (p_workspace, private.hash_contact(p_contact), p_reason, v_user)
  on conflict (workspace_id, contact_hash) do nothing;
end;
$$;

-- Removes a lead and its history, keeping a record of the erasure and any suppression entry.
create function public.erase_lead(p_lead uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_workspace uuid;
begin
  select l.workspace_id into v_workspace from public.leads l where l.id = p_lead for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if not private.has_workspace_role(v_workspace, array['owner','admin']) then
    raise exception 'Only an owner or admin can do this' using errcode = '42501';
  end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception 'An erasure needs a reason' using errcode = 'P0001';
  end if;

  insert into public.data_erasures (workspace_id, erased_lead_id, reason, erased_by)
  values (v_workspace, p_lead, p_reason, v_user);

  perform private.set_workflow(true);
  delete from public.leads where id = p_lead;
  perform private.set_workflow(false);
end;
$$;
