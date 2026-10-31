// Additive, versioned upgrades run inside a transaction. Existing data is retained.
export async function upgrade(db) {
  if (!(await db.schema.hasTable('schema_migrations'))) await db.schema.createTable('schema_migrations', t => { t.integer('version').primary(); t.string('applied_at').notNullable(); });
  const changes = [
    [1, async trx => {
      await trx.schema.alterTable('subscriptions', t => { t.text('pause_intervals').notNullable().defaultTo('[]'); t.string('paused_at'); t.string('bill_until'); });
      // Quotes created before the upgrade did not have immutable calculated lines.
      await trx.schema.alterTable('quotations', t => { t.boolean('price_snapshot').notNullable().defaultTo(false); });
    }],
  ];
  for (const [version, up] of changes) {
    await db.transaction(async trx => {
      if (process.env.DATABASE_URL) await trx.raw('SELECT pg_advisory_xact_lock(7371026)');
      if (await trx('schema_migrations').where({version}).first()) return;
      await up(trx);
      await trx('schema_migrations').insert({version,applied_at:new Date().toISOString()});
    });
  }
}
