-- Run with: npm run db:test
-- Everything happens inside one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(74);

-- Fixtures: owner, admin and member in workspace A, an owner in workspace B, and a spare user.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner.a@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'admin.a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'member.a@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'owner.b@example.test'),
  ('00000000-0000-0000-0000-00000000000e', 'outsider@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 'a', '00000000-0000-0000-0000-00000000000a'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'B', 'b', '00000000-0000-0000-0000-00000000000c');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'owner');

insert into public.leads (id, workspace_id, source_type, source_record_id, author_handle, original_content) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'r1', 'jane', 'lead a'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001', 'rss', 'r1', 'jane', 'lead b');

-- 1. Sign-up and bootstrap
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000e'), 1, 'a new user gets a profile');

set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000e"}';
set local role authenticated;
select throws_ok($$insert into public.workspaces (name, slug) values ('X', 'x')$$, '42501', null, 'a signed-in user cannot create a workspace');
select throws_ok($$insert into public.workspace_members (workspace_id, user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'owner')$$, '42501', null, 'an outsider cannot join a workspace');
select is((select count(*)::int from public.workspaces), 0, 'an outsider sees no workspaces');

-- 2. Tenant isolation
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select is((select count(*)::int from public.leads), 1, 'a member reads only their workspace''s leads');
select throws_ok($$insert into public.leads (workspace_id, source_type, original_content) values ('bbbbbbbb-0000-0000-0000-000000000001', 'manual', 'x')$$, '42501', null, 'a member cannot write into another workspace');
select is((select count(*)::int from public.profiles), 3, 'a member reads the profiles of teammates only');

reset role;
set local "request.jwt.claims" = '';
set local role anon;
select throws_ok($$select count(*) from public.leads$$, '42501', null, 'anonymous callers cannot read leads');
select throws_ok($$select public.approve_draft('00000000-0000-0000-0000-000000000000')$$, '42501', null, 'anonymous callers cannot call workflow functions');
reset role;

-- 3. Cross-workspace links
select throws_ok($$insert into public.lead_analyses (workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'review')$$, '23503', null, 'an analysis cannot point at another workspace''s lead');

-- 4. Member permissions
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
set local role authenticated;
select lives_ok($$insert into public.leads (workspace_id, source_type, source_record_id, original_content, contact_value) values ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'manual-1', 'manual lead', 'Person@Example.test')$$, 'a member can add a manual lead');
select is((select created_by from public.leads where source_record_id = 'manual-1'), '00000000-0000-0000-0000-00000000000b'::uuid, 'the database records who added the lead');
select throws_ok($$insert into public.leads (workspace_id, source_type, original_content, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'x', 'won')$$, '42501', null, 'a member cannot set a status when inserting');
select throws_ok($$update public.leads set status = 'contacted' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '42501', null, 'a member cannot set a status directly');
select throws_ok($$update public.leads set lead_score = 100 where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '42501', null, 'a member cannot set a score');
select throws_ok($$delete from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '42501', null, 'a member cannot delete a lead');
select throws_ok($$insert into public.lead_analyses (workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'anthropic', 'm', 'forged', true, 'high', 'high', 0.9, 25, 25, 15, 20, 10, 5, 'review')$$, '42501', null, 'a member cannot forge an analysis');
select throws_ok($$insert into public.services (workspace_id, service_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Nuclear engineering')$$, '42501', null, 'a member cannot change the catalogue');
select throws_ok($$insert into public.source_configs (workspace_id, source_type, display_name, access_method) values ('aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'Feed', 'rss')$$, '42501', null, 'a member cannot change sources');
select throws_ok($$select public.erase_lead((select id from public.leads where source_record_id = 'manual-1'), 'test')$$, '42501', null, 'a member cannot erase a lead');
select throws_ok($$insert into public.contact_events (workspace_id, lead_id, event_type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'contacted')$$, '42501', null, 'a member cannot log contact outside the draft functions');
select lives_ok($$insert into public.contact_events (workspace_id, lead_id, event_type, notes) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'note', 'called')$$, 'a member can add a note');
select is((select created_by from public.contact_events where notes = 'called'), '00000000-0000-0000-0000-00000000000b'::uuid, 'the database sets the note''s author');
select throws_ok($$insert into public.contact_events (workspace_id, lead_id, event_type, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'note', '00000000-0000-0000-0000-00000000000a')$$, '42501', null, 'a member cannot name another author');

-- 5. Configuration rules
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select lives_ok($$insert into public.services (workspace_id, service_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agentic Workflows')$$, 'an admin can add a service');
select is((select capability_level from public.services where service_name = 'Agentic Workflows'), 'developing', 'a new service is not assumed to be confirmed');
select throws_ok($$insert into public.source_configs (workspace_id, source_type, display_name, access_method, enabled) values ('aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'Feed', 'rss', true)$$, '23514', null, 'a source cannot be enabled without a permission reference');

-- 6. Workspace ownership
select throws_ok($$update public.workspace_members set role = 'member' where user_id = '00000000-0000-0000-0000-00000000000a' and workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, '42501', null, 'an admin cannot demote an owner');
select throws_ok($$delete from public.workspace_members where user_id = '00000000-0000-0000-0000-00000000000a' and workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, '42501', null, 'an admin cannot remove an owner');
select throws_ok($$update public.workspace_members set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000d' and workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, '42501', null, 'an admin cannot promote themselves to owner');
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select throws_ok($$delete from public.workspace_members where user_id = '00000000-0000-0000-0000-00000000000a' and workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'P0001', null, 'the last owner cannot be removed');
reset role;

-- 7. History and direct writes, using the service role because it bypasses row level security
set local "request.jwt.claims" = '';
set local role service_role;
select throws_ok($$update public.leads set status = 'won' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '42501', null, 'the server cannot set a status directly');
select throws_ok($$delete from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '42501', null, 'the server cannot delete a lead directly');
select throws_ok($$insert into public.pipeline_events (workspace_id, lead_id, to_status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'won')$$, '42501', null, 'the server cannot forge a pipeline event');
select throws_ok($$delete from public.contact_events$$, '42501', null, 'the server cannot delete contact history');
select throws_ok($$insert into public.outreach_drafts (workspace_id, lead_id, analysis_id, prompt_version, channel, ai_original_message, message, status, approved_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'v1', 'email', 'x', 'x', 'approved', '00000000-0000-0000-0000-00000000000a')$$, '42501', null, 'the server cannot insert an approved draft');
select throws_ok($$select public.approve_draft('00000000-0000-0000-0000-000000000000')$$, '42501', null, 'the server role cannot call approval at all');

-- 8. Deduplication
select is_empty($$insert into public.leads (workspace_id, source_type, source_record_id, original_content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'r1', 'duplicate') on conflict (workspace_id, source_type, source_record_id) do nothing returning id$$, 'on conflict resolves a duplicate source record');
select lives_ok($$insert into public.leads (workspace_id, source_type, original_content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'one'), ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'two')$$, 'leads with no source ID are allowed');
select throws_ok($$insert into public.leads (workspace_id, source_type, canonical_url, original_content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'https://x.test/p', 'one'), ('aaaaaaaa-0000-0000-0000-000000000001', 'csv', 'https://x.test/p', 'two')$$, '23505', null, 'the same URL cannot be added twice without a source ID');
select throws_ok($$insert into public.leads (workspace_id, source_type, content_hash, original_content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'h1', 'same'), ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'h1', 'same')$$, '23505', null, 'the same content cannot be added twice without a source ID');

-- 9. Qualification: the total is calculated, and the qualified rule is enforced
select throws_ok($$select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a1', 'contacted')$$, 'P0001', null, 'a lead cannot jump from new to contacted');
select lives_ok($$select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a1', 'qualifying')$$, 'the server can start qualification');
select throws_ok($$select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a1', 'qualified')$$, 'P0001', null, 'a lead with no analysis cannot qualify');
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'anthropic', 'm', 'v1', true, 'low', 'unknown', 0.5, 10, 5, 5, 5, 0, 5, 'review');
select is((select lead_score from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 30, 'the lead takes its score from the calculated total');
select throws_ok($$select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a1', 'qualified')$$, 'P0001', null, 'a score under 60 cannot qualify');
select throws_ok($$update public.lead_analyses set recommended_action = 'reject'$$, '42501', null, 'an analysis cannot be rewritten');
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action, created_at)
values ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'review', now() + interval '1 minute');
select lives_ok($$select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a1', 'qualified')$$, 'a score of 60 or more can qualify');
select throws_ok($$select public.create_outreach_draft('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'email', 'hello', 'v1')$$, 'P0001', null, 'a draft cannot use an out-of-date analysis');

-- 10. Draft review
select lives_ok($$select public.create_outreach_draft('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c2', 'email', 'hello', 'v1')$$, 'the server can create a pending draft');
select is((select status from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'draft_ready', 'creating a draft moves the lead to draft_ready');
reset role;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000e"}';
set local role authenticated;
select throws_ok($$select public.approve_draft((select id from public.outreach_drafts limit 1))$$, 'P0002', null, 'an outsider cannot find a draft to approve');
reset role;
select set_config('test.draft', (select id::text from public.outreach_drafts limit 1), true);
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
set local role authenticated;
select throws_ok($$select public.approve_draft(current_setting('test.draft')::uuid)$$, '42501', null, 'a member of another workspace cannot approve');
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select lives_ok($$select public.edit_draft(current_setting('test.draft')::uuid, 'hello, edited')$$, 'a member can edit a pending draft');
select lives_ok($$select public.approve_draft(current_setting('test.draft')::uuid)$$, 'decision 8: any member can approve');
select results_eq($$select approved_by, ai_original_message, status from public.outreach_drafts where id = current_setting('test.draft')::uuid$$, $$values ('00000000-0000-0000-0000-00000000000b'::uuid, 'hello'::text, 'approved'::text)$$, 'the approver and the AI''s original text are recorded');
select lives_ok($$select public.edit_draft(current_setting('test.draft')::uuid, 'changed after approval')$$, 'an approved draft can be edited');
select results_eq($$select d.status, d.approved_by, l.status from public.outreach_drafts d join public.leads l on l.id = d.lead_id where d.id = current_setting('test.draft')::uuid$$, $$values ('pending'::text, null::uuid, 'draft_ready'::text)$$, 'editing an approved draft cancels its approval');
select throws_ok($$select public.mark_draft_sent(current_setting('test.draft')::uuid)$$, 'P0001', null, 'an unapproved draft cannot be marked as sent');
select lives_ok($$select public.approve_draft(current_setting('test.draft')::uuid)$$, 'the edited draft can be approved again');
select lives_ok($$select public.mark_draft_sent(current_setting('test.draft')::uuid)$$, 'an approved draft can be marked as sent');
select is((select status from public.leads where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'contacted', 'the lead moves to contacted');
select ok((select count(*) >= 5 from public.pipeline_events where lead_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 'every status change is in the audit trail');

-- 11. Opt-out, erasure and account deletion
select lives_ok($$insert into public.contact_events (workspace_id, lead_id, event_type) values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.leads where source_record_id = 'manual-1'), 'opt_out')$$, 'a member can record an opt-out');
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
select lives_ok($$select public.erase_lead((select id from public.leads where source_record_id = 'manual-1'), 'Requested by the person')$$, 'an admin can erase a lead');
select is((select count(*)::int from public.suppression_list where contact_hash = encode(sha256(convert_to('person@example.test', 'UTF8')), 'hex')), 1, 'the opt-out outlives the lead');
select is((select count(*)::int from public.data_erasures), 1, 'the erasure is recorded');
reset role;

-- The same person is found again: they cannot get a draft.
insert into public.leads (id, workspace_id, source_type, original_content, contact_value) values ('aaaaaaaa-0000-0000-0000-0000000000a6', 'aaaaaaaa-0000-0000-0000-000000000001', 'rss', 'found again', ' person@example.test ');
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action)
values ('aaaaaaaa-0000-0000-0000-0000000000c6', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a6', 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'review');
set local "request.jwt.claims" = '';
set local role service_role;
select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a6', 'qualifying');
select public.transition_lead('aaaaaaaa-0000-0000-0000-0000000000a6', 'qualified');
select throws_ok($$select public.create_outreach_draft('aaaaaaaa-0000-0000-0000-0000000000a6', 'aaaaaaaa-0000-0000-0000-0000000000c6', 'email', 'hello', 'v1')$$, 'P0001', null, 'a suppressed contact cannot get a draft');
reset role;

-- compliance_review blocks drafting.
insert into public.lead_analyses (id, workspace_id, lead_id, model_provider, model_name, prompt_version, is_business_opportunity, buying_intent, urgency, confidence, score_service_relevance, score_buying_intent, score_project_clarity, score_capability_match, score_budget_evidence, score_recency, recommended_action, created_at)
values ('aaaaaaaa-0000-0000-0000-0000000000c7', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'anthropic', 'm', 'v1', true, 'high', 'high', 0.9, 20, 20, 10, 15, 5, 5, 'compliance_review', now());
set local role service_role;
select public.transition_lead('bbbbbbbb-0000-0000-0000-0000000000b1', 'qualifying');
select public.transition_lead('bbbbbbbb-0000-0000-0000-0000000000b1', 'qualified');
select throws_ok($$select public.create_outreach_draft('bbbbbbbb-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000c7', 'email', 'hello', 'v1')$$, 'P0001', null, 'a compliance review result blocks a draft');
reset role;

select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-00000000000b'$$, 'a user who approved a draft can still be deleted');
select is((select approved_by from public.outreach_drafts where id = current_setting('test.draft')::uuid), null::uuid, 'deleting a user clears their name but keeps the draft');
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-00000000000c'$$, 'a sole owner''s account can still be deleted');

-- 12. Schema checks
select is_empty($$
  select c.conrelid::regclass::text || ' ' || c.conname
  from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
        and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
    )
$$, 'every foreign key has a supporting index');
select is_empty($$select tablename from pg_tables where schemaname = 'public' and not rowsecurity$$, 'row level security is on for every table');

select * from finish();
rollback;
