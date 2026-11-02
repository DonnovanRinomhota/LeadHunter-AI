# Database

The schema lives in `migrations/`. `tests/database/rules.test.sql` covers the workflow rules, and `permissions.test.sql` checks every role against every table. Donnovan reviews and runs all SQL first, and nothing is applied to a hosted project until that is done.

## Run it locally

This needs Docker Desktop running. The first start downloads several container images.

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

`db:reset` rebuilds the local database from the migrations and loads `seed.sql`, which holds the local workspace and three priority services. To sign in locally, run `npm run dev:user -- you@example.com` once after each reset. `db:test` runs the tests in a transaction that is rolled back. CI runs them on every pull request too.

## How it fits together

| Migration | Purpose |
|---|---|
| `core_schema` | Tables, constraints and indexes |
| `workflow_rules` | Triggers and the functions for lead moves, drafts, opt-outs and erasure |
| `access_policies` | Grants and row level security |
| `qualification_queue` | Fit assessment, and the functions n8n uses to claim leads |
| `ingest_lead` | The single atomic path for incoming leads |
| `draft_queue` | Lists qualified leads ready for a first draft |
| `lead_screens` | Lets members add leads, and keeps service matches ready for filtering |

## Rules to build against

Status and draft changes go through these functions. Direct writes are refused, including for the service role.

| Function | Who can call it | What it does |
|---|---|---|
| `transition_lead` | Members and server | Moves a lead along the allowed paths in `private.lead_transitions` |
| `create_outreach_draft` | Server | Creates a pending draft from the latest analysis |
| `edit_draft` | Members | Edits a draft; editing an approved draft cancels its approval |
| `approve_draft` | Members | Approves a draft in the caller's own name |
| `reject_draft` | Members | Rejects a draft with a reason |
| `mark_draft_sent` | Members | Records that a person sent the approved text; it sends nothing |
| `ingest_lead` | Members and server | Stores a lead once, using its idempotency key, source record, URL or content |
| `list_leads_ready_for_draft` | Server | Lists leads that should get a first draft |
| `claim_leads_for_qualification` | Server | Hands out leads safely for qualification |
| `record_qualification_failure` | Server | Returns a failed lead to new with its error |
| `suppress_contact` | Owners and admins | Blocks a contact without needing a lead |
| `erase_lead` | Owners and admins | Removes a lead and its history, keeping the suppression entry and an erasure record |

The server's calls use the secret key and have no signed-in user, so the server can never approve a draft.

## Limits to know about

- Contact hashes are unsalted SHA-256, so treat them as personal data.
- Nothing yet deletes leads when `retain_until` passes, because the retention period needs legal advice.
- A lead that uses up its qualification attempts stays in `new` with an error until a retry action is built.
