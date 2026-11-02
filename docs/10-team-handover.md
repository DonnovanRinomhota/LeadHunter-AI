# 10. Team handover

**Last updated:** 3 November 2026, by Donnovan

The code for adding, scoring, drafting and reviewing leads is merged into `main`, but it isn't ready for real use: the live site has no confirmed database, Claude has never been called, and nothing has reached a real prospect. Start with the hosted test setup below, then the work assigned to you.

## Where things stand

The product plan and backlog are in `docs/09-team-ownership-and-delivery-plan.md`, though its backlog tables don't show this progress yet.

| Area | Status | What has actually been shown |
|---|---|---|
| App, CI, Next.js setup (D1) | Built | CI runs app and database checks on each PR |
| Database and access rules (J1 to J4, J7) | Built, **Jerome's review outstanding** | 152 tests are written. Donnovan saw 141 pass on real local Supabase before the last additions |
| Signed lead intake (J6) | Built | Worked from company n8n through a tunnel to a local app |
| Sign-in and lead screens (D2 to D5) | Built | Passed browser tests with a stand-in for Supabase's login. Donnovan's local browser run isn't confirmed |
| Scoring (M2, M3) | Built, sample mode only | Claude has never been called |
| Drafts and review (M6, D6) | Built, sample mode only | Passed browser tests with the same stand-in. Claude has never written a draft |
| Telegram | Connection works | The test message reached the LeadHunter group |
| Vercel site | Deployed | [The sign-in page](https://lead-hunter-ai-rouge.vercel.app/login) loads. Its database settings aren't confirmed, so sign-in may not work yet |
| Pipeline view, settings (D7, D8) | Not started | |
| Scheduled n8n workflows, real alerts, first source (M5, M7, M9) | Not started | Only manual test workflows exist |
| Source permission review (M8) | Not started | |
| Legal advice (S3) | Not started | Needs the registered entity first |

A real lead must not be added, and no real prospect contacted, until the legal advice is in.

## Who picks up what next

Owners follow `docs/09`. Do them in this order within each list.

### Jerome

- [ ] Review all 8 files in `supabase/migrations/` and the tests in `supabase/tests/database/`. They merged while you were offline, so nothing should go near real data until this is done.
- [ ] Choose the Supabase region and set up the hosted test project, using the steps below. Donnovan reviews and runs SQL first, per decision 10, so agree this with him.
- [ ] Turn off public sign-up on the hosted project. The setting in `config.toml` only covers local databases.

### Mako

- [ ] Review the prompts in `src/server/qualification/prompt.ts` and `src/server/drafts/prompt.ts`.
- [ ] Check and correct the 33 made-up test leads in `evals/sample-leads.json`. Their labels are a first draft, not team-agreed.
- [ ] Start the source permission review (M8). Find permitted sources that reach professional firms of 20 to 200 staff in Zimbabwe and South Africa. Government tender data doesn't fit this segment.
- [ ] Point the n8n workflows at the Vercel address once it works, then build the schedule and retries (M5) and real Telegram alerts (M7).

### Donnovan

- [ ] Decide the open questions below.
- [ ] Confirm the registered legal entity and country, then start legal advice covering Zimbabwe, South Africa and the team's own locations.
- [ ] Confirm each service against the website, then mark it `confirmed`. Scores for `developing` services stay low.
- [ ] Rotate the Telegram bot token in BotFather, then update the n8n credential.
- [ ] Build or request the pipeline view and settings screens (D7, D8).

### Open questions

| Question | Owner | Recommendation |
|---|---|---|
| Remove sign-in so the site is open? | Donnovan | **No.** The site would expose leads and contact details to anyone with the link, and anyone could approve drafts or erase leads. Use fixed team accounts instead |
| Which Vercel plan? | Donnovan | Hobby is limited to non-commercial personal use, and this is a company tool. Review this before relying on it. Pro starts at $20 a month |
| When to buy Anthropic credit? | Donnovan | After the hosted setup and Mako's review of the test leads |
| Should the repository stay public? | All | Public for now, per decision 1. Keep pricing and real leads out of it, and review this soon |
| How should requests outside the three priority services score? | Mako | Keep them, ranked lower |

## Setting up the hosted test environment

Team members can test on Vercel instead of locally once this is done, using fake data only. It also gives each person a password that stays the same, because accounts are no longer wiped by a local reset.

1. **Create a Supabase project** on the Free plan, in a new organisation under a business login. Free projects pause after about a week of inactivity and have no automatic backups.
2. **Apply the migrations** from your repo, after Jerome's review:

   ```bash
   npx --yes supabase@2.122.1 link --project-ref YOUR_PROJECT_REF
   npx --yes supabase@2.122.1 db push
   ```

   Don't load `supabase/seed.sql` here, because it's only for local use.
3. **Turn off public sign-up** under Authentication settings, then add each team member under Authentication, Users, with their own password.
4. **Create the workspace** in the SQL editor, changing the three emails to your own:

   ```sql
   with new_workspace as (
     insert into public.workspaces (name, slug)
     values ('Spiritus Agentic Solutions', 'spiritus')
     returning id
   ), profile as (
     insert into public.business_profiles
       (workspace_id, company_name, website_url, target_geographies, target_industries, ideal_customer_profile)
     select id, 'Spiritus Agentic Solutions', 'https://spiritustec.com/', '{ZW,ZA}',
       '{consultancies,accounting firms,business services}',
       '{"segment": "Mid-sized professional services firms", "staff_min": 20, "staff_max": 200}'
     from new_workspace
   ), catalogue as (
     insert into public.services (workspace_id, service_name, description, is_priority)
     select new_workspace.id, s.name, s.description, true
     from new_workspace, (values
       ('Agentic Workflows', 'Reduce repetitive administrative work.'),
       ('Automation & Integration', 'Streamline processes and connect existing systems.'),
       ('AI Knowledge Operations', 'Improve access to business information.')
     ) as s(name, description)
   )
   insert into public.workspace_members (workspace_id, user_id, role)
   select new_workspace.id, u.id, 'owner'
   from new_workspace
   join auth.users u on u.email in ('donnovan@example.com', 'jerome@example.com', 'mako@example.com')
   returning workspace_id;
   ```

   Keep the `workspace_id` it returns. Run it once, after the accounts from step 3 exist. If it returns fewer rows than people, an email didn't match, so add that member separately instead of running it again. It's been tested on plain Postgres but not on a hosted project, so review it first.
5. **Add these settings in Vercel**, then redeploy:

   | Setting | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | The hosted project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key |
   | `SUPABASE_SECRET_KEY` | The secret key. Never give it a `NEXT_PUBLIC_` name |
   | `LEADHUNTER_WORKSPACE_ID` | The ID from step 4 |
   | `N8N_TO_APP_SECRET` | A new 64-character secret, also saved in the n8n Crypto credential |

6. **Update n8n:** set `appUrl` in each workflow's Settings node to `https://lead-hunter-ai-rouge.vercel.app`. The tunnel is no longer needed.

### What testing on Vercel changes

- **Code tests:** CI still runs on every PR. Wait for `check` and `database` before merging.
- **Database changes:** Vercel deploys code only. Each new migration must be pushed with `supabase db push`, or the new code may fail against the old database.
- **Previews:** preview and production deployments use the same database unless you configure separate settings.
- **Scoring and drafts:** sample mode is deliberately refused outside a local database, so these return `Scoring is turned off` on Vercel until live mode is set. Test them locally for free, or with Anthropic credit on Vercel.

## How we work

### Decisions already made

- **Market:** professional services firms of 20 to 200 staff in Zimbabwe and South Africa, with Zambia and Botswana later.
- **Services:** Agentic Workflows, Automation & Integration, and AI Knowledge Operations.
- **Outreach name:** Spiritus Agentic Solutions. The registered entity is still to be confirmed.
- **Approval:** any workspace member can approve a draft, and the app records who did.
- **Good fit, no buying signal:** the lead gets the Research status and no draft.
- **Qualified:** a score of 60 or more with no disqualifier.
- **Sending:** the app can't send messages. A person copies the approved text and sends it.
- **Spending:** no paid services for now. Scoring is off by default, with a daily limit of 50 when on.

### Run it locally

This needs Docker Desktop and Node 22 or later. Put the local settings in `.env.local`, using the names in `.env.example`, then:

```bash
npm ci
npm run db:start
npm run db:test
npm run dev:user -- you@example.com
npm run dev
```

Add `QUALIFICATION_MODE=sample` to `.env.local` for free scoring. With the app running, `npm run dev:score` and `npm run dev:drafts` run each step.

### Traps we already hit

- **Check your folder:** the repo must be your project folder. Run `git rev-parse --show-toplevel` if unsure. A home folder that is itself a Git repo risks publishing private files.
- **Branch from an up-to-date `main`:** run `git pull origin main` first. Two failed installs came from branching before the previous PR had merged.
- **`npm ci` fails with `EPERM`:** stop `npm run dev` and close VS Code first.
- **`db:reset` wipes local accounts:** that's why local passwords seemed to change. Run `dev:user` again afterwards.
- **Supabase CLI version:** stay on 2.122.1 and ignore the update notice. Startup failed for Donnovan on 3.0.0 and worked after moving to 2.122.1, though the exact cause wasn't confirmed.
- **Secrets:** don't paste real keys or tokens into chat, screenshots or this public repo. The local `sb_secret_` default only works locally.
- **Changing the database:** add a new file in `supabase/migrations/`, and never edit a merged one or change the database by hand.

### Key files

| What | Where |
|---|---|
| Plan, decisions and backlog | `docs/09-team-ownership-and-delivery-plan.md` |
| Database rules and how to run them | `supabase/README.md` |
| Shared formats | `src/contracts/` |
| n8n workflows and credentials | `n8n/README.md` |
| Scoring rules | `docs/05-ai-qualification.md` |
