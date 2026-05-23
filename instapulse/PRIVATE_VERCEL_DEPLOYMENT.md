# Private Vercel Deployment Guide

> **Purpose:** This deployment is for private testing only. It is not a public launch.  
> Do not share the deployment URL publicly. No real user data should be entered during testing.

---

## A. What you are testing

- Demo mode on a deployed Vercel URL  
- Login and session behavior on Vercel  
- Database connection with a hosted PostgreSQL provider (Neon or Supabase)  
- Meta OAuth redirect/callback on the deployed URL  
- Own Instagram account sync  
- Competitor sync behavior (Development mode tester accounts)  
- Reports, CSV exports, logs, and settings  

---

## B. Required environment variables

Set all of these in Vercel → Project → Settings → Environment Variables.

### Always required

```env
DATABASE_URL=postgresql://user:password@host:5432/instapulse
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>
NEXTAUTH_URL=https://your-vercel-deployment.vercel.app
TOKEN_ENCRYPTION_KEY=<generate: openssl rand -hex 32>
CRON_SECRET=<generate: openssl rand -hex 32>
SUPPORT_EMAIL=your@email.com
```

### For demo mode (first deployment — recommended)

```env
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
```

### For real Meta OAuth (after demo test passes)

```env
DEMO_MODE=false
NEXT_PUBLIC_DEMO_MODE=false
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=https://your-vercel-deployment.vercel.app/api/auth/meta/callback
INSTAGRAM_GRAPH_API_VERSION=v21.0
NEXT_PUBLIC_META_APP_ID=your-meta-app-id
```

> `TOKEN_ENCRYPTION_KEY` must be at least 16 characters. The app throws at startup if it is missing in production.  
> `NEXTAUTH_SECRET` must be at least 32 characters. NextAuth throws if it is missing.  
> `NEXTAUTH_URL` must match your exact Vercel deployment URL — no trailing slash.

---

## C. Recommended first deployment: Demo mode

Deploy with `DEMO_MODE=true` first. This lets you verify the full app stack (auth, database, UI, reports) without touching the Meta API.

Switch to `DEMO_MODE=false` only after the demo test passes and you have added Meta credentials.

---

## D. Step 1 — Create a hosted PostgreSQL database

Choose one:

