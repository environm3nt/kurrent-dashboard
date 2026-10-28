# Kurrent dashboard

The client portal for Kurrent, a recruitment-intelligence product for staffing agencies. The nightly pipeline in [kurrent-engine](https://github.com/environm3nt/kurrent-engine) writes ranked, contact-verified leads into Supabase; this app is where recruiters read them, work them through a pipeline, plan which roles to run each day, and manage their team. Multi-tenant: one Supabase project, many agencies, row-level security between them.

Next.js 14 (App Router), TypeScript, Supabase (Postgres + auth, SSR client), Tailwind, Lucide icons, Sentry. Deployed on Vercel.

## What's in it

**Pages** (`src/app/dashboard/…`)

| Route | What it does | Main component |
|---|---|---|
| `/dashboard` | Today's briefing — greeting, stats, new leads as cards, role suggestions | `BriefingGreeting`, `StatsCards`, `LeadBriefingCards`, `RoleRecommendations` |
| `/dashboard/leads` | Every lead — list and pipeline views, filters, status changes, notes, on-demand candidate search and PDF | `UnifiedLeads` |
| `/dashboard/pipeline` | Redirects to `/dashboard/leads` (kept for old links) | — |
| `/dashboard/roles` | A recruiter's own role pool, with suggestions | `MyRolesConfig`, `RoleRecommendations` |
| `/dashboard/schedule` | Plan the week — which roles run on which days | `WeekPlanner` |
| `/dashboard/automation` | Digest and pipeline settings per recruiter | `AutomationConfig` |
| `/dashboard/reports` | Generated PDF reports and industry briefs | `ReportLibrary` |
| `/dashboard/team` | Who's on the account and what they're working | `TeamOverview` |
| `/dashboard/settings` | Agency profile, branding, plan, team invitations | `SettingsForm`, `TeamManagement` |
| `/dashboard/pricing` | Tier comparison (amounts come from env; see below) | — |
| `/dashboard/admin`, `/dashboard/analytics` | Cross-client operator views, gated to platform admins | `AdminDashboard` |
| `/login` | Magic-link and password sign-in via Supabase Auth | — |

**API routes** (`src/app/api/…`) — all check the Supabase session; the admin route checks the platform-admin list too.

- `leads/[id]/status`, `leads/[id]/archive`, `leads/[id]/notes` — work a lead
- `leads/[id]/candidates` — on-demand candidate search (People Data Labs) scored by an LLM against the lead's job description; this is where candidate matching lives now, rather than in the nightly batch
- `leads/[id]/pdf` — generate the lead's market-snapshot PDF via PDFMonkey, polling until ready
- `industry-briefs` — LLM-written industry brief as a PDF
- `roles/suggestions`, `locations/autocomplete` — typeahead for the role and schedule pages
- `invitations` — invite a teammate; sends the email through Resend
- `admin/users` — list and change user↔client roles

**Auth and tenancy.** `src/middleware.ts` refreshes the Supabase session on every request and redirects signed-out users to `/login`. `src/app/dashboard/layout.tsx` loads the current user's client; a first-time user whose email matches a client's `contact_email` or `allowed_admin_emails` is auto-provisioned as that client's admin. Everything else is enforced by RLS policies in `supabase/`.

**Supabase** (`supabase/`)

- `schema.sql` — `clients`, `user_clients`, `leads`, `pipeline_runs`, `api_usage`, RLS policies, triggers
- `migration-00x-*.sql`, `migration-add-policies.sql`, `migrations/` — incremental changes in the order they were applied
- `seed-demo-account.sql` — a complete fictional agency ("Northbridge Talent Group") with 15 leads, so the portal has something to show

## Running it

```
npm install
cp .env.example .env.local        # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY at minimum
npm run dev
```

Then in your Supabase project's SQL editor, run `supabase/schema.sql`, the migrations in numeric order, and `supabase/seed-demo-account.sql` with `you@example.com` replaced by the address you'll sign in with. Sign in at `/login` and you'll land on the demo agency.

`npm run build` and `npm run lint` run clean with no keys set. There are no automated tests in this repo; the pipeline's behaviour is tested in `kurrent-engine`.

## Environment variables

| Variable | Used for | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth and all reads | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | auto-provisioning, admin pages, invitations (server only) | yes |
| `PLATFORM_ADMIN_EMAILS`, `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS` | who sees `/dashboard/admin` and `/dashboard/analytics` | for admin pages |
| `PDL_API_KEY`, `CLAUDE_API_KEY` | on-demand candidate search and scoring | for that feature |
| `PDFMONKEY_API_KEY`, `PDFMONKEY_TEMPLATE_ID`, `INDUSTRY_BRIEF_TEMPLATE_ID` | lead PDFs, industry briefs (template IDs from your PDFMonkey account) | for those features |
| `APOLLO_API_KEY` | company lookups inside industry briefs | optional |
| `RESEND_API_KEY` | invitation emails | for invitations |
| `NEXT_PUBLIC_TIER_PRICES` | `"starter:499,growth:799,scale:1299"` renders amounts on the pricing page; unset shows "Custom" | no |
| `NEXT_PUBLIC_APP_URL` | links in invitation emails | no |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | error tracking, source-map upload | no |

## Decisions worth knowing

- **Candidate search is on demand, not batch.** It started in the nightly pipeline and moved here (`api/leads/[id]/candidates`) so credits are spent only on roles a recruiter actually opens.
- **PDFs are generated on first download**, not at write time, for the same reason.
- **Platform-admin gating is email-based and env-driven** (`src/lib/platform-admin.ts`), separate from per-client roles in `user_clients`.
- **Rate limiting is in-memory** (`src/lib/rate-limit.ts`) — fine for one Vercel region, documented as the thing to replace if that changes.

## Not included

The nightly pipeline (separate repo), the operational SQL used against the live project, and anything client-specific. All agencies, people, companies and contact details in `supabase/seed-demo-account.sql` are invented.
