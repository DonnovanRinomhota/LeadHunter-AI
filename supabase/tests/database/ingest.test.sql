begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'member@example.test');
insert into public.workspaces (id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 'a'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'B', 'b');
insert into public.workspace_members (workspace_id, user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'owner');

create function pg_temp.ingest(p_ws text, p_key text, p_record text, p_url text, p_hash text)
returns table (outcome text, lead_id uuid) language sql as $$
  select * from public.ingest_lead(p_ws::uuid, p_key, 'rss', null, p_record, p_url, p_url, null, null, 'ZW', null, null, 'content', p_hash, null)
$$;

set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
set local role authenticated;
select lives_ok($$select public.ingest_lead('aaaaaaaa-0000-0000-0000-000000000001', 'key-p', 'manual', null, 'person-1', null, null, null, null, null, null, null, 'added by a person', null, null)$$, 'a member can add a lead to their workspace');
select is((select created_by from public.leads where source_record_id = 'person-1'), '00000000-0000-0000-0000-00000000000b'::uuid, 'the lead is recorded in that member''s name');
select throws_ok($$select public.ingest_lead('bbbbbbbb-0000-0000-0000-000000000001', 'key-x', 'manual', null, null, null, null, null, null, null, null, null, 'x', null, null)$$, '42501', null, 'a member cannot add a lead to another workspace');
reset role;
set local "request.jwt.claims" = '';

select is((select outcome from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-1', 'r1', null, null)), 'created', 'a new lead is created');
select is((select outcome from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-1', 'r1', null, null)), 'duplicate', 'replaying a key creates nothing');
select is((select lead_id from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-1', 'r1', null, null)), (select id from public.leads where source_record_id = 'r1'), 'a replay returns the original lead');
select is((select lead_id from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-2', 'r1', null, null)), (select id from public.leads where source_record_id = 'r1'), 'a new key for the same source record finds the existing lead');
select is((select count(*)::int from public.leads where source_record_id = 'r1'), 1, 'only one lead exists for that record');

select is((select outcome from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-3', null, 'https://x.test/p', null)), 'created', 'a lead with a URL and no record ID is created');
select is((select outcome from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-4', null, 'https://x.test/p', null)), 'duplicate', 'the same URL is a duplicate');
select is((select outcome from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-5', null, null, 'hash-1')), 'created', 'a lead with only a content hash is created');
select is((select outcome from pg_temp.ingest('aaaaaaaa-0000-0000-0000-000000000001', 'key-6', null, null, 'hash-1')), 'duplicate', 'the same content is a duplicate');
select is((select outcome from pg_temp.ingest('bbbbbbbb-0000-0000-0000-000000000001', 'key-1', 'r1', null, null)), 'created', 'the same key and record are separate in another workspace');

-- Service matches follow the latest analysis, for the list filter.
insert into public.services (id, workspace_id, service_name) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000001', 'One'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000001', 'Two');
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action)
select 'aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', id, 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'review' from public.leads where source_record_id = 'person-1';
insert into public.lead_analysis_services (workspace_id, analysis_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000f1');
select is((select service_categories from public.leads where source_record_id = 'person-1'), array['aaaaaaaa-0000-0000-0000-0000000000f1'::uuid], 'a lead lists its matched services');
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action)
select 'aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000001', id, 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'review' from public.leads where source_record_id = 'person-1';
insert into public.lead_analysis_services (workspace_id, analysis_id, service_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-0000000000f2');
select is((select service_categories from public.leads where source_record_id = 'person-1'), array['aaaaaaaa-0000-0000-0000-0000000000f2'::uuid], 'a new analysis replaces the older matches');

select * from finish();
rollback;
