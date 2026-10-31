# Brightloop — Subscription Management System

A local-first, full-stack subscription workspace for products, plans, quotations, recurring invoices, payments and customer self-service. React/TypeScript + Express + Knex; SQLite out of the box, PostgreSQL supported and integration-tested.

The original visual design is retained. New workflow controls reuse existing forms, buttons and modals; the main stylesheets are byte-for-byte unchanged from the original submission.

## Quick start

Requires **Node.js 24.x** and npm. Install Node before installing native database dependencies.

```bash
npm ci
npm run local
```

This generates `.env` with a random JWT secret if absent, creates/upgrades the schema, seeds an empty workspace without replacing existing business data, and starts the API/UI.

- UI: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Stop both with Ctrl+C.

| Role | Email | Demo password |
|---|---|---|
| ADMIN | admin@brightloop.local | Brightloop@2026 |
| STAFF | staff@brightloop.local | Brightloop@2026 |
| CUSTOMER | customer@brightloop.local | Brightloop@2026 |

Demo credentials are for evaluation only. Rotate them before real use. Switching Node major versions after installation requires `npm rebuild better-sqlite3` or a clean `npm ci`.

### Demo versus authenticated application

Without `VITE_API_URL`, `npm run dev` shows the explicitly labeled browser-only demo. Demo role switching is not an authentication mechanism. With `.env.example` configuration, the application uses actual JWT authentication and persistent server data. For same-origin proxy/production hosting use `VITE_API_URL=/api`; do not hard-code localhost into browser code for remote hosting.

## Implemented workflows

- **Accounts:** unique normalized email, required password policy, bcrypt, role restrictions, admin-only staff creation, JWT/refresh rotation and immediate session revocation on reset/logout.
- **Password recovery:** expiring single-use reset links; existing form accepts the link automatically. Local preview or real SMTP delivery.
- **Catalog:** products, costs/sales prices/notes, variants and deltas, all four billing frequencies, availability windows, minimum plan quantity and per-plan lifecycle permissions.
- **Quotations:** reusable templates, validity, server-priced immutable offer lines, expired/duplicate conversion rejection, explicit legacy re-quote policy.
- **Subscriptions:** full Draft → Quotation → Confirmed → Active → Closed flow; customer-scoped pause/resume/renew/close; staff contract edits; prospective quantity/add-on changes and optimistic revisions.
- **Billing:** UTC daily/manual scan, backfill, original calendar-day anchoring, pause intervals, accrued-charge preservation on closure, per-invoice transactions, period uniqueness and failure logs.
- **Rules/invoices:** automatic product/subscription discounts, date/minimum/usage conditions, tax rules, immutable invoice confirmation, PDFs, cancellation and email attachments.
- **Payments:** methods/date/note, partial/full payment, precision validation, overpayment prevention and optional `Idempotency-Key` retry protection. Recording does not charge a bank/card.
- **Finance:** all-history operational lists, collectible debt excluding drafts, as-of aging, live cash-receipt analytics, aggregate-backed summaries, server search/renewals and pagination.
- **Notifications:** durable local/SMTP adapter, delivery statuses, retries, leases, stable Message-ID, staff/customer reminders and audit history.

## Email configuration

Default `MAIL_TRANSPORT=local` is **development preview only**. Messages are written to `backend/data/outbox.log` and marked `logged`, never represented as mailbox delivery.

For actual mail, configure `.env`:

```dotenv
MAIL_TRANSPORT=smtp
PUBLIC_APP_URL=https://billing.your-domain.example
MAIL_FROM=Brightloop <billing@your-domain.example>
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=your-user
SMTP_PASSWORD=your-secret
```

Use port 465 / `SMTP_SECURE=true` if required by your provider. Do not disable TLS outside a controlled local test receiver. Never commit `.env`. SMTP credentials/provider acceptance and domain SPF/DKIM/DMARC are deployment responsibilities.

The worker retries pending/failed messages every 30 seconds with backoff, up to five attempts. Staff can inspect `GET /api/notifications` and invoke `POST /api/notifications/retry`. Delivery is **at-least-once**, not exactly-once: losing an SMTP acknowledgment can cause a duplicate; stable Message-ID assists deduplication.

## PostgreSQL

```bash
docker compose up -d postgres
# Set DATABASE_URL in .env to the database from docker-compose.yml
npm run local
```

Knex stores portable JSON snapshots as text and normalizes decimal values at the API boundary. SQLite uses a serialized connection/WAL; PostgreSQL uses row locks. Additive versioned upgrades retain old records; the original schema upgrade is regression-tested. Take a backup before upgrading; run first startup/migration once before adding additional application instances.

