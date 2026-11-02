# LeadHunter AI

> **Picking this up?** Start with the [team handover](docs/10-team-handover.md).

**AI-powered lead discovery, qualification and acquisition platform for SpiritusTec.**

LeadHunter AI is designed to discover publicly available business opportunities, understand the problem being expressed, match it to SpiritusTec's services, score its commercial relevance, prepare tailored outreach drafts, and track the journey from opportunity to client.

The first release is an **internal SpiritusTec tool**. The architecture is intentionally tenant-aware so it can evolve into a multi-tenant SaaS product after the internal workflow has been validated.

## Product principles

- Find genuine buying signals, not just large volumes of posts.
- Use authorised APIs, licensed feeds, permitted search sources and user-submitted leads.
- Keep a human in control of outreach: drafts require review and approval.
- Preserve source context and explain why a lead was qualified.
- Treat all external content as untrusted input.
- Measure qualified opportunities, meetings, clients and revenue.

## MVP scope

1. Team authentication and a SpiritusTec business profile.
2. Service catalogue and ideal-customer profile.
3. Lead ingestion from one permitted source plus manual lead entry.
4. Normalisation, deduplication and source traceability.
5. AI extraction, service matching, intent classification and scoring.
6. Personalised outreach draft generation.
7. Review / approve / reject workflow.
8. Telegram notifications for internal team review.
9. Basic pipeline and outcome tracking.

**Not in the MVP:** unrestricted social scraping, automated unsolicited DMs, billing, or a public self-serve SaaS launch.

## Initial service categories

- AI automation and n8n workflows
- AI chatbots and agents
- Website development and maintenance
- SQL, databases and data workflows
- API integrations
- AI knowledge operations and custom AI solutions
- Analytics, observability, compliance and security (where capability is confirmed)

## Architecture at a glance

```mermaid
flowchart TD
    A[Permitted sources / manual submissions] --> B[n8n ingestion workflows]
    B --> C[Normalise + deduplicate]
    C --> D[Supabase PostgreSQL]
    D --> E[AI qualification service]
    E --> F[Structured lead analysis + score]
    F --> D
    D --> G[Next.js review dashboard]
    G --> H{Human review}
    H -->|Approve draft| I[Manual outreach / authorised channel]
    H -->|Reject or edit| G
    I --> J[Conversation + pipeline tracking]
    J --> D
    B --> K[Automation logs]
    E --> K
    G --> K
    B --> L[Telegram team notification]
```

## Suggested technology

| Layer | Initial choice | Responsibility |
|---|---|---|
| Web app | Next.js + TypeScript | Team dashboard and API routes |
| UI | Tailwind CSS + component library | Responsive review interface |
| Database | Supabase PostgreSQL | Leads, services, drafts, pipeline |
| Authentication | Supabase Auth | Team identity and access |
| Orchestration | n8n | Ingestion, enrichment, notifications |
| AI | OpenAI or Anthropic API | Extraction, classification, scoring, drafts |
| Notifications | Telegram Bot API | Internal team alerts |
| Hosting | Vercel + VPS for n8n | Web app and workflow runtime |

The application is in early build. See `docs/09-team-ownership-and-delivery-plan.md` for what is being built next.

## Repository structure

```text
LeadHunter-AI/
├── README.md
├── .env.example
├── .gitignore
├── docs/
│   ├── 01-product-overview.md
│   ├── 02-system-architecture.md
│   ├── 03-mvp-roadmap.md
│   ├── 04-data-model.md
│   ├── 05-ai-qualification.md
│   ├── 06-integrations-and-compliance.md
│   ├── 07-api-contracts.md
│   ├── 08-team-workflow.md
│   ├── 09-team-ownership-and-delivery-plan.md
│   └── 10-team-handover.md
├── supabase/
│   ├── README.md
│   ├── config.toml
│   ├── migrations/
│   └── tests/
├── n8n/
│   ├── README.md
│   └── workflow-specifications/
│       ├── 01-lead-ingestion.md
│       ├── 02-ai-qualification.md
│       ├── 03-outreach-draft.md
│       └── 04-notifications-and-follow-up.md
├── prompts/
│   └── lead-qualification.md
├── src/
│   └── app/
└── .github/
    └── workflows/
        └── ci.yml
```

## Local development

Requires Node.js 22 or later.

```bash
npm ci
npm run dev
```

The app runs at <http://localhost:3000>. Run `npm run check` before opening a pull request; CI runs the same lint, type check, test and build steps.

## Getting started

1. Review `docs/01-product-overview.md` and agree on the first target customer segment.
2. Confirm SpiritusTec's service descriptions, capability boundaries and minimum engagement values.
3. Follow `supabase/README.md` to run and test the schema locally.
4. Set up n8n and configure credentials as environment secrets.
5. Implement the first permitted source connector and manual lead submission.
6. Build the review dashboard and human approval workflow.

See `docs/03-mvp-roadmap.md` for the proposed delivery sequence.

## Configuration

Copy `.env.example` to `.env.local` when the application is implemented. Never commit real API keys, database passwords, service-role keys, bot tokens or customer data.

## Important compliance note

Facebook, Telegram, Reddit and LinkedIn are potential discovery channels, **not permission to scrape**. Access must use each platform's currently permitted APIs, approved integrations, licensing or other valid authorisation. Platform terms and applicable privacy / electronic-marketing rules must be checked before enabling a connector. Do not automate unsolicited messages. The system should retain source links, minimise personal data, honour opt-outs and provide deletion/retention controls.

## Project status

**Stage:** Early build. Sign-in, lead intake and the lead list work locally. Scoring and outreach are not built yet.

**Owner / initial deployment:** SpiritusTec internal use.

**Long-term direction:** Validate the internal acquisition process first; consider multi-tenant SaaS only after measurable results.
