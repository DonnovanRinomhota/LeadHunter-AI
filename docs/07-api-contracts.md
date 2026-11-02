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
