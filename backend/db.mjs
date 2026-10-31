import "dotenv/config";
import knex from "knex";
import { upgrade } from "./migrations.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
mkdirSync(path.resolve("backend/data"), { recursive: true });
export const db = knex(
  process.env.DATABASE_URL
    ? {
        client: "pg",
        connection: process.env.DATABASE_URL,
        pool: { min: 0, max: 10 },
      }
    : {
        client: "better-sqlite3",
        connection: {
          filename: process.env.SQLITE_PATH || "backend/data/brightloop.sqlite",
        },
        useNullAsDefault: true,
        pool: {
          min: 1,
          max: 1,
          afterCreate(conn, done) {
            conn.pragma("journal_mode = WAL");
            conn.pragma("foreign_keys = ON");
            done(null, conn);
          },
        },
      },
);
export const id = () => randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString();
export const round = (v) =>
  Math.round((Number(v) + Number.EPSILON) * 100) / 100;
export function decode(row) {
  if (!row) return row;
  const r = { ...row };
  for (const k of [
    "pause_intervals",
    "lines",
    "product_ids",
    "flags",
    "details",
    "old_value",
    "new_value",
    "applied_discounts",
  ]) {
    if (typeof r[k] === "string") {
      try {
        r[k] = JSON.parse(r[k]);
      } catch {}
    }
  }
  for (const k of [
    "price",
    "sales_price",
    "cost_price",
    "price_delta",
    "value",
    "min_amount",
    "amount",
    "subtotal",
    "tax_total",
    "discount_total",
    "total",
    "paid_amount",
    "revenue",
    "outstanding",
    "overdue_amount",
  ])
    if (r[k] != null) r[k] = Number(r[k]);
  if (r.active != null) r.active = Boolean(r.active);
  return r;
}
export function addPeriod(date, frequency, count = 1, anchor = date) {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  const original = new Date(`${anchor.slice(0, 10)}T12:00:00Z`).getUTCDate();
  if (frequency === "daily") d.setUTCDate(d.getUTCDate() + count);
  else if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7 * count);
  else {
    d.setUTCDate(1);
    if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + count);
    else d.setUTCMonth(d.getUTCMonth() + count);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(original, last));
  }
  return d.toISOString().slice(0, 10);
}
export async function audit(
  trx,
  entity_type,
  entity_id,
  actor,
  action,
  old_value,
  new_value,
) {
  await trx("audit").insert({
    id: id(),
    entity_type,
    entity_id,
    actor: actor || "system",
    action,
    old_value: JSON.stringify(old_value ?? null),
    new_value: JSON.stringify(new_value ?? null),
    created_at: now(),
  });
}
export async function number(trx, prefix) {
  const key = `${prefix}-${today().slice(0, 4)}`;
  await trx("sequences").insert({ key, value: 0 }).onConflict("key").ignore();
  await trx("sequences").where({ key }).increment("value", 1);
  const row = await trx("sequences").where({ key }).first();
  return `${key}-${String(row.value).padStart(4, "0")}`;
}
export async function migrate() {
  const create = async (name, fn) => {
    if (!(await db.schema.hasTable(name)))
      await db.schema.createTable(name, fn);
  };
  const base = (t) => {
    t.string("id", 36).primary();
    t.string("created_at").notNullable();
  };
  await create("sequences", (t) => {
    t.string("key").primary();
    t.integer("value").notNullable();
  });
  await create("users", (t) => {
    base(t);
    t.string("name").notNullable();
    t.string("email").notNullable().unique();
    t.string("password_hash").notNullable();
    t.string("role").notNullable().index();
    t.string("company");
  });
  await create("refresh_tokens", (t) => {
    t.string("id", 64).primary();
    t.string("user_id", 36).references("users.id").onDelete("CASCADE");
    t.string("expires_at");
  });
  await create("password_resets", (t) => {
    t.string("id", 64).primary();
    t.string("user_id", 36).references("users.id").onDelete("CASCADE");
    t.string("expires_at");
    t.boolean("used").defaultTo(false);
  });
  await create("products", (t) => {
    base(t);
    t.string("name").notNullable();
    t.string("type").defaultTo("Software");
    t.decimal("sales_price", 14, 2).notNullable();
    t.decimal("cost_price", 14, 2).defaultTo(0);
    t.text("notes");
    t.boolean("active").defaultTo(true);
  });
  await create("variants", (t) => {
    base(t);
    t.string("product_id", 36).references("products.id");
    t.string("group_name").notNullable();
    t.string("option_name").notNullable();
    t.decimal("price_delta", 14, 2).defaultTo(0);
  });
  await create("plans", (t) => {
    base(t);
    t.string("name").notNullable();
    t.string("product_id", 36).references("products.id");
    t.decimal("price", 14, 2).notNullable();
    t.string("billing_frequency").notNullable();
    t.integer("min_quantity").defaultTo(1);
    t.string("available_from");
    t.string("available_to");
    t.text("flags").notNullable();
    t.boolean("active").defaultTo(true);
  });
  await create("templates", (t) => {
    base(t);
    t.string("name").notNullable();
    t.string("plan_id", 36).references("plans.id");
    t.text("lines").notNullable();
    t.integer("validity_days").defaultTo(30);
  });
  await create("quotations", (t) => {
    base(t);
    t.string("number").unique();
    t.string("customer_id", 36).references("users.id").index();
    t.string("plan_id", 36).references("plans.id");
    t.text("lines").notNullable();
    t.string("valid_until").notNullable();
    t.string("status").defaultTo("Quotation");
    t.string("subscription_id", 36);
  });
  await create("subscriptions", (t) => {
    base(t);
    t.string("number").notNullable().unique();
    t.string("customer_id", 36).notNullable().references("users.id");
    t.string("plan_id", 36).notNullable().references("plans.id");
    t.string("status").notNullable().defaultTo("Draft");
    t.string("start_date").notNullable();
    t.string("expiry_date").notNullable().index();
    t.string("next_billing_date").notNullable();
    t.integer("payment_terms").defaultTo(14);
    t.text("lines").notNullable();
    t.index(["status", "next_billing_date"]);
    t.index(["customer_id", "status"]);
    t.index(["created_at"]);
  });
  await create("taxes", (t) => {
    base(t);
    t.string("name").notNullable();
    t.string("type").notNullable();
    t.decimal("value", 14, 2).notNullable();
    t.text("product_ids");
    t.boolean("active").defaultTo(true);
  });
  await create("discounts", (t) => {
    base(t);
    t.string("name").notNullable();
    t.string("type").notNullable();
    t.decimal("value", 14, 2).notNullable();
    t.decimal("min_amount", 14, 2).defaultTo(0);
    t.integer("min_quantity").defaultTo(1);
    t.string("start_date");
    t.string("end_date");
    t.integer("max_uses");
    t.integer("used_count").defaultTo(0);
    t.string("scope").defaultTo("subscription");
    t.text("product_ids");
    t.boolean("active").defaultTo(true);
  });
  await create("invoices", (t) => {
    base(t);
    t.string("number").notNullable().unique();
    t.string("subscription_id", 36).references("subscriptions.id");
    t.string("customer_id", 36).notNullable().references("users.id");
    t.text("customer_details");
    t.string("period_start").notNullable().index();
    t.string("period_end").notNullable();
    t.string("due_date").notNullable();
    t.string("status").notNullable().defaultTo("Draft");
    t.text("lines").notNullable();
    t.decimal("subtotal", 14, 2).notNullable();
    t.decimal("tax_total", 14, 2).notNullable();
    t.decimal("discount_total", 14, 2).notNullable();
    t.decimal("total", 14, 2).notNullable();
    t.decimal("paid_amount", 14, 2).defaultTo(0);
    t.text("applied_discounts");
    t.unique(["subscription_id", "period_start"]);
    t.index(["status", "due_date"]);
    t.index(["customer_id", "created_at"]);
  });
  await create("payments", (t) => {
    base(t);
    t.string("invoice_id", 36).notNullable().references("invoices.id");
    t.string("customer_id", 36).notNullable().references("users.id");
    t.string("method").notNullable();
    t.decimal("amount", 14, 2).notNullable();
    t.string("payment_date").notNullable().index();
    t.text("note");
    t.string("recorded_by", 36).references("users.id");
    t.index(["customer_id", "payment_date"]);
  });
  await create("audit", (t) => {
    base(t);
    t.string("entity_type").notNullable();
    t.string("entity_id").notNullable().index();
    t.string("actor").notNullable();
    t.string("action").notNullable();
    t.text("old_value");
    t.text("new_value");
    t.index(["created_at"]);
  });
  await create("notifications", (t) => {
    base(t);
    t.string("key").unique().notNullable();
    t.string("recipient").notNullable();
    t.string("subject").notNullable();
    t.text("body");
  });
  await create("billing_runs", (t) => {
    base(t);
    t.string("finished_at");
    t.string("status");
    t.integer("scanned").defaultTo(0);
    t.integer("created").defaultTo(0);
    t.integer("skipped").defaultTo(0);
    t.integer("failed").defaultTo(0);
    t.text("details");
  });
  await create("daily_summary", (t) => {
    t.string("date").primary();
    t.integer("active_subscriptions").defaultTo(0);
    t.decimal("revenue", 16, 2).defaultTo(0);
    t.decimal("outstanding", 16, 2).defaultTo(0);
    t.integer("overdue_count").defaultTo(0);
    t.decimal("overdue_amount", 16, 2).defaultTo(0);
    t.string("updated_at");
  });
  await upgrade(db);
}
