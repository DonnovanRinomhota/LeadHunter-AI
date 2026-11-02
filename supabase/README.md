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

`db:reset` rebuilds the local database from the migrations. `db:test` runs the tests in a transaction that is rolled back. CI runs them on every pull request too.

## How it fits together

| Migration | Purpose |
|---|---|
| `core_schema` | Tables, constraints and indexes |
| `workflow_rules` | Triggers and the functions for lead moves, drafts, opt-outs and erasure |
| `access_policies` | Grants and row level security |

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
| `suppress_contact` | Owners and admins | Blocks a contact without needing a lead |
| `erase_lead` | Owners and admins | Removes a lead and its history, keeping the suppression entry and an erasure record |

The server's calls use the secret key and have no signed-in user, so the server can never approve a draft.

## Limits to know about

- Contact hashes are unsalted SHA-256, so treat them as personal data.
- Nothing yet deletes leads when `retain_until` passes, because the retention period needs legal advice.
- The claim function for the n8n poller comes with the shared contracts.
