begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'member@example.test');
insert into public.workspaces (id, name, slug) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 'a');
insert into public.workspace_members (workspace_id, user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'owner');
insert into public.leads (id, workspace_id, source_type, source_record_id, original_content, contact_value) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'a1', 'ready', 'one@example.test'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'a2', 'needs a check', 'two@example.test'),
  ('aaaaaaaa-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'a3', 'opted out', 'three@example.test');

insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action)
select ('aaaaaaaa-0000-0000-0000-0000000000c' || right(l.id::text, 1))::uuid, l.workspace_id, l.id, 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5,
  case when l.source_record_id = 'a2' then 'compliance_review' else 'review' end
from public.leads l;

set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
set local role authenticated;
select throws_ok($$select public.list_leads_ready_for_draft()$$, '42501', null, 'people cannot read the draft queue');
reset role;

set local "request.jwt.claims" = '';
set local role service_role;
select public.transition_lead(id, 'qualifying') from public.leads where source_record_id in ('a1','a2','a3');
select public.transition_lead(id, 'qualified') from public.leads where source_record_id in ('a1','a2','a3');
reset role;
insert into public.suppression_list (workspace_id, contact_hash) select workspace_id, contact_hash from public.leads where source_record_id = 'a3';
set local role service_role;

select results_eq($$select lead_id, analysis_id from public.list_leads_ready_for_draft()$$, $$values ('aaaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'aaaaaaaa-0000-0000-0000-0000000000c1'::uuid)$$, 'only a clean lead marked for review is listed');

update public.leads set qualification_last_error = 'Draft failed' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is_empty($$select lead_id from public.list_leads_ready_for_draft()$$, 'a lead with a recorded problem is not retried automatically');
update public.leads set qualification_last_error = null where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';

select public.create_outreach_draft('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'email', 'First draft', 'v1');
select is_empty($$select lead_id from public.list_leads_ready_for_draft()$$, 'a lead with a draft is not listed');
reset role;

set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
set local role authenticated;
select lives_ok($$select public.reject_draft((select id from public.outreach_drafts limit 1), 'Too pushy')$$, 'a person can reject the draft');
select is((select status from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'qualified', 'a rejection returns the lead to qualified');
reset role;
set local "request.jwt.claims" = '';
set local role service_role;
select is_empty($$select lead_id from public.list_leads_ready_for_draft()$$, 'a rejected draft is not replaced automatically');
reset role;

-- An opt-out recorded by a member cancels an active draft.
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action, created_at)
values ('aaaaaaaa-0000-0000-0000-0000000000c9', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'review', now() + interval '1 minute');
set local role service_role;
select public.create_outreach_draft('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c9', 'email', 'Second draft', 'v1');
reset role;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
set local role authenticated;
insert into public.contact_events (workspace_id, lead_id, event_type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'opt_out');
select is((select status from public.outreach_drafts where message = 'Second draft'), 'cancelled', 'an opt-out cancels the active draft');
select is((select status from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'qualified', 'an opt-out takes the lead out of review');

select * from finish();
rollback;
