# Brightloop — Subscription Management System

**A little less busywork. One connected workspace for a subscription business.**

Brightloop combines a React/TypeScript dashboard and customer portal with a local Node.js/Express/Knex REST API. The runnable business system has **no cloud runtime dependencies**: use local PostgreSQL or the included SQLite fallback, local JWT signing, an in-process scheduler, local PDF files, and a console/file email outbox.

## 1. Quickstart

Prerequisites: **Node.js 24 LTS**, npm, and Python 3 for the optional load test/demo script. SQLite needs no separate database server. The repository uses a single root dependency installation; `backend/` and `frontend/` are separate application directories sharing that installation.

```bash
npm install
npm run local
```

The local command creates `.env` from `.env.example` with a randomly generated JWT secret if needed, creates the SQLite schema, seeds the workspace without overwriting existing data, and starts both applications:

- Frontend: `http://localhost:5173`
- REST API: `http://localhost:4000/api`

Open the frontend and sign in. Keep the command running; Ctrl+C stops both processes. The API binds to loopback only. Open the frontend using **localhost**, matching the configured CORS origin.

### Demo credentials

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@brightloop.local` | `Brightloop@2026` |
| STAFF | `staff@brightloop.local` | `Brightloop@2026` |
| CUSTOMER | `customer@brightloop.local` | `Brightloop@2026` |

The seed script also prints credentials. Change these passwords before using real business data.

### Local PostgreSQL instead of SQLite

```bash
cp .env.example .env
# Set JWT_SECRET to a new random secret with at least 32 characters.
docker compose up -d postgres
# Uncomment DATABASE_URL in .env:
# postgresql://brightloop:brightloop_local@127.0.0.1:5432/brightloop
npm run local
```

The same Knex schema runs on both drivers. JSON snapshots are stored as portable text, dates as ISO strings, roles/states as validated strings, identifiers as UUIDs, and money as fixed-precision decimals. API serialization normalizes PostgreSQL numeric strings to JSON numbers. PostgreSQL transactions use row locks; SQLite uses WAL and a single serialized connection. **The included test and timing results were measured on SQLite, not PostgreSQL.**

### Commands

| Command | Purpose |
|---|---|
| `npm run local` | Seed if needed, then run API + UI together |
| `npm run api` | Run local API and daily scheduler |
| `npm run dev` | Run UI only; reads `.env` |
| `npm run seed` | Create schema and seed; existing workspace preserved |
| `npm run build` | Type-check and build production frontend |
| `npm test` | Run REST integration tests against isolated in-memory SQLite |
| `npm run test:ui` | Run browser tests against a temporary local static server; build first |
| `npm run test:local-ui` | Build an API-connected UI and run seven browser checks against a temporary real local API/database |
| `npm run test:load` | Seed isolated 10k database, launch temporary local API, measure endpoints, stop API |
| `python3 scripts/month_end_demo.py` | Exercise the complete lifecycle against a running local API |

For browser tests, first run `npx playwright install chromium`. No running development server is required for automated tests.

### Runtime configuration

See `.env.example` for `JWT_SECRET`, `DATABASE_URL`, `SQLITE_PATH`, `PORT`, `FRONTEND_ORIGIN`, `VITE_API_URL`, `REMINDER_DAYS`, and `SCHEDULER`.

- API access JWTs expire in **15 minutes**. Refresh tokens expire after **7 days**, are hashed at rest, rotated on every use, and revoked after password reset/logout.
- `SCHEDULER=off` disables the in-process schedule for externally managed cron deployments/tests.
- Default scheduler: **00:05 UTC daily**. Renewal reminders default to **7 days** before expiry.
- To run your own OS cron, invoke `POST /api/billing/run` and `POST /api/notifications/run` with a staff/admin JWT. Do not place credentials in world-readable crontabs.

## 2. Preview versus the local application

With **no `VITE_API_URL`**, the UI opens a clearly labeled, browser-persistent **demo workspace**. The profile menu can switch among demo roles. This is a demonstration, **not an authentication boundary**. Demo comparison percentages and charts are illustrative; the overview identifies the demo and the chart labels its sample trend. Demo invoice downloads use a bundled local PDF library, and "send" records a simulated audit event without sending email.

With the local API configured, the UI shows the login screen, uses JWT/refresh authentication, routes business operations to the API, uses server-paginated 50-row lists, and displays revenue analytics derived from actual recorded payments. Role switching is absent in this mode. The API enforces customer isolation regardless of what a client sends. Fonts and application assets are bundled locally. No externally hosted API, CDN, authentication service, payment processor, or SMTP provider is needed.

The optional hosted UI preview is separate from the self-hosted executable system. Download the source archive from **Help & getting started** or **Settings** to run the actual business system locally.

## 3. Included modules

- **Authentication & team access:** signup, login, refresh rotation, logout, password reset, password policy, bcrypt hashes, admin-only staff creation, role middleware, customer ownership checks.
- **Products, variants & plans:** catalog, product cost/sales prices, notes, soft archive, variant groups/options, price deltas, all four billing frequencies, quantities, availability windows, plan action flags. Advanced setup provides create/edit/archive forms.
- **Templates & quotations:** reusable product lines, validity, customer quotations, atomic one-time conversion to a numbered subscription, expired-quote rejection.
- **Subscriptions:** numbered records, terms and billing dates, draft/quotation/confirmed/active/paused/closed states, permitted lifecycle actions, per-record audit history.
- **Taxes & discounts:** percent/fixed taxes, product scopes, percent/fixed discounts, date windows, minimums, usage caps, server-confirmation usage accounting.
- **Billing & invoices:** daily/manual scan, cursor-batched processing, missed-period backfill, per-invoice transaction, unique period constraint, billing run logs, confirm/cancel/send, local PDFs.
- **Payments & receivables:** bank/card/cash/UPI/other recording, partial payments, automatic paid state, outstanding/overdue views, aging buckets.
- **Customer portal:** own subscriptions, invoices, PDFs, payments, plan-permitted self-service actions.
- **Reports:** summary cards, date-bound lists, revenue charts, aging, CSV page exports, indexed reads, daily summary materialization.
- **Notifications & audit:** idempotent invoice, renewal, and overdue notices; staff copies; business mutation history with old/new snapshots.

## 4. REST API reference

All business endpoints are under `/api` and require `Authorization: Bearer <access_token>`. Public auth routes and `/health` are the only exceptions. `ADMIN` includes staff operational privileges. Catalog reads are available to staff/admin; customer catalog details are returned only through owned subscriptions.

| Method | Endpoint | Access | Behavior |
|---|---|---|---|
| GET | `/health` | Public | Local process health |
| POST | `/auth/signup` | Public | Customer account only; email normalized and unique |
| POST | `/auth/login` | Public | Access + refresh token and public user |
| POST | `/auth/refresh` | Public, refresh token | Rotate token; replay rejected |
| POST | `/auth/forgot-password` | Public | Generic response; registered email gets local reset token |
| POST | `/auth/reset-password` | Public, reset token | Single-use, 30-minute reset token; password policy enforced |
| POST / GET | `/auth/logout`, `/auth/me` | Authenticated | Revoke refresh tokens / current user |
| POST | `/admin/staff` | Admin | Create staff; role cannot be supplied by caller |
| GET | `/customers`, `/team` | Staff / Admin | Paginated public user records; hashes never returned |
| GET, POST | `/products`, `/plans`, `/taxes`, `/discounts` | Staff reads; Admin writes | List/create catalog and rules |
| GET, PUT, DELETE | `/products/:id`, `/plans/:id`, `/taxes/:id`, `/discounts/:id` | Staff reads; Admin writes | Read/edit/soft archive |
| GET, POST | `/products/:id/variants` | Staff reads; Admin writes | Variant options with group + price delta |
| PUT, DELETE | `/products/:id/variants/:variantId` | Admin | Edit/remove option; historical invoice snapshots preserved |
| GET, POST | `/templates` | Staff | List/create quotation templates |
| GET, PUT, DELETE | `/templates/:id` | Staff | Read/edit/delete template |
| GET, POST | `/quotations` | Staff | List / instantiate template for customer |
| POST | `/quotations/:id/convert` | Staff | One transaction; quote and new subscription linked |
| GET, POST | `/subscriptions` | Scoped reads; Staff creates | List/create subscription |
| GET | `/subscriptions/:id` | Scoped | Subscription and full audit history |
| POST | `/subscriptions/:id/:action` | Staff or scoped customer | `confirm`, `activate`, `pause`, `resume`, `renew`, `close`, `cancel`; customer only permitted self-service actions |
| POST | `/billing/run` | Staff | Idempotent due-period generation with BillingRun report |
| GET | `/billing/runs` | Staff | Paginated scan history and failures |
| GET | `/invoices`, `/invoices/outstanding` | Scoped | Invoice lists; unpaid balance views |
| GET | `/invoices/:id` | Scoped | Invoice snapshot |
| POST | `/invoices/:id/:action` | Staff | `confirm`, `cancel`, `send` |
| GET | `/invoices/:id/pdf` | Scoped | Local PDF generation and attachment download |
| GET, POST | `/payments` | Scoped reads; Staff records | List payments / record partial or final payment |
| GET | `/portal/overview` | Customer | Own subscription count, collected payments, balance |
| GET | `/portal/subscriptions`, `/portal/invoices`, `/portal/payments` | Customer | Own records only |
| GET | `/portal/invoices/:id/pdf` | Customer + ownership | Own invoice PDF |
| POST | `/portal/subscriptions/:id/:action` | Customer + ownership | `pause`, `resume`, `renew`, `close` with plan checks |
| GET | `/dashboard/summary` | Staff | Summary snapshot and collected revenue in date range |
| GET | `/reports/subscriptions`, `/reports/invoices`, `/reports/payments` | Staff | Filtered, bounded, paginated reports |
| GET | `/reports/revenue` | Staff | Paginated pre-aggregated DailySummary data |
| GET | `/reports/aging` | Staff | 0–30 / 31–60 / 61–90 / 90+ receivable buckets |
| GET | `/analytics/revenue` | Scoped | Actual payment time series and billing-frequency mix |
| GET | `/audit`, `/notifications` | Staff | Paginated mutation / local notification records |
| POST | `/notifications/run` | Staff | Manually check renewal and overdue reminders |

### List contract and filters

```text
?page=1&page_size=50&from=2026-10-01&to=2026-10-31
&status=Active&customer_id=<uuid>&plan_id=<uuid>
&method=bank&overdue=true&search=Acme
```

Pagination defaults to 50 and is capped at 100. Date bounds default to the previous year through today. Relevant filters are applied server-side. Payment dates filter the `payment_date` column; other lists use creation dates; aging uses due dates. Status, customer, plan, method, overdue and search filters are accepted on applicable collections. `entity_id` filters audit history. Customer attempts to supply another `customer_id` return 403.

```json
{"data": [], "total": 0, "page": 1, "page_size": 50, "from": "2026-10-01", "to": "2026-10-31"}
```

Validation returns 400; missing credentials 401; insufficient permissions/foreign ownership 403; missing records 404; duplicate email, illegal transitions, expired/unavailable offers and duplicate conversion 409. Error responses contain `error` and optionally validation `details`.

### Representative write payloads

```json
// POST /subscriptions
{
  "customer_id": "<customer-uuid>",
  "plan_id": "<plan-uuid>",
  "start_date": "2026-10-31",
  "payment_terms": 14,
  "lines": [{"product_id": "<product-uuid>", "quantity": 1, "variant_ids": ["<option-uuid>"]}]
}
```

The server computes effective prices; client-supplied `unit_price` never overrides the plan/catalog price. A plan's main product uses its plan price; additional product lines use their sales price, with selected variant deltas added. `expiry_date` is optional and defaults to one billing period.

```json
// POST /payments
{"invoice_id":"<invoice-uuid>","method":"bank","amount":49.50,"payment_date":"2026-10-31","note":"Bank reference 1234"}
```

Recording a payment does **not** contact a processor or move money.

## 5. Full billing-month walkthrough

Automated walkthrough (API must already be running):

```bash
python3 scripts/month_end_demo.py
```

This logs in as admin, creates a customer quotation from a seeded template, converts it once, confirms and activates the subscription, runs billing twice to verify the second run creates zero duplicates, confirms and sends the invoice, records two partial payments, verifies `Paid`, pauses/resumes/renews the subscription, checks reminders, and reads the financial summary. All generated PDFs and mock emails remain on local disk.

### The same journey in the UI

1. Sign in as admin; review **Products & plans**. Open **Advanced setup** to edit product prices, Brand=Odoo (+560), availability windows, or plan flags.
2. In **Taxes & discounts**, review the active sales tax and the expired and usage-capped sample discounts.
3. In **Quotations**, open **Manage templates** to create or edit a template. Create an offer for a customer; click **Convert**. Expired offers are rejected by the API.
4. In **Subscriptions**, open the new record. Confirm, then activate it. Its status history records each change.
5. In **Invoices**, click **Run billing**. Read the scan counts. Run it again: the unique subscription/period constraint prevents duplicates.
6. Open the draft invoice and confirm it. Eligible discount usage is consumed in that transaction. Send it and download the PDF.
7. Record a partial bank payment, then the remaining amount. The invoice becomes Paid only when the full balance is covered.
8. View **Reports** and the receivable aging buckets. Export a report/page to CSV.
9. Sign out and use the customer account. Only that customer's subscriptions, payments, and invoice PDFs are returned. Pause/resume/renew/close buttons follow the plan flags.
10. At the next billing date, the scheduler generates the next exclusive period. A missed scheduler day is recovered by the next due-date scan. Renewing extends expiry by one period; auto-close ends expired terms when enabled.
11. Check `backend/data/outbox.log`, `backend/data/invoices/`, **Audit log**, and `/api/billing/runs` for a complete operational trail.

## 6. Architecture

```text
backend/
  app.mjs          REST routes, schemas, authorization, lifecycle transactions
  auth.mjs         JWT, bcrypt, password policy, refresh/reset flows
  db.mjs           portable schema, connection, dates, sequence numbers, audit helper
  services.mjs     tax/discount evaluation, billing, summaries, local mail/PDF/reminders
  server.mjs       loopback server and UTC daily job
  seed.mjs         idempotent fixture setup
  tests/           automated REST tests
  data/            runtime database, outbox, PDF files (not shipped in source archive)
