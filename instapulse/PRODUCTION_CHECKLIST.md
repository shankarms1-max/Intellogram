# InstaPulse Production Checklist

> Last verified: 2026-05-16 · Build: Next.js 16.2.6 · 37 routes, 0 TypeScript errors

---

## 1. Required Environment Variables

All variables must be set before starting the server. Variables marked **CRITICAL** will throw at runtime if missing.

### Auth & Session
| Variable | Required | Notes |
|---|---|---|
| `NEXTAUTH_SECRET` | **CRITICAL** | Min 32 chars. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | **CRITICAL** | Full canonical URL, e.g. `https://app.example.com` |

### Database
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **CRITICAL** | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/db` |

### Encryption
| Variable | Required | Notes |
|---|---|---|
| `TOKEN_ENCRYPTION_KEY` | **CRITICAL** | Min 16 chars; used for AES-256 encryption of all stored tokens and secrets. Generate: `openssl rand -hex 32` |

### Meta / Instagram OAuth (platform-managed credential mode)
| Variable | Required | Notes |
|---|---|---|
| `META_APP_ID` | Optional | Required if using platform-managed credentials; users can supply their own via BYOK |
| `META_APP_SECRET` | Optional | Same as above. Stored encrypted in DB when supplied via BYOK |
| `META_REDIRECT_URI` | Optional | Must match exactly what is registered in Meta App Dashboard, e.g. `https://app.example.com/api/auth/meta/callback` |

### Cron Job
| Variable | Required | Notes |
|---|---|---|
| `CRON_SECRET` | Required if using cron | Long random string used to authenticate `/api/cron/sync-instagram`. Generate: `openssl rand -hex 32` |

### Demo Mode
| Variable | Required | Notes |
|---|---|---|
| `DEMO_MODE` | Optional | Set to `true` to enable demo mode with seeded fake data. Never set on a production instance with real user data. |

### Sample `.env.local`
```env
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/instapulse
TOKEN_ENCRYPTION_KEY=your-32-hex-chars-here
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:3000/api/auth/meta/callback
CRON_SECRET=your-cron-secret-here
# DEMO_MODE=true
```

---

## 2. Local Setup Checklist

- [ ] Node.js 20+ and npm installed
- [ ] PostgreSQL 15+ running locally (or connection to remote DB)
- [ ] Clone repo and `cd instapulse`
- [ ] `npm install`
- [ ] Copy `.env.local` from sample above and fill in all CRITICAL variables
- [ ] `npx prisma db push` — pushes schema and creates all tables + indexes
- [ ] `npm run dev` — starts dev server at `http://localhost:3000`
- [ ] Open `http://localhost:3000` and confirm redirect to sign-in page
- [ ] Register a new account and confirm redirect to dashboard
- [ ] Verify `npm run lint` produces 0 errors (12 expected warnings are OK)
- [ ] Verify `npm run build` completes with 0 TypeScript errors

---

## 3. Vercel Deployment Checklist

- [ ] Create a new Vercel project and link to the Git repository
- [ ] Set **Root Directory** to `instapulse` in Vercel project settings
- [ ] Set **Framework Preset** to Next.js
- [ ] Add all required environment variables in Vercel → Settings → Environment Variables:
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL` (set to your Vercel production URL)
  - `DATABASE_URL`
  - `TOKEN_ENCRYPTION_KEY`
  - `CRON_SECRET`
  - `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` (if using platform-managed OAuth)
- [ ] Deploy and confirm build succeeds (check build logs for TypeScript errors)
- [ ] Confirm `/auth/signin` loads correctly on the live URL
- [ ] Set up Vercel Cron (in `vercel.json`) or external cron to call `/api/cron/sync-instagram`:
  ```json
  {
    "crons": [{
      "path": "/api/cron/sync-instagram",
      "schedule": "0 * * * *"
    }]
  }
  ```
  Include header: `Authorization: Bearer <CRON_SECRET>`
- [ ] After first deploy, run `npx prisma db push` against the production database (or use the Vercel build command)
- [ ] Confirm database tables exist by visiting `/dashboard` after signing up

---

## 4. Database Migration Checklist

This project uses `prisma db push` (schema-push, no migration files). For production schema changes:

- [ ] **Backup production database** before any schema change
- [ ] Run `npx prisma db push --preview-feature` against a staging database first
- [ ] Verify application works correctly on staging
- [ ] For additive changes (new columns with defaults, new tables): safe to push directly
- [ ] For destructive changes (column renames, type changes, column removal):
  - Write a data migration script first
  - Apply in a maintenance window or with a zero-downtime strategy
  - Test rollback procedure
- [ ] After pushing: verify all `@@index` directives created in PostgreSQL:
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename IN 
    ('WorkspaceCredential','WorkspaceMember','InstagramConnection',
     'TrackedAccount','AccountSnapshot','MediaItem','SyncJob','ApiLog','Report');
  ```
