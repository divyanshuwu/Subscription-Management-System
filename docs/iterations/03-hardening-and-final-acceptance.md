# Iteration 3 — Quality gates, database parity and final acceptance

Date: 31 October 2026. Previous self-score 89/100. Final self-score **93/100** under the original rubric. This exceeds the user's >90 target; no further score-inflation loop is necessary. External juries may reasonably score differently.

## Update → why

### Database and billing reliability
- Executed the actual core and hardening suites on PostgreSQL 17 in isolated randomized schemas, not just SQLite. Added a runner that never drops public business tables.
- PostgreSQL exposed a real defect missed by SQLite: numeric NaN is storable in PostgreSQL. The new rollback test initially failed there even though SQLite passed. Fixed monetary normalization to reject non-finite results before any invoice insert; reruns passed on both databases.
- Added 500-due-subscription overlapping-worker tests on both drivers, explicit rollback/recovery tests, idempotent partial-payment keys and mismatch rejection.
- Payment UI sends a stable request key while retrying the same form. Reusing a key with different data returns 409 instead of silently duplicating a partial payment.
- Subscription revisions now advance for lifecycle/billing updates as well as amendments. Automatic final closure uses compare-and-set state/revision checks to avoid overwriting a concurrent renewal. Failed subscriptions are not auto-closed away from debt recovery.
- Hardened outbox claims with attempt-version and due-time comparisons, preserving retry backoff across competing workers.
- Added a genuine original-schema fixture and upgrade test. Three versioned upgrades run repeatedly without deleting existing customer/subscription/quotation data; old unpriced quotations are correctly marked for re-quote.
- Added indexes for payment/invoice lookup, invoice creation time and eligible outbox work. Aging now aggregates in SQL instead of loading every old debt into application memory.
- Corrected minimum quantity semantics: plan-seat minimum applies to the plan product, not each independent add-on.

### Build, security and maintainability
- Removed unused React Router dependency; updated Vite/ESLint/TypeScript lint ecosystem to compatible patched versions; added a documented minimatch override. Fresh full dependency audit reports **zero** known vulnerabilities.
- Removed unused imports, fixed effect synchronization/cancellation, removed optional editor-plugin suppression, expanded ESLint to backend/scripts, formatted implementation files, and enforced Node 24 in package metadata.
- Three narrow legacy dynamic-type exceptions remain (API response boundary and heterogeneous catalog/table registries); they are documented inline, not hidden by disabling lint globally. The large main component/route module still limits architecture marks.
- Demo browser builds explicitly override developer API settings, so tests remain reproducible after `.env` is configured. API browser and realistic acceptance builds likewise use their own explicit API targets.
- Added coverage thresholds (85% lines, 70% branches, 80% functions for loaded non-test backend modules), quality command and CI workflow with Node 24 + PostgreSQL + browsers + audit + acceptance tests.
- Removed original external recording/CDN/page-view/editor instrumentation from HTML. This both eliminates unnecessary network/telemetry dependencies and makes the production CSP/local performance behavior predictable.
- Added security headers, placeholder-secret rejection in production, same-origin static serving/API proxy, a non-root multi-stage Dockerfile and secret/data exclusion rules.
- Added consistent online SQLite backup utility and a direct production-mode smoke test. Documented safe restore procedure and PostgreSQL backup requirements.

### UI/UX preservation
- Neither `frontend/src/styles.css` nor `frontend/src/components/ServerRecords.css` changed: SHA-256 hashes match the evaluated original commit.
- Built the original commit and compared eight dashboard regions (sidebar, topbar, main content, stats grid, chart grid, revenue card, stat card, renewal card) at 1440px and 390px. Geometry, font/color/background values matched; no horizontal overflow.
- Repeated high-volume page navigation and screenshot inspection also exposed duplicate React sibling keys shared by the record table and catalog manager. These caused orphaned quotation tables to accumulate on Overview. Gave the components distinct stable key namespaces and added repeated-navigation assertions plus console-error capture. Final screenshot/acceptance rerun shows one correct page, not accumulated tables.
- Reporting presets now derive month/quarter/year from the current date instead of hard-coded October 2026.
- This is layout/style evidence, not a claim that every dynamic number or every screen has pixel-identical text. New functionality necessarily introduces controls, but only within the existing visual patterns.

