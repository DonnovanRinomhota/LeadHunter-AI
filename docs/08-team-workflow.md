# 8. Team workflow and ownership

## Suggested workstreams

| Workstream | Responsibilities |
|---|---|
| Product / technical lead | Architecture, priorities, code review, delivery coordination |
| Frontend / application | Dashboard, authentication flows, forms and API integration |
| Automation / AI | n8n workflows, prompts, structured outputs, notifications |
| Data / backend | Supabase schema, RLS, migrations, API contracts and observability |
| Business development | ICP, service catalogue, lead qualification rules, outreach review |
| QA / research | Source permissions, test cases, false-positive review and user feedback |

One person can own multiple workstreams. Assign a single accountable owner to each deliverable.

## Suggested team cadence

- One short weekly planning session.
- A shared task board with owner, due date and acceptance criteria.
- Pull requests for code changes; at least one reviewer.
- Weekly demo using realistic test data.
- Weekly review of lead quality and commercial outcomes.

## Definition of done

A feature is done when:
- It meets its acceptance criteria.
- It has basic validation and error handling.
- It does not expose secrets or bypass RLS.
- It includes tests for critical paths.
- Relevant documentation is updated.
- It has been demonstrated to another team member.

## Decisions to make together

1. Initial target segment and geography.
2. Top three services to prioritise.
3. First permitted discovery source.
4. Team roles and weekly time commitment.
5. Who reviews and approves prospect contact.
6. Project ownership, IP and any future commercial arrangement.
