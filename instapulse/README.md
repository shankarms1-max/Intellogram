# Channel Radar

A production-ready Instagram Analytics SaaS built with Next.js 16, Prisma 7, and the official Meta Instagram Graph API.

> **Important:** Channel Radar uses **only** official Instagram Graph APIs. No scraping, no Puppeteer, no unofficial endpoints.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router, TypeScript) | Server components + API routes in one repo |
| Auth | NextAuth.js v4 (credentials + JWT) | Full control over session/token lifecycle without vendor lock-in |
| Database | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` | Works on Supabase, Neon, Railway, RDS |
| ORM | Prisma 7 | Type-safe queries, schema migrations, `db push` for dev |
| Styling | Tailwind CSS v4 | Utility-first, zero runtime |
| Charts | Recharts | Well-maintained, composable React charts |
| Encryption | crypto-js (AES-256) | Tokens/secrets encrypted at rest before DB write |
| CSV | PapaParse | Fast, battle-tested CSV parse/unparse |
| Validation | Zod v4 | Runtime validation matching TypeScript types |
| Icons | Lucide React | Tree-shakeable icon library |

> **Why NextAuth and not Supabase Auth?** NextAuth gives us full control over the session strategy and lets us use any PostgreSQL host without coupling the auth layer to Supabase. The credential provider handles email/password without any third-party dependency on the auth path.

---

## Features Built

### Phase 1 — Core App
- Email/password auth (sign up, sign in, session-guarded routes)
- Per-user default workspace auto-created on first login
- 11-model Prisma schema with proper indexes and cascade deletes
- Demo mode — seeds 8 accounts + 30 days of data on first login; no real API calls
- Dashboard home, Accounts manager, Media explorer, Analytics charts
- Reports (daily snapshot, weekly competitor, monthly performance) with CSV download
- CSV bulk import/export with formula-injection sanitization
- Settings page (workspace name, industry, description)

### Phase 2 — Instagram Integration
- Full Meta OAuth flow (start → callback → token exchange → account discovery)
- Account sync: profile + recent media + insights for own accounts
- Per-account and workspace-wide sync with SyncJob records
- Rate-limit header capture (`X-App-Usage`, `X-Business-Use-Case-Usage`) stored per API log
- Rate-limit threshold logic: warn ≥60%, pause-non-critical ≥80%, stop-sync ≥90%
- API Logs page with filter/pagination

### Phase 3 — BYOK Credentials
- **Managed**: platform Meta App from env vars (default)
- **BYO Meta App**: workspace admin enters own App ID + Secret (AES-256 encrypted)
- **BYO Access Token**: paste long-lived token, validate before saving
- Six credential status states: `active | expired | invalid | missing_permissions | rate_limited | unconfigured`

### Phase 4 — Competitor Intelligence
- Metric availability matrix (own vs competitor) — explicit "Not available via API"
- No private competitor metrics, no fake data

---

## Instagram API Limitations

| Metric | Own Account | Competitor Account |
|---|---|---|
| Followers | Full | Public only |
| Media list | Full | Public only |
| Like count | Full | If public |
| Comment count | Full | If public |
| Reach | Full | **Not available** |
| Impressions | Full | **Not available** |
| Saves | Full | **Not available** |
| Shares | Full | **Not available** |
| Story insights | Full | **Not available** |
| Audience demographics | Full | **Not available** |

Unavailable metrics are stored as `null` and displayed as "Not available via Instagram API" — no fake data.

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (local or cloud)

### 1. Install

```bash
cd instapulse
npm install
```

### 2. Environment variables

```env
# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/instapulse"

# ─── NextAuth ────────────────────────────────────────────────────────────────
# Generate: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# ─── Encryption (required — NEVER leave default in production) ───────────────
# Generate: openssl rand -hex 16
TOKEN_ENCRYPTION_KEY="your-32-char-hex-key"

