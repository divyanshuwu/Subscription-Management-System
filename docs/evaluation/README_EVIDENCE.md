# Brightloop independent evaluation — evidence pack

Review date: 2026-10-31. Score: 76/100 under the explicitly defined independent rubric.
Evaluated commit: f228f3b7a3029d9563e9be8c4dcdf63a6fe39eb7.

## Deliverables

- Brightloop_Jury_Evaluation.pdf — main 12-page report.
- Brightloop_Jury_Evaluation.docx — editable report.
- Brightloop_Jury_Evaluation.md — searchable plain Markdown report.
- evidence/ — fresh executed checks, benchmark JSON, diagnostic reproductions, screenshots, audit output and PS text/hash.
- jury-probes.mjs — isolated diagnostic reproduction script.
- billing-batch.mjs — isolated overlapping-job check with 500 due subscriptions.
- render_report.py — report rendering source (optional; requires python-docx and reportlab).

The source snapshot is a separate download, Subscription-Management-System_evaluated_source.zip, created with git archive from the evaluated commit. Its original committed result files are not the fresh evaluation results: use this evidence directory for measurements made in this review.

## Repeat the review

Extract the source ZIP and this evidence ZIP into the same parent directory. The expected folders are siblings:

    parent/
      Subscription-Management-System/
      evaluation/

Use Node 24, install root repository dependencies with npm ci, and rebuild better-sqlite3 if changing Node major version. Run the supplied build/test/browser/load commands from the repository root. Browser tests require Playwright Chromium and its system libraries.

Independent script import paths are relative to their own evaluation folder. Their JSON output path is currently /home/user/evaluation/evidence; change that output path when running elsewhere. They set their own SQLite database to :memory: and do not use an existing customer database.

From the repository root:

    node ../evaluation/jury-probes.mjs
    node ../evaluation/billing-batch.mjs

Diagnostic REPRODUCED means that the reported behavior was observed, not that it meets requirements. Probes P9 (anchor policy) and P10 (historical import/missed snapshot resilience) are explicitly caveated, not scored as equivalent definite PS violations.

## Important interpretation limits

- Node20/native-database and first Chromium-library failures were environment setup issues; the supported-runtime reruns passed. The initial Node20 failure log is retained, not used as a test-failure deduction.
- Successful backend tests used Node 24 and SQLite, not PostgreSQL.
- Load timings are API response timings on a local warm SQLite database. Only subscriptions were expanded to 10k; finance ledgers remained small.
- The overlapping-job test uses in-memory SQLite's single serialized connection and is not proof of production PostgreSQL or multi-instance coordination.
- Audit counts are affected-package reports, not a confirmed count of exploitable production vulnerabilities.
- Demo browser isolation/navigation is distinct from server authorization. Real API-backed browser checks also passed.
- No application business source was modified. The checked-out repository was restored to its original committed tracked state after generated load results were copied here.
