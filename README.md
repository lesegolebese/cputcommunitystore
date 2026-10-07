# Community Store & Campus Marketplace

A mobile-first marketplace for CPUT students, vendors, faculty and local residents, in South African
Rand, with PayFast / SnapScan payments, a community bulletin board and trust & safety tooling.

Stack: TanStack Start (React 19, SSR) · Tailwind 4 · shadcn/ui · a small JSON-file database behind
`/api/*` · Vitest.

## Quick start

```sh
npm install
npm run dev        # http://localhost:5173
npm run test       # API + routing tests
npm run lint
npm run format     # prettier --write
npm run build && npm run preview
```

The first request creates `data/db.json` (git-ignored) with seed listings, notices and demo users.

### Demo logins (development builds)

Password for all four: `Demo@1234`

| Role | Email |
| --- | --- |
| Student | lesego@mycput.ac.za |
| Local vendor (approved) | thandi@kitchen.co.za |
| Faculty / moderator | zanele@cput.ac.za |
| Resident | pieter@gmail.com |

### Email without an email provider

No email service is connected yet. Verification and password-reset emails are **printed in the server
console and appended to `data/outbox.log`**. In development the sign-up / forgot-password screens also
show a "use this link now" button. To go live, replace `sendEmail()` in `src/server/security.ts` with
Postmark / SendGrid / SMTP.

## What is implemented

| Area | Behaviour |
| --- | --- |
| Registration | Name, email, password (8+ chars, letter + number), role. Students need a `@mycput.ac.za` / `@cput.ac.za` address; vendors need a business registration number and wait for moderator approval; faculty accounts are not self-service. |
| Email verification | One-time, expiring link; login is refused until verified; resend supported. |
| Login / sessions | PBKDF2-SHA256 password hashes (210 000 iterations), signed 12-hour tokens, 5-failure lockout for 15 minutes, per-IP rate limits. |
| Password reset | One-time link valid for 1 hour; does not reveal whether an email exists. |
| Profile | Edit name, bio, campus zone, profile photo (PNG/JPEG/WebP ≤ 200 KB). |
| 2FA | Real TOTP (Google Authenticator compatible). Once on, every checkout needs a valid code. |
| Listings | Create / edit / delete (owner or moderator), photo upload, category, condition, campus zone, student discount, stock. Persisted. |
| Search & filters | Keyword, category, condition, price, verified sellers, campus zone. |
| Cart & checkout | Server recalculates prices (client prices are ignored): student discount + 2 % escrow fee. Stock checked and reduced on payment. |
| Payments | PayFast (signed redirect + ITN webhook with signature and amount checks) and SnapScan (webhook with HMAC check). With no credentials in development, a clearly labelled **test mode** marks the order paid. |
| Escrow flow | Paid → seller marks ready → buyer confirms collection → funds "released", trades and points updated. |
| Ratings & reviews | Only buyers with a completed order can review; one review per item (editable); ratings are averaged live. |
| Notifications | Stored per user (orders, messages, replies, account events); polled every 15 s; mark-all-read. |
| Messaging | Buyer ↔ seller threads per listing; phone numbers are blocked in chat. |
| Bulletin board | Post, like, reply, delete own post; notices can auto-expire. |
| Moderation | Report listings; moderators remove / keep, and approve or reject vendors. |
| Fraud screening | **Rule-based** (not AI): new-account listing bursts, price outliers, duplicate titles, large orders from new accounts, sign-up bursts. Alerts are shown to moderators. |
| Loyalty | Points for trades, reviews and notices; spend them on listing boosts. |
| Security headers | CSP, HSTS (production), `X-Frame-Options`, `nosniff`, referrer and permissions policies. |

## API

Everything is served by one catch-all route (`src/routes/api.$.tsx` → `src/server/handlers.ts`).
Send the token as `Authorization: Bearer <token>`.

```
POST auth/register | auth/verify-email | auth/resend-verification | auth/login | auth/logout
POST auth/forgot | auth/reset | auth/2fa/setup | auth/2fa/enable | auth/2fa/disable
GET  me · PATCH me · GET me/history
GET  products · POST products · PUT/DELETE products/:id · POST products/:id/boost
GET/POST products/:id/reviews
GET/POST notices · POST notices/:id/like | notices/:id/comments · DELETE notices/:id
GET/POST orders · GET orders/:id · POST orders/:id/ready | confirm | cancel
POST payments/payfast/notify | payments/snapscan/notify
GET  notifications · POST notifications/read-all
GET/POST messages · GET messages/threads
POST flags · GET leaderboard
GET/POST admin/flags(/:id) · GET admin/fraud · GET admin/vendors · POST admin/vendors/:id   (faculty only)
```

## Code map

```
src/server/handlers.ts   routing, validation, business rules
src/server/db.ts         JSON-file store (swap for Postgres without touching handlers)
src/server/security.ts   password hashing, TOTP, rate limiting, email outbox
src/server/payments.ts   PayFast / SnapScan adapters
src/server/fraud.ts      rule-based screening
src/lib/pricing.ts       shared price maths (client preview == server charge)
src/components/store/    auth screen + feature components
src/test/api.test.ts     25 end-to-end API tests
```

## Honest limitations

* **Database:** a JSON file is fine for a demo or small pilot, not for concurrent production load.
  Move to Postgres/Supabase before real launch.
* **Payments:** PayFast sandbox needs your sandbox merchant ID/key and a publicly reachable `PUBLIC_URL`
  so PayFast can call the ITN webhook (use ngrok locally). SnapScan needs a merchant account. Without
  credentials only the labelled test mode works. "Escrow" is a status in this app; releasing real funds
  to sellers needs the gateway's split-payment / payout arrangement.
* **Email:** not connected (see above).
* **Fraud detection:** rules, not machine learning.
* **Uploads:** photos are stored as data URLs inside the database file; use blob storage at scale.
* **Rate limits & lockouts** are in memory and reset when the server restarts.

## Before go-live

1. Set `JWT_SECRET` (32+ chars). The server refuses to run in production without it.
2. Leave `ALLOW_DEMO_ACCOUNTS=false` so the published demo password does not work.
3. Connect an email provider; configure PayFast / SnapScan credentials and `PUBLIC_URL` (HTTPS).
4. Replace the JSON store and in-memory rate limiting with Postgres and Redis.
5. Run a penetration test and review the CSP for your host.
