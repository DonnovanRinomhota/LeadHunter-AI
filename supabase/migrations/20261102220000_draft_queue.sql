-- Lists leads that should get a first draft. A lead with any earlier draft is left out,
-- so a rejected draft is not replaced automatically and nothing is paid for twice.
-- A lead with a recorded problem is also left out until someone looks at it.

create function public.list_leads_ready_for_draft(p_limit integer default 5)
returns table (lead_id uuid, analysis_id uuid, workspace_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    raise exception 'The draft queue is read by the server' using errcode = '42501';
  end if;

  return query
  select l.id, a.id, l.workspace_id
  from public.leads l
  join lateral (
    select latest.id, latest.recommended_action, latest.disqualifier
    from public.lead_analyses latest
    where latest.lead_id = l.id
    order by latest.created_at desc, latest.id desc
    limit 1
  ) a on true
  where l.status = 'qualified'
    and l.qualification_last_error is null
    and a.recommended_action = 'review'
    and a.disqualifier is null
    and not exists (select 1 from public.outreach_drafts d where d.lead_id = l.id)
    and not private.is_suppressed(l.workspace_id, l.contact_hash)
  order by l.lead_score desc nulls last, l.discovered_at
  limit p_limit;
end;
$$;

revoke all on function public.list_leads_ready_for_draft(integer) from public, anon, authenticated;
grant execute on function public.list_leads_ready_for_draft(integer) to service_role;
