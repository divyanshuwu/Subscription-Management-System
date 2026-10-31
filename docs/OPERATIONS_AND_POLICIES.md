# Billing policies, deployment and recovery

## Financial policies (implemented behavior)

1. **Currency/precision:** one currency (USD in the supplied UI). API monetary inputs have at most two decimal places; decimal.js rounds half-up to cents. Non-finite calculated money is rejected before database storage. This explicitly handles PostgreSQL's ability to store numeric NaN. No multi-currency or tax-jurisdiction certification is claimed.
2. **Invoice price authority:** generation snapshots customer data, lines, evaluated tax and discount results. Confirmation approves that snapshot; subsequent catalog/rule changes do not silently change it. Usage counts are consumed atomically on confirmation. If the last allowance has already been consumed, confirmation returns 409; cancel/revise the draft explicitly. Cancellation does not automatically refund a consumed promotion allowance.
3. **Quote authority:** new quotes contain server-calculated immutable unit prices and variant selections; conversion uses them. Legacy pre-upgrade quotes have no reliable price snapshot and must be re-quoted. Plan availability is checked when an offer/subscription is created/activated. Commercially accepted unit prices are preserved; ongoing plan action flags remain live administration policy.
4. **Calendar anchoring:** daily/weekly are calendar offsets; monthly/yearly keep the original contract day, clamped when necessary. A Jan 31 term returns to Mar 31 after Feb 28. Leap-year annual anniversaries recover in leap years. All billing dates/jobs use UTC.
5. **No proration:** charges are for full anchored periods. A period is earned if it starts before pause/close and outside a recorded completed pause interval. Starting a pause does not erase an already-earned period. Periods starting during a pause are skipped with an audit event. Resume never overwrites an overdue cursor. Pausing does not extend contract expiry automatically.
6. **Closing/renewal:** early close sets a billable cutoff; already accrued periods remain collectable. Failed invoice generation never auto-closes away the failed debt. Auto-closing a paused term records its remaining pause interval. A closed term with unsettled accrual must run billing before restarting. A restart uses today's new anchor. Subscription cancellation before activation is represented as Closed.
7. **Amendments:** Draft/Quotation/Confirmed line edits take effect immediately. Active/Paused line edits apply on the first future anchored billing boundary; never on already-earned or issued service. Changes may require renewing/extending a term to reach that boundary. Repeated edits replace the pending proposal, guarded by a revision. Existing unchanged product/variant unit prices are retained; new selections are priced on the server. Customers may change owned quantities/add-ons, not contract dates/payment terms. Plan minimum seats apply to the plan product, not each independent add-on.
8. **Receivables:** only Confirmed, partially/unpaid invoices are collectible. Drafts are unissued estimates and excluded from debt/overdue/reminders. Paid/Cancelled are excluded. Aging includes all Confirmed debt due up to its as-of date; optional lower bounds are explicit. Summary and operational lists do not silently hide old contracts/debt.
9. **Revenue:** cash receipts aggregate actual payment rows using payment dates. This is not GAAP/IFRS recognition, MRR or ARR. Daily summary rows are convenient current snapshots; source payments remain authoritative for historical cash reporting.
10. **Payment retries:** supply a stable `Idempotency-Key` for the same invoice/method/date/amount/note. Retrying identical data returns the original payment; changed data with that key returns 409. Keys are scoped to invoices. Recording payments does not move money; refunds and bank-feed reconciliation are not implemented.

## Email delivery and retry operation

`MAIL_TRANSPORT=local` writes a preview and marks it `logged`. Actual mailbox delivery requires `MAIL_TRANSPORT=smtp`, working credentials and a properly configured sender domain. TLS is required by default; the controlled test receiver disables it only for local tests.

State: `pending → sending → sent` or `failed → retry`; local previews terminate as `logged`. Up to five delivery attempts use backoff. A stale sending lease becomes eligible again after five minutes. The worker runs every 30 seconds, even when the daily billing scheduler is disabled. Notification keys prevent duplicate queue creation; atomic status claims prevent concurrent delivery of the same eligible row. SMTP acknowledgment-loss duplicates remain possible: delivery is at-least-once, with a stable Message-ID.

Staff operations:

- `GET /api/notifications` — delivery status, attempts, sent time and sanitized failure code.
- `POST /api/notifications/retry` — process eligible pending/failed messages (respects due time/max attempts).
- Exhausted messages require operator investigation; after fixing the provider/configuration, authorized database maintenance can reset attempts/status with an audit/change record. Do not blindly reset all messages.

