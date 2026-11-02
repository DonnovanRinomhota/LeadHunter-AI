# Workflow 02 — AI qualification

1. Receive lead ID and workspace ID from a trusted internal trigger.
2. Fetch lead and relevant active services from Supabase.
3. Send only necessary text and service descriptions to the configured model.
4. Use `prompts/lead-qualification.md`.
5. Parse and validate strict JSON output.
6. Clamp / reject invalid scores and enum values; do not persist malformed output.
7. Insert a versioned `lead_analyses` row.
8. Update lead score, buying intent, service categories and status.
9. If recommended action is `review`, trigger outreach draft workflow.
10. Log provider, model, prompt version, result and errors without secrets.

Do not send any message to a prospect from this workflow.
