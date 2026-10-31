# Iteration 2 — Complete workflows and real delivery

Date: 31 October 2026. Previous self-score 84/100. New self-score **89/100**, same original rubric. Remains below the requested >90 threshold, so another hardening/evaluation loop follows.

## What changed, and why

### Mail and recovery
- Replaced the local-only email helper with a durable mail adapter. `MAIL_TRANSPORT=local` explicitly produces development previews; `MAIL_TRANSPORT=smtp` sends via configurable SMTP, with TLS required by default, optional authentication, timeouts and invoice PDF attachments.
- Reset messages now contain clickable fragment-based reset links. The existing login form recognizes the link, pre-fills the token and clears it from the browser URL. Fragments do not reach the HTTP access log.
- Notification rows now persist pending/sending/sent/logged/failed state, attempts, retry time, delivery lease and sanitized failure code. A 30-second worker retries eligible messages up to five attempts; staff may invoke the retry endpoint. Old legacy messages are marked logged, not accidentally replayed.
- Delivery claims prevent simultaneous workers from sending the same pending row concurrently. Expired leases recover after process death. SMTP is explicitly at-least-once: lost acknowledgments can still cause duplicates; deterministic Message-ID supports downstream deduplication. No false exactly-once claim.
- Logout and password reset now invalidate already-issued access tokens immediately using a server-checked session version, in addition to revoking refresh tokens. Client refresh requests share one in-flight rotation to avoid replay races.

### Subscription management
- Added role/ownership-protected subscription amendments, including staff contract expiry/payment-term edits and customer quantity/add-on management.
- Draft/Quotation/Confirmed edits apply immediately; active/paused line changes are scheduled for the first future anchored billing boundary. Old invoice snapshots and already-accrued periods remain unchanged. Unchanged lines retain their agreed unit prices; new products/variant selections use server prices.
- Revisions reject stale concurrent edits with HTTP 409. Customer requests cannot alter staff-controlled payment terms or expiry. Closed subscriptions must be renewed first.
- Added a customer-safe searchable add-on catalog that does not expose cost prices/notes.
- Added the existing-design subscription editor modal, optional custom expiry during creation, tax preview, scheduled-change note and Prepare quotation action. No stylesheet, navigation, typography or dashboard grid redesign.

### Scaling and consistency
- Server-backed customer/plan selection removes the first-100 cached-options limitation. Existing forms/native inputs/selects retain their current style.
- Added customer-scoped server global search and upcoming-renewal queries. Overdue amounts/counts now use server-wide aggregates, not a partially loaded invoice page.
- Removed misleading API quotation form choices: the selected template determines plan/lines/validity. API period defaults use the actual current date rather than a hard-coded demo month.
- Introduced decimal rounding via decimal.js and CSV formula neutralization.

## Test results

- Expanded backend suite: **33/33 pass**, including real SMTP socket delivery to a controlled test receiver, reset links, PDF MIME attachment, failed-transport retry, concurrent claim, amendment timing/price preservation, stale revisions, portal ownership/field restrictions, server search and immediate access-token revocation.
- API-connected browser suite expanded from 7 to **10/10 pass**: contract editor round-trip, searchable customer outside the first 100, and customer self-service quantity changes without staff-only controls.
- Production build: **pass**.
- Logs: `docs/evidence/iteration-2-tests.txt`, `iteration-2-local-ui.txt`, `iteration-2-build.txt`.
- During the update/test loop the new migration-count assertion needed updating from one to two versions, a nested JSX expression was corrected, the SMTP test decoded quoted-printable soft line wraps before checking a URL, and the picker test was corrected to wait for an attached native option rather than visibility. Final reruns passed; these intermediate failures are not hidden.

## Evaluation impact

| Category | Iteration 1 | Iteration 2 |
|---|---:|---:|
| Auth | 10/12 | 11/12 |
| Catalog/plans | 12/13 | 13/13 |
| Quotes/lifecycle | 11/13 | 12/13 |
| Billing/rules | 17/20 | 18/20 |
| Payments | 9/9 | 9/9 |
| Portal | 5/6 | 6/6 |
| Finance/performance | 6/7 | 6/7 |
| Architecture | 3/5 | 3/5 |
| Tests | 5/6 | 5/6 |
| Security/operations | 3/5 | 3/5 |
| UX/docs | 3/4 | 3/4 |
| **Total** | **84** | **89** |

SMTP implementation was verified against a controlled receiver, not the user's personal/provider mailbox. External deliverability, domain SPF/DKIM and credentials are deployment configuration, not assumed verified. Outstanding third-loop work: clean lint/quality gates and dependencies, PostgreSQL concurrency, realistic mixed-ledger and browser timing, visual layout regression, deployment/backup guidance and final acceptance mapping.
