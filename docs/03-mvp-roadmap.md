# 3. MVP roadmap

The timeline is indicative and depends on team capacity, provider access and source permissions.

## Phase 0 — Decisions (1–2 days)
- Choose one initial customer segment and geography.
- Agree the top 3 service offers.
- Define what makes a lead qualified and what disqualifies it.
- Confirm the first authorised source.
- Assign an owner to each workstream.

## Phase 1 — Foundation
- Create Next.js + TypeScript application.
- Configure Supabase project, Auth and RLS.
- Apply initial database migration.
- Add team profile, services and ideal-customer settings.
- Establish development / staging environments.

## Phase 2 — Lead intake
- Implement manual lead submission.
- Implement one authorised source connector.
- Normalise and deduplicate leads.
- Save source URL and timestamps.
- Add connector run logs and retry handling.

## Phase 3 — AI qualification
- Implement structured extraction and classification.
- Match opportunities against SpiritusTec services.
- Calculate transparent lead score.
- Add confidence and missing-information fields.
- Generate outreach drafts for eligible leads.

## Phase 4 — Review dashboard
- Lead list with filters and status.
- Lead detail showing original source and AI reasoning.
- Edit / approve / reject draft.
- Telegram internal notifications.
- Audit trail for review decisions.

## Phase 5 — Pipeline and validation
- Track contacted, replied, meeting, proposal, won and lost.
- Capture reason lost / disqualified.
- Review false positives and false negatives weekly.
- Measure qualified leads, meetings and revenue.

## MVP acceptance criteria

- A team member can add a lead manually.
- At least one permitted connector can create a lead.
- Duplicate source records are not created.
- AI output is validated and linked to evidence from source content.
- A reviewer can edit, approve or reject an outreach draft.
- No prospect-facing message is sent without the required human approval.
- Pipeline status changes are auditable.
- Tenant data is protected by RLS and API ownership checks.

## Deliberately deferred

- Public SaaS signup and billing
- Multi-workspace administration UI
- Automated social DMs
- Large-scale enrichment
- Complex campaign sequencing
- Predictive revenue forecasting
- Multiple social-platform connectors before permissions are confirmed
