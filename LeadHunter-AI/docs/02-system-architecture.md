# 2. System architecture

## Logical components

### A. Source connectors
Adapters retrieve opportunities only through authorised mechanisms:
- Official platform APIs with required permissions
- Licensed search / data providers
- Public RSS feeds where permitted
- Approved job / tender / procurement feeds
- Website contact or enquiry submissions
- Manual lead entry by a team member

Every connector must return a common source envelope and preserve the original URL, publication time, retrieval time and source identifier where available.

### B. n8n orchestration
n8n coordinates scheduled discovery, webhooks, normalisation, deduplication, AI calls, retries, notifications and pipeline reminders. Keep credentials in n8n credentials / secret storage, not in workflow text or repository exports.

### C. Application and API
A Next.js + TypeScript application provides authentication, lead review, service configuration, draft approval and pipeline management. Server-side routes validate user access and call Supabase / AI services.

### D. Supabase
PostgreSQL is the system of record. Supabase Auth handles identity. Row Level Security (RLS) protects tenant-owned records. Storage can be added later for approved attachments; do not store unnecessary source media.

### E. AI qualification
The AI layer returns schema-validated structured data: problem summary, service match, intent evidence, missing information, confidence, score and draft. AI output is advisory; a human decides whether to contact the prospect.

### F. Human review and outreach
The dashboard shows the original source, analysis, score and proposed message. A team member can edit, approve, reject or mark as contacted. Actual sending should be manual in the MVP unless a channel explicitly permits the integration and the team has implemented opt-out and rate controls.

### G. Observability
Record connector runs, failures, AI model/version, token usage where available, review actions and state changes. Avoid logging secrets or unnecessary personal data.

## Data flow

1. A scheduled n8n workflow calls a permitted connector or receives a manual submission.
2. The connector returns source metadata and original content.
3. Normalisation maps it to the canonical lead structure.
4. Deduplication checks source ID and canonical URL within the tenant.
5. A qualification workflow sends minimal necessary content to the selected LLM.
6. Structured output is validated and persisted as a lead score / analysis.
7. An outreach draft is generated only when the lead is relevant and contact is appropriate.
8. Telegram sends an internal notification with a dashboard link, not a bulk prospect message.
9. A human reviews and approves / rejects the draft.
10. The team records contact, response, meeting, proposal and final outcome.

## Deployment boundaries

- Next.js: Vercel or another managed web host.
- n8n: secured VPS / managed n8n instance.
- Supabase: managed PostgreSQL and Auth.
- AI provider: server-side API calls only.
- Secrets: hosting secret manager and n8n credential store.

## Security boundaries

- Browser receives only public Supabase configuration and user-scoped access.
- Supabase service-role key remains server-side only.
- n8n webhook endpoints require shared-secret or signed-request verification.
- Validate all webhook payloads and enforce idempotency.
- Enforce tenant ownership in both API code and RLS.
- Treat source text as untrusted; never let it issue tool instructions or trigger external actions.
