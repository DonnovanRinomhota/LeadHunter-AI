-- Who can reach what. Grants set the columns and actions a role can use,
-- and row level security limits those actions to the caller's workspaces.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

revoke all on all functions in schema private from public, anon, authenticated, service_role;
revoke all on all functions in schema public from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.user_workspace_ids() to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function private.shares_workspace(uuid) to authenticated;

grant execute on function public.transition_lead(uuid, text, text, numeric, text) to authenticated, service_role;
grant execute on function public.create_outreach_draft(uuid, uuid, text, text, text) to service_role;
grant execute on function public.edit_draft(uuid, text) to authenticated;
grant execute on function public.approve_draft(uuid) to authenticated;
grant execute on function public.reject_draft(uuid, text) to authenticated;
grant execute on function public.mark_draft_sent(uuid) to authenticated;
grant execute on function public.suppress_contact(uuid, text, text) to authenticated;
grant execute on function public.erase_lead(uuid, text) to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant update (name, slug) on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update on public.business_profiles to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.source_configs to authenticated;
grant select on public.leads to authenticated;
grant insert (workspace_id, source_config_id, source_type, source_record_id, source_url, canonical_url,
  author_handle, organisation_name, country_code, contact_channel, contact_value, original_content,
  content_hash, published_at, industry, project_title, project_description, next_action_at)
  on public.leads to authenticated;
grant update (organisation_name, country_code, contact_channel, contact_value, industry,
  project_title, project_description, next_action_at)
  on public.leads to authenticated;
grant select on public.lead_analyses to authenticated;
grant select on public.lead_analysis_services to authenticated;
grant select on public.outreach_drafts to authenticated;
grant select on public.contact_events to authenticated;
grant insert (workspace_id, lead_id, draft_id, event_type, channel, notes, occurred_at)
  on public.contact_events to authenticated;
grant select on public.pipeline_events to authenticated;
grant select on public.automation_runs to authenticated;
grant select on public.suppression_list to authenticated;
grant select on public.data_erasures to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles','workspaces','workspace_members','business_profiles','services','source_configs',
    'leads','lead_analyses','lead_analysis_services','outreach_drafts','contact_events','pipeline_events',
    'automation_runs','suppression_list','data_erasures','ingestion_records'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Every member can read these. Writes are added below or left to the server.
  foreach t in array array['business_profiles','services','source_configs','leads','lead_analyses',
    'lead_analysis_services','outreach_drafts','contact_events','pipeline_events','automation_runs'] loop
    execute format('create policy %I on public.%I for select to authenticated using (workspace_id in (select private.user_workspace_ids()))', t || '_select_member', t);
  end loop;

  -- Owners and admins manage configuration.
  foreach t in array array['business_profiles','services','source_configs'] loop
    execute format($f$create policy %I on public.%I for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin']))$f$, t || '_insert_admin', t);
    execute format($f$create policy %I on public.%I for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin'])) with check (private.has_workspace_role(workspace_id, array['owner','admin']))$f$, t || '_update_admin', t);
  end loop;
  foreach t in array array['services','source_configs'] loop
    execute format($f$create policy %I on public.%I for delete to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']))$f$, t || '_delete_admin', t);
  end loop;

  foreach t in array array['suppression_list','data_erasures'] loop
    execute format($f$create policy %I on public.%I for select to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']))$f$, t || '_select_admin', t);
  end loop;
end;
$$;

create policy profiles_select_self_or_teammate on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_select_member on public.workspaces for select to authenticated
  using (id in (select private.user_workspace_ids()));
create policy workspaces_update_admin on public.workspaces for update to authenticated
  using (private.has_workspace_role(id, array['owner','admin']))
  with check (private.has_workspace_role(id, array['owner','admin']));

create policy workspace_members_select_member on public.workspace_members for select to authenticated
  using (workspace_id in (select private.user_workspace_ids()));
create policy workspace_members_insert_admin on public.workspace_members for insert to authenticated
  with check (private.has_workspace_role(workspace_id, array['owner','admin']));
create policy workspace_members_update_admin on public.workspace_members for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin']));
create policy workspace_members_delete_admin on public.workspace_members for delete to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']));

create policy leads_insert_member on public.leads for insert to authenticated
  with check (workspace_id in (select private.user_workspace_ids()));
create policy leads_update_member on public.leads for update to authenticated
  using (workspace_id in (select private.user_workspace_ids()))
  with check (workspace_id in (select private.user_workspace_ids()));

-- People can record what happened, but approval and contact events come from the draft functions.
create policy contact_events_insert_member on public.contact_events for insert to authenticated
  with check (
    workspace_id in (select private.user_workspace_ids())
    and event_type in ('reply_received','opt_out','meeting_booked','note')
  );
