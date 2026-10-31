// Additive, versioned upgrades run inside a transaction. Existing data is retained.
export async function upgrade(db) {
  if (!(await db.schema.hasTable("schema_migrations")))
    await db.schema.createTable("schema_migrations", (t) => {
      t.integer("version").primary();
      t.string("applied_at").notNullable();
    });
  const changes = [
    [
      1,
      async (trx) => {
        await trx.schema.alterTable("subscriptions", (t) => {
          t.text("pause_intervals").notNullable().defaultTo("[]");
          t.string("paused_at");
          t.string("bill_until");
        });
        // Quotes created before the upgrade did not have immutable calculated lines.
        await trx.schema.alterTable("quotations", (t) => {
          t.boolean("price_snapshot").notNullable().defaultTo(false);
        });
      },
    ],
    [
      2,
      async (trx) => {
        await trx.schema.alterTable("notifications", (t) => {
          t.string("delivery_status").notNullable().defaultTo("logged");
          t.integer("attempts").notNullable().defaultTo(0);
          t.string("next_attempt_at");
          t.string("locked_at");
          t.string("last_error");
          t.string("sent_at");
          t.text("attachments").notNullable().defaultTo("[]");
        });
        await trx.schema.alterTable("users", (t) => {
          t.integer("token_version").notNullable().defaultTo(0);
        });
        await trx.schema.alterTable("subscriptions", (t) => {
          t.text("pending_lines");
          t.string("pending_effective_date");
          t.integer("revision").notNullable().defaultTo(0);
        });
      },
    ],
    [
      3,
      async (trx) => {
        await trx.schema.alterTable("payments", (t) => {
          t.string("idempotency_key", 100);
          t.unique(["invoice_id", "idempotency_key"]);
          t.index(["invoice_id"]);
        });
        await trx.schema.alterTable("notifications", (t) => {
          t.index(["delivery_status", "next_attempt_at"]);
        });
        await trx.schema.alterTable("invoices", (t) => {
          t.index(["created_at"]);
        });
      },
    ],
  ];
  for (const [version, up] of changes) {
    await db.transaction(async (trx) => {
      if (process.env.DATABASE_URL)
        await trx.raw("SELECT pg_advisory_xact_lock(7371026)");
      if (await trx("schema_migrations").where({ version }).first()) return;
      await up(trx);
      await trx("schema_migrations").insert({
        version,
        applied_at: new Date().toISOString(),
      });
    });
  }
}
