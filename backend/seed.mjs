import "dotenv/config";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";
import {
  db,
  id,
  now,
  today,
  addPeriod,
  number,
  audit,
  migrate,
} from "./db.mjs";
import { runBilling, confirmInvoice, refreshSummary } from "./services.mjs";
export async function seed() {
  await migrate();
  if (await db("users").where({ email: "admin@brightloop.local" }).first()) {
    console.log(
      "Brightloop is already seeded. Your existing data was preserved.",
    );
    return;
  }
  const date = today();
  const password_hash = await bcrypt.hash("Brightloop@2026", 12);
  const admin = {
    id: id(),
    name: "Alex Morgan",
    email: "admin@brightloop.local",
    password_hash,
    role: "ADMIN",
    company: "Brightloop Software",
    created_at: now(),
  };
  const staff = {
    id: id(),
    name: "Jamie Parker",
    email: "staff@brightloop.local",
    password_hash,
    role: "STAFF",
    company: "Brightloop Software",
    created_at: now(),
  };
  const names = [
    "Acme Inc.",
    "Layers",
    "Sisyphus",
    "Capsule",
    "Quotient",
    "Orbit",
    "Northstar",
    "Polymath",
    "FocalPoint",
    "Luminous",
    "Nietzsche",
    "Goodwell",
  ];
  const customers = names.map((company, i) => ({
    id: id(),
    name: ["Olivia Rhye", "Phoenix Baker", "Lana Steiner", "Demi Wilkinson"][
      i % 4
    ],
    email:
      i === 0 ? "customer@brightloop.local" : `customer${i}@brightloop.local`,
    password_hash,
    role: "CUSTOMER",
    company,
    created_at: now(),
  }));
  await db("users").insert([admin, staff, ...customers]);
  const products = [
    {
      id: id(),
      name: "Brightloop Workspace",
      type: "Software",
      sales_price: 49,
      cost_price: 12,
      notes: "A better home for your team’s everyday work.",
      active: true,
      created_at: now(),
    },
    {
      id: id(),
      name: "Brightloop CRM",
      type: "Software",
      sales_price: 99,
      cost_price: 25,
      notes: "Customer relationships, beautifully connected.",
      active: true,
      created_at: now(),
    },
    {
      id: id(),
      name: "Analytics Plus",
      type: "Add-on",
      sales_price: 29,
      cost_price: 5,
      notes: "Turn data into better decisions.",
      active: true,
      created_at: now(),
    },
  ];
  await db("products").insert(products);
  const variant = {
    id: id(),
    product_id: products[1].id,
    group_name: "Brand",
    option_name: "Odoo",
    price_delta: 560,
    created_at: now(),
  };
  await db("variants").insert(variant);
  const plans = ["Starter", "Professional", "Business", "Enterprise"].map(
    (name, i) => ({
      id: id(),
      name,
      product_id: products[i === 3 ? 1 : 0].id,
      price: [49, 99, 249, 2399][i],
      billing_frequency: i === 3 ? "yearly" : "monthly",
      min_quantity: 1,
      available_from: addPeriod(date, "yearly", -1),
      available_to: addPeriod(date, "yearly", 2),
      flags: JSON.stringify({
        auto_close_on_end: true,
        allow_early_close: i !== 3,
        allow_pause: i !== 3,
        allow_renew: true,
      }),
      active: true,
      created_at: now(),
    }),
  );
  await db("plans").insert(plans);
  const template = {
    id: id(),
    name: "Professional onboarding",
    plan_id: plans[1].id,
    lines: JSON.stringify([
      { product_id: products[0].id, quantity: 1, variant_ids: [] },
    ]),
    validity_days: 30,
    created_at: now(),
  };
  await db("templates").insert(template);
  await db("taxes").insert({
    id: id(),
    name: "Standard sales tax",
    type: "percent",
    value: 10,
    product_ids: null,
    active: true,
    created_at: now(),
  });
  await db("discounts").insert([
    {
      id: id(),
      name: "Welcome aboard",
      type: "percent",
      value: 10,
      min_amount: 0,
      min_quantity: 1,
      start_date: addPeriod(date, "yearly", -1),
      end_date: addPeriod(date, "monthly", 3),
      max_uses: 100,
      used_count: 0,
      scope: "subscription",
      product_ids: null,
      active: true,
      created_at: now(),
    },
    {
      id: id(),
      name: "Summer savings (expired)",
      type: "percent",
      value: 15,
      min_amount: 0,
      min_quantity: 1,
      start_date: addPeriod(date, "monthly", -4),
      end_date: addPeriod(date, "daily", -10),
      max_uses: null,
      used_count: 0,
      scope: "subscription",
      product_ids: null,
      active: true,
      created_at: now(),
    },
    {
      id: id(),
      name: "Early bird (usage capped)",
      type: "fixed",
      value: 25,
      min_amount: 0,
      min_quantity: 1,
      start_date: null,
      end_date: null,
      max_uses: 10,
      used_count: 10,
      scope: "subscription",
      product_ids: null,
      active: true,
      created_at: now(),
    },
  ]);
  for (let i = 0; i < 24; i++) {
    const plan = plans[i % 4];
    const start = addPeriod(date, "monthly", -1);
    await db.transaction(async (trx) => {
      const row = {
        id: id(),
        number: await number(trx, "SUB"),
        customer_id: customers[i % customers.length].id,
        plan_id: plan.id,
        status:
          i < 16
            ? "Active"
            : ["Draft", "Quotation", "Confirmed", "Paused", "Closed"][i % 5],
        start_date: start,
        expiry_date:
          i < 3 ? addPeriod(date, "daily", i + 1) : addPeriod(date, "yearly"),
        next_billing_date: start,
        payment_terms: 14,
        lines: JSON.stringify([
          {
            product_id: plan.product_id,
            name: products[plan.product_id === products[1].id ? 1 : 0].name,
            quantity: 1,
            unit_price: Number(plan.price) + (i === 3 ? 560 : 0),
            variant_ids: i === 3 ? [variant.id] : [],
          },
        ]),
        created_at: now(),
      };
      await trx("subscriptions").insert(row);
      await audit(trx, "subscription", row.id, admin.id, "seeded", null, row);
    });
  }
  await db.transaction(async (trx) => {
    for (let i = 0; i < 2; i++) {
      const q = {
        id: id(),
        number: await number(trx, "QUO"),
        customer_id: customers[6 + i].id,
        plan_id: plans[1].id,
        lines: template.lines,
        valid_until: addPeriod(date, "daily", 30),
        status: "Quotation",
        created_at: now(),
      };
      await trx("quotations").insert(q);
      await audit(trx, "quotation", q.id, admin.id, "created", null, q);
    }
  });
  const billing = await runBilling(admin.id);
  const invoices = await db("invoices").orderBy("number");
  for (let i = 0; i < invoices.length; i++) {
    if (i >= 18) continue;
    const inv = await confirmInvoice(invoices[i].id, admin.id);
    if (i < 12) {
      const amount =
        i === 0 ? Math.round((inv.total / 2) * 100) / 100 : Number(inv.total);
      const payment_date = addPeriod(date, "daily", -i % 10);
      await db.transaction(async (trx) => {
        const payment = {
          id: id(),
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          method: ["bank", "card", "UPI"][i % 3],
          amount,
          payment_date,
          note:
            i === 0
              ? "Partial payment; remaining balance due"
              : "Subscription payment",
          recorded_by: staff.id,
          created_at: now(),
        };
        await trx("payments").insert(payment);
        await trx("invoices")
          .where({ id: inv.id })
          .update({
            paid_amount: amount,
            status: amount >= inv.total ? "Paid" : "Confirmed",
          });
        await audit(
          trx,
          "payment",
          payment.id,
          staff.id,
          "recorded",
          null,
          payment,
        );
      });
    }
  }
  for (let i = 30; i >= 0; i--)
    await refreshSummary(addPeriod(date, "daily", -i));
  console.log(
    `Seeded ${customers.length} customers, 24 subscriptions, and ${billing.created} invoices.`,
  );
  console.log(
    "\nDEMO CREDENTIALS (change before production)\nADMIN    admin@brightloop.local\nSTAFF    staff@brightloop.local\nCUSTOMER customer@brightloop.local\nPassword Brightloop@2026\n",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await seed();
  } finally {
    await db.destroy();
  }
}
