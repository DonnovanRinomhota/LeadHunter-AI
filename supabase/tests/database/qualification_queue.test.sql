begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'member@example.test');
insert into public.workspaces (id, name, slug) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 'a');
insert into public.workspace_members (workspace_id, user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'owner');
insert into public.leads (id, workspace_id, source_type, original_content, discovered_at) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'first', now() - interval '2 hours'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'second', now() - interval '1 hour');

set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
set local role authenticated;
select throws_ok($$select public.claim_leads_for_qualification()$$, '42501', null, 'people cannot claim leads');
select throws_ok($$select public.record_qualification_failure('aaaaaaaa-0000-0000-0000-0000000000a1', 'x')$$, '42501', null, 'people cannot record failures');
reset role;

set local "request.jwt.claims" = '';
set local role service_role;
select results_eq($$select lead_id from public.claim_leads_for_qualification(1)$$, $$values ('aaaaaaaa-0000-0000-0000-0000000000a1'::uuid)$$, 'the oldest lead is claimed first, within the limit');
select is((select status from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'qualifying', 'a claimed lead moves to qualifying');
select is((select qualification_attempts from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 1, 'the attempt is counted');
select results_eq($$select lead_id from public.claim_leads_for_qualification(5)$$, $$values ('aaaaaaaa-0000-0000-0000-0000000000a2'::uuid)$$, 'a lead that is already claimed is not handed out twice');

select lives_ok($$select public.record_qualification_failure('aaaaaaaa-0000-0000-0000-0000000000a2', 'Claude returned invalid output')$$, 'the server can record a failure');
select results_eq($$select status, qualification_last_error from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a2'$$, $$values ('new'::text, 'Claude returned invalid output'::text)$$, 'a failed lead returns to new with its error');
select throws_ok($$select public.record_qualification_failure('aaaaaaaa-0000-0000-0000-0000000000a2', 'x')$$, 'P0001', null, 'a lead that is not being qualified cannot fail');

-- A stale claim is reclaimed. Attempts run out at the limit.
update public.leads set qualification_claimed_at = now() - interval '1 hour' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select results_eq($$select lead_id from public.claim_leads_for_qualification(1)$$, $$values ('aaaaaaaa-0000-0000-0000-0000000000a1'::uuid)$$, 'a stale claim can be claimed again');
update public.leads set qualification_claimed_at = now() - interval '1 hour', qualification_attempts = 3 where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select is_empty($$select lead_id from public.claim_leads_for_qualification(5) where lead_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, 'a lead out of attempts is not handed out');
select results_eq($$select status, qualification_last_error from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, $$values ('new'::text, 'Timed out on the final attempt'::text)$$, 'a lead out of attempts returns to new with an error');

-- A good-fit firm with no buying signal is kept, without a draft.
update public.leads set qualification_attempts = 0 where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a1', 'qualifying');
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, fit_assessment, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'anthropic', 'm', 'v1', true, 'good', 'low', 'unknown', 0.7, 25, 0, 15, 20, 0, 5, 'research');
select is((select fit_assessment from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'good', 'fit is recorded on the lead');
select is((select buying_intent from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'low', 'buying intent is recorded separately');
select lives_ok($$select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a1', 'qualified')$$, 'a strong fit can still qualify');
select throws_ok($$select public.create_outreach_draft('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'email', 'hello', 'v1')$$, 'P0001', null, 'a research result cannot get a draft');

select * from finish();
rollback;
