-- Checks every role against every table: exact privileges, then real attempts across two workspaces.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- Exact privileges. A new table or grant fails here until it is added on purpose.
select is_empty($$
  select c.relname from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'select,insert,update,delete')
      or has_any_column_privilege('anon', c.oid, 'select,insert,update'))
$$, 'anon has no access to any table');

select results_eq($$
  select c.relname::text collate "default",
    concat_ws(',',
      case when has_any_column_privilege('authenticated', c.oid, 'select') then 'select' end,
      case when has_any_column_privilege('authenticated', c.oid, 'insert') then 'insert' end,
      case when has_any_column_privilege('authenticated', c.oid, 'update') then 'update' end,
      case when has_table_privilege('authenticated', c.oid, 'delete') then 'delete' end)
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by c.relname::text collate "C"
$$, $$values
  ('automation_runs', 'select'),
  ('business_profiles', 'select,insert,update'),
  ('contact_events', 'select,insert'),
  ('data_erasures', 'select'),
  ('ingestion_records', ''),
  ('lead_analyses', 'select'),
  ('lead_analysis_services', 'select'),
  ('leads', 'select,insert,update'),
  ('outreach_drafts', 'select'),
  ('pipeline_events', 'select'),
  ('profiles', 'select,update'),
  ('services', 'select,insert,update,delete'),
  ('source_configs', 'select,insert,update,delete'),
  ('suppression_list', 'select'),
  ('workspace_members', 'select,insert,update,delete'),
  ('workspaces', 'select,update')
$$, 'authenticated has exactly the intended table access');

select is_empty($$
  select column_name from (values ('status'), ('lead_score'), ('confidence'), ('buying_intent'), ('created_by'), ('workspace_id'), ('contact_hash'), ('qualification_attempts')) c(column_name)
  where has_column_privilege('authenticated', 'public.leads', c.column_name, 'update')
$$, 'people cannot update a lead''s status, scores, author, workspace or hash');

select results_eq($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and has_function_privilege('authenticated', p.oid, 'execute') order by p.oid::regprocedure::text collate "C"
$$, $$values
  ('approve_draft(uuid)'),
  ('edit_draft(uuid,text)'),
  ('erase_lead(uuid,text)'),
  ('ingest_lead(uuid,text,text,uuid,text,text,text,text,text,text,text,text,text,text,timestamp with time zone)'),
  ('mark_draft_sent(uuid)'),
  ('reject_draft(uuid,text)'),
  ('suppress_contact(uuid,text,text)'),
  ('transition_lead(uuid,text,text,numeric,text)')
$$, 'authenticated can call only the intended functions');

select results_eq($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and has_function_privilege('service_role', p.oid, 'execute') order by p.oid::regprocedure::text collate "C"
$$, $$values
  ('claim_leads_for_qualification(integer,interval,integer)'),
  ('create_outreach_draft(uuid,uuid,text,text,text)'),
  ('ingest_lead(uuid,text,text,uuid,text,text,text,text,text,text,text,text,text,text,timestamp with time zone)'),
  ('record_qualification_failure(uuid,text)'),
  ('transition_lead(uuid,text,text,numeric,text)')
$$, 'the server can call only the intended functions');

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon cannot call any function');

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not coalesce(p.proconfig, '{}') @> array['search_path=""']
$$, 'every security definer function pins an empty search path');

-- Fixtures: one owner, admin and member in A, and one row of everything in B.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner.a@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'admin.a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'member.a@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'owner.b@example.test');

insert into public.workspaces (id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 'a'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'B', 'b');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'owner');

insert into public.business_profiles (workspace_id, company_name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'B Ltd');
insert into public.services (id, workspace_id, service_name) values
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000001', 'B service'),
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000001', 'A service');
insert into public.source_configs (workspace_id, source_type, display_name, access_method) values ('bbbbbbbb-0000-0000-0000-000000000001', 'rss', 'B feed', 'rss');
insert into public.leads (id, workspace_id, source_type, author_handle, original_content) values
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'rss', 'bee', 'lead b');
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action)
values ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'review');
insert into public.lead_analysis_services (workspace_id, analysis_id, service_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-0000000000f1');
insert into public.contact_events (workspace_id, lead_id, event_type) values ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'note');
insert into public.automation_runs (workspace_id, workflow_name, status) values ('bbbbbbbb-0000-0000-0000-000000000001', 'test', 'success');
insert into public.suppression_list (workspace_id, contact_hash) values ('bbbbbbbb-0000-0000-0000-000000000001', 'h');
insert into public.data_erasures (workspace_id, erased_lead_id, reason) values ('bbbbbbbb-0000-0000-0000-000000000001', gen_random_uuid(), 'test');
insert into public.ingestion_records (workspace_id, idempotency_key) values ('bbbbbbbb-0000-0000-0000-000000000001', 'k');

