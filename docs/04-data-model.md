# 4. Data model

The SQL migrations are in `supabase/migrations/`, and `supabase/README.md` explains how to run them.

## Core entities

| Table | Purpose |
|---|---|
| `profiles` | User profile linked to Supabase Auth |
| `workspaces` | Tenant / organisation boundary |
| `workspace_members` | Membership and role |
| `business_profiles` | SpiritusTec positioning and ideal customer profile |
| `services` | Services offered and capability boundaries |
| `source_configs` | Permitted source connector configuration |
| `leads` | Canonical opportunity record |
| `lead_analyses` | Versioned AI qualification output |
| `outreach_drafts` | Human-reviewable message drafts |
| `contact_events` | Contact and response history |
| `pipeline_events` | Meeting, proposal, won/lost history |
| `automation_runs` | Workflow execution audit metadata |
| `lead_analysis_services` | Which services each analysis matched, with evidence |
| `suppression_list` | Contacts who must not be contacted, kept after a lead is erased |
| `data_erasures` | Record that a lead was erased |
| `ingestion_records` | Idempotency keys for lead ingestion |

## Lead lifecycle

`new → qualifying → qualified / disqualified → draft_ready → approved → contacted → replied → meeting → proposal → won / lost`

Not every lead follows every state. Keep a separate `status` and record transitions in `pipeline_events` / `contact_events`.

## Data principles

- Use UUID primary keys.
- Store money with explicit currency.
- Store source content only when necessary and permitted.
- Keep source URL and source identifiers for traceability.
- Store AI output as JSONB but validate its shape in the application.
- Keep AI analysis versioned; do not overwrite history silently.
- Use workspace-scoped uniqueness to deduplicate source records.
- Avoid collecting sensitive personal data.
- Set retention and deletion rules before production.