## Test → observed results

| Gate | Final result |
|---|---|
| `npm run check` | Clean lint + production build + **39/39 SQLite tests** |
| PostgreSQL runner | **38/38** (15 core + 23 hardening); original-schema fixture test is SQLite-only |
| Coverage | **89.04% lines / 78.17% branches / 83.24% functions**, thresholds passed |
| Demo browser | **10/10 passed** |
| API-connected browser | **10/10 passed**, including custom contract edit, >100 customer search and customer amendment |
| Dependency audit | **0 findings**, all severity levels |
| Genuine original-schema upgrade | Data retained, additive defaults correct, repeatable upgrades |
| 500 due / two overlapping workers | Exactly 500 invoices; no duplicate periods or failed subscriptions, on SQLite and PostgreSQL |
| Production-mode smoke | Static app, health, auth, security headers, no recording hooks and online backup/integrity check passed |
| Visual comparison | Original CSS hashes and measured dashboard layout/styles match at both viewports |

Coverage is of loaded non-test backend modules, not 89% of every frontend/server/deployment file. The Actions workflow and Dockerfile are supplied; no hosted Actions execution or Docker-engine build is claimed. SMTP socket tests use a controlled receiver, not the user's mailbox.

## Realistic performance acceptance

`npm run test:acceptance` creates **10,000 subscriptions, 60,000 invoices and 30,000 payments** in isolated SQLite. It measures real HTTP reads (50 requests/endpoint, concurrency five), then the API-connected browser, and finally two overlapping billing jobs with 500 due subscriptions. This replaces reliance on the old subscription-only/light-finance benchmark.

Recorded ledger-run evidence (see JSON for exact values): API endpoint p95 values were below two seconds; every tested workspace page transition was below two seconds; five overview navigations/reloads also completed below two seconds. Browser readiness waits for actual fetches to finish and two rendering frames, not just a heading or an already-achieved SPA load state. Page transitions are sampled five times, so their reported nearest-rank p95 is effectively the sampled maximum, not a statistically strong internet SLA.

The initial performance attempt exposed external legacy recording requests that prevented network idle. Those hooks were removed, and acceptance reruns passed. An early script also relied on SPA `networkidle`; replaced it with explicit in-flight fetch tracking before recording final results. These were meaningful test-driven corrections, not hidden test skips.

## Evaluation impact (same weights)

| Category | Iteration 2 | Final |
|---|---:|---:|
| Auth | 11/12 | 12/12 |
| Catalog/plans | 13/13 | 13/13 |
| Quotes/lifecycle | 12/13 | 12/13 |
| Billing/rules | 18/20 | 18/20 |
| Payments | 9/9 | 9/9 |
| Portal | 6/6 | 6/6 |
| Finance/performance | 6/7 | 6/7 |
| Architecture | 3/5 | 3/5 |
| Tests | 5/6 | 6/6 |
| Security/operations | 3/5 | 4/5 |
| UX/docs | 3/4 | 4/4 |
| **Total** | **89** | **93** |

No architecture points were invented for formatting: the monolithic modules remain. No perfect performance/security score was awarded merely because local checks passed.

## Remaining recommendations (not blockers for a polished hackathon demo)

1. Move browser tokens to a reviewed HttpOnly-cookie/session design; conduct a deployment-specific penetration/security review.
2. Split the large app/route modules and replace legacy dynamic API boundaries with generated/validated typed clients.
3. Version tax/rule history for audit-grade pricing of service periods predating rule edits; current generation snapshots preserve future confirmation, but do not reconstruct arbitrary historical tax law.
4. Add formal proration, credit notes/refunds, metering and MRR/ARR only if product scope requires them; they are not explicit mandatory PS outputs.
5. Prove WAN/mobile-device and high-concurrency PostgreSQL performance, run a real provider/domain delivery test and verify PostgreSQL restore drills.
6. Container-build and execute the supplied CI workflow in the target repository/infrastructure. Keep audit/coverage/performance gates active instead of treating this score as permanent.