**Option A: Neon (recommended — serverless, free tier)**
1. Go to [neon.tech](https://neon.tech) → Create project
2. Copy the **pooled connection string** (connection pooling tab)
3. Use that as `DATABASE_URL`

**Option B: Supabase**
1. Go to [supabase.com](https://supabase.com) → New project
2. Go to Project Settings → Database → Connection String → **Transaction pooler** mode
3. Use that as `DATABASE_URL`

> Always use the **pooled** connection string for Vercel (serverless functions open many short-lived connections).

---

## E. Step 2 — Run Prisma schema push against the production database

Run this once before first deployment, or after any schema change:

```bash
# From the instapulse/ directory
DATABASE_URL="your-production-connection-string" npx prisma db push
```

Or for production-style migration files:

```bash
DATABASE_URL="your-production-connection-string" npx prisma migrate deploy
```

> This creates all tables, indexes, and enums in the hosted database.  
> The Vercel build command (`prisma generate && next build`) generates the Prisma client but does NOT push schema — you must do this manually.

---

## F. Step 3 — Deploy to Vercel

1. Push the repo to GitHub (or use an existing remote)
2. Go to [vercel.com](https://vercel.com) → New Project → Import Git Repository
3. Set **Root Directory** to `instapulse` in the Vercel project settings
4. Set **Framework Preset** to Next.js
5. Add all required environment variables (Section B above)
6. Click Deploy
7. Confirm build passes in the build logs
8. Open the deployed URL and confirm `/auth/signin` loads

> The build command is `prisma generate && next build` — this is already set in `package.json`.  
> `postinstall` also runs `prisma generate` so the Prisma client is available during build.

---

## G. Demo mode test checklist

After first deployment with `DEMO_MODE=true`:

- [ ] `/auth/signup` — sign up with a new email/password
- [ ] `/auth/signin` — sign in and confirm redirect to `/dashboard`
- [ ] Dashboard home — demo banner is visible, demo data appears
- [ ] Accounts page — demo tracked accounts listed
- [ ] Media page — demo posts listed
- [ ] Analytics page — charts render with demo data
- [ ] Competitor page — metric matrix and checklists visible
- [ ] Reports page — generate a report and download CSV
- [ ] Settings page — update workspace name, confirm save
- [ ] Logs page — API logs table (may be empty in demo mode — that is expected)
- [ ] Logout — session clears, redirects to sign-in
- [ ] Sign back in — session works after reload

> In demo mode, sync endpoints return 403 (sync disabled). That is expected.

---

## H. Step 4 — Switch to real Meta OAuth testing

1. In Vercel → Project → Settings → Environment Variables:
   - Set `DEMO_MODE` = `false`
   - Set `NEXT_PUBLIC_DEMO_MODE` = `false`
   - Add `META_APP_ID`, `META_APP_SECRET`
   - Set `META_REDIRECT_URI` = `https://your-vercel-deployment.vercel.app/api/auth/meta/callback`
   - Add `NEXT_PUBLIC_META_APP_ID`
2. In Meta App Dashboard (developers.facebook.com):
   - Go to your app → Facebook Login → Settings (or Instagram → Instagram Login)
   - Add `https://your-vercel-deployment.vercel.app/api/auth/meta/callback` as a Valid OAuth Redirect URI
3. Redeploy the Vercel project (or trigger a new deployment)
4. Test the Connect Instagram flow

> `META_REDIRECT_URI` must match **exactly** what is registered in Meta App Dashboard.  
> One character difference will cause OAuth to fail with a redirect URI mismatch error.

---

## I. Real Meta OAuth test checklist

- [ ] Open `/dashboard/connect`
- [ ] Confirm "Connect Instagram" tab shows (no "Platform credentials not configured" warning)
- [ ] Click "Connect Instagram"
- [ ] Meta OAuth dialog opens in the same window
- [ ] Approve permissions (instagram_basic, instagram_manage_insights, pages_read_engagement, pages_show_list)
- [ ] Callback returns to `/dashboard/connect?success=true`
- [ ] Instagram account listed under Active Connections
- [ ] IG Business Account ID stored — visible in `/api/debug/meta-discovery` (requires `ENABLE_DEBUG_ROUTES=true`)
- [ ] Go to Accounts page → Own account listed with status Active
- [ ] Trigger sync on own account
- [ ] Own profile data (followers, bio) updated
- [ ] Own media synced (check Media page)
- [ ] Insights (reach, saves) appear if instagram_manage_insights was granted
- [ ] API Logs page shows successful calls

---

## J. Competitor sync testing note

**Development mode restriction:**  
While the Meta app is in Development mode, Business Discovery for public competitors (e.g., @natgeo) is blocked by Meta. You will see "Requires Meta Live access" in the competitor sync UI. This is expected.

To test competitor sync in Development mode:
1. Create or use another Instagram Business/Creator account
2. Link it to a Facebook Page
3. Add the Facebook user who owns it as an app tester/developer in Meta App Dashboard → Roles
4. Have them accept the invitation at [developers.facebook.com](https://developers.facebook.com)
5. Use that Instagram username as the competitor handle
6. Run competitor sync

Public competitor sync requires switching the app to Live mode after Meta App Review.

---

## K. Security checklist

- [ ] `TOKEN_ENCRYPTION_KEY` is a randomly generated secret — not the dev fallback
- [ ] `NEXTAUTH_SECRET` is a randomly generated secret
- [ ] `CRON_SECRET` is set and randomly generated
- [ ] `META_APP_SECRET` is in Vercel environment variables — not hardcoded
- [ ] Do not log in with real customer Instagram accounts
- [ ] Do not share the Vercel deployment link publicly
- [ ] Do not commit `.env` or real secrets to Git
- [ ] `ENABLE_DEBUG_ROUTES` is only set if you need debug endpoints (remove in production)

---

## L. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails: "Cannot find module '@prisma/client'" | Prisma client not generated | Verify `build` script is `prisma generate && next build` |
| Sign-in redirects to error page | `NEXTAUTH_URL` mismatch | Set `NEXTAUTH_URL` to exact Vercel URL, no trailing slash |
| Meta OAuth returns "Invalid redirect URI" | `META_REDIRECT_URI` mismatch | Copy the exact callback URL into Meta App Dashboard |
| DATABASE_URL connection error | Wrong connection string or not pooled | Use the pooled connection string from Neon/Supabase |
| "Token encryption key" error at startup | `TOKEN_ENCRYPTION_KEY` missing or short | Set to at least 16 hex chars (32 recommended) |
| Demo mode not seeding | Demo data seeds on first sign-up, not sign-in | Sign up a new account; re-seeding requires deleting the user |
| Meta callback fails with session error | Session cookie not persisting across redirect | Confirm `NEXTAUTH_URL` and `NEXTAUTH_SECRET` are set correctly |
| `/me/accounts` returns empty | Facebook Page not linked to Instagram | See connect page → link Page to IG account in Meta Business Suite |
| Business Discovery blocked | App in Development mode | Expected — use tester account or switch to Live mode after App Review |
| Cron not running | `CRON_SECRET` missing or `vercel.json` not deployed | Confirm `vercel.json` in repo root (`instapulse/vercel.json`), set `CRON_SECRET` |

---

## M. Private test checklist (summary)

- [ ] Build passes on Vercel
- [ ] Vercel deploy succeeds (no runtime errors)
- [ ] Sign up works
- [ ] Log in works
- [ ] Dashboard loads with demo data
- [ ] Reports generate and download as CSV
- [ ] Settings update saves correctly
- [ ] Connect page shows correct state when Meta credentials are missing
- [ ] Meta OAuth works after credentials are added
- [ ] Own Instagram sync works (profile + media + insights)
- [ ] API Logs page shows calls
- [ ] Competitor page shows "Requires Meta Live access" note for public competitors
- [ ] Competitor sync works for app tester account (optional)
- [ ] Logout and login again works

---

## N. After private testing — pre-public checklist

Do these **only after** private testing passes and before any public launch:

- [ ] Remove `robots: { index: false, follow: false }` from `src/app/layout.tsx`
- [ ] Remove or update `src/app/robots.ts` to allow crawlers
- [ ] Set `DEMO_MODE=false` (if not already)
- [ ] Complete Meta App Review and switch app to Live mode
- [ ] Add production domain to Meta App Dashboard as App Domain
- [ ] Set up monitoring/alerting for sync failures and token expiry
- [ ] Test with a non-admin Instagram account to confirm the OAuth flow works for end users
