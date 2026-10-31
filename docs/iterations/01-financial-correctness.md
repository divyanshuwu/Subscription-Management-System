# Iteration 1 — Financial correctness

Date: 31 October 2026. Baseline: f228f3b7a302 (76/100). Self-assessment after this iteration: **84/100** using the original rubric. This is not an external jury certification.

## Update and reasons

1. Added transactional, versioned additive schema upgrades. Existing SQLite/PostgreSQL data is preserved; PostgreSQL upgrades take an advisory transaction lock. New subscription pause intervals and close cutoffs preserve billing history; quotes identify whether their prices were snapshotted.
2. Removed implicit rolling-year exclusion from operational lists. Date filters remain available, while long-lived products, customers, subscriptions and debts remain discoverable.
3. Quotation creation snapshots server-calculated lines. Conversion preserves those prices even if the catalog changes. Legacy quotes without reliable snapshots require an explicit re-quote rather than inventing agreed prices.
4. Invoice confirmation approves its stored tax/discount/total snapshot instead of recalculating using today's rules. Usage caps remain atomic; if a reserved-looking draft cannot consume the remaining allowance, confirmation returns 409 with an explicit revision instruction, never silently changing money.
5. Pause/resume no longer overwrites the billing cursor. Completed pause intervals identify anchored periods that should not be charged. Accrued periods before a pause or early close remain billable. Period starts during pauses are skipped with an audit event.
6. Monthly/yearly period advancement retains the original day anchor (Jan 31 → Feb 28 → Mar 31; leap-year anniversaries recover). Existing date helper remains usable for ordinary arithmetic.
7. Added Draft → Quotation action with server permission checks.
8. Excluded unissued Drafts from collectible debt and reminders. Aging defaults include all confirmed debt due by its as-of date. Dashboard summaries are refreshed on read rather than relying on a stale latest snapshot.
9. Historical revenue reports aggregate source payment rows rather than assuming all daily materializations exist.
10. Monetary inputs reject unsupported sub-cent precision and non-finite numbers; 0.001 can no longer create a zero payment. Subscription detail includes a clearly identified live pricing preview.
11. Kept visual styles/layout intact. Existing date inputs now start with an empty optional lower bound instead of silently excluding older records.

## Explicit policies

Billing is in full anchored periods, no proration. A period is billable if its start occurred before pause/close and outside a completed pause interval. A period that starts during a pause is not charged; service-period anchoring remains unchanged. Pauses do not automatically extend contract expiry. Restarting a closed subscription requires accrued billing to be settled first. These policies are documented rather than left implicit.

## Test → evaluate

- Existing supplied integration tests: **15/15 passed** after changes.
- Expanded suite: **28/28 passed** (13 new regressions), logged in `docs/evidence/iteration-1-tests.txt`.
- Production build: **passed**, logged in `docs/evidence/iteration-1-build.txt`.
- New coverage includes old active records, quote repricing, discount/tax snapshot preservation, pause/resume accrual, paused-period exclusion, early close, draft/old-debt reconciliation, sub-cent input, full lifecycle, anchor recovery, historical revenue, repeatable migration and parallel last-discount confirmation.
- No CSS, branding, typography, navigation or dashboard grid changes.

## Score impact

| Category | Baseline | Iteration 1 |
|---|---:|---:|
| Auth | 10/12 | 10/12 |
| Catalog/plans | 12/13 | 12/13 |
| Quotes/lifecycle | 9/13 | 11/13 |
| Billing/rules | 14/20 | 17/20 |
| Payments | 8/9 | 9/9 |
| Portal | 5/6 | 5/6 |
| Finance/performance | 5/7 | 6/7 |
| Architecture | 3/5 | 3/5 |
| Tests | 4/6 | 5/6 |
| Security/operations | 3/5 | 3/5 |
| UX/docs | 3/4 | 3/4 |
| **Total** | **76** | **84** |

## Remaining gaps / next loop

Actual mail adapter/retry tests, reset links, inline add-on/contract edits, searchable server selectors/global search, server-wide upcoming-renewal and overdue widgets, dependency/lint cleanup, CI, realistic mixed-ledger performance and PostgreSQL proof. Architecture is still a large modular monolith; do not inflate this score just because core tests pass.
