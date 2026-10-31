import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  db,
  id,
  now,
  today,
  addPeriod,
  decode,
  round,
  number,
  audit,
} from "./db.mjs";
import { authRoutes, auth, staff, admin, scope, fail } from "./auth.mjs";
import {
  runBilling,
  confirmInvoice,
  invoicePdf,
  email,
  refreshSummary,
  reminders,
} from "./services.mjs";
export const app = express();
app.disable("x-powered-by");
app.use(
  cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }),
);
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "Brightloop local API" }),
);
authRoutes(
  app,
  rateLimit({
    windowMs: 60000,
    limit: process.env.NODE_ENV === "test" ? 10000 : 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use("/api", auth);
const uuid = z.string().uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const money = z.coerce.number().min(0).max(100000000);
const flags = z.object({
  auto_close_on_end: z.boolean().default(true),
  allow_early_close: z.boolean().default(true),
  allow_pause: z.boolean().default(true),
  allow_renew: z.boolean().default(true),
});
const lineSchema = z.object({
  product_id: uuid,
  variant_ids: z.array(uuid).max(20).default([]),
  quantity: z.coerce.number().int().min(1).max(100000),
  unit_price: money.optional(),
});
const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.string().max(50).default("Software"),
  sales_price: money,
  cost_price: money.default(0),
  notes: z.string().max(5000).default(""),
  active: z.boolean().default(true),
});
const planSchema = z.object({
  name: z.string().min(2).max(120),
  product_id: uuid,
  price: money,
  billing_frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  min_quantity: z.coerce.number().int().min(1).default(1),
  available_from: date.nullable().optional(),
  available_to: date.nullable().optional(),
  flags: flags.default({
    auto_close_on_end: true,
    allow_early_close: true,
    allow_pause: true,
    allow_renew: true,
  }),
  active: z.boolean().default(true),
});
const taxSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(["percent", "fixed"]),
  value: money,
  product_ids: z.array(uuid).nullable().default(null),
  active: z.boolean().default(true),
});
const discountSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(["percent", "fixed"]),
  value: money,
  min_amount: money.default(0),
  min_quantity: z.coerce.number().int().min(1).default(1),
  start_date: date.nullable().optional(),
  end_date: date.nullable().optional(),
  max_uses: z.coerce.number().int().min(1).nullable().optional(),
  scope: z.enum(["products", "subscription"]).default("subscription"),
  product_ids: z.array(uuid).nullable().default(null),
  active: z.boolean().default(true),
});
const templateSchema = z.object({
  name: z.string().min(2).max(100),
  plan_id: uuid,
  lines: z.array(lineSchema).min(1).max(100),
  validity_days: z.coerce.number().int().min(1).max(365).default(30),
});
function encode(row) {
  const out = { ...row };
  for (const key of ["flags", "product_ids", "lines"])
    if (out[key] != null) out[key] = JSON.stringify(out[key]);
  return out;
}
function bounds(query) {
  return {
    from: query.from
      ? date.parse(query.from)
      : addPeriod(today(), "yearly", -1),
    to: query.to ? date.parse(query.to) : today(),
  };
}
async function list(req, table, options = {}) {
  const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.page_size) || 50));
  const q = db(table);
  if (["subscriptions", "invoices", "payments", "quotations"].includes(table)) {
    if (req.user.role === "CUSTOMER") {
      if (req.query.customer_id && req.query.customer_id !== req.user.sub)
        fail(403, "Cannot access another customer");
      q.where("customer_id", req.user.sub);
    } else if (req.query.customer_id)
      q.where("customer_id", uuid.parse(req.query.customer_id));
  }
  const { from, to } = bounds(req.query);
  if (from > to) fail(400, "Start date must not be after end date");
  if (table === "payments") q.whereBetween("payment_date", [from, to]);
  else
    q.where("created_at", ">=", `${from}T00:00:00`).where(
      "created_at",
      "<=",
      `${to}T23:59:59.999Z`,
    );
  if (
    req.query.status &&
    ["subscriptions", "invoices", "quotations"].includes(table)
  )
    q.where("status", String(req.query.status));
  if (req.query.plan_id && table === "subscriptions")
    q.where("plan_id", uuid.parse(req.query.plan_id));
  if (req.query.method && table === "payments")
    q.where("method", String(req.query.method));
  if ((req.query.overdue === "true" || options.overdue) && table === "invoices")
    q.whereNotIn("status", ["Paid", "Cancelled"]).where(
      "due_date",
      "<",
      today(),
    );
  if (
    options.outstanding ||
    (table === "invoices" && req.query.outstanding === "true")
  )
    q.whereNotIn("status", ["Paid", "Cancelled"]);
  if (req.query.entity_id && table === "audit")
    q.where("entity_id", String(req.query.entity_id));
  if (req.query.search) {
    const term = `%${String(req.query.search).slice(0, 100)}%`;
    if (["subscriptions", "invoices", "quotations", "payments"].includes(table))
      q.where(function () {
        this.where(
          table === "payments" ? "note" : "number",
          "like",
          term,
        ).orWhereIn(
          "customer_id",
          db("users")
            .select("id")
            .where("name", "like", term)
            .orWhere("company", "like", term)
            .orWhere("email", "like", term),
        );
      });
    else if (table === "users")
      q.where(function () {
        this.where("name", "like", term)
          .orWhere("company", "like", term)
          .orWhere("email", "like", term);
      });
    else if (table === "audit")
      q.where(function () {
        this.where("action", "like", term)
          .orWhere("entity_type", "like", term)
          .orWhere("actor", "like", term);
      });
    else if (
      ["products", "plans", "templates", "taxes", "discounts"].includes(table)
    )
      q.where("name", "like", term);
  }
  if (options.role) q.where("role", options.role);
  if (options.roles) q.whereIn("role", options.roles);
  const [{ total }, rows] = await Promise.all([
    q.clone().count("* as total").first(),
    q
      .clone()
      .orderBy("created_at", "desc")
      .offset((page - 1) * limit)
      .limit(limit),
  ]);
  const data = rows.map(decode);
  if (table === "products" && data.length) {
    const variants = (
      await db("variants").whereIn(
        "product_id",
        data.map((p) => p.id),
      )
    ).map(decode);
    for (const product of data)
      product.variants = variants.filter((v) => v.product_id === product.id);
  }
  if (
    ["subscriptions", "invoices", "payments", "quotations"].includes(table) &&
    data.length
  ) {
    const users = await db("users")
      .whereIn("id", [...new Set(data.map((r) => r.customer_id))])
      .select("id", "name", "email", "company");
    const plans =
      table === "subscriptions"
        ? await db("plans").whereIn("id", [
            ...new Set(data.map((r) => r.plan_id)),
          ])
        : [];
    for (const r of data) {
      r.customer = users.find((u) => u.id === r.customer_id);
      if (table === "subscriptions")
        r.plan = decode(plans.find((p) => p.id === r.plan_id));
    }
  }
  if (table === "users") for (const r of data) delete r.password_hash;
  return { data, total: Number(total), page, page_size: limit, from, to };
}
async function validateRelations(table, row) {
  if (table === "plans") {
    if (
      !(await db("products")
        .where({ id: row.product_id, active: true })
        .first())
    )
      fail(400, "Select an active product");
    if (
      row.available_from &&
      row.available_to &&
      row.available_from > row.available_to
    )
      fail(400, "Availability end must follow start");
  }
  if (["taxes", "discounts"].includes(table)) {
    if (row.type === "percent" && row.value > 100)
      fail(400, "Percentage must be at most 100");
    if (row.start_date && row.end_date && row.start_date > row.end_date)
      fail(400, "End must follow start");
    if (
      row.product_ids?.length &&
      Number(
        (
          await db("products")
            .whereIn("id", row.product_ids)
            .count("* as n")
            .first()
        ).n,
      ) !== new Set(row.product_ids).size
    )
      fail(400, "Invalid product selection");
  }
  if (table === "templates") await validatedLines(db, row.plan_id, row.lines);
}
for (const [table, schema, permission] of [
  ["products", productSchema, admin],
  ["plans", planSchema, admin],
  ["taxes", taxSchema, admin],
  ["discounts", discountSchema, admin],
  ["templates", templateSchema, staff],
]) {
  app.get(`/api/${table}`, staff, async (req, res) =>
    res.json(await list(req, table)),
  );
  app.get(`/api/${table}/:id`, staff, async (req, res) => {
    const row = decode(
      await db(table)
        .where({ id: uuid.parse(req.params.id) })
        .first(),
    );
    if (!row) fail(404, "Record not found");
    if (table === "products")
      row.variants = await db("variants").where({ product_id: row.id });
    res.json(row);
  });
  app.post(`/api/${table}`, permission, async (req, res) => {
    const parsed = schema.parse(req.body);
    await validateRelations(table, parsed);
    const row = { ...encode(parsed), id: id(), created_at: now() };
    await db.transaction(async (trx) => {
      await trx(table).insert(row);
      await audit(trx, table, row.id, req.user.sub, "created", null, row);
    });
    res.status(201).json(decode(row));
  });
  app.put(`/api/${table}/:id`, permission, async (req, res) => {
    const old = await db(table)
      .where({ id: uuid.parse(req.params.id) })
      .first();
    if (!old) fail(404, "Record not found");
    const parsed = schema.parse({ ...decode(old), ...req.body });
    await validateRelations(table, parsed);
    const update = encode(parsed);
    await db.transaction(async (trx) => {
      await trx(table).where({ id: old.id }).update(update);
      await audit(trx, table, old.id, req.user.sub, "updated", old, update);
    });
    res.json(decode({ ...old, ...update }));
  });
  app.delete(`/api/${table}/:id`, permission, async (req, res) => {
    const row = await db(table)
      .where({ id: uuid.parse(req.params.id) })
      .first();
    if (!row) fail(404, "Record not found");
    await db.transaction(async (trx) => {
      if (table === "templates")
        await trx(table).where({ id: row.id }).delete();
      else await trx(table).where({ id: row.id }).update({ active: false });
      await audit(trx, table, row.id, req.user.sub, "archived", row, {
        active: false,
      });
    });
    res.json({ message: "Archived successfully" });
  });
}
const variantSchema = z.object({
  group_name: z.string().min(1).max(80),
  option_name: z.string().min(1).max(80),
  price_delta: z.coerce.number().min(-1000000).max(1000000),
});
app.get("/api/products/:id/variants", staff, async (req, res) =>
  res.json({
    data: await db("variants").where({ product_id: uuid.parse(req.params.id) }),
  }),
);
app.post("/api/products/:id/variants", admin, async (req, res) => {
  const row = {
    ...variantSchema.parse(req.body),
    product_id: uuid.parse(req.params.id),
    id: id(),
    created_at: now(),
  };
  if (!(await db("products").where({ id: row.product_id }).first()))
    fail(404, "Product not found");
  await db.transaction(async (trx) => {
    await trx("variants").insert(row);
    await audit(trx, "variant", row.id, req.user.sub, "created", null, row);
  });
  res.status(201).json(row);
});
for (const method of ["put", "delete"])
  app[method](
    "/api/products/:id/variants/:variantId",
    admin,
    async (req, res) => {
      const old = await db("variants")
        .where({
          id: uuid.parse(req.params.variantId),
          product_id: uuid.parse(req.params.id),
        })
        .first();
      if (!old) fail(404, "Variant not found");
      const data = method === "put" ? variantSchema.parse(req.body) : null;
      await db.transaction(async (trx) => {
        if (data) await trx("variants").where({ id: old.id }).update(data);
        else await trx("variants").where({ id: old.id }).delete();
        await audit(
          trx,
          "variant",
          old.id,
          req.user.sub,
          method === "put" ? "updated" : "deleted",
          old,
          data,
        );
      });
      res.json(data ? { ...old, ...data } : { message: "Variant deleted" });
    },
  );