# ─── Meta App (optional — use DEMO_MODE=true without it) ─────────────────────
META_APP_ID="your-meta-app-id"
META_APP_SECRET="your-meta-app-secret"
META_REDIRECT_URI="http://localhost:3000/api/auth/meta/callback"
INSTAGRAM_GRAPH_API_VERSION="v21.0"

# ─── Demo mode ───────────────────────────────────────────────────────────────
DEMO_MODE="true"
NEXT_PUBLIC_DEMO_MODE="true"
NEXT_PUBLIC_META_APP_ID="your-meta-app-id"   # safe — public identifier only

# ─── Cron (for scheduled sync) ───────────────────────────────────────────────
# Generate: openssl rand -hex 32
CRON_SECRET="your-cron-secret"

# ─── Support (shown on legal pages) ──────────────────────────────────────────
SUPPORT_EMAIL="privacy@yourdomain.com"
```

### 3. Database setup

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database (dev, no migration files)
```

### 4. Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → sign up → demo data seeds automatically.

---

## Configuring a Real Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/apps/) → **Create App** → Business type
2. Add **Instagram Graph API** product
3. Add **Facebook Login** product → set Valid OAuth Redirect URI:
   ```
   http://localhost:3000/api/auth/meta/callback
   ```
4. Request these permissions:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_read_engagement`
   - `pages_show_list`
5. Copy **App ID** and **App Secret** to `.env` as `META_APP_ID` and `META_APP_SECRET`
6. Set `DEMO_MODE="false"`

**Alternative:** Enter credentials per-workspace via the Connect page → **Your Meta App** tab — no `.env` change needed.

---

## Database Commands

```bash
npm run db:generate    # Regenerate Prisma client after schema changes
npm run db:push        # Push schema to DB (dev — no migration files)
npm run db:migrate     # Create and apply a named migration (production)
npm run db:seed        # Run seed script manually
npm run db:studio      # Open Prisma Studio
```

---

## Vercel + Supabase/Neon Deployment

### 1. Create a PostgreSQL database

- [Supabase](https://supabase.com) — free tier, connection pooling available
- [Neon](https://neon.tech) — serverless Postgres, free tier

Copy the connection string (use the **pooled** connection string on Supabase/Neon for serverless).

### 2. Deploy to Vercel

```bash
npx vercel
# or connect GitHub repo for automatic deployments
```

### 3. Set environment variables in Vercel

In Vercel → Project → Settings → Environment Variables, add all variables from the `.env` section above, plus:

```env
NEXTAUTH_URL="https://your-app.vercel.app"
META_REDIRECT_URI="https://your-app.vercel.app/api/auth/meta/callback"
NODE_ENV="production"
# Optional: META_ENABLE_BUSINESS_MANAGER_FALLBACK=true
```

> `TOKEN_ENCRYPTION_KEY` **must** be set in production. The app will throw at startup if it is missing or shorter than 16 characters.

### 4. Run database migrations

```bash
DATABASE_URL="<production-url>" npx prisma db push
```

For zero-downtime production migrations use `prisma migrate deploy` instead of `db push`.

### 5. Update Meta App OAuth redirect

Add your production URL to Meta App → Facebook Login → Valid OAuth Redirect URIs:
```
https://your-app.vercel.app/api/auth/meta/callback
```

---

## Cron / Scheduled Sync

Add a `vercel.json` in the project root to enable daily sync:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-instagram",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when invoking cron routes. Set `CRON_SECRET` in your Vercel environment variables.

The cron route:
- Skips entirely if `DEMO_MODE=true`
- Skips workspaces where rate-limit status is `rate_limited` (≥90% Meta API quota)
- Creates `SyncJob` records per account
- Returns a JSON summary of workspaces processed

---

## Meta App Review Checklist

Before submitting for Meta App Review to unlock `instagram_manage_insights` and enable public competitor sync:

- [ ] Privacy Policy URL set in App settings → pointing to `/privacy`
- [ ] Terms of Service URL set in App settings → pointing to `/terms`
- [ ] Data Deletion callback URL set → pointing to `/data-deletion`
- [ ] App Icon and App Description filled in
- [ ] Valid OAuth Redirect URI matches production URL exactly
- [ ] Complete Meta Business Verification if prompted
- [ ] Demo video showing:
  - User login and Instagram OAuth connection
  - Own account analytics (profile, media, insights)
  - Business Discovery competitor comparison
  - Data deletion page
- [ ] Permissions to request:
  - [ ] `instagram_basic` — used for profile data
  - [ ] `instagram_manage_insights` — used for reach/impressions/saves on own media
  - [ ] `pages_read_engagement` — used to link Facebook Pages to Instagram accounts
  - [ ] `pages_show_list` — used to discover linked pages via `/me/accounts`
  - [ ] `business_management` — used to discover pages via Business Manager (New Pages Experience)
- [ ] App is in Live mode after approval
- [ ] Test with a real public Instagram Business/Creator competitor account

> Meta controls App Review timelines and approval decisions. Approval cannot be guaranteed by the app.

---

## Security Notes

| Concern | Implementation |
|---|---|
| Access tokens at rest | AES-256 encrypted (`crypto-js`) — never plain text |
| Meta App Secret at rest | AES-256 encrypted |
| Token exposure to browser | Never — all Meta API calls are server-side |
| Session validation | Every API route calls `getServerSession(authOptions)` |
| Workspace isolation | All DB queries filter by `workspaceId` verified against session |
| CSV formula injection | Cells starting with `=`, `+`, `-`, `@` are prefixed to prevent spreadsheet execution |
| Encryption key enforcement | Throws at startup in production if `TOKEN_ENCRYPTION_KEY` is missing |
| Cron auth | `CRON_SECRET` bearer token required; missing secret returns 401 |
| Demo mode | Sync endpoints return 403 in demo mode; no real API calls made |

---

## Business Discovery in Development vs Live Mode

Own Instagram account sync works once OAuth and IG Business Account discovery are configured correctly. Business Discovery for **public competitors** is more restricted.

### Why public competitor sync may fail in Development mode

In Development mode, Meta restricts the Business Discovery API to Instagram accounts connected to app roles/testers. Public competitor accounts such as large brands or creators will fail with a spurious `(#100) The parameter username is required.` error even when the username IS provided. **This is a Meta platform restriction, not a code bug.**

### App mode capability matrix

| Capability | Development mode | Live mode + approved permissions |
|---|---|---|
| Own account profile & media | Works for connected tester/admin accounts | Works for all connected accounts |
| Own account insights (reach, saves) | Works for connected tester/admin accounts | Works for all connected accounts |
| Competitor public profile & media | App tester/role accounts only | Works where Business Discovery supports the target |
| Competitor reach / saves / shares | Not available (private metrics) | Not available (private metrics) |

### How to test competitor sync in Development mode

1. Create or use another Instagram Business/Creator account.
2. Link that account to a Facebook Page.
3. Add the Facebook user who owns that account as an app tester/developer/admin in Meta App Dashboard → Roles.
4. Have the user accept the invitation at [developers.facebook.com](https://developers.facebook.com).
5. Use that Instagram username as the competitor handle.
6. Run competitor sync.

> Public accounts like @natgeo will not work in Development mode unless they are connected to an app role/tester account.

### Recommended current rollout

- Keep Instagram own-account analytics enabled — it works independently of app mode.
- Keep competitor sync in the app — it is core to the product.
- Show "Requires Meta Live access" when public competitor sync is blocked by Dev mode.
- Test competitor sync with a tester account to confirm the integration works end-to-end.
- Prepare Meta App Review for production competitor tracking.

---

## Known Limitations

1. **Competitor private metrics** — Instagram API only returns public data for non-connected accounts
2. **Competitor sync in Development mode** — Public competitors are blocked; only app tester/role accounts work until app is switched to Live mode after App Review
3. **Token expiry** — Long-lived tokens expire in ~60 days; BYO Token mode requires manual refresh
4. **Rate limits** — Meta Graph API enforces per-app quotas; sync pauses automatically at ≥90%
5. **Historical data** — Only recent media is fetched after connection; historical posts not backfilled
6. **Stories** — Story insights require special time-windowed API access; not currently implemented
7. **Personal accounts** — Only Business/Creator accounts can connect to the Graph API
8. **App Review** — `instagram_manage_insights` requires Meta App Review before use in production

---

## Troubleshooting: `/me/accounts` returns empty even with permissions granted

### What this means

After OAuth completes, the app calls `GET /me/accounts` to find Facebook Pages and their linked Instagram Business Accounts. If this returns an empty `data` array even though `pages_show_list` and `pages_read_engagement` were granted, the token has the correct scopes but Meta is not surfacing any API-visible Pages for that Facebook user.

This is not a bug in the app. It is a Meta API access/configuration issue.

### Why it happens

App role access (admin/developer/tester on a Meta Developer App) is separate from Page access. The Facebook user who performed OAuth must have **full-control or required task access** to the Facebook Page that is linked to the Instagram Business account. Simply being an admin of the Meta Developer App does not grant Page API access.

Business access is also separate. Pages managed through Meta Business Portfolio are not returned by `/me/accounts`. They require the `business_management` permission to be discovered via `/me/businesses → /{business-id}/pages`.

### Diagnostic states

| State | Meaning |
|---|---|
| `page_permissions_granted_but_no_pages_returned` | Scopes granted, `/me/accounts` returned 0 Pages. Facebook user lacks full-control task access to the Page, or the Page–Instagram link is broken. |
| `business_manager_permission_required` | `/me/businesses` returned a permission error. Pages are likely managed through Meta Business Portfolio. Enable `META_ENABLE_BUSINESS_MANAGER_FALLBACK=true` and reconnect. |

The Connect Instagram page surfaces these states automatically when a token exists but no Pages are returned.

### How to fix

**Step 1 — Verify Page task access**

The Facebook user who is connecting must have **Full Control** (or at minimum the required tasks) on the Facebook Page:
1. In Facebook: go to the Page → Settings → Page Access → People with Facebook Access
2. Confirm the connecting user has Full Control, not just Partial Access

**Step 2 — Re-authorize cleanly**

Old OAuth grants can cache incomplete page selections:
1. Go to Facebook → Settings → Apps and Websites → remove the existing Channel Radar authorization
2. Return to the Connect Instagram page and go through OAuth again
3. During the OAuth dialog — when Facebook asks which Pages to grant access to — explicitly select the correct Page

**Step 3 — Business Portfolio fallback (if applicable)**

If the Page is managed through Meta Business Portfolio and `/me/businesses` is returning a permission error:
1. Set `META_ENABLE_BUSINESS_MANAGER_FALLBACK=true` in Vercel environment variables
2. Redeploy
3. Go through OAuth again — the `business_management` scope will be requested
4. This allows the app to discover Pages via `/me/businesses → pages` instead of `/me/accounts`

> Note: `business_management` is an advanced scope. Meta may require App Review before it can be granted to users outside the development team. For own-team use (app admin/developer), it is available in Development mode.

---

## Legal Pages

| Page | Purpose |
|---|---|
| `/privacy` | Privacy Policy (required by Meta) |
| `/terms` | Terms of Service |
| `/data-deletion` | Data Deletion Request (required by Meta for Facebook Login) |

Set `SUPPORT_EMAIL` env var to customize the contact address shown on these pages.

---

## Meta API Access Strategy

### Instagram is not YouTube

YouTube Data API lets you create a Google Cloud project, enable the API, generate an API key, and immediately fetch public channel and video data. **Instagram does not work this way.**

Meta's Instagram Graph API requires:
- A Meta Developer App (App ID + App Secret)
- Facebook Login / Instagram Graph API product added to the app
- OAuth flow — user must grant permissions via their Facebook/Instagram account
- The Instagram account must be a **Business or Creator** account
- The account must be **linked to a Facebook Page**
- Required permissions: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`
- `instagram_manage_insights` requires **Meta App Review** before granting to users outside the development team

There is no simple server-side API key that fetches public Instagram data.

### Recommended credential mode by user type

| User type | Recommended mode | Why |
|---|---|---|
| Starter / Pro users | **Managed OAuth (Connect Instagram)** | No Meta Developer account needed. InstaPulse handles the Meta App. |
| Agencies | Managed OAuth + optional **BYO Meta App** | BYO Meta App isolates API quota and separates the OAuth relationship per client. |
| Enterprise | **Dedicated BYO Meta App** with assisted setup | Full control, quota isolation, client-owned Meta Business assets. |
| Developers / testing | **Developer Token Mode** (BYO Access Token) | Useful for CI environments or direct token testing. Not recommended for production. |

### Meta API quota

Meta does not provide unlimited API quota and does not use a simple YouTube-style quota unit system. Rate limits are applied dynamically based on:
- Per-app usage (tracked via `X-App-Usage` response header)
- Per-business-use-case usage (`X-Business-Use-Case-Usage` header)

InstaPulse logs these headers in the API Logs page after every call. Threshold behavior:
- ≥60% usage → warning logged
- ≥80% usage → non-critical sync paused for the workspace
- ≥90% usage → workspace marked `rate_limited`, sync skipped until usage drops

Agencies with BYO Meta App get dedicated quota — their API usage does not count against the shared platform app.

### What BYO Meta App does and does NOT unlock

**Does help with:**
- Quota / rate-limit isolation from the shared platform app
- Ownership of the OAuth relationship and permissions
- Agency and enterprise control over Meta Business assets
- Dedicated setup for clients with their own Meta Business Portfolio

**Does NOT unlock:**
- Competitor reach, impressions, saves, shares, story insights, or audience demographics
- Any private metric for competitor accounts
- Watch time, retention, or reel analytics for competitor accounts
- Increased API quota beyond what Meta allows per-app

Competitor metrics are always limited to what the official Instagram Graph API exposes for non-connected public accounts. This is a Meta API restriction and cannot be worked around.

---

## Agency / Enterprise BYO Meta App Onboarding

This setup is available as **assisted onboarding** for Agency and Enterprise customers. The platform team guides the technical configuration steps; the client must provide or approve access to their Meta Business assets.

### What assisted onboarding covers

- Creating or auditing the client's Meta Developer App
- Adding the Instagram Graph API product
- Configuring the correct OAuth redirect URI
- Requesting the correct permissions (`instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`)
- Validating the first successful OAuth connection and sync
- Guidance on Meta App Review submission (if not yet approved)

### What the client must provide

| Access required | Why |
|---|---|
| Meta Business Portfolio admin access | Required to manage the Meta Developer App |
| Facebook Page admin access | Required for Instagram Graph API OAuth |
| Instagram Business or Creator account | Personal accounts cannot connect to the Graph API |
| Instagram account linked to the Facebook Page | Required for API access |
| Ability to approve OAuth permissions | User must grant permissions during the OAuth flow |

### Meta App Review

`instagram_manage_insights` — required for reach, impressions, saves, and other own-account insights — must go through Meta App Review before it can be granted to users outside the development team.

- App Review is submitted through the Meta App Dashboard
- Meta controls approval timelines and outcomes; these cannot be guaranteed
- While in Development mode, only accounts added as test users can connect
- After approval and Live mode, any Instagram Business/Creator account can connect

For the full checklist, see [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).