set local role service_role;
select public.transition_lead('bbbbbbbb-0000-0000-0000-0000000000b1', 'qualifying');
select public.transition_lead('bbbbbbbb-0000-0000-0000-0000000000b1', 'qualified');
select public.create_outreach_draft('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1', 'email', 'hello', 'v1');
reset role;

-- B's owner sees all of B, which proves the isolation checks below are not passing on empty tables.
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
set local role authenticated;
select is((select count(*)::int from (
  select workspace_id from public.business_profiles union all select workspace_id from public.services
  union all select workspace_id from public.source_configs union all select workspace_id from public.leads
  union all select workspace_id from public.lead_analyses union all select workspace_id from public.lead_analysis_services
  union all select workspace_id from public.outreach_drafts union all select workspace_id from public.contact_events
  union all select workspace_id from public.pipeline_events union all select workspace_id from public.automation_runs
  union all select workspace_id from public.suppression_list union all select workspace_id from public.data_erasures
) s), 14, 'an owner sees every row in their own workspace');

-- An admin of A sees and changes nothing in B.
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select is((select count(*)::int from (
  select workspace_id from public.business_profiles union all select workspace_id from public.services
  union all select workspace_id from public.source_configs union all select workspace_id from public.leads
  union all select workspace_id from public.lead_analyses union all select workspace_id from public.lead_analysis_services
  union all select workspace_id from public.outreach_drafts union all select workspace_id from public.contact_events
  union all select workspace_id from public.pipeline_events union all select workspace_id from public.automation_runs
  union all select workspace_id from public.suppression_list union all select workspace_id from public.data_erasures
) s where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0, 'an admin of A reads nothing from B');
select is((select count(*)::int from public.workspaces where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0, 'an admin of A cannot read workspace B');
select is((select count(*)::int from public.workspace_members where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0, 'an admin of A cannot read B''s members');
select is_empty($$update public.business_profiles set description = 'x' where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$, 'an admin of A cannot update B''s profile');
select is_empty($$update public.services set description = 'x' where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$, 'an admin of A cannot update B''s services');
select is_empty($$delete from public.services where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$, 'an admin of A cannot delete B''s services');
select is_empty($$update public.source_configs set display_name = 'x' where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$, 'an admin of A cannot update B''s sources');
select is_empty($$delete from public.source_configs where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$, 'an admin of A cannot delete B''s sources');
select is_empty($$update public.leads set industry = 'x' where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$, 'an admin of A cannot update B''s leads');
select is_empty($$update public.workspaces set name = 'x' where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$, 'an admin of A cannot rename workspace B');
select throws_ok($$insert into public.services (workspace_id, service_name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'x')$$, '42501', null, 'an admin of A cannot add a service to B');
select throws_ok($$insert into public.contact_events (workspace_id, lead_id, event_type) values ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'note')$$, '42501', null, 'an admin of A cannot log an event in B');
select throws_ok($$insert into public.workspace_members (workspace_id, user_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d')$$, '42501', null, 'an admin of A cannot join B');
select throws_ok($$select public.erase_lead('bbbbbbbb-0000-0000-0000-0000000000b1', 'test')$$, '42501', null, 'an admin of A cannot erase B''s lead');
select throws_ok($$select public.suppress_contact('bbbbbbbb-0000-0000-0000-000000000001', 'x')$$, '42501', null, 'an admin of A cannot suppress a contact in B');
select throws_ok($$select public.transition_lead('bbbbbbbb-0000-0000-0000-0000000000b1', 'archived')$$, '42501', null, 'an admin of A cannot move B''s lead');
select throws_ok($$select count(*) from public.ingestion_records$$, '42501', null, 'people cannot read ingestion records');

-- Roles inside workspace A.
select lives_ok($$update public.workspaces set name = 'A renamed' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'an admin can rename their workspace');
select lives_ok($$update public.services set description = 'by admin' where id = 'aaaaaaaa-0000-0000-0000-0000000000f1'$$, 'an admin can update a service');
select lives_ok($$insert into public.business_profiles (workspace_id, company_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A Ltd')$$, 'an admin can add the business profile');

set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is_empty($$update public.workspaces set name = 'x' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$, 'a member cannot rename the workspace');
select is_empty($$update public.services set description = 'x' where id = 'aaaaaaaa-0000-0000-0000-0000000000f1' returning id$$, 'a member cannot update a service');
select is_empty($$delete from public.services where id = 'aaaaaaaa-0000-0000-0000-0000000000f1' returning id$$, 'a member cannot delete a service');
select is_empty($$update public.business_profiles set description = 'x' returning id$$, 'a member cannot update the business profile');
select throws_ok($$insert into public.workspace_members (workspace_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c')$$, '42501', null, 'a member cannot add a member');
select is_empty($$update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-00000000000a' returning id$$, 'a person cannot change a teammate''s profile');
select lives_ok($$update public.profiles set display_name = 'Me' where id = '00000000-0000-0000-0000-00000000000b'$$, 'a person can change their own profile');
select is((select count(*)::int from public.suppression_list), 0, 'a member cannot read the suppression list');

select * from finish();
rollback;
