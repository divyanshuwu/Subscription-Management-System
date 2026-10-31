import "dotenv/config";
import cron from "node-cron";
import express from "express";
import path from "node:path";
import { app } from "./app.mjs";
import { migrate, db } from "./db.mjs";
import { secret } from "./auth.mjs";
import {
  runBilling,
  refreshSummary,
  reminders,
  deliverOutbox,
} from "./services.mjs";
secret();
await migrate();
await refreshSummary();
if (process.env.NODE_ENV === "production") {
  const web = path.resolve("dist");
  app.use(express.static(web));
  app.get(/^(?!\/api).*/, (req, res) =>
    res.sendFile(path.join(web, "index.html")),
  );
}
const server = app.listen(
  Number(process.env.PORT || 4000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Brightloop API listening locally on port ${process.env.PORT || 4000}`,
    ),
);
// Durable outbox is independent of the daily billing schedule.
const mailWorker = setInterval(
  () => deliverOutbox().catch(console.error),
  30000,
);
mailWorker.unref();
let running = false;
if (process.env.SCHEDULER !== "off")
  cron.schedule(
    "5 0 * * *",
    async () => {
      if (running) return;
      running = true;
      try {
        await runBilling();
        await reminders();
        await refreshSummary();
      } catch (e) {
        console.error("Scheduled billing failed", e);
      } finally {
        running = false;
      }
    },
    { timezone: "UTC" },
  );
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      clearInterval(mailWorker);
      await db.destroy();
      process.exit(0);
    }),
  );