app.get("/api/customers", staff, async (req, res) =>
  res.json(await list(req, "users", { role: "CUSTOMER" })),
);
app.get("/api/team", admin, async (req, res) => {
  const result = await list(req, "users", { roles: ["ADMIN", "STAFF"] });
  res.json(result);
});
async function validatedLines(trx, planId, raw, requireAvailable = true) {
  const plan = decode(await trx("plans").where({ id: planId }).first());
  if (!plan) fail(400, "Plan not found");
  if (
    requireAvailable &&
    (!plan.active ||
      (plan.available_from && plan.available_from > today()) ||
      (plan.available_to && plan.available_to < today()))
  )
    fail(409, "Plan is outside its availability window");
  const lines = [];
  for (const line of raw) {
    if (line.quantity < plan.min_quantity)
      fail(400, `Minimum quantity is ${plan.min_quantity}`);
    const product = await trx("products")
      .where({ id: line.product_id, active: true })
      .first();
    if (!product) fail(400, "Product is inactive or missing");
    const variants = line.variant_ids?.length
      ? await trx("variants")
          .where({ product_id: product.id })
          .whereIn("id", line.variant_ids)
      : [];
    if (
      variants.length !== (line.variant_ids?.length || 0) ||
      new Set(variants.map((v) => v.group_name)).size !== variants.length
    )
      fail(400, "Choose at most one valid option per variant group");
    const unit_price = round(
      Number(
        product.id === plan.product_id ? plan.price : product.sales_price,
      ) + variants.reduce((s, v) => s + Number(v.price_delta), 0),
    );
    if (unit_price < 0) fail(400, "Effective price cannot be negative");
    lines.push({
      product_id: product.id,
      name: product.name,
      variant_ids: variants.map((v) => v.id),
      variants: variants.map((v) => `${v.group_name}: ${v.option_name}`),
      quantity: line.quantity,
      unit_price,
    });
  }
  if (!lines.some((l) => l.product_id === plan.product_id))
    fail(400, "Lines must include the plan product");
  return { plan, lines };
}
async function newSubscription(trx, input, actor, initial = "Draft") {
  const customer = await trx("users")
    .where({ id: input.customer_id, role: "CUSTOMER" })
    .first();
  if (!customer) fail(400, "Select a customer account");
  const { plan, lines } = await validatedLines(trx, input.plan_id, input.lines);
  const start = input.start_date || today();
  const expiry = input.expiry_date || addPeriod(start, plan.billing_frequency);
  if (expiry <= start) fail(400, "Expiry must be after start date");
  const row = {
    id: id(),
    number: await number(trx, "SUB"),
    customer_id: input.customer_id,
    plan_id: input.plan_id,
    status: initial,
    start_date: start,
    expiry_date: expiry,
    next_billing_date: start,
    payment_terms: input.payment_terms ?? 14,
    lines: JSON.stringify(lines),
    created_at: now(),
  };
  await trx("subscriptions").insert(row);
  await audit(trx, "subscription", row.id, actor, "created", null, row);
  return decode(row);
}
const subSchema = z.object({
  customer_id: uuid,
  plan_id: uuid,
  start_date: date.default(today),
  expiry_date: date.optional(),
  payment_terms: z.coerce.number().int().min(0).max(365).default(14),
  lines: z.array(lineSchema).min(1).max(100),
});
app.post("/api/subscriptions", staff, async (req, res) =>
  res
    .status(201)
    .json(
      await db.transaction((trx) =>
        newSubscription(trx, subSchema.parse(req.body), req.user.sub),
      ),
    ),
);
app.get("/api/subscriptions", async (req, res) =>
  res.json(await list(req, "subscriptions")),
);
app.get("/api/subscriptions/:id", async (req, res) => {
  const row = scope(
    req,
    decode(
      await db("subscriptions")
        .where({ id: uuid.parse(req.params.id) })
        .first(),
    ),
  );
  row.history = (
    await db("audit").where({ entity_id: row.id }).orderBy("created_at")
  ).map(decode);
  res.json(row);
});
app.post("/api/quotations", staff, async (req, res) => {
  const input = z
    .object({ template_id: uuid, customer_id: uuid })
    .parse(req.body);
  const template = decode(
    await db("templates").where({ id: input.template_id }).first(),
  );
  if (!template) fail(404, "Template not found");
  if (
    !(await db("users")
      .where({ id: input.customer_id, role: "CUSTOMER" })
      .first())
  )
    fail(400, "Customer not found");
  await validatedLines(db, template.plan_id, template.lines);
  const row = await db.transaction(async (trx) => {
    const value = {
      id: id(),
      number: await number(trx, "QUO"),
      customer_id: input.customer_id,
      plan_id: template.plan_id,
      lines: JSON.stringify(template.lines),
      valid_until: addPeriod(today(), "daily", template.validity_days),
      status: "Quotation",
      created_at: now(),
    };
    await trx("quotations").insert(value);
    await audit(
      trx,
      "quotation",
      value.id,
      req.user.sub,
      "created",
      null,
      value,
    );
    return value;
  });
  res.status(201).json(decode(row));
});
app.get("/api/quotations", staff, async (req, res) =>
  res.json(await list(req, "quotations")),
);
app.post("/api/quotations/:id/convert", staff, async (req, res) => {
  const row = await db.transaction(async (trx) => {
    let q = trx("quotations").where({ id: uuid.parse(req.params.id) });
    if (process.env.DATABASE_URL) q = q.forUpdate();
    const quote = decode(await q.first());
    if (!quote) fail(404, "Quotation not found");
    if (quote.status !== "Quotation")
      fail(409, "Quotation is already converted");
    if (quote.valid_until < today())
      fail(409, "Expired quotations cannot be converted");
    const sub = await newSubscription(
      trx,
      { ...quote, start_date: today() },
      req.user.sub,
      "Quotation",
    );
    const changed = await trx("quotations")
      .where({ id: quote.id, status: "Quotation" })
      .update({ status: "Converted", subscription_id: sub.id });
    if (!changed) fail(409, "Quotation already converted");
    await audit(trx, "quotation", quote.id, req.user.sub, "converted", quote, {
      subscription_id: sub.id,
    });
    return sub;
  });
  res.status(201).json(row);
});
async function transition(req, res) {
  const action = req.params.action;
  const result = await db.transaction(async (trx) => {
    let q = trx("subscriptions").where({ id: uuid.parse(req.params.id) });
    if (process.env.DATABASE_URL) q = q.forUpdate();
    const s = scope(req, decode(await q.first()));
    const plan = decode(await trx("plans").where({ id: s.plan_id }).first());
    const allowed = {
      confirm: ["Draft", "Quotation"],
      activate: ["Confirmed"],
      pause: ["Active"],
      resume: ["Paused"],
      renew: ["Active", "Paused", "Closed"],
      close: ["Active", "Paused"],
      cancel: ["Draft", "Quotation", "Confirmed"],
    };
    if (!allowed[action]) fail(404, "Unknown action");
    if (
      req.user.role === "CUSTOMER" &&
      !["pause", "resume", "renew", "close"].includes(action)
    )
      fail(403, "Action restricted to staff");
    if (!allowed[action].includes(s.status))
      fail(409, `Cannot ${action} a ${s.status} subscription`);
    const flag = {
      pause: "allow_pause",
      resume: "allow_pause",
      renew: "allow_renew",
      close: "allow_early_close",
    }[action];
    if (
      flag &&
      !plan.flags[flag] &&
      !(action === "close" && s.expiry_date <= today())
    )
      fail(409, "This plan does not allow this action");
    if (["confirm", "activate"].includes(action))
      await validatedLines(trx, plan.id, s.lines);
    const status = {
      confirm: "Confirmed",
      activate: "Active",
      pause: "Paused",
      resume: "Active",
      renew: s.status === "Closed" ? "Active" : s.status,
      close: "Closed",
      cancel: "Closed",
    }[action];
    const update = { status };
    if (action === "renew") {
      update.expiry_date = addPeriod(
        s.expiry_date > today() ? s.expiry_date : today(),
        plan.billing_frequency,
      );
      if (s.status === "Closed") update.next_billing_date = today();
    }
    if (action === "resume" && s.next_billing_date < today())
      update.next_billing_date = today();
    if (action === "activate" && s.expiry_date <= today())
      fail(409, "Renew the term before activation");
    await trx("subscriptions").where({ id: s.id }).update(update);
    await audit(trx, "subscription", s.id, req.user.sub, action, s, update);
    return { ...s, ...update };
  });
  await refreshSummary();
  res.json(result);
}
app.post("/api/subscriptions/:id/:action", transition);
app.post("/api/billing/run", staff, async (req, res) =>
  res.json(await runBilling(req.user.sub)),
);
app.get("/api/billing/runs", staff, async (req, res) =>
  res.json(await list(req, "billing_runs")),
);
app.get("/api/invoices/outstanding", async (req, res) =>
  res.json(await list(req, "invoices", { outstanding: true })),
);
app.get("/api/invoices", async (req, res) =>
  res.json(await list(req, "invoices")),
);
app.get("/api/invoices/:id/pdf", async (req, res) => {
  const invoice = scope(
    req,
    await db("invoices")
      .where({ id: uuid.parse(req.params.id) })
      .first(),
  );
  res.download(await invoicePdf(invoice), `${invoice.number}.pdf`);
});
app.get("/api/invoices/:id", async (req, res) =>
  res.json(
    scope(
      req,
      decode(
        await db("invoices")
          .where({ id: uuid.parse(req.params.id) })
          .first(),
      ),
    ),
  ),
);
app.post("/api/invoices/:id/:action", staff, async (req, res) => {
  const invoice = await db("invoices")
    .where({ id: uuid.parse(req.params.id) })
    .first();
  if (!invoice) fail(404, "Invoice not found");
  const action = req.params.action;
  if (action === "confirm") {
    const result = await confirmInvoice(invoice.id, req.user.sub);
    await refreshSummary();
    return res.json(result);
  }
  if (action === "cancel") {
    if (
      !["Draft", "Confirmed"].includes(invoice.status) ||
      Number(invoice.paid_amount) > 0
    )
      fail(409, "Paid or partially paid invoices cannot be cancelled");
    await db.transaction(async (trx) => {
      const changed = await trx("invoices")
        .where({ id: invoice.id, paid_amount: 0 })
        .whereIn("status", ["Draft", "Confirmed"])
        .update({ status: "Cancelled" });
      if (!changed) fail(409, "Invoice changed; reload and retry");
      await audit(
        trx,
        "invoice",
        invoice.id,
        req.user.sub,
        "cancelled",
        invoice,
        { status: "Cancelled" },
      );
    });
    await refreshSummary();
    return res.json({ ...decode(invoice), status: "Cancelled" });
  }
  if (action === "send") {
    if (!["Confirmed", "Paid"].includes(invoice.status))
      fail(409, "Confirm an invoice before sending");
    const user = await db("users").where({ id: invoice.customer_id }).first();
    const pdf = await invoicePdf(invoice);
    const sent = await email(
      `invoice:${invoice.id}`,
      user.email,
      `Your Brightloop invoice ${invoice.number}`,
      `Invoice total: $${invoice.total}. Due ${invoice.due_date}. Local PDF: ${pdf}`,
    );
    if (sent)
      await audit(db, "invoice", invoice.id, req.user.sub, "sent", null, {
        recipient: user.email,
        pdf,
      });
    return res.json({
      sent,
      message: sent
        ? "Invoice written to local outbox"
        : "Already sent; duplicate notification suppressed",
    });
  }
  fail(404, "Unknown action");
});
app.post("/api/payments", staff, async (req, res) => {
  const input = z
    .object({
      invoice_id: uuid,
      method: z.enum(["cash", "bank", "card", "UPI", "other"]),
      amount: money.refine((v) => v > 0, "Amount must be positive"),
      payment_date: date.default(today),
      note: z.string().max(1000).default(""),
    })
    .parse(req.body);
  if (input.payment_date > today())
    fail(400, "Future-dated payments are not allowed");
  const result = await db.transaction(async (trx) => {
    let q = trx("invoices").where({ id: input.invoice_id });
    if (process.env.DATABASE_URL) q = q.forUpdate();
    const invoice = await q.first();
    if (!invoice) fail(404, "Invoice not found");
    if (invoice.status !== "Confirmed")
      fail(409, "Payments require an unpaid, confirmed invoice");
    const amount = round(input.amount);
    if (amount > round(invoice.total - invoice.paid_amount))
      fail(400, "Payment exceeds outstanding balance");
    const row = {
      ...input,
      amount,
      id: id(),
      customer_id: invoice.customer_id,
      recorded_by: req.user.sub,
      created_at: now(),
    };
    await trx("payments").insert(row);
    const sum = await trx("payments")
      .where({ invoice_id: invoice.id })
      .sum("amount as total")
      .first();
    const update = {
      paid_amount: round(sum.total),
      status: Number(sum.total) >= Number(invoice.total) ? "Paid" : "Confirmed",
    };
    await trx("invoices").where({ id: invoice.id }).update(update);
    await audit(trx, "payment", row.id, req.user.sub, "created", null, row);
    await audit(
      trx,
      "invoice",
      invoice.id,
      req.user.sub,
      "payment_recorded",
      invoice,
      update,
    );
    return row;
  });
  await refreshSummary(input.payment_date);
  if (input.payment_date !== today()) await refreshSummary();
  res.status(201).json(result);
});
app.get("/api/payments", async (req, res) =>
  res.json(await list(req, "payments")),
);
app.get("/api/portal/overview", async (req, res) => {
  if (req.user.role !== "CUSTOMER") fail(403, "Customer account required");
  const [s, i, p] = await Promise.all([
    db("subscriptions")
      .where({ customer_id: req.user.sub })
      .count("* as n")
      .first(),
    db("invoices")
      .where({ customer_id: req.user.sub })
      .whereNotIn("status", ["Paid", "Cancelled"])
      .sum("total as t")
      .sum("paid_amount as p")
      .first(),
    db("payments")
      .where({ customer_id: req.user.sub })
      .sum("amount as n")
      .first(),
  ]);
  res.json({
    subscriptions: Number(s.n),
    outstanding: round(Number(i.t || 0) - Number(i.p || 0)),
    revenue_collected: Number(p.n || 0),
  });
});
for (const table of ["subscriptions", "invoices", "payments"])
  app.get(`/api/portal/${table}`, async (req, res) => {
    if (req.user.role !== "CUSTOMER") fail(403, "Customer account required");
    res.json(await list(req, table));
  });
