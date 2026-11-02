# n8n workflows

n8n is the orchestration layer. Keep workflow exports free of credentials and secrets.

Importable files are in `workflows/`. They arrive inactive and use a `LeadHunter:` prefix so they stay separate from other company workflows.

| File | What it does | Needs the app running |
|---|---|---|
| `telegram-connection-test.json` | Sends one test message to the team chat | No |
| `ingest-test-lead.json` | Signs and sends one made-up lead to the ingest API | Yes |
| `generate-outreach-drafts.json` | Asks the app to create drafts for up to 5 qualified leads. Nothing is sent. It only spends money in live mode | Yes |
| `score-queued-leads.json` | Asks the app to score up to 5 queued leads. It only spends money if the app is in live mode | Yes |

Credentials are created by hand in n8n and never exported:

| Credential | Type | Value |
|---|---|---|
| `LeadHunter Telegram bot` | Telegram API | The bot token |
| `LeadHunter n8n to app` | Crypto, in the Hmac Secret field | The same value as `N8N_TO_APP_SECRET` |

Recommended workflow order:
1. Lead ingestion
2. AI qualification
3. Outreach draft generation
4. Team notification and follow-up reminders

Use a dedicated service account / API credential, signed webhooks, retries, idempotency and execution logging. Do not allow an LLM node to execute arbitrary tools based on text found in a lead.
