# Workflow 01 — Lead ingestion

**Trigger:** Schedule, approved source webhook or manual lead submission.

1. Load enabled source configuration.
2. Call an authorised connector.
3. Validate source response and enforce source-specific rate limits.
4. Map to canonical fields: `source_type`, `source_record_id`, `source_url`, `author_handle`, `original_content`, `published_at`.
5. Reject empty / malformed / out-of-scope records.
6. Normalise whitespace and calculate a stable content hash.
7. Upsert / deduplicate using workspace + source + source record ID; use canonical URL or content hash as fallback where appropriate.
8. Create `automation_runs` record and update counts.
9. Send newly created lead IDs to qualification workflow.
10. Notify internal Telegram channel of run summary.

**Failure handling:** retry transient errors with backoff; stop on permission / authentication errors and alert an administrator. Do not silently rotate accounts or bypass rate limits.
