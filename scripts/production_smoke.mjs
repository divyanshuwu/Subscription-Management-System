import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "node:fs";
await mkdir("artifacts", { recursive: true });
const source = "artifacts/production-smoke.sqlite",
  backup = "artifacts/production-smoke-backup.sqlite";
for (const p of [source, backup]) if (existsSync(p)) unlinkSync(p);
const env = {
  ...process.env,
  SQLITE_PATH: source,
  DATABASE_URL: "",
  JWT_SECRET: "production-smoke-only-random-looking-secret-1234567890",
  SCHEDULER: "off",
  HOST: "127.0.0.1",
  PORT: "4108",
  MAIL_TRANSPORT: "local",
  QUIET: "1",
};
const seed = spawnSync(process.execPath, ["backend/seed.mjs"], {
  env,
  stdio: "pipe",
});
assert.equal(seed.status, 0, seed.stderr.toString());
const server = spawn(process.execPath, ["backend/server.mjs"], {
  env: { ...env, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (c) => {
  logs += c;
});
server.stderr.on("data", (c) => {
  logs += c;
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Startup timed out: " + logs)),
      10000,
    );
    server.stdout.on("data", () => {
      if (logs.includes("listening locally")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Server exited " + code + ": " + logs));
    });
  });
  const base = "http://127.0.0.1:4108",
    root = await fetch(base);
  assert.equal(root.status, 200);
  const html = await root.text();
  assert.match(html, /Brightloop/);
  assert.ok(root.headers.get("content-security-policy"));
  assert.ok(!html.includes("rrweb") && !html.includes("data-arena-recording"));
  assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal((await fetch(base + "/api/subscriptions")).status, 401);
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@brightloop.local",
      password: "Brightloop@2026",
    }),
  }).then((r) => r.json());
  assert.ok(login.access_token);
  const result = spawnSync(process.execPath, ["scripts/backup.mjs", backup], {
    env,
    stdio: "pipe",
  });
  assert.equal(result.status, 0, result.stderr.toString());
  const restored = new Database(backup, { readonly: true });
  assert.ok(restored.prepare("SELECT count(*) as n FROM users").get().n > 0);
  assert.equal(restored.pragma("integrity_check", { simple: true }), "ok");
  restored.close();
  await writeFile(
    "docs/evidence/iteration-3-production.json",
    JSON.stringify(
      {
        static_html: 200,
        health: 200,
        unauthenticated_business_api: 401,
        security_headers: true,
        external_recording_removed: true,
        login: true,
        consistent_backup_and_integrity_check: true,
        container_build: "Dockerfile supplied; Docker engine not exercised",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS production static/API/auth/security headers and SQLite backup/integrity smoke",
  );
} finally {
  server.kill("SIGTERM");
  await new Promise((r) => server.once("exit", r));
}
