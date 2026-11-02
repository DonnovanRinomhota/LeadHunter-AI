-- Local development only. Loaded by db:reset, and never applied to a hosted project by the steps in this repo.
-- Capability stays developing until the team confirms each service against the website.
insert into public.workspaces (id, name, slug) values
  ('11111111-1111-4111-8111-111111111111', 'Spiritus Agentic Solutions (local)', 'spiritus-local');

insert into public.business_profiles (workspace_id, company_name, website_url, target_geographies, target_industries, ideal_customer_profile) values
  ('11111111-1111-4111-8111-111111111111', 'Spiritus Agentic Solutions', 'https://spiritustec.com/', '{ZW,ZA}',
   '{consultancies,accounting firms,business services}',
   '{"segment": "Mid-sized professional services firms", "staff_min": 20, "staff_max": 200}');

insert into public.services (workspace_id, service_name, description, is_priority) values
  ('11111111-1111-4111-8111-111111111111', 'Agentic Workflows', 'Reduce repetitive administrative work.', true),
  ('11111111-1111-4111-8111-111111111111', 'Automation & Integration', 'Streamline processes and connect existing systems.', true),
  ('11111111-1111-4111-8111-111111111111', 'AI Knowledge Operations', 'Improve access to business information.', true);
