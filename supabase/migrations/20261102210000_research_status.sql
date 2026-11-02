-- A good-fit firm with no buying signal is neither qualified nor disqualified.
-- Research keeps it visible for a person, and only a qualified lead can get a draft.

alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('new','qualifying','qualified','research','disqualified','draft_ready','approved','contacted','replied','meeting','proposal','won','lost','archived'));

insert into private.lead_transitions (from_status, to_status, actor) values
  ('qualifying','research','server'),
  ('research','qualified','person'),
  ('research','disqualified','person'),
  ('research','archived','person'),
  ('research','new','person');
