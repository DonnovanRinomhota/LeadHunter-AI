# n8n workflows

n8n is the orchestration layer. Keep workflow exports free of credentials and secrets.

Recommended workflow order:
1. Lead ingestion
2. AI qualification
3. Outreach draft generation
4. Team notification and follow-up reminders

Use a dedicated service account / API credential, signed webhooks, retries, idempotency and execution logging. Do not allow an LLM node to execute arbitrary tools based on text found in a lead.
