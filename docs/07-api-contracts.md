# 7. API contracts (proposed)

These are implementation contracts, not deployed endpoints yet.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/leads` | List workspace leads with filters / pagination |
| POST | `/api/leads` | Create a manual lead |
| GET | `/api/leads/:id` | Fetch lead, analyses and drafts |
| POST | `/api/leads/:id/qualify` | Request AI qualification |
| POST | `/api/leads/:id/drafts` | Generate an outreach draft |
| POST | `/api/drafts/:id/approve` | Approve a draft |
| POST | `/api/drafts/:id/reject` | Reject a draft |
| PATCH | `/api/drafts/:id` | Edit a pending draft |
| POST | `/api/leads/:id/events` | Record contact / pipeline event |
| GET/POST | `/api/services` | List / configure services |
| GET/POST | `/api/sources` | List / configure permitted sources |
| POST | `/api/webhooks/n8n` | Receive signed n8n events |
| GET | `/api/analytics/summary` | Pipeline and conversion metrics |

## Shared contracts

These files define what every workstream builds against. Change them in a PR reviewed by another owner.

| Contract | File |
|---|---|
| Lead ingest format and responses | `src/contracts/ingest.ts` |
| Claude's output, scoring and quote checks | `src/contracts/qualification.ts` |
| Statuses, actions and the qualified score | `src/contracts/lead-state.ts` |
| Signed requests between n8n and the app | `src/contracts/internal-auth.ts` |
| Allowed lead moves | `private.lead_transitions` in `supabase/migrations/` |
| Claiming leads and recording failures | `claim_leads_for_qualification`, `record_qualification_failure` |
| Database types | Generate with `npm run db:types` while the local database is running |

## API requirements

- Authenticate every user-facing request.
- Resolve workspace membership server-side.
- Verify record ownership / workspace membership.
- Validate request bodies with a schema library.
- Rate-limit expensive AI operations.
- Use idempotency keys for webhook ingestion.
- Verify n8n webhook signatures / shared secrets.
- Return safe errors without leaking credentials or stack traces.
- Audit approval, rejection and status transitions.
- Never trust a client-supplied `workspace_id` without membership validation.
