import { db, id, now, today, addPeriod, migrate } from "../backend/db.mjs";
import { seed } from "../backend/seed.mjs";
import { refreshSummary } from "../backend/services.mjs";
await migrate();
await seed();
const target = Number(process.argv[2] || 10000);
const count = Number((await db("subscriptions").count("* as n").first()).n);
const customer = await db("users").where({ role: "CUSTOMER" }).first();
const plan = await db("plans").first();
for (let i = count; i < target; i += 100) {
  const batch = Array.from({ length: Math.min(100, target - i) }, (_, j) => ({
    id: id(),
    number: `LOAD-${String(i + j).padStart(7, "0")}`,
    customer_id: customer.id,
    plan_id: plan.id,
    status: "Active",
    start_date: today(),
    expiry_date: addPeriod(today(), "yearly"),
    next_billing_date: addPeriod(today(), "monthly"),
    payment_terms: 14,
    lines: JSON.stringify([
      {
        product_id: plan.product_id,
        quantity: 1,
        unit_price: Number(plan.price),
        name: "Load-test subscription",
      },
    ]),
    created_at: now(),
  }));
  await db("subscriptions").insert(batch);
}
await refreshSummary();
console.log(
  `LOAD TEST DATASET: ${(await db("subscriptions").count("* as n").first()).n} subscriptions`,
);
await db.destroy();