frontend/src/
  BrightloopApp.tsx                  workspace UI, portal, forms, record drawers
  data.ts                           typed data contract, demo fixtures, API adapter
  components/Charts.tsx              SVG reports and actual-payment analytics
  components/ServerRecords.tsx       bounded 50-row server-side lists and filters
  components/CatalogManager.tsx      full catalog/rule/template editors
  styles.css                        responsive local-font visual system
src/App.tsx                         root Vite adapter to frontend application
scripts/                            local runner, demo, benchmark, browser tests
```

### Module dependency graph

```mermaid
flowchart TD
    UI[React workspace + customer portal] --> REST[Express REST API]
    REST --> AUTH[M1 JWT + RBAC]
    AUTH --> CATALOG[M2 Products + variants]
    CATALOG --> PLANS[M3 Plans + flags]
    PLANS --> QUOTES[M4 Templates + quotations]
    QUOTES --> SUBS[M5 Subscription state machine]
    SUBS --> BILL[M6 Idempotent billing]
    RULES[M7 Tax + discount rules] --> BILL
    BILL --> PAY[M8 Payments + receivables]
    PAY --> REPORTS[M10 Daily summaries + reports]
    SUBS --> PORTAL[M9 Scoped customer operations]
    CRON[Local node-cron] --> BILL
    CRON --> NOTIFY[M11 Reminder job]
    BILL --> PDF[PDFKit → local disk]
    BILL --> MAIL[Mock mail → console + outbox.log]
    NOTIFY --> MAIL
    REST --> AUDIT[M11 Mutation audit]
    REST --> DB[(Local PostgreSQL / SQLite)]
    BILL --> DB
    REPORTS --> DB
    AUDIT --> DB
