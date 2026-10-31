import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import bcrypt from "bcryptjs";
process.env.SQLITE_PATH = ":memory:";
process.env.DATABASE_URL = "";
process.env.JWT_SECRET =
  "test-only-brightloop-secret-at-least-thirty-two-chars";
process.env.NODE_ENV = "test";
process.env.QUIET = "1";
const { app } = await import("../app.mjs");
const { db, migrate, id, now, today, addPeriod, decode } =
  await import("../db.mjs");
const { calculate, reminders } = await import("../services.mjs");
const api = supertest(app);
let adminToken,
  staffToken,
  customerToken,
  otherToken,
  customerId,
  otherId,
  plan,
  product,
  template,
  subId,
  invoiceId;
const auth = (req, token = adminToken) =>
  req.set("Authorization", `Bearer ${token}`);
const credentials = { password: "Brightloop@2026" };
before(async () => {
  await migrate();
  const password_hash = await bcrypt.hash(credentials.password, 4);
  await db("users").insert([
    {
      id: id(),
      name: "Admin User",
      email: "admin@test.local",
      password_hash,
      role: "ADMIN",
      created_at: now(),
    },
    {
      id: id(),
      name: "Staff User",
      email: "staff@test.local",
      password_hash,
      role: "STAFF",
      created_at: now(),
    },
  ]);
  adminToken = (
    await api
      .post("/api/auth/login")
      .send({ ...credentials, email: "admin@test.local" })
  ).body.access_token;
  staffToken = (
    await api
      .post("/api/auth/login")
      .send({ ...credentials, email: "staff@test.local" })
  ).body.access_token;
  let r = await api
    .post("/api/auth/signup")
    .send({ ...credentials, name: "Customer One", email: "one@test.local" });
  customerToken = r.body.access_token;
  customerId = r.body.user.id;
  r = await api
    .post("/api/auth/signup")
    .send({ ...credentials, name: "Customer Two", email: "two@test.local" });
  otherToken = r.body.access_token;
  otherId = r.body.user.id;
});
after(async () => {
  await db.destroy();
});
test("M1: server rejects weak password; unique emails are case-insensitive", async () => {
  const r = await api
    .post("/api/auth/signup")
    .send({
      name: "Weak User",
      email: "weak@test.local",
      password: "weakpass",
    });
  assert.equal(r.status, 400);
  const duplicate = await api
    .post("/api/auth/signup")
    .send({ name: "Duplicate", email: "ONE@test.local", ...credentials });
  assert.equal(duplicate.status, 409);
});
test("M1: unauthenticated calls are 401; customer and staff cannot add staff", async () => {
  assert.equal((await api.get("/api/subscriptions")).status, 401);
  const data = { name: "New Staff", email: "new@test.local", ...credentials };
  assert.equal(
    (await auth(api.post("/api/admin/staff"), customerToken).send(data)).status,
    403,
  );
  assert.equal(
    (await auth(api.post("/api/admin/staff"), staffToken).send(data)).status,
    403,
  );
  assert.equal(
    (await auth(api.post("/api/admin/staff")).send(data)).status,
    201,
  );
});
test("M1: refresh tokens rotate and cannot be replayed", async () => {
  const login = await api
    .post("/api/auth/login")
    .send({ ...credentials, email: "one@test.local" });
  const token = login.body.refresh_token;
  assert.equal(
    (await api.post("/api/auth/refresh").send({ refresh_token: token })).status,
    200,
  );
  assert.equal(
    (await api.post("/api/auth/refresh").send({ refresh_token: token })).status,
    401,
  );
});
test("M2/M3: admin catalog CRUD, variant delta, plan availability, staff mutation 403", async () => {
  const payload = { name: "Workspace", sales_price: 100, cost_price: 20 };
  assert.equal(
    (await auth(api.post("/api/products"), staffToken).send(payload)).status,
    403,
  );
  const p = await auth(api.post("/api/products")).send(payload);
  assert.equal(p.status, 201);
  product = p.body;
  const v = await auth(api.post(`/api/products/${product.id}/variants`)).send({
    group_name: "Brand",
    option_name: "Odoo",
    price_delta: 560,
  });
  assert.equal(v.body.price_delta, 560);
  const result = await auth(api.post("/api/plans")).send({
    name: "Monthly",
    product_id: product.id,
    price: 100,
    billing_frequency: "monthly",
    flags: {
      allow_pause: true,
      allow_renew: true,
      allow_early_close: true,
      auto_close_on_end: true,
    },
  });
  assert.equal(result.status, 201);
  plan = result.body;
  template = (
    await auth(api.post("/api/templates")).send({
      name: "Onboarding",
      plan_id: plan.id,
      lines: [{ product_id: product.id, quantity: 1 }],
      validity_days: 30,
    })
  ).body;
  const expired = await auth(api.post("/api/plans")).send({
    name: "Expired",
    product_id: product.id,
    price: 100,
    billing_frequency: "monthly",
    available_to: addPeriod(today(), "daily", -1),
  });
  const sub = await auth(api.post("/api/subscriptions")).send({
    customer_id: customerId,
    plan_id: expired.body.id,
    lines: [{ product_id: product.id, quantity: 1 }],
  });
  assert.equal(sub.status, 409);
});
test("M4: quote conversion is atomic, single-use, and rejects expired quotes", async () => {
  const q = (
    await auth(api.post("/api/quotations")).send({
      template_id: template.id,
      customer_id: customerId,
    })
  ).body;
  const r = await auth(api.post(`/api/quotations/${q.id}/convert`));
  assert.equal(r.status, 201);
  subId = r.body.id;
  assert.equal(
    (await auth(api.post(`/api/quotations/${q.id}/convert`))).status,
    409,
  );
  assert.equal(
    Number((await db("subscriptions").count("* as n").first()).n),
    1,
  );
  const expired = (
    await auth(api.post("/api/quotations")).send({
      template_id: template.id,
      customer_id: customerId,
    })
  ).body;
  await db("quotations")
    .where({ id: expired.id })
    .update({ valid_until: addPeriod(today(), "daily", -1) });
  assert.equal(
    (await auth(api.post(`/api/quotations/${expired.id}/convert`))).status,
    409,
  );
});
test("M5: illegal transitions return 409; pause and resume follow state machine", async () => {
  assert.equal(
    (await auth(api.post(`/api/subscriptions/${subId}/pause`))).status,
    409,
  );
  assert.equal(
    (await auth(api.post(`/api/subscriptions/${subId}/confirm`))).status,
    200,
  );
  assert.equal(
    (await auth(api.post(`/api/subscriptions/${subId}/activate`))).status,
    200,
  );
  assert.equal(
    (await auth(api.post(`/api/subscriptions/${subId}/activate`))).status,
    409,
  );
  assert.equal(
    (
      await auth(
        api.post(`/api/portal/subscriptions/${subId}/pause`),
        customerToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await auth(
        api.post(`/api/portal/subscriptions/${subId}/resume`),
        customerToken,
      )
    ).status,
    200,
  );
});
test("M7: expired and exhausted discounts are skipped; line tax precedes discount", async () => {
  await auth(api.post("/api/taxes")).send({
    name: "Sales tax",
    type: "percent",
    value: 10,
  });
  await auth(api.post("/api/discounts")).send({
    name: "Expired discount",
    type: "percent",
    value: 99,
    end_date: addPeriod(today(), "daily", -1),
  });
  const capped = (
    await auth(api.post("/api/discounts")).send({
      name: "Capped discount",
      type: "percent",
      value: 99,
      max_uses: 1,
    })
  ).body;
  await db("discounts").where({ id: capped.id }).update({ used_count: 1 });
  const valid = (
    await auth(api.post("/api/discounts")).send({
      name: "Valid discount",
      type: "percent",
      value: 10,
      max_uses: 1,
    })
  ).body;
  const calc = await calculate(db, [
    { product_id: product.id, quantity: 1, unit_price: 100 },
  ]);
  assert.equal(calc.subtotal, 100);
  assert.equal(calc.tax_total, 10);
  assert.equal(calc.discount_total, 10);
  assert.equal(calc.total, 100);
  assert.equal(JSON.parse(calc.applied_discounts)[0].id, valid.id);
  assert.equal(
    (
      await auth(api.post("/api/discounts")).send({
        name: "Invalid",
        type: "percent",
        value: 101,
      })
    ).status,
    400,
  );
});
test("M6: billing twice never duplicates an invoice; billing run scan is logged", async () => {
  const first = await auth(api.post("/api/billing/run"));
  assert.equal(first.status, 200);
  assert.equal(first.body.created, 1);
  assert.equal(first.body.scanned, 1);
  invoiceId = (await db("invoices").first()).id;
  const count = (await db("invoices").count("* as n").first()).n;
  const second = await auth(api.post("/api/billing/run"));
  assert.equal(second.body.created, 0);
  assert.equal((await db("invoices").count("* as n").first()).n, count);
  assert.equal(Number((await db("billing_runs").count("* as n").first()).n), 2);
});
test("M6/M7: confirmation consumes a capped discount exactly once", async () => {
  assert.equal(
    (await auth(api.post(`/api/invoices/${invoiceId}/confirm`))).status,
    200,
  );
  assert.equal(
    (await auth(api.post(`/api/invoices/${invoiceId}/confirm`))).status,
    409,
  );
  const valid = await db("discounts").where({ name: "Valid discount" }).first();
  assert.equal(valid.used_count, 1);
  const calc = await calculate(db, [
    { product_id: product.id, quantity: 1, unit_price: 100 },
  ]);
  assert.equal(calc.discount_total, 0);
});
test("M8: partial payment stays Confirmed; exact balance transitions to Paid", async () => {
  const i = await db("invoices").where({ id: invoiceId }).first();
  let r = await auth(api.post("/api/payments")).send({
    invoice_id: invoiceId,
    method: "bank",
    amount: 25,
    payment_date: today(),
  });
  assert.equal(r.status, 201);
  assert.equal(
    (await db("invoices").where({ id: invoiceId }).first()).status,
    "Confirmed",
  );
  r = await auth(api.post("/api/payments")).send({
    invoice_id: invoiceId,
    method: "UPI",
    amount: Number(i.total) - 25,
    payment_date: today(),
  });
  assert.equal(r.status, 201);
  const paid = await db("invoices").where({ id: invoiceId }).first();
  assert.equal(paid.status, "Paid");
  assert.equal(Number(paid.paid_amount), Number(i.total));
});
test("M8: cancelled invoices, future payments, and overpayment are rejected", async () => {
  const original = await db("invoices").where({ id: invoiceId }).first();
  const cancelled = {
    ...original,
    id: id(),
    number: "INV-TEST-CANCEL",
    subscription_id: null,
    status: "Cancelled",
    paid_amount: 0,
  };
  await db("invoices").insert(cancelled);
  assert.equal(
    (
      await auth(api.post("/api/payments")).send({
        invoice_id: cancelled.id,
        method: "cash",
        amount: 10,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await auth(api.post("/api/payments")).send({
        invoice_id: invoiceId,
        method: "cash",
        amount: 10,
        payment_date: addPeriod(today(), "daily"),
      })
    ).status,
    400,
  );
  const unpaid = {
    ...original,
    id: id(),
    number: "INV-TEST-OVERPAY",
    subscription_id: null,
    status: "Confirmed",
    paid_amount: 0,
  };
  await db("invoices").insert(unpaid);
  assert.equal(
    (
      await auth(api.post("/api/payments")).send({
        invoice_id: unpaid.id,
        method: "cash",
        amount: Number(unpaid.total) + 1,
      })
    ).status,
    400,
  );
});
test("M9: server-side customer isolation covers lists, records, PDF and mutations", async () => {
  assert.equal(
    (await auth(api.get(`/api/subscriptions/${subId}`), otherToken)).status,
    403,
  );
  assert.equal(
    (
      await auth(
        api.post(`/api/portal/subscriptions/${subId}/pause`),
        otherToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (await auth(api.get(`/api/portal/invoices/${invoiceId}/pdf`), otherToken))
      .status,
    403,
  );
  const list = await auth(api.get("/api/portal/subscriptions"), otherToken);
  assert.equal(list.body.data.length, 0);
  assert.equal(
    (
      await auth(
        api.get(`/api/subscriptions?customer_id=${customerId}`),
        otherToken,
      )
    ).status,
    403,
  );
  assert.equal((await auth(api.get("/api/audit"), customerToken)).status, 403);
  assert.equal(
    (await auth(api.get("/api/dashboard/summary"), customerToken)).status,
    403,
  );
});
test("M6/M11: PDF is generated locally; notifications are idempotent", async () => {
  const pdf = await auth(api.get(`/api/invoices/${invoiceId}/pdf`));
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers["content-type"], /pdf/);
  const first = await auth(api.post(`/api/invoices/${invoiceId}/send`));
  const second = await auth(api.post(`/api/invoices/${invoiceId}/send`));
  assert.equal(first.body.sent, true);
  assert.equal(second.body.sent, false);
  await reminders();
  const count = (await db("notifications").count("* as n").first()).n;
  await reminders();
  assert.equal((await db("notifications").count("* as n").first()).n, count);
});
test("M10/M11: paginated date-bound reports, summaries and mutation audits", async () => {
  for (const path of [
    "/dashboard/summary",
    "/reports/aging",
    "/reports/revenue",
    "/reports/subscriptions",
    "/reports/invoices",
    "/reports/payments",
    "/audit",
  ])
    assert.equal((await auth(api.get(`/api${path}`))).status, 200, path);
  const list = await auth(api.get("/api/subscriptions?page_size=1"));
  assert.equal(list.body.page_size, 1);
  assert.ok(list.body.from);
  assert.ok(Number((await db("audit").count("* as n").first()).n) >= 15);
});
test("M1: reset tokens are expiring, single-use and password policy is enforced", async () => {
  const { createHash } = await import("node:crypto");
  const token = "a-valid-test-reset-token-at-least-32-characters";
  await db("password_resets").insert({
    id: createHash("sha256").update(token).digest("hex"),
    user_id: otherId,
    expires_at: new Date(Date.now() + 60000).toISOString(),
    used: false,
  });
  assert.equal(
    (
      await api
        .post("/api/auth/reset-password")
        .send({ token, password: "weak" })
    ).status,
    400,
  );
  assert.equal(
    (
      await api
        .post("/api/auth/reset-password")
        .send({ token, password: "FreshPassword@2026" })
    ).status,
    200,
  );
  assert.equal(
    (
      await api
        .post("/api/auth/reset-password")
        .send({ token, password: "AnotherPassword@2026" })
    ).status,
    400,
  );
});
