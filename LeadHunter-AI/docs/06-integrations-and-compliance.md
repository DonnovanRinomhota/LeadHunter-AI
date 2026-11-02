# 6. Integrations, sources and compliance

## Source strategy

Facebook, Telegram, Reddit and LinkedIn were identified as possible discovery channels. Their mention does not grant permission to scrape or automate collection. Access varies by platform, API product, permissions, commercial use and current terms.

Before building a connector:
1. Read current platform terms and developer policies.
2. Confirm the specific API and permission allow the intended discovery and commercial use.
3. Confirm storage, model-processing and retention conditions.
4. Record approval / licence details in the source configuration.
5. Add rate limits, provenance, deletion and opt-out handling.

Do not make unrestricted scraping of social networks a dependency of the MVP. Start with:
- Manual lead submission by the SpiritusTec team.
- Official APIs where approved.
- Licensed search or data providers.
- RSS / public feeds where permitted.
- Public procurement, tender or job feeds whose terms allow the intended use.
- Website enquiries and inbound forms.

## Outreach policy

- Human approval is required before first contact.
- Do not send bulk unsolicited messages or automated cold DMs.
- Use only channels and contact bases where the intended communication is lawful and permitted.
- Identify SpiritusTec clearly; do not mislead recipients.
- Respect objections, opt-outs and suppression lists.
- Record who approved a draft and when.
- Provide a way to stop further contact.

## Poland / EU considerations

The team should assess GDPR, ePrivacy and Polish electronic communications / marketing rules before launch. Public availability of a person's information does not automatically make it lawful to collect, profile, retain or use for marketing. Establish a lawful basis, purpose limitation, data minimisation, retention schedule, transparency and rights-handling process with appropriate legal advice.

## Integration roles

- Supabase: persistence, auth, RLS.
- n8n: orchestration and retries.
- Telegram: internal team notifications only in MVP.
- OpenAI / Anthropic: server-side structured analysis.
- CRM: consider later after internal pipeline needs are clear.