```

### Subscription state machine

```mermaid
stateDiagram-v2
    [*] --> Draft: direct creation
    [*] --> Quotation: atomic quote conversion
    Draft --> Confirmed: confirm
    Quotation --> Confirmed: confirm
    Confirmed --> Active: activate
    Active --> Paused: pause [allow_pause]
    Paused --> Active: resume [allow_pause]
    Active --> Active: renew [allow_renew]
    Paused --> Paused: renew [allow_renew]
    Active --> Closed: close or auto-close at expiry
    Paused --> Closed: close or auto-close at expiry
    Draft --> Closed: cancel
    Quotation --> Closed: cancel
    Confirmed --> Closed: cancel
    Closed --> Active: renew [allow_renew]
```

A direct draft can be confirmed without a separate quotation; the Quotation state is entered by quotation conversion. Cancellation is represented as Closed because the requested subscription state set has no separate Cancelled state. Closed renewal starts a fresh billing date at today. Resume skips paused time rather than charging retroactively for the pause. Early closure before expiry requires the plan flag.

### Invoice state machine

```mermaid
stateDiagram-v2
    [*] --> Draft: recurring billing
    Draft --> Confirmed: confirm + revalidate discounts
    Confirmed --> Confirmed: partial payment
    Confirmed --> Paid: total payments reach total
    Draft --> Cancelled: cancel
    Confirmed --> Cancelled: cancel only with zero payments
    Confirmed --> Confirmed: send local PDF once
    Paid --> Paid: download PDF / idempotent send