## Commands and verification

| Command | Purpose |
|---|---|
| `npm run local` | Seed/upgrade if needed and run API + UI |
| `npm run api` | API, billing scheduler and mail worker |
| `npm run dev` | Vite UI with `/api` proxy |
| `npm run build` | Type-check and production build |
| `npm run lint` | Frontend + backend/script ESLint gates |
| `npm test` | 39 isolated SQLite tests, including genuine legacy upgrade |
| `npm run check` | Lint + build + backend tests |
| `npm run test:coverage` | Instrumented backend coverage with thresholds |
| `npm run test:ui` | Build isolated demo + 10 browser checks |
| `npm run test:local-ui` | Build and run 10 actual-API browser checks |
| `npm run test:postgres` | Two suites / 38 checks in isolated PostgreSQL schemas |
| `npm run test:load` | Original lightweight 10k-subscription API benchmark |
| `npm run test:acceptance` | Realistic 10k subscriptions / 60k invoices / 30k payments, HTTP + browser + overlapping billing |
| `npm run test:production` | Production static/auth/header and SQLite backup smoke |
| `npm audit` | Dependency advisory scan |
| `npm run backup -- /safe/path/backup.sqlite` | Consistent SQLite online backup; refuses overwrite |
| `npm run package:source` | Regenerate current source download including docs/CI |

Browser setup:

```bash
npx playwright install --with-deps chromium
```

PostgreSQL tests create/drop randomized schemas, never public business tables:

```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/test_db npm run test:postgres
```

Use a dedicated test service/account. The user needs permission to create schemas. The original-schema upgrade test is SQLite-only; 15 core + 23 hardening cases also execute on PostgreSQL.

CI is defined in `.github/workflows/quality.yml` with Node 24, PostgreSQL 17, audit, coverage, browser and realistic acceptance gates. The workflow is supplied; local execution of its commands passed, but a hosted Actions run is not claimed.

## Evaluation / iteration record

Original rubric: **76 → 84 → 89 → 93 / 100** (engineering self-assessment, not external jury certification).

- [Iteration 1 — financial correctness](docs/iterations/01-financial-correctness.md)
- [Iteration 2 — complete workflows and delivery](docs/iterations/02-complete-workflows-and-delivery.md)
- [Iteration 3 — hardening and final acceptance](docs/iterations/03-hardening-and-final-acceptance.md)
- [Final evaluation and requirement mapping](docs/FINAL_EVALUATION.md)
- [Billing policies, deployment and recovery](docs/OPERATIONS_AND_POLICIES.md)
- Fresh logs, JSON and visual evidence: `docs/evidence/`

## Important API additions

All business endpoints require a Bearer JWT; staff/admin privileges and customer ownership are checked on the server.

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/api/subscriptions/:id/quotation` | Draft → Quotation, staff only |
| PUT | `/api/subscriptions/:id` | Staff line/contract amendment |
| PUT | `/api/portal/subscriptions/:id` | Owned line/quantity amendment; no staff-only fields |
| GET | `/api/portal/catalog?search=` | Customer-safe add-on product search |
| GET | `/api/search?search=` | Scoped bounded global search |
| GET | `/api/renewals/upcoming` | Next four upcoming terms across server records |
| POST | `/api/notifications/retry` | Staff-triggered eligible outbox processing |
| POST | `/api/payments` | Optional `Idempotency-Key` header for safe retries |

Amendment body: `{ "expected_revision": 0, "lines": [{ "product_id": "uuid", "quantity": 2, "variant_ids": [] }] }`. Staff may additionally submit `expiry_date` and `payment_terms`. Conflicting revision returns 409; active line changes take effect at the first future anchored period. Never trust client prices.

## Deployment and limitations

A multi-stage Node 24 Dockerfile builds the frontend with `/api` and serves it from the API process as a non-root user. Set JWT/database/mail configuration and mount durable storage for SQLite, PDFs and the outbox. The production server includes security headers and rejects the example JWT secret. The Dockerfile was supplied but not container-built in this environment; production process/static/auth/backup behavior was smoke-tested directly.

No automatic card/bank charges, refunds, credit notes, metering, multi-currency conversion or proration are claimed. Revenue charts are cash collections, not accounting recognition or MRR/ARR. Business policies and remaining hardening recommendations are explicit in the operations/final evaluation docs. Internet/provider latency and production security require deployment-specific validation.