app.get("/api/portal/invoices/:id/pdf", async (req, res) => {
  if (req.user.role !== "CUSTOMER") fail(403, "Customer account required");
  const row = scope(
    req,
    await db("invoices")
      .where({ id: uuid.parse(req.params.id) })
      .first(),
  );
  res.download(await invoicePdf(row), `${row.number}.pdf`);
});
app.post("/api/portal/subscriptions/:id/:action", async (req, res) => {
  if (req.user.role !== "CUSTOMER") fail(403, "Customer account required");
  await transition(req, res);
});
app.get("/api/dashboard/summary", staff, async (req, res) => {
  const { from, to } = bounds(req.query);
  const summary =
    (await db("daily_summary").orderBy("date", "desc").first()) ||
    (await refreshSummary());
  const rev = await db("payments")
    .whereBetween("payment_date", [from, to])
    .sum("amount as n")
    .first();
  const open = await db("invoices").whereNotIn("status", ["Paid", "Cancelled"]).count("* as n").first();
  res.json({ ...decode(summary), outstanding_count: Number(open.n), revenue_collected: round(rev.n || 0), from, to });
});
for (const table of ["subscriptions", "invoices", "payments"])
  app.get(`/api/reports/${table}`, staff, async (req, res) =>
    res.json(await list(req, table)),
  );
