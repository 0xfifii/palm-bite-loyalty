# Palm Bite Loyalty

The customer loyalty app for Palm Bite. Customers collect one point per verified visit by scanning a rotating QR code at the counter. Fifteen points unlock a free eligible drink. When a team member confirms the drink was served, the card resets to zero and a new card begins. Full history is kept.

It is an installable Progressive Web App (Android, iPhone, tablets and desktop) built with Next.js, TypeScript, Tailwind CSS and Supabase (PostgreSQL, Auth, Storage).

## Contents

1. [How it works](#how-it-works)
2. [Project structure](#project-structure)
3. [Local setup](#local-setup)
4. [Supabase configuration](#supabase-configuration)
5. [Creating the first administrator](#creating-the-first-administrator)
6. [Setting up the visit QR display](#setting-up-the-visit-qr-display)
7. [Installing the app on a phone](#installing-the-app-on-a-phone)
8. [Tests](#tests)
9. [Deploying to Vercel](#deploying-to-vercel)
10. [Security model](#security-model)
11. [Before launch: what Palm Bite needs to supply](#before-launch-what-palm-bite-needs-to-supply)

## How it works

| Rule | Where it is enforced |
| --- | --- |
| New customers start at 0 points; registration awards nothing | `handle_new_user` trigger creates the account at 0. Roles can never be set from sign-up data. |
| One verified visit = one point | `award_qr_visit` and `staff_check_in` database functions, the only paths that add a visit |
| One point per customer per business-local day | `visits_one_per_day` unique constraint on `(customer_id, visit_date)`, plus a row lock on the loyalty account |
| 15 points = exactly one reward | `rewards_one_per_cycle` unique constraint, `rewards_one_open_per_customer` partial unique index |
| No new points while a reward is unredeemed | `_award_point` returns `REWARD_PENDING_REDEMPTION` |
| Redemption resets to 0 and starts a new card | `complete_redemption`, one atomic transaction with row locks |
| History is never lost | Visits, ledger and audit tables are append-only (triggers reject updates and deletes) |

The business timezone (default `Africa/Lagos`) and the QR lifetime (default 60 seconds, allowed 30 to 300) are set by an administrator in **Admin > Settings**.

### The visit QR code

1. A staff or admin device opens `/display`. Every minute it asks the server for a new code.
2. The server creates a token `PB1.<session id + random nonce>.<HMAC-SHA256 signature>`. The signature covers the Palm Bite location id and uses `QR_SIGNING_SECRET`, which never leaves the server.
3. The database stores only the SHA-256 hash of the token with its expiry time. The display refreshes the code about 10 seconds before it expires.
4. The QR code encodes `https://<your site>/scan?t=<token>`, so a phone's own camera app also opens the right page. Inside the app, **Scan & Earn** reads it with the live camera.
5. The server checks the signature, then the database checks the session exists, the hash matches, it is not revoked or expired, and the daily rule. Only then is the point written.
6. Every scan request carries an idempotency key. If the network drops after the point was saved, the retry returns the original result instead of awarding twice.

A rotating code stops people reusing a photo of an old code, but it cannot prove the guest is physically in the shop. For guests who cannot scan, staff use **Check in** (by name or phone). Each staff check-in is recorded with the staff member's name and an optional reason. The `visits.method` column and the checks in `lib/loyalty/scan-service.ts` are where stronger presence checks (for example a geofence or a staff-confirmed code) can be added later.

### Redeeming a free drink

1. The customer opens their reward, picks an eligible drink and options, and confirms.
2. The app shows a code such as `PB-7K3Q9X` and a QR of it.
3. Staff open **Staff > Redeem** (or **Admin > Rewards**), type or scan the code, check the drink and the customer, then tap **Confirm drink served**.
4. The reward becomes Redeemed, the card resets to 0 and card number increases by one. If anything fails, nothing changes.
5. Staff can cancel a pending request with a reason. The customer keeps their reward and can choose again.

## Project structure

```
app/                     Next.js routes
  (auth)/                join, login, password recovery
  (customer)/            home, drinks, scan, rewards, profile (bottom navigation)
  staff/                 redeem, check in, QR display link
  admin/                 overview, customers, visits, QR, rewards, drinks, reports, settings
  display/               full-screen rotating visit QR
  api/scan               visit verification endpoint
  api/qr/session         mints a new signed visit code (staff only)
  api/reports/[kind]     CSV export (admin only)
components/              UI building blocks (brand, ui, customer, staff, admin, scan, qr, pwa)
lib/
  qr/token.ts            token signing and verification (server only)
  qr/parse.ts            reading scanned text (client safe)
  loyalty/               scan workflow, response codes and copy, card presentation, queries
  reports/               CSV building and report fetching
  supabase/              server, browser, service role and proxy clients
supabase/migrations/     schema, functions, security, storage, reports
supabase/seed.sql        clearly labelled SAMPLE drinks for development
public/                  brand assets, PWA icons, service worker
tests/unit               token, scan workflow, validation, CSV, card presentation
tests/db                 34 integration tests run against real PostgreSQL
tests/e2e/full_flow.py   browser journey including a real camera scan
scripts/                 icons, admin promotion, test database, copy checker
```

## Local setup

Requirements: Node.js 20.9 or newer, and a Supabase project (hosted, or local with the Supabase CLI and Docker).

```bash
git clone <your-repo-url> palm-bite-loyalty
cd palm-bite-loyalty
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see the comments in the file). Generate the two secrets with:

```bash
openssl rand -base64 48   # QR_SIGNING_SECRET
openssl rand -base64 24   # RATE_LIMIT_SALT
```

Apply the database (next section), then:

```bash
npm run dev               # http://localhost:3000
```

Production build locally:

```bash
npm run build
npm start
```

The camera only works on `localhost` or over HTTPS. To test scanning from a real phone, deploy to Vercel or use an HTTPS tunnel.

## Supabase configuration

### 1. Create the project

Create a project at supabase.com. From **Project Settings > API** copy the project URL, the anon (or publishable) key and the service role (or secret) key into `.env.local`.

### 2. Apply the migrations

Option A, Supabase CLI:

```bash
npx supabase login
npx supabase init            # only if supabase/config.toml does not exist yet; keep the existing migrations
npx supabase link --project-ref <your-project-ref>
npx supabase db push         # applies supabase/migrations in order
```

Option B, SQL editor: run each file in `supabase/migrations` in filename order.

Then, for development only, run `supabase/seed.sql` to add the six sample drinks. Each is named "Sample ..." and labelled Sample in the app. Do not run the seed in production; add the real menu in **Admin > Drinks menu** instead.

### 3. Authentication settings

In **Authentication > URL Configuration**:

- Site URL: your app URL, for example `https://loyalty.palmbite.com`
- Redirect URLs: add `https://loyalty.palmbite.com/**` (and `http://localhost:3000/**` for development)

In **Authentication > Providers > Email**: keep Email enabled and **Confirm email** on.

In **Authentication > Email Templates**, so links work even if opened on a different device, set:

- Confirm signup link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/home`
- Reset password link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

For real customers, configure a custom SMTP sender in **Project Settings > Auth > SMTP** (Supabase's built-in sender is heavily rate limited).

Phone numbers are collected, normalised to international format and kept unique, and staff use them to find a guest. Email is the verified contact. To verify phones by SMS as well, enable an SMS provider in Supabase and add an OTP step; nothing else needs to change.

## Creating the first administrator

No administrator credentials exist in the code. To create the first one:

1. Open the app and register normally with the owner's email (**Join the Club**). Confirm the email.
2. Promote that account, using either:

   ```bash
   node --env-file=.env.local scripts/promote-admin.mjs owner@palmbite.com
   ```

   or in the Supabase SQL editor:

   ```sql
   select public.promote_to_admin('owner@palmbite.com');
   ```

3. Sign in again. You land on `/admin`.

After that, add team members from the app: they register normally, then an admin opens **Customers > their name > Access** and sets the role to Staff or Administrator. Every role change is in the audit log.

## Setting up the visit QR display

1. Use a tablet or screen at the counter, kept on charge.
2. Sign in with a staff or admin account and open `/display` (or **Admin > QR display > Open full-screen display**).
3. Tap **Full screen**. The page keeps the screen awake where the browser supports it and replaces the code automatically before it expires. If the connection drops it hides the code until a fresh one arrives.
4. If a code is ever shared outside the shop, use **Admin > QR display > Revoke live codes**. Displays fetch a new code within seconds.
5. To rotate the signing secret: set the current value as `QR_SIGNING_SECRET_PREVIOUS`, set a new `QR_SIGNING_SECRET`, redeploy, then clear the previous value after a few minutes.

## Installing the app on a phone

- **Android (Chrome):** open the site, then tap **Install app** on the Profile screen, or use the browser menu and choose **Install app**.
- **iPhone (Safari):** open the site in Safari, tap Share, then **Add to Home Screen**.
- **Desktop (Chrome or Edge):** use the install icon in the address bar.

The service worker caches only public static files and an offline page. Points, scans and redemptions always need a live connection; nothing is ever awarded offline and no private data is cached.

## Tests

```bash
npm run typecheck
npm run lint
npm run test:unit                      # no database needed
npm run check:copy                     # fails on any emoji, em dash or en dash
```

Database integration tests run the real migrations on a throwaway local PostgreSQL (version 15 or newer) with a small Supabase stand-in for roles and `auth.uid()`:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:test:setup
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/palm_bite_test npm run test:db
```

They cover all 22 required scenarios that involve data: zero start, no registration points, valid scan, same-day repeat, later day, expired, tampered and revoked codes, unauthenticated calls, customers editing balances, exactly one reward, no second reward, reset on redemption, history kept, failed redemption preserved, new cycle, concurrent scans, concurrent redemptions, cross-customer access, staff limits, reports matching real data and timezone boundaries.

The browser journey (registration, a real camera scan of the live display code, duplicate scan, reward choice, staff redemption, reset, admin pages, CSV export, access checks) runs with Python Playwright and ffmpeg against a running app:

```bash
pip install playwright && python -m playwright install chromium
E2E_BASE_URL=http://localhost:3000 E2E_DATABASE_URL=postgres://... python3 tests/e2e/full_flow.py
```

Use a development project for this; it creates test accounts and promotes one to administrator. It assumes **Confirm email** is turned off in that project so test accounts can sign in immediately.

## Deploying to Vercel

1. Push the repository to GitHub:

   ```bash
   git remote add origin git@github.com:<you>/palm-bite-loyalty.git
   git push -u origin main
   ```

2. In Vercel, **Add New > Project**, import the repository. The framework is detected as Next.js; no build settings need changing.
3. Add every variable from `.env.example` under **Settings > Environment Variables**, with `NEXT_PUBLIC_SITE_URL` set to the production URL.
4. Deploy. Then set the same URL as the Supabase Site URL and redirect URL (see above).
5. Check: open the site on a phone, register, confirm the email, open `/display` on another device as staff, and scan.

## Security model

- **Row Level Security** on every table. Customers can read only their own rows; staff can read what they need to serve guests; only admins see audit logs, scan attempts and exports. Customers can update only their own name and phone (column-level grants).
- **No client writes to loyalty data.** Points, visits, rewards and redemptions change only through `SECURITY DEFINER` functions that read the caller from `auth.uid()` and check the role in the database. Roles, balances and statuses sent by a browser are never trusted.
- **Server-only paths.** `award_qr_visit`, `log_scan_attempt`, `rate_limit_hit`, `registration_conflicts` and `promote_to_admin` are executable only by the service role, which is used only in server code.
- **Secrets** live only in environment variables. The QR signing secret and service role key are never sent to the browser.
- **Rate limits** (database backed, so they work across serverless instances) on sign-up, sign-in, password recovery, scanning and QR minting. IP addresses are stored only as salted hashes.
- **Audit log** of rewards earned, drinks chosen and served, cancellations, point corrections (with reasons), staff check-ins, status and role changes, settings, QR revocations and report exports.
- **Headers:** Content Security Policy, frame blocking, no MIME sniffing, strict referrer policy, camera limited to this site, and HSTS on HTTPS.
- **CSV exports** neutralise spreadsheet formulas.

## Before launch: what Palm Bite needs to supply

- **Real menu and photography.** The app ships with six clearly labelled sample drinks and an original drink illustration used when no photo is uploaded. Instagram and image sites could not be reached from the build environment, so no Palm Bite photos are included. Upload photos in **Admin > Drinks menu**; they appear across the app.
- **Supabase project and keys**, a custom SMTP sender, and the email template changes above.
- **Domain** for the Vercel deployment.
- **Business timezone** check in **Admin > Settings** (defaults to Africa/Lagos).
- **Privacy notice** for customers, appropriate to where Palm Bite operates.
