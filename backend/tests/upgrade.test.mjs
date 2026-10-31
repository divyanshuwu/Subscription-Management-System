import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
test("genuine original schema upgrades without deleting old business data", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "brightloop-upgrade-"),
  );
  process.env.SQLITE_PATH = path.join(directory, "legacy.sqlite");
  process.env.DATABASE_URL = "";
  const legacy = await import("./fixtures/legacy-db.mjs");
  await legacy.migrate();
  const uid = legacy.id(),
    pid = legacy.id(),
    planid = legacy.id(),
    subid = legacy.id(),
    quoteid = legacy.id();
  await legacy
    .db("users")
    .insert({
      id: uid,
      name: "Original customer",
      email: "original@test.local",
      password_hash: "unchanged",
      role: "CUSTOMER",
      created_at: legacy.now(),
    });
  await legacy
    .db("products")
    .insert({
      id: pid,
      name: "Original product",
      sales_price: 100,
      created_at: legacy.now(),
    });
  await legacy
    .db("plans")
    .insert({
      id: planid,
      name: "Original plan",
      product_id: pid,
      price: 100,
      billing_frequency: "monthly",
      flags: "{}",
      created_at: legacy.now(),
    });
  await legacy
    .db("subscriptions")
    .insert({
      id: subid,
      number: "ORIGINAL-SUB",
      customer_id: uid,
      plan_id: planid,
      status: "Active",
      start_date: "2020-01-01",
      expiry_date: "2030-01-01",
      next_billing_date: "2026-11-01",
      lines: "[]",
      created_at: legacy.now(),
    });
  await legacy
    .db("quotations")
    .insert({
      id: quoteid,
      number: "ORIGINAL-QUOTE",
      customer_id: uid,
      plan_id: planid,
      lines: "[]",
      valid_until: "2030-01-01",
      created_at: legacy.now(),
    });
  await legacy.db.destroy();
  const current = await import("../db.mjs");
  try {
    await current.migrate();
    await current.migrate();
    const user = await current.db("users").where({ id: uid }).first(),
      sub = await current.db("subscriptions").where({ id: subid }).first();
    assert.equal(user.password_hash, "unchanged");
    assert.equal(user.token_version, 0);
    assert.equal(sub.number, "ORIGINAL-SUB");
    assert.equal(sub.revision, 0);
    assert.equal(sub.pause_intervals, "[]");
    assert.equal(
      Boolean(
        (await current.db("quotations").where({ id: quoteid }).first())
          .price_snapshot,
      ),
      false,
    );
    assert.equal(
      Number((await current.db("schema_migrations").count("* as n").first()).n),
      3,
    );
  } finally {
    await current.db.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});