- [ ] Confirm Prisma Client is regenerated: `npx prisma generate`

---

## 5. Meta Developer App Checklist

Complete before any OAuth flow will work:

- [ ] Create a Meta Developer account at [developers.facebook.com](https://developers.facebook.com)
- [ ] Create a new App → select "Business" type
- [ ] Add the **Instagram** product to the app
- [ ] Under App Settings → Basic:
  - [ ] Record `App ID` and `App Secret`
  - [ ] Set App Domains to your production domain
  - [ ] Add Privacy Policy URL: `https://your-domain.com/privacy`
  - [ ] Add Terms of Service URL: `https://your-domain.com/terms`
  - [ ] Add Data Deletion Instructions URL: `https://your-domain.com/data-deletion`
- [ ] Under Instagram → Instagram Login → Settings:
  - [ ] Add Valid OAuth Redirect URIs: `https://your-domain.com/api/auth/meta/callback`
  - [ ] Deauthorize Callback URL (optional but recommended)
- [ ] Set `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` in environment variables
- [ ] Test OAuth flow end-to-end in development (App Mode: Development)
- [ ] Add test users or your own Instagram account as a test user while in Development mode

---

## 6. Meta App Review Checklist

Required before accepting OAuth connections from users outside your development team:

- [ ] App is in **Development** mode during testing; switch to **Live** only after review
- [ ] Request the following permissions (justification required for each):
  - `instagram_basic` — view profile info and media
  - `instagram_manage_insights` — view insights for own accounts
  - `pages_read_engagement` — read engagement data for connected Pages
  - `pages_show_list` — list Facebook Pages the user manages
- [ ] For each requested permission, provide:
  - Screencast video demonstrating how the permission is used in the app
  - Written explanation of the use case
- [ ] Legal pages are live and accessible (no auth required):
  - [ ] `https://your-domain.com/privacy` — Privacy Policy
  - [ ] `https://your-domain.com/terms` — Terms of Service
  - [ ] `https://your-domain.com/data-deletion` — Data Deletion Instructions
- [ ] App is publicly accessible (not behind a VPN) during review
- [ ] Data use checkboxes completed in App Review submission
- [ ] After approval: switch App Mode to **Live**
- [ ] Verify users can complete OAuth and grant permissions without Meta "test user" restriction

---

## 7. Demo Mode Checklist

- [ ] Set `DEMO_MODE=true` in environment variables
- [ ] **Do not** set `DEMO_MODE=true` on any instance that has real user data — the seed function will create fake accounts and media that cannot easily be distinguished from real data
- [ ] Verify DemoBanner appears on all dashboard pages after login
- [ ] Verify sync endpoints return 403 with `{ error: "Demo mode: sync disabled" }`:
  - `POST /api/sync/workspace`
  - `POST /api/accounts/[id]/sync`
- [ ] Verify cron route (`/api/cron/sync-instagram`) returns early without syncing
- [ ] Verify demo data is seeded when a new account registers:
  - Accounts page shows demo tracked accounts
  - Media page shows demo posts
  - Analytics page shows demo charts
- [ ] All demo data is clearly labeled with the DemoBanner — no user should mistake demo data for real data
- [ ] To reset demo data: delete the user account and re-register (seed runs on registration)

---

## 8. Security Checklist

### Secrets & Encryption
- [ ] `TOKEN_ENCRYPTION_KEY` is at least 32 characters, randomly generated, never committed to source control
- [ ] `NEXTAUTH_SECRET` is at least 32 characters, randomly generated
- [ ] `CRON_SECRET` is a long random string, never exposed publicly
- [ ] All Instagram access tokens are stored AES-256 encrypted in the database — never in plaintext
- [ ] Meta App Secret is stored AES-256 encrypted when saved via BYOK — never exposed to the browser
- [ ] No secrets are logged to `console.log` or API responses

### Authentication & Authorization
- [ ] All `/dashboard/*` routes and `/api/*` routes (except auth) require a valid session
- [ ] All database queries are scoped to `workspaceId` — no cross-workspace data leakage
- [ ] Workspace membership is validated before any account or media operation
- [ ] Cron endpoint (`/api/cron/sync-instagram`) validates `Authorization: Bearer <CRON_SECRET>` header — returns 401 if missing or wrong

### CSV Export Safety
- [ ] CSV cells are sanitized with `sanitizeCsvCell()` to prevent formula injection (prefixes `=`, `+`, `-`, `@` with a tab character)

### Instagram API Compliance
- [ ] No browser automation, scraping, Puppeteer, Playwright, or unofficial Instagram APIs
- [ ] Only official Meta/Instagram Graph API endpoints are used
- [ ] Own-account metrics are only fetched if `instagram_manage_insights` permission is granted
- [ ] Competitor accounts: only publicly-available metrics are returned (follower count, public post count, likes, comments, estimated engagement rate)
- [ ] Private/restricted metrics for competitor accounts (reach, impressions, saves, shares, story views, audience demographics) are returned as `null` and displayed as `—`
- [ ] Rate-limit headers (`X-App-Usage`) are parsed after each API call; workspace is marked `rate_limited` at ≥90% usage

### Rate Limiting
- [ ] At 60% API usage: warning logged
- [ ] At 80% API usage: sync paused for workspace
- [ ] At 90%+ API usage: workspace marked `rate_limited`, sync skipped until usage drops
- [ ] Cron route skips rate-limited workspaces rather than retrying

### Security Headers
- [ ] Consider adding `next.config.ts` security headers (CSP, X-Frame-Options, HSTS) before going live with real users

---

## 9. Known Limitations

### Instagram API Constraints (cannot be worked around without violating ToS)
- **Competitor accounts**: Only public metrics available (follower count, public media count, likes, comments). No reach, impressions, saves, shares, story views, reel plays, or audience demographics. These are API-level restrictions from Meta, not app limitations.
- **Follower history**: Tracking starts from when the account is added. No historical follower data before that point.
- **BYOK does not expand permissions**: Bringing your own Meta App credentials does not grant access to additional Instagram metrics. Permissions are determined by what the authenticating user grants, not by which app is used.
- **Short-lived tokens expire**: The app exchanges for long-lived tokens (60 days), but tokens must be refreshed before expiry. No automatic refresh is currently implemented — if a token expires, the user must reconnect.
- **Instagram Basic Display API deprecated**: The app uses the Instagram Graph API (for business/creator accounts). Personal accounts linked to a Facebook Page are required; pure personal accounts without a linked Page cannot connect.

### Application Limitations
- **Single workspace per user**: Each user has one default workspace. Multi-workspace support is not implemented.
- **No real-time data**: Metrics are fetched on-demand via sync or via hourly cron. There is no WebSocket or streaming data.
- **No email notifications**: No alerting when sync fails, rate limits are hit, or tokens expire.
- **No team/multi-user workspaces**: WorkspaceMember model exists in schema but invite/member management UI is not implemented.
- **Reports are generated synchronously**: Large reports (many accounts, long date ranges) may time out on serverless deployments. Consider background job processing for production scale.
- **No automatic token refresh**: Long-lived Instagram tokens last 60 days. Manual reconnection is required when tokens expire.
- **CSV import username-only**: Bulk import adds accounts by username; Meta API lookup is used to find the account. If the account is private or username changes, import will fail silently.

### Infrastructure
- **No job queue**: Sync jobs run synchronously in the request/cron handler. For high account volumes, consider a background queue (e.g., Inngest, BullMQ, Vercel Queue).
- **Vercel function timeout**: Default serverless function timeout is 10s (hobby) / 60s (pro). Large workspace syncs may exceed this. Use Vercel Pro + `maxDuration` config for production.
- **No horizontal scaling coordination**: Rate-limit state is stored per-workspace in the database, which works across multiple instances, but no distributed locking is used for concurrent syncs of the same workspace.
