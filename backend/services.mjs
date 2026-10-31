import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  db,
  id,
  now,
  today,
  round,
  decode,
  addPeriod,
  number,
  audit,
} from "./db.mjs";
export { email, deliverOutbox } from "./mailer.mjs";
import { email } from "./mailer.mjs";
export async function calculate(trx, lines, date = today()) {
  const taxes = (await trx("taxes").where({ active: true })).map(decode);
  const discounts = (await trx("discounts").where({ active: true })).map(
    decode,
  );
  let subtotal = 0,
    tax_total = 0,
    discount_total = 0;
  const applied = [];
  const out = lines.map((line) => {
    const amount = round(line.quantity * line.unit_price);
    const appliedTaxes = taxes.filter(
      (t) => !t.product_ids?.length || t.product_ids.includes(line.product_id),
    );
    const tax = round(
      appliedTaxes.reduce(
        (s, t) =>
          s +
          (t.type === "percent"
            ? (amount * Number(t.value)) / 100
            : Number(t.value) * line.quantity),
        0,
      ),
    );
    subtotal += amount;
    tax_total += tax;
    return {
      ...line,
      amount,
      tax,
      taxes: appliedTaxes.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        value: t.value,
      })),
      remaining: amount,
    };
  });
  const eligible = discounts.filter(
    (d) =>
      (!d.start_date || d.start_date <= date) &&
      (!d.end_date || d.end_date >= date) &&
      (d.max_uses == null || d.used_count < d.max_uses),
  );
  for (const d of eligible.sort(
    (a, b) =>
      (a.scope === "products" ? 0 : 1) - (b.scope === "products" ? 0 : 1),
  )) {
    const targets =
      d.scope === "products"
        ? out.filter(
            (l) =>
              !d.product_ids?.length || d.product_ids.includes(l.product_id),
          )
        : out;
    const qty = targets.reduce((s, l) => s + l.quantity, 0);
    const eligibleAmount = round(targets.reduce((s, l) => s + l.remaining, 0));
    if (
      qty < d.min_quantity ||
      eligibleAmount < Number(d.min_amount) ||
      !eligibleAmount
    )
      continue;
    const amount = round(
      Math.min(
        eligibleAmount,
        d.type === "percent"
          ? (eligibleAmount * Number(d.value)) / 100
          : Number(d.value),
      ),
    );
    discount_total += amount;
    for (const l of targets)
      l.remaining = Math.max(
        0,
        l.remaining - (amount * l.remaining) / eligibleAmount,
      );
    applied.push({ id: d.id, name: d.name, amount });
  }
  return {
    lines: JSON.stringify(out.map(({ remaining, ...l }) => l)),
    subtotal: round(subtotal),
    tax_total: round(tax_total),
    discount_total: round(discount_total),
    total: round(subtotal + tax_total - discount_total),
    applied_discounts: JSON.stringify(applied),
  };
}
export async function refreshSummary(date = today()) {
  const [active, revenue, outstanding, overdue] = await Promise.all([
    db("subscriptions").where({ status: "Active" }).count("* as n").first(),
    db("payments").where("payment_date", date).sum("amount as n").first(),
    db("invoices")
      .where("status", "Confirmed")
      .sum("total as total")
      .sum("paid_amount as paid")
      .first(),
    db("invoices")
      .where("status", "Confirmed")
      .where("due_date", "<", date)
      .count("* as count")
      .sum("total as total")
      .sum("paid_amount as paid")
      .first(),
  ]);
  const row = {
    date,
    active_subscriptions: Number(active.n),
    revenue: round(revenue.n || 0),
    outstanding: round(
      Number(outstanding.total || 0) - Number(outstanding.paid || 0),
    ),
    overdue_count: Number(overdue.count),
    overdue_amount: round(
      Number(overdue.total || 0) - Number(overdue.paid || 0),
    ),
    updated_at: now(),
  };
  await db("daily_summary").insert(row).onConflict("date").merge();
  return row;
}
export async function runBilling(actor = "system") {
  const run = {
    id: id(),
    created_at: now(),
    status: "Running",
    scanned: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    details: "[]",
  };
  await db("billing_runs").insert(run);
  const errors = [];
  let cursor = "";
  const date = today();
  while (true) {
    const batch = await db("subscriptions")
      .where(function () { this.whereIn("status", ["Active", "Paused"]).orWhere(function () { this.where("status", "Closed").whereNotNull("bill_until"); }); })
      .where("next_billing_date", "<=", date)
      .where("id", ">", cursor)
      .orderBy("id")
      .limit(100);
    if (!batch.length) break;
    for (const sub of batch) {
      cursor = sub.id;
      run.scanned++;
      try {
        let more = true;
        let periods = 0;
        while (more) {
          const result = await db.transaction(async (trx) => {
            let q = trx("subscriptions").where({ id: sub.id });
            if (process.env.DATABASE_URL) q = q.forUpdate();
            const s = decode(await q.first());
            const plan = decode(
              await trx("plans").where({ id: s.plan_id }).first(),
            );
            if (s.next_billing_date > date) return "done";
            if (s.status === "Closed" && (!s.bill_until || s.next_billing_date >= s.bill_until)) return "done";
            if (s.status === "Paused" && s.next_billing_date >= (s.paused_at || date)) return "done";
            if (
              s.next_billing_date >= s.expiry_date &&
              plan.flags.auto_close_on_end
            ) {
              await trx("subscriptions")
                .where({ id: s.id })
                .update({ status: "Closed" });
              await audit(trx, "subscription", s.id, actor, "auto_closed", s, {
                status: "Closed",
              });
              return "done";
            }
            const start = s.next_billing_date;
            const end = addPeriod(start, plan.billing_frequency, 1, s.start_date);
            // Full anchored periods starting during a completed pause are not charged.
            if ((s.pause_intervals || []).some(p => start >= p.start && start < p.end)) {
              await trx("subscriptions").where({id:s.id}).update({next_billing_date:end});
              await audit(trx, "subscription", s.id, actor, "paused_period_skipped", null, {period_start:start,period_end:end});
              return "skipped";
            }
            const exists = await trx("invoices")
              .where({ subscription_id: s.id, period_start: start })
              .first();
            if (exists) {
              await trx("subscriptions")
                .where({ id: s.id })
                .update({ next_billing_date: end });
              return "skipped";
            }
            const customer = await trx("users")
              .where({ id: s.customer_id })
              .first();
            const invoice = {
              id: id(),
              number: await number(trx, "INV"),
              subscription_id: s.id,
              customer_id: s.customer_id,
              customer_details: JSON.stringify({
                name: customer.name,
                email: customer.email,
                company: customer.company,
              }),
              created_at: now(),
              period_start: start,
              period_end: end,
              due_date: addPeriod(start, "daily", s.payment_terms),
              status: "Draft",
              paid_amount: 0,
              ...(await calculate(trx, s.pending_lines && start >= s.pending_effective_date ? s.pending_lines : s.lines, start)),
            };
            if (s.pending_lines && start >= s.pending_effective_date) {
              await trx("subscriptions").where({id:s.id}).update({lines:JSON.stringify(s.pending_lines),pending_lines:null,pending_effective_date:null});
            }
            await trx("invoices").insert(invoice);
            await trx("subscriptions")
              .where({ id: s.id })
              .update({ next_billing_date: end });
            await audit(
              trx,
              "invoice",
              invoice.id,
              actor,
              "generated",
              null,
              invoice,
            );
            await audit(
              trx,
              "subscription",
              s.id,
              actor,
              "billing_advanced",
              { next_billing_date: start },
              { next_billing_date: end },
            );
            return "created";
          });
          if (result === "created") run.created++;
          else if (result === "skipped") run.skipped++;
          else more = false;
          if (++periods > 4000)
            throw new Error(
              "Backfill safety limit reached; run again to continue",
            );
        }
      } catch (e) {
        run.failed++;
        errors.push({ subscription_id: sub.id, message: e.message });
      }
    }
  }
  const closing = (
    await db("subscriptions")
      .whereIn("status", ["Active", "Paused"])
      .where("expiry_date", "<=", date)
  ).map(decode);
  for (const s of closing) {
    const p = decode(await db("plans").where({ id: s.plan_id }).first());
    if (p.flags.auto_close_on_end)
      await db.transaction(async (trx) => {
        await trx("subscriptions")
          .where({ id: s.id })
          .update({ status: "Closed" });
        await audit(trx, "subscription", s.id, actor, "auto_closed", s, {
          status: "Closed",
        });
      });
  }
  run.finished_at = now();
  run.status = run.failed ? "Completed with errors" : "Completed";
  run.details = JSON.stringify(errors);
  await db("billing_runs").where({ id: run.id }).update(run);
  await refreshSummary();
  await audit(db, "billing_run", run.id, actor, "completed", null, run);
  return decode(run);
}
export async function confirmInvoice(invoiceId, actor) {
  return db.transaction(async (trx) => {
    let q = trx("invoices").where({ id: invoiceId });
    if (process.env.DATABASE_URL) q = q.forUpdate();
    const i = decode(await q.first());
    if (!i)
      throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (i.status !== "Draft")
      throw Object.assign(new Error("Only draft invoices can be confirmed"), {
        status: 409,
      });
    // Confirmation approves the draft snapshot; it never silently reprices it.
    const discounts = i.applied_discounts || [];
    for (const d of discounts) {
      const rule = await trx("discounts").where({ id: d.id }).first();
      const changed = await trx("discounts")
        .where({ id: d.id })
        .modify((q) => {
          if (!rule) q.whereRaw("1 = 0");
          else if (rule.max_uses != null) q.where("used_count", "<", rule.max_uses);
        })
        .increment("used_count", 1);
      if (!changed)
        throw Object.assign(
          new Error("Discount allowance exhausted; cancel and regenerate an explicit revised draft"),
          { status: 409 },
        );
      await audit(
        trx,
        "discount",
        d.id,
        actor,
        "used",
        { used_count: rule.used_count },
        { used_count: rule.used_count + 1 },
      );
    }
    const update = {
      status: Number(i.total) === 0 ? "Paid" : "Confirmed",
    };
    await trx("invoices").where({ id: invoiceId }).update(update);
    await audit(trx, "invoice", invoiceId, actor, "confirmed", i, update);
    return decode({ ...i, ...update });
  });
}
export async function invoicePdf(invoice) {
  const dir = path.resolve("backend/data/invoices");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${invoice.number}.pdf`);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const stream = createWriteStream(file);
    doc.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.fillColor("#087f66").fontSize(25).text("brightloop");
    doc
      .fillColor("#182c26")
      .fontSize(12)
      .text("Brightloop Software · Subscription services");
    doc.moveDown(2).fontSize(25).text("INVOICE");
    doc
      .fontSize(11)
      .text(invoice.number)
      .text(`Status: ${invoice.status}`)
      .text(
        `Period: ${invoice.period_start} to ${invoice.period_end} (exclusive)`,
      )
      .text(`Due: ${invoice.due_date}`);
    const customer = JSON.parse(invoice.customer_details || "{}");
    doc
      .moveDown()
      .text(
        `Bill to: ${customer.company || customer.name || invoice.customer_id}`,
      )
      .text(customer.email || "");
    doc.moveDown(2);
    for (const line of decode(invoice).lines)
      doc
        .text(
          `${line.name || "Subscription"}  |  ${line.quantity} × $${Number(line.unit_price).toFixed(2)}  |  $${round(line.quantity * line.unit_price).toFixed(2)}`,
        )
        .moveDown(0.5);
    doc
      .moveDown()
      .text(`Subtotal: $${Number(invoice.subtotal).toFixed(2)}`)
      .text(`Tax: $${Number(invoice.tax_total).toFixed(2)}`)
      .text(`Discount: -$${Number(invoice.discount_total).toFixed(2)}`)
      .fontSize(17)
      .text(`Total: $${Number(invoice.total).toFixed(2)}`)
      .fontSize(11)
      .text(`Paid: $${Number(invoice.paid_amount).toFixed(2)}`)
      .text(
        `Balance: $${round(Number(invoice.total) - Number(invoice.paid_amount)).toFixed(2)}`,
      );
    doc
      .moveDown(3)
      .fillColor("#74837d")
      .text("Thank you for growing with Brightloop.");
    doc.end();
  });
  return file;
}
export async function reminders() {
  const date = today();
  const before = addPeriod(
    date,
    "daily",
    Number(process.env.REMINDER_DAYS || 7),
  );
  const subs = await db("subscriptions")
    .whereIn("status", ["Active", "Paused"])
    .whereBetween("expiry_date", [date, before]);
  for (const s of subs) {
    const u = await db("users").where({ id: s.customer_id }).first();
    await email(
      `renewal:${s.id}:${s.expiry_date}`,
      u.email,
      "Your subscription is coming up for renewal",
      `${s.number} expires on ${s.expiry_date}. Visit your local Brightloop portal.`,
    );
  }
  const invoices = await db("invoices")
    .where("status", "Confirmed")
    .where("due_date", "<", date);
  const staff = await db("users").whereIn("role", ["STAFF", "ADMIN"]);
  for (const i of invoices) {
    const customer = await db("users").where({ id: i.customer_id }).first();
    for (const u of [customer, ...staff])
      await email(
        `overdue:${i.id}:${u.id}`,
        u.email,
        `Payment reminder · ${i.number}`,
        `Outstanding balance: $${round(i.total - i.paid_amount)}. Due date: ${i.due_date}.`,
      );
  }
  return {
    renewal_candidates: subs.length,
    overdue_candidates: invoices.length,
  };
}