```

### Billing-day flow

```mermaid
flowchart TD
    START[Daily UTC schedule or POST billing/run] --> LOG[Create BillingRun]
    LOG --> SCAN[Cursor scan Active + next_billing_date <= today]
    SCAN --> BATCH[Read up to 100 subscriptions]
    BATCH --> TX[One transaction per due invoice]
    TX --> LOCK[Lock subscription on PostgreSQL]
    LOCK --> CHECK{Period already invoiced?}
    CHECK -- Yes --> ADVANCE[Advance date; count skipped]
    CHECK -- No --> CALC[Snapshot customer + lines; taxes then discounts]
    CALC --> INSERT[Insert invoice with unique subscription/period_start]
    INSERT --> AUDIT[Audit invoice + next billing date]
    AUDIT --> COMMIT[Commit]
    COMMIT --> DUE{Another missed period due?}
    DUE -- Yes --> TX
    DUE -- No --> NEXT[Next subscription / next batch]
    ADVANCE --> DUE
    NEXT --> SCAN
    SCAN -- Exhausted --> CLOSE[Auto-close eligible expired terms]
    CLOSE --> FINISH[Finish BillingRun with counts + per-record failures]
    FINISH --> SUMMARY[Refresh DailySummary]
    SUMMARY --> REMIND[Scheduled idempotent renewal / overdue notices]