Do not expose outbox logs or PDF directories through unauthenticated static paths. Protect database backups: pending reset messages necessarily contain a usable short-lived link. Hashes—not plaintext—are stored in the token lookup table. The authenticated notifications endpoint is staff-only.

## Production deployment

### Native process / reverse proxy

1. Install Node 24 and `npm ci`.
2. Set strong JWT secret, database path/URL, `PUBLIC_APP_URL`, frontend origin and SMTP credentials. Do not use seeded demo accounts with real data.
3. Build with `VITE_API_URL=/api npm run build`.
4. Back up the existing database; run one controlled migration/seed startup before additional replicas. Schema upgrades are additive/versioned; PostgreSQL upgrades use an advisory lock. Baseline table bootstrap is not a fully parallel migration orchestrator.
5. Run `NODE_ENV=production HOST=127.0.0.1 PORT=4000 node backend/server.mjs` behind a TLS reverse proxy. It serves static build + `/api` from one origin. For a container bind HOST to 0.0.0.0.
6. Store SQLite/PDF/outbox files on a durable writable volume. Prefer PostgreSQL for multi-process workloads. Coordinate scheduler leadership if running multiple instances; period uniqueness/row locks prevent duplicate invoices, but duplicated scans are wasteful.
7. Monitor `/api/health`, billing-run failures, failed/exhausted outbox rows, storage usage and backups. `/health` is process liveness, not a full readiness check of DB/SMTP.

### Container packaging

`Dockerfile` is a multi-stage Node 24 build and non-root runtime. Supply environment secrets at runtime; `.dockerignore` excludes secrets, databases and local test artifacts. Persist `/app/backend/data`. Build/run example:

```bash
docker build -t brightloop .
docker run --rm -p 4000:4000 --env-file .env -e HOST=0.0.0.0 \
  -v brightloop-data:/app/backend/data brightloop
```

The Docker build was not executed in this environment. Native production static/auth/security-header and online-backup smoke tests passed. Docker Compose currently provisions PostgreSQL; it is not a complete high-availability application deployment.

## Back up and restore

### SQLite

```bash
npm run backup -- /safe/path/brightloop-2026-10-31.sqlite
```

This uses SQLite's online backup API, not a raw copy of a live WAL database. It refuses to overwrite an existing destination. Back up PDFs separately if historical delivered files must be retained; invoices can otherwise be regenerated from snapshots.

Restore rehearsal:

1. Stop all app processes/workers and preserve the damaged/current database and WAL files for investigation.
2. Verify the backup using SQLite `PRAGMA integrity_check` and record its timestamp/checksum.
3. Restore into a new path, point `SQLITE_PATH` there, start a single instance and verify record counts, balances, invoice period uniqueness and auth before exposing traffic.
4. Never overwrite a live database. Keep a retention policy and off-host encrypted copies.

The production smoke created a consistent online backup, opened it separately, checked user data and verified `integrity_check = ok`. This is a local rehearsal, not an enterprise disaster-recovery certification.

### PostgreSQL

Use managed snapshots or a dedicated restricted backup account with `pg_dump --format=custom`, encrypt/off-host the dump, and restore into a separate test database with `pg_restore`. Validate ownership, row counts, invoice uniqueness and balances. Test PostgreSQL backup restoration in your actual deployment; it was not exercised here.

## Security boundaries and remaining work

- Customer isolation and role enforcement are server-side. Demo role switching is never an access-control boundary.
- Access/refresh tokens are still in localStorage. CSP/security headers reduce exposure, but an independent XSS review and HttpOnly-cookie/session design are recommended for production.
- There are three narrowly documented dynamic typing exceptions in legacy API/table/form boundaries. New API calls can provide a response type; a full typed-client refactor remains future work. Lint rules were not globally disabled to make a green result.
- The large application/route modules remain larger than ideal; modularizing them is preferable to introducing microservices.
- The current dependency audit has no known findings at the recorded date. This is neither a penetration test nor a permanent security guarantee. The minimatch override is compatibility-tested by the build/lint/test gates; re-evaluate when upstream ranges catch up.
- Removed original external recording/CDN/page-view/editor instrumentation from the distributable HTML. The production app no longer needs those endpoints.
- Five local browser samples per page and bounded API load tests do not prove internet/WAN SLAs, slow-device behavior, very high concurrency or production PostgreSQL latency. Keep testing against real deployment conditions.
