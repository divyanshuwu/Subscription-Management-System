import pg from "pg";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "Set TEST_DATABASE_URL to a PostgreSQL test service. Tests create/drop isolated schemas, never public tables.",
  );
const client = new pg.Client({ connectionString: url });
await client.connect();
let failed = false;
try {
  for (const file of [
    "backend/tests/system.test.mjs",
    "backend/tests/hardening.test.mjs",
  ]) {
    const schema = "jury_" + randomBytes(8).toString("hex");
    await client.query(`CREATE SCHEMA "${schema}"`);
    try {
      console.log(`\nPostgreSQL isolated schema ${schema}: ${file}`);
      const result = spawnSync(process.execPath, ["--test", file], {
        stdio: "inherit",
        env: { ...process.env, TEST_DATABASE_URL: url, DB_SCHEMA: schema },
      });
      if (result.status !== 0) failed = true;
    } finally {
      await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    }
  }
} finally {
  await client.end();
}
process.exitCode = failed ? 1 : 0;
