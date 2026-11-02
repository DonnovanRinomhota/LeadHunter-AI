-- Lets signed-in members add leads through the same path as n8n, in their own name.
-- Also keeps leads.service_categories in step with the latest analysis, for filtering.

create or replace function public.ingest_lead(
  p_workspace uuid,
  p_idempotency_key text,
  p_source_type text,
  p_source_config_id uuid,
  p_source_record_id text,
  p_source_url text,
  p_canonical_url text,
  p_author_handle text,
  p_organisation_name text,
  p_country_code text,
  p_contact_channel text,
  p_contact_value text,
  p_original_content text,
  p_content_hash text,
  p_published_at timestamptz
) returns table (outcome text, lead_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_lead uuid;
begin
  if auth.uid() is not null then
    perform private.require_member(p_workspace);
  end if;

  insert into public.ingestion_records (workspace_id, idempotency_key)
  values (p_workspace, p_idempotency_key)
  on conflict (workspace_id, idempotency_key) do nothing;

  if not found then
    select r.lead_id into v_lead from public.ingestion_records r
    where r.workspace_id = p_workspace and r.idempotency_key = p_idempotency_key;
    outcome := 'duplicate';
    lead_id := v_lead;
    return next;
    return;
  end if;

  insert into public.leads (
    workspace_id, source_config_id, source_type, source_record_id, source_url, canonical_url,
    author_handle, organisation_name, country_code, contact_channel, contact_value,
    original_content, content_hash, published_at
  ) values (
    p_workspace, p_source_config_id, p_source_type, p_source_record_id, p_source_url, p_canonical_url,
    p_author_handle, p_organisation_name, p_country_code, p_contact_channel, p_contact_value,
    p_original_content, p_content_hash, p_published_at
  )
  on conflict do nothing
  returning id into v_lead;

  if v_lead is not null then
    outcome := 'created';
  else
    outcome := 'duplicate';
    select l.id into v_lead from public.leads l
    where l.workspace_id = p_workspace and (
      (p_source_record_id is not null and l.source_type = p_source_type and l.source_record_id = p_source_record_id)
      or (p_source_record_id is null and l.source_record_id is null and (
        (p_canonical_url is not null and l.canonical_url = p_canonical_url)
        or (p_content_hash is not null and l.content_hash = p_content_hash)
      ))
    )
    limit 1;
  end if;

  update public.ingestion_records r set lead_id = v_lead
  where r.workspace_id = p_workspace and r.idempotency_key = p_idempotency_key;

  lead_id := v_lead;
  return next;
end;
$$;

grant execute on function public.ingest_lead(uuid, text, text, uuid, text, text, text, text, text, text, text, text, text, text, timestamptz) to authenticated;

create or replace function private.apply_analysis_to_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.leads l set
    lead_score = new.total_score,
    fit_assessment = new.fit_assessment,
    buying_intent = new.buying_intent,
    urgency = new.urgency,
    confidence = new.confidence,
    budget_min = new.budget_min,
    budget_max = new.budget_max,
    budget_currency = new.budget_currency,
    requirements = new.requirements,
    service_categories = '{}',
    project_description = coalesce(new.problem_summary, l.project_description),
    organisation_name = coalesce(l.organisation_name, new.organisation_name),
    qualification_last_error = null
  where l.id = new.lead_id and l.workspace_id = new.workspace_id;
  return new;
end;
$$;

create function private.apply_service_match_to_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.leads l set service_categories = array_append(l.service_categories, new.service_id)
  from public.lead_analyses a
  where a.id = new.analysis_id and l.id = a.lead_id
    and not new.service_id = any (l.service_categories);
  return new;
end;
$$;

create trigger apply_service_match_to_lead
  after insert on public.lead_analysis_services
  for each row execute function private.apply_service_match_to_lead();

revoke all on function private.apply_service_match_to_lead() from public, anon, authenticated, service_role;

create index leads_service_categories_idx on public.leads using gin (service_categories);