app.get("/api/reports/revenue", staff, async (req, res) => {
  const { from, to } = bounds(req.query);
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(req.query.page_size) || 50));
  const query = db("daily_summary").whereBetween("date", [from, to]);
  const count = await query.clone().count("* as n").first();
  res.json({
    data: await query
      .orderBy("date")
      .limit(size)
      .offset((page - 1) * size),
    total: Number(count.n),
    page,
    page_size: size,
    from,
    to,
  });
});
app.get("/api/reports/aging", staff, async (req, res) => {
  const { from, to } = bounds(req.query);
  const rows = await db("invoices")
    .whereNotIn("status", ["Paid", "Cancelled"])
    .whereBetween("due_date", [from, to]);
  const buckets = [
    { label: "0–30 days", amount: 0, count: 0 },
    { label: "31–60 days", amount: 0, count: 0 },
    { label: "61–90 days", amount: 0, count: 0 },
    { label: "90+ days", amount: 0, count: 0 },
  ];
  for (const i of rows) {
    const days = Math.floor(
      (Date.parse(today()) - Date.parse(i.due_date)) / 86400000,
    );
    const bucket =
      buckets[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3];
    bucket.amount = round(
      bucket.amount + Number(i.total) - Number(i.paid_amount),
    );
    bucket.count++;
  }
  res.json({ data: buckets, from, to });
});
app.get("/api/audit", staff, async (req, res) =>
  res.json(await list(req, "audit")),
);
app.get("/api/analytics/revenue", async (req, res) => {
  const { from, to } = bounds(req.query);
  const query = db("payments")
    .leftJoin("invoices", "payments.invoice_id", "invoices.id")
    .leftJoin("subscriptions", "invoices.subscription_id", "subscriptions.id")
    .leftJoin("plans", "subscriptions.plan_id", "plans.id")
    .whereBetween("payments.payment_date", [from, to]);
  if (req.user.role === "CUSTOMER")
    query.where("payments.customer_id", req.user.sub);
  const rows = await query
    .select("payments.payment_date", "plans.billing_frequency")
    .sum("payments.amount as revenue")
    .groupBy("payments.payment_date", "plans.billing_frequency")
    .orderBy("payments.payment_date");
  const dates = new Map();
  const buckets = { monthly: 0, yearly: 0, other: 0 };
  let total = 0;
  for (const row of rows) {
    const amount = Number(row.revenue);
    dates.set(row.payment_date, (dates.get(row.payment_date) || 0) + amount);
    buckets[
      ["monthly", "yearly"].includes(row.billing_frequency)
        ? row.billing_frequency
        : "other"
    ] += amount;
    total += amount;
  }
  const segments = [
    { name: "Monthly plans", amount: buckets.monthly, color: "#21866b" },
    { name: "Yearly plans", amount: buckets.yearly, color: "#8ac9a8" },
    { name: "Other plans", amount: buckets.other, color: "#e5e9b4" },
  ].map(({ amount, ...s }) => ({
    ...s,
    pct: total ? (amount / total) * 100 : 0,
  }));
  res.json({
    series: [...dates].map(([date, revenue]) => ({
      date,
      revenue: round(revenue),
    })),
    segments,
    total: round(total),
    from,
    to,
  });
});
app.get("/api/notifications", staff, async (req, res) =>
  res.json(await list(req, "notifications")),
);
app.post("/api/notifications/run", staff, async (req, res) => {
  const result = await reminders();
  await audit(
    db,
    "notifications",
    id(),
    req.user.sub,
    "reminders_checked",
    null,
    result,
  );
  res.json(result);
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError)
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  const conflict = err.code?.includes("CONSTRAINT") || err.code === "23505";
  const relation = err.code === "23503";
  const status = err.status || (conflict ? 409 : relation ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({
    error:
      status === 500
        ? "An internal error occurred"
        : conflict
          ? "A unique or reference constraint was violated"
          : err.message,
  });
});
