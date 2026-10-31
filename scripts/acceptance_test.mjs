// Real HTTP + browser measurements on a mixed 10k / 60k / 30k ledger.
import assert from "node:assert/strict";
import express from "express";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
process.env.SQLITE_PATH = ":memory:";
process.env.DATABASE_URL = "";
process.env.JWT_SECRET =
  "acceptance-only-local-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";
process.env.QUIET = "1";
process.env.MAIL_TRANSPORT = "local";
const build = spawnSync(
  "npx",
  ["vite", "build", "--outDir", "artifacts/acceptance-web"],
  { stdio: "inherit", env: { ...process.env, VITE_API_URL: "/api" } },
);
if (build.status) process.exit(build.status);
const { app } = await import("../backend/app.mjs");
const { db, id, now, today, addPeriod } = await import("../backend/db.mjs");
const { seed } = await import("../backend/seed.mjs");
const { runBilling } = await import("../backend/services.mjs");
await seed();
const customer = await db("users").where({ role: "CUSTOMER" }).first(),
  plan = await db("plans").first();
const originalCount = Number(
  (await db("subscriptions").count("* as n").first()).n,
);
console.log(
  "Seeding realistic ledger: 10,000 subscriptions, 60,000+ invoices, 30,000+ payments",
);
const stamp = now(),
  line = JSON.stringify([
    {
      product_id: plan.product_id,
      name: "Acceptance subscription",
      quantity: 1,
      unit_price: 100,
    },
  ]);
for (let n = originalCount; n < 10000; n += 100) {
  const subs = [],
    invoices = [],
    payments = [];
  for (let k = n; k < Math.min(n + 100, 10000); k++) {
    const sid = id();
    subs.push({
      id: sid,
      number: "ACCEPT-SUB-" + k,
      customer_id: customer.id,
      plan_id: plan.id,
      status: "Active",
      start_date: today(),
      expiry_date: addPeriod(today(), "yearly"),
      next_billing_date: addPeriod(today(), "monthly"),
      payment_terms: 14,
      lines: line,
      created_at: stamp,
    });
    for (let period = 0; period < 6; period++) {
      const iid = id(),
        paid = period % 2 === 0,
        dt = addPeriod(today(), "monthly", -period);
      invoices.push({
        id: iid,
        number: `ACCEPT-INV-${k}-${period}`,
        subscription_id: sid,
        customer_id: customer.id,
        period_start: dt,
        period_end: addPeriod(dt, "monthly"),
        due_date: dt,
        status: paid ? "Paid" : "Confirmed",
        lines: line,
        subtotal: 100,
        tax_total: 0,
        discount_total: 0,
        total: 100,
        paid_amount: paid ? 100 : 0,
        applied_discounts: "[]",
        created_at: stamp,
      });
      if (paid)
        payments.push({
          id: id(),
          invoice_id: iid,
          customer_id: customer.id,
          method: "bank",
          amount: 100,
          payment_date: dt,
          note: "Acceptance payment",
          recorded_by: customer.id,
          created_at: stamp,
        });
    }
  }
  await db("subscriptions").insert(subs);
  // Bound SQLite variable counts as well as SQL compound-select limits.
  for (let i = 0; i < invoices.length; i += 20)
    await db("invoices").insert(invoices.slice(i, i + 20));
  for (let i = 0; i < payments.length; i += 40)
    await db("payments").insert(payments.slice(i, i + 40));
}
// Fill the small difference caused by retaining the seed's 24 existing subscriptions.
const missingInvoices =
  60000 - Number((await db("invoices").count("* as n").first()).n);
const missingPayments =
  30000 - Number((await db("payments").count("* as n").first()).n);
const sampleSub = await db("subscriptions").first();
for (let i = 0; i < missingInvoices; i++) {
  const iid = id(),
    dt = addPeriod(today(), "daily", -1000 - i),
    paid = i < missingPayments;
  await db("invoices").insert({
    id: iid,
    number: "ACCEPT-FILL-" + i,
    subscription_id: sampleSub.id,
    customer_id: sampleSub.customer_id,
    period_start: dt,
    period_end: addPeriod(dt, "monthly"),
    due_date: dt,
    status: paid ? "Paid" : "Confirmed",
    lines: line,
    subtotal: 100,
    tax_total: 0,
    discount_total: 0,
    total: 100,
    paid_amount: paid ? 100 : 0,
    applied_discounts: "[]",
    created_at: stamp,
  });
  if (paid)
    await db("payments").insert({
      id: id(),
      invoice_id: iid,
      customer_id: sampleSub.customer_id,
      method: "bank",
      amount: 100,
      payment_date: dt,
      note: "Historical acceptance payment",
      recorded_by: customer.id,
      created_at: stamp,
    });
}
const counts = {};
for (const t of ["subscriptions", "invoices", "payments"])
  counts[t] = Number((await db(t).count("* as n").first()).n);