```

Errors on one subscription are captured in `BillingRun.details` and do not abandon the remaining batch. A subscription with an uncommitted failed invoice retains its due date and is retried on a later run. A safety limit of 4,000 backfilled periods per subscription per run prevents accidental unbounded work; another run continues from the last committed date.

### ER diagram

```mermaid
erDiagram
    USERS ||--o{ SUBSCRIPTIONS : owns
    USERS ||--o{ QUOTATIONS : receives
    USERS ||--o{ INVOICES : billed
    USERS ||--o{ PAYMENTS : pays
    USERS ||--o{ REFRESH_TOKENS : authenticates
    USERS ||--o{ PASSWORD_RESETS : recovers
    PRODUCTS ||--o{ VARIANTS : offers
    PRODUCTS ||--o{ PLANS : priced_by
    PLANS ||--o{ TEMPLATES : quoted_with
    TEMPLATES ||--o{ QUOTATIONS : instantiated_as
    PLANS ||--o{ SUBSCRIPTIONS : governs
    SUBSCRIPTIONS ||--o{ INVOICES : generates
    INVOICES ||--o{ PAYMENTS : settled_by
    TAXES }o--o{ PRODUCTS : applies_to
    DISCOUNTS }o--o{ PRODUCTS : discounts
    AUDIT }o--|| USERS : actor
    USERS {
        string id PK
        string email UK
        string role
        string password_hash
    }
    SUBSCRIPTIONS {
        string id PK
        string number UK
        string customer_id FK
        string plan_id FK
        string status
        string next_billing_date
        text lines_snapshot
    }
    INVOICES {
        string id PK
        string number UK
        string subscription_id FK
        string customer_id FK
        string period_start
        string period_end
        decimal total
        decimal paid_amount
        text lines_snapshot
    }
    DAILY_SUMMARY {
        string date PK
        integer active_subscriptions
        decimal revenue
        decimal outstanding
        integer overdue_count
    }
    BILLING_RUNS {
        string id PK
        integer scanned
        integer created
        integer skipped
        integer failed
        text details
    }
```

The diagram includes logical relationships. Product scopes and immutable line snapshots use JSON text for database portability; template contents are copied into quotations, not dynamically referenced afterward. Audit actors include the system actor and therefore are not a strict user foreign key.

## 7. Correctness and security decisions

- All writes are schema-validated. Zod strips caller-supplied fields such as role, paid amount, used count, and invoice totals.
- Email addresses are normalized to lowercase and guarded by a database UNIQUE constraint. Passwords require **at least 9 characters**, uppercase, lowercase, and a special character; bcrypt cost is 12.
- Auth tokens are HS256 only with issuer/audience checks; the secret must be at least 32 characters. Password and refresh-reset secrets are never included in public user responses.
- Every record read/action checks ownership for CUSTOMER; every list injects the authenticated customer ID. The browser is never trusted for isolation.
- CORS allows only the configured local frontend origin. Authentication endpoints are rate-limited. Request bodies are bounded to 1 MB. Errors do not expose internal stack traces.
- Knex parameter binding is used throughout; there is no concatenated raw SQL. Dynamic table names come from a closed server-side set, never request input.
- Monetary totals round to two decimals. Tax is calculated on pre-discount line amount; product discounts precede subscription discounts; discounts cannot reduce the merchandise subtotal below zero. Fixed line taxes apply per unit.
- Discounts are provisional on Draft invoices and reevaluated on confirmation so an expired or exhausted discount cannot be consumed. Usage increments are conditional, transactional, and audited; racing confirmation retries with 409 rather than overspending a cap.
- Issued invoices snapshot customer and line details. Product/plan/rule deletion is a soft archive. Existing invoices remain printable.
- Invoice period uniqueness is a database constraint, not an application-only check. Monthly/yearly date arithmetic clamps to the target month's last day; periods are `[start, end)`.
- Payments reject future dates, cancelled/draft/paid invoices, nonpositive amounts, and overpayment. Partial payment cancellation is disallowed; refunds/credit notes are intentionally outside this specification.
- Notification keys are unique: one invoice-sent notice per invoice, one renewal notice per subscription/expiry, one overdue notice per invoice/recipient. This avoids repeated spam. Delivery is intentionally a local mock, not an SMTP guarantee. A process crash between recording and writing the mock log may require an operator to inspect/replay the outbox record.
- Business mutations are audited within the same transaction where feasible; notification/job records are audited separately. Credentials and password hashes are not placed in audit snapshots.
- DailySummary contains end-of-job stock measures and daily cash receipts. Active/outstanding metrics are current snapshots, not a historical accounting ledger. Payment-date revenue remains reconstructible from immutable payment records.
- One scheduler process is the intended local deployment. Database uniqueness also protects against duplicate invoices if a manual run overlaps the job. Back up the database and local PDF directory together. Access tokens remain valid until their 15-minute expiry after logout; refresh tokens are revoked immediately.

## 8. Tests and performance evidence

### Automated integration tests

`npm test`: **15 tests passed, 0 failed** on the included SQLite integration suite. Covers:

1. Password policy and case-insensitive email uniqueness.
2. Authentication and admin-only staff creation (401/403).
3. Refresh rotation and replay rejection.
4. Product/variant/plan creation, staff restrictions, plan availability.
5. Atomic conversion, duplicate conversion, expired quotation rejection.
6. Illegal subscription states, pause and resume.
7. Expired/capped discounts, tax ordering, maximum percent validation.
8. Billing twice with unchanged invoice count and BillingRun scan logs.
9. Confirmation consuming a discount once.
10. Partial payment and automatic Paid transition.
11. Cancelled/future/overpayment rejection.
12. Portal list/record/action/PDF isolation and report/audit 403s.
13. Local PDF and idempotent notification delivery.
14. Paginated date-bounded reports, summary and audit presence.
15. Reset password policy and single-use token rejection.

`npm run test:ui`: **10 browser checks passed**, covering the desktop dashboard, subscription creation and state changes, idempotent demo billing, PDF download, global search, every navigation page, customer views, 390px mobile layout, and absence of runtime errors. The script launches and closes a temporary static server itself. Screenshots are saved under `/tmp/brightloop-tests/`.

`npm run test:local-ui`: **7 additional browser checks passed against the real REST API and SQLite**, covering JWT login, subscription creation, server-enforced activation, recurring invoice creation/confirmation, payment-to-Paid transition and PDF download, authenticated catalog editing, and customer-scoped server pagination. It builds into an isolated `dist-api/`, launches both temporary servers, and closes them afterward. Results are in `scripts/local-ui-results.json`. The separate full-month walkthrough was also executed successfully end to end.

### 10,000-subscription benchmark

```bash
python3 scripts/load_test.py
```

The script seeds **10,000 real subscription rows** in a separate `backend/data/load-test.sqlite`, starts an actual local HTTP API, authenticates, warms up endpoints, and measures **50 requests per endpoint, concurrency 5, default 50-row pages**. It writes machine-readable results to `scripts/load-results.json` and asserts every p95 is below 2,000 ms. The process is terminated in a `finally` block.

Measured SQLite/WAL run on this build:

| Endpoint | p50 (ms) | p95 (ms) |
|---|---:|---:|
| `/subscriptions` | 19.87 | 25.08 |
| `/subscriptions?page=100` | 20.06 | 27.06 |
| `/subscriptions?status=Active` | 89.18 | 94.61 |
| `/invoices` | 10.62 | 12.95 |
| `/invoices/outstanding` | 7.96 | 10.56 |
| `/payments` | 6.10 | 9.82 |
| `/dashboard/summary` | 5.12 | 5.65 |
| `/reports/revenue` | 4.93 | 10.26 |
| `/reports/aging` | 3.82 | 4.25 |
| `/reports/subscriptions` | 12.86 | 17.18 |
| `/reports/invoices` | 8.04 | 11.44 |
| `/reports/payments` | 5.08 | 8.04 |
| `/audit` | 7.95 | 8.86 |

**All 13 endpoints passed; maximum measured p95: 94.61 ms.** These are measurements, not a hardware-independent performance guarantee. Re-run in your environment. This workload proves list/summary performance with 10k subscriptions, not 10k simultaneous payment writes, a 10k-due-invoice batch completion SLA, or PostgreSQL timings.

Indexes cover unique subscription/invoice numbers, `(status, next_billing_date)`, `(customer_id, status)`, subscription creation/expiry, invoice period uniqueness and `period_start`, `(status, due_date)`, `(customer_id, created_at)`, payment dates/customer dates, and audit entity/timestamps. Queries are bounded and paginated; summary jobs keep dashboard stock aggregates out of large list responses.

## 9. Problem-statement coverage map

| Requirement | Implementation / verification |
|---|---|
| Local-only stack B, API + React UI | `backend/server.mjs`, Express/Knex; `frontend/src`; `.env.example`; local runner; no cloud runtime integrations |
| PostgreSQL preferred + SQLite fallback / portable schema | `backend/db.mjs`, `docker-compose.yml`; driver selected by DATABASE_URL; tested SQLite |
| Local files, email, HS256, scheduler | `invoicePdf`, `email`, `auth.mjs`, `server.mjs`; local data directory and UTC cron |
| M1 signup/login/unique email/password hash/policy | `auth.mjs` schemas/routes; users UNIQUE email; tests 1–3 |
| M1 reset/refresh/expiry/RBAC/admin-only staff | hashed single-use reset/refresh tables; role middleware; tests 2, 3, 12, 15 |
| M2 product CRUD/types/prices/cost/notes/active/soft delete | catalog routes, `products` table, catalog manager UI; invoice snapshots preserved |
| M2 variant groups/options/delta/effective pricing | `variants`, `validatedLines`, Odoo +560 seed; variant editor and subscription selection |
| M3 all frequencies/minimum/window/flags | `planSchema`, `validatedLines`, `addPeriod`, `transition`; advanced plan editor; test 4 |
| M4 templates/product lines/validity/quotes/atomic conversion | template routes, quote snapshots, transaction + conditional status update; test 5 |
| M5 numbered subscriptions/dates/terms/lines/quantity | `newSubscription`, transactional `sequences`, `validatedLines`, subscription drawer |
| M5 state machine/plan-gated lifecycle/renewal/auto-close/history | `transition`, `runBilling`, audit endpoint; test 6 and diagrams above |
| M6 scheduled/manual batched scan/unique period/one transaction | `runBilling`, UNIQUE(subscription_id, period_start), BillingRun log; test 8 |
| M6 customer snapshot/totals/due dates/states/send/local PDF/advance | `calculate`, `confirmInvoice`, `invoicePdf`, `email`, payment transition; tests 8–13 |
| M7 tax scopes/percent/fixed/active and discount scopes/window/minimum/caps/order | rule schemas and `calculate`; transactional cap consumption; tests 7, 9 |
| M8 payment fields/methods/partial/Paid/future/cancelled/outstanding/overdue/aging | payment transaction, scoped lists, aging endpoint, payment UI; tests 10, 11 |
| M9 customer UI/API/own PDFs/self-service/server isolation | portal routes, `scope`, customer query injection, customer navigation; test 12 |
| M10 cards/collected revenue/unpaid balances/overdue/trends | dashboard summary, DailySummary, actual-payment analytics, charts |
| M10 status/customer/plan/date/method/overdue filters + pagination | API `list`, `ServerRecords.tsx`; default 50, cap 100, bounded dates |
| M10 10k subscriptions / p95 <2s / indexes / aggregated summaries | `load_test.py`, `load_seed.mjs`, `load-results.json`; all 13 endpoint p95 checks passed |
| M11 renewal/overdue/staff/invoice notices, idempotence | `reminders`, unique notification keys, local outbox; test 13 |
| M11 every business mutation audit fields old/new/actor/time | `audit` helper, transactional route/service callsites, Audit log UI; test 14 |
| Validation/parameterized queries/CORS/error semantics | Zod, Knex, local-origin CORS, error middleware; REST tests |
| Seed credentials/products/Odoo/plans/templates/mixed states/invoices/discounts/payments/overdue/summary | `backend/seed.mjs`; 12 customers, 24 subscriptions, 28 generated invoices on a fresh seed |
| Full repo/readme/API docs/diagrams/demo/tests/load script | this README, backend/frontend/scripts, `.env.example`, source archive download |

## 10. Deployment notes and limits

Use this repository locally as requested. For a self-hosted production installation, serve the built frontend from a local reverse proxy, keep the API on loopback, use your own local TLS certificate/proxy if exposing beyond localhost, update the CORS origin, rotate the demo credentials, protect `.env`, and configure local backups. The supplied development configuration is not a substitute for an independent security review.

There are no real payment-gateway charges or external emails. There are no refunds, dunning charge attempts, multi-currency conversions, proration, metered usage, or legally jurisdiction-specific tax calculations; those are outside this problem statement. The UI’s browser-only preview is deliberately separate from the authenticated local system. PostgreSQL compatibility is implemented but not empirically benchmarked in this execution environment.
