-- Fit is recorded apart from buying intent. A good-fit firm with no buying signal
-- gets the research action, which keeps it visible without allowing a draft.
-- Also adds the queue n8n uses to claim leads for qualification.

alter table public.lead_analyses
  add column fit_assessment text not null default 'unknown'
    check (fit_assessment in ('good','possible','poor','unknown'));

alter table public.lead_analyses drop constraint lead_analyses_recommended_action_check;
alter table public.lead_analyses add constraint lead_analyses_recommended_action_check
  check (recommended_action in ('review','research','reject','needs_information','compliance_review'));

alter table public.leads
  add column fit_assessment text check (fit_assessment in ('good','possible','poor','unknown'));

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
    project_description = coalesce(new.problem_summary, l.project_description),
    organisation_name = coalesce(l.organisation_name, new.organisation_name),
    qualification_last_error = null
  where l.id = new.lead_id and l.workspace_id = new.workspace_id;
  return new;
end;
$$;

create index leads_qualification_queue_idx on public.leads(status, discovered_at)
  where status in ('new','qualifying');

-- Hands out work safely when runs overlap. A claim that goes stale can be claimed again,
-- and a lead that uses up its attempts returns to new with an error for a person to see.
create function public.claim_leads_for_qualification(
  p_limit integer default 10,
  p_stale_after interval default '15 minutes',
  p_max_attempts integer default 3
) returns table (lead_id uuid, workspace_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_lead record;
begin
  if auth.uid() is not null then
    raise exception 'Leads are claimed by the server' using errcode = '42501';
  end if;

  for v_lead in
    select l.id from public.leads l
    where l.status = 'qualifying'
      and l.qualification_attempts >= p_max_attempts
      and l.qualification_claimed_at < now() - p_stale_after
    for update skip locked
  loop
    update public.leads l set qualification_last_error = 'Timed out on the final attempt'
    where l.id = v_lead.id;
    perform private.apply_transition(v_lead.id, 'new', 'Qualification attempts used up');
  end loop;

  for v_lead in
    select l.id, l.workspace_id as ws, l.status from public.leads l
    where l.qualification_attempts < p_max_attempts
      and (l.status = 'new'
        or (l.status = 'qualifying' and l.qualification_claimed_at < now() - p_stale_after))
    order by l.discovered_at
    limit p_limit
    for update skip locked
  loop
    if v_lead.status = 'new' then
      perform private.apply_transition(v_lead.id, 'qualifying', 'Claimed for qualification');
    end if;
    update public.leads l set
      qualification_attempts = l.qualification_attempts + 1,
      qualification_claimed_at = now()
    where l.id = v_lead.id;
    lead_id := v_lead.id;
    workspace_id := v_lead.ws;
    return next;
  end loop;
end;
$$;

create function public.record_qualification_failure(p_lead uuid, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    raise exception 'Failures are recorded by the server' using errcode = '42501';
  end if;
  if not exists (select 1 from public.leads l where l.id = p_lead and l.status = 'qualifying') then
    raise exception 'This lead is not being qualified' using errcode = 'P0001';
  end if;

  update public.leads l set qualification_last_error = p_error where l.id = p_lead;
  perform private.apply_transition(p_lead, 'new', 'Qualification failed');
end;
$$;

revoke all on function public.claim_leads_for_qualification(integer, interval, integer) from public, anon, authenticated;
revoke all on function public.record_qualification_failure(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_leads_for_qualification(integer, interval, integer) to service_role;
grant execute on function public.record_qualification_failure(uuid, text) to service_role;
