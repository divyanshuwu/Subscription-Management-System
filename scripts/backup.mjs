import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
const source = process.env.SQLITE_PATH || "backend/data/brightloop.sqlite";
const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Usage: npm run backup -- /safe/path/brightloop-backup.sqlite",
  );
if (existsSync(destination))
  throw new Error("Refusing to overwrite an existing backup");
mkdirSync(path.dirname(path.resolve(destination)), { recursive: true });
const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(destination);
  console.log(`Consistent SQLite backup created: ${destination}`);
} finally {
  db.close();
}