const root = path.resolve("artifacts/acceptance-web");
app.use(express.static(root));
app.get("/", (req, res) => res.sendFile(path.join(root, "index.html")));
const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const p95 = (values) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const results = {
  dataset: counts,
  environment:
    "Node 24, SQLite memory, headless Chromium, local same-origin HTTP",
  api: [],
  pages: [],
  billing: null,
  errors: [],
};
try {
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@brightloop.local",
      password: "Brightloop@2026",
    }),
  }).then((r) => r.json());
  assert.ok(login.access_token);
  for (const endpoint of [
    "/subscriptions",
    "/invoices",
    "/invoices/outstanding",
    "/payments",
    "/dashboard/summary",
    "/reports/aging",
    "/analytics/revenue",
    "/search?search=ACCEPT",
  ]) {
    const timings = [];
    for (let batch = 0; batch < 10; batch++)
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          const start = performance.now();
          const response = await fetch(base + "/api" + endpoint, {
            headers: { Authorization: "Bearer " + login.access_token },
          });
          assert.equal(response.status, 200);
          await response.json();
          timings.push(performance.now() - start);
        }),
      );
    const result = {
      endpoint,
      requests: 50,
      concurrency: 5,
      p95_ms: Math.round(p95(timings)),
      max_ms: Math.round(Math.max(...timings)),
    };
    results.api.push(result);
    console.log("API", result);
    assert.ok(result.p95_ms < 2000);
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1060 },
  });
  await page.addInitScript(() => {
    window.__brightloopPending = 0;
    window.__brightloopLastRequest = performance.now();
    const original = window.fetch;
    window.fetch = async (...args) => {
      window.__brightloopPending++;
      try {
        return await original(...args);
      } finally {
        window.__brightloopPending--;
        window.__brightloopLastRequest = performance.now();
      }
    };
  });
  const ready = async () => {
    await page.waitForFunction(
      () =>
        window.__brightloopPending === 0 &&
        performance.now() - window.__brightloopLastRequest > 100,
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  };
  page.on("pageerror", (e) => results.errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") results.errors.push(message.text());
  });
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await page.goto(base);
    if (i === 0)
      await page
        .getByRole("button", { name: "Sign in to Brightloop", exact: true })
        .click();
    await page
      .getByRole("heading", { name: "Business, at a glance." })
      .waitFor();
    await ready();
    results.pages.push({
      page: "Overview cold navigation/reload " + (i + 1),
      elapsed_ms: Math.round(performance.now() - start),
    });
  }
  for (const name of [
    "Subscriptions",
    "Invoices",
    "Payments",
    "Customers",
    "Products & plans",
    "Quotations",
    "Taxes & discounts",
    "Reports",
    "Audit log",
    "Settings",
  ]) {
    const timings = [];
    for (let i = 0; i < 5; i++) {
      await page.locator(".nav-item").filter({ hasText: "Overview" }).click();
      await ready();
      assert.equal(
        await page.locator(".server-records").count(),
        0,
        "Previous page table leaked into overview",
      );
      const start = performance.now();
      await page.locator(".nav-item").filter({ hasText: name }).click();
      if (
        [
          "Subscriptions",
          "Invoices",
          "Payments",
          "Customers",
          "Quotations",
          "Audit log",
        ].includes(name)
      )
        await page.locator(".server-records tbody tr").first().waitFor();
      await ready();
      timings.push(performance.now() - start);
      if (
        [
          "Subscriptions",
          "Invoices",
          "Payments",
          "Customers",
          "Quotations",
          "Audit log",
        ].includes(name)
      )
        assert.equal(
          await page.locator(".server-records").count(),
          1,
          "Duplicate/orphaned table",
        );
    }
    const result = {
      page: name,
      samples: 5,
      p95_ms: Math.round(p95(timings)),
      max_ms: Math.round(Math.max(...timings)),
    };
    results.pages.push(result);
    console.log("PAGE", result);
    assert.ok(result.p95_ms < 2000, `${name} exceeds two seconds`);
  }
  // Full-page same-origin screenshot of the API-connected, high-volume workspace.
  await page.locator(".nav-item").filter({ hasText: "Overview" }).click();
  await ready();
  await page.screenshot({
    path: "docs/evidence/final-api-desktop.png",
    fullPage: true,
  });
  const dueIds = (
    await db("subscriptions")
      .where("number", "like", "ACCEPT-SUB-%")
      .limit(500)
      .select("id")
  ).map((s) => s.id);
  await db("subscriptions")
    .whereIn("id", dueIds)
    .update({ next_billing_date: today() });
  // Remove only the fixture's current-period invoices for the due subset, retaining old history.
  const existing = (
    await db("invoices")
      .whereIn("subscription_id", dueIds)
      .where({ period_start: today() })
      .select("id")
  ).map((i) => i.id);
  await db("payments").whereIn("invoice_id", existing).delete();
  await db("invoices").whereIn("id", existing).delete();
  const before = Number((await db("invoices").count("* as n").first()).n),
    start = performance.now();
  const runs = await Promise.all([
    runBilling("acceptance-A"),
    runBilling("acceptance-B"),
  ]);
  const after = Number((await db("invoices").count("* as n").first()).n);
  assert.equal(after - before, 500);
  assert.equal(
    runs.reduce((a, b) => a + b.failed, 0),
    0,
  );
  results.billing = {
    due_subscriptions: 500,
    overlapping_runs: 2,
    created: after - before,
    failed: 0,
    elapsed_ms: Math.round(performance.now() - start),
  };
  assert.deepEqual(results.errors, []);
} finally {
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/iteration-3-acceptance.json",
    JSON.stringify(results, null, 2),
  );
  await browser.close();
  await new Promise((r) => server.close(r));
  await db.destroy();
}
