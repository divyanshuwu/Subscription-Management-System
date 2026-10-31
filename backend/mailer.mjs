import nodemailer from "nodemailer";
import { appendFile, mkdir } from "node:fs/promises";
import { db, id, now, audit, decode } from "./db.mjs";

// Durable at-least-once delivery: deterministic Message-ID aids recipient deduplication.
// SMTP acknowledgment lost after delivery can still cause duplicates; no exactly-once claim.
export async function email(key, recipient, subject, body, attachments = []) {
  const row = {
    id: id(),
    key,
    recipient,
    subject,
    body,
    attachments: JSON.stringify(attachments),
    delivery_status: "pending",
    attempts: 0,
    next_attempt_at: now(),
    created_at: now(),
  };
  const inserted = await db("notifications")
    .insert(row)
    .onConflict("key")
    .ignore()
    .returning("id");
  if (!inserted.length) return false;
  await audit(db, "notification", row.id, "system", "queued", null, {
    recipient,
    subject,
    key,
  });
  await deliverOutbox(row.id);
  return true;
}
export async function deliverOutbox(onlyId) {
  const timestamp = now(),
    stale = new Date(Date.now() - 300000).toISOString();
  // Recover abandoned delivery leases after worker/process death.
  await db("notifications")
    .where({ delivery_status: "sending" })
    .where("locked_at", "<", stale)
    .update({ delivery_status: "failed", next_attempt_at: timestamp });
  const q = db("notifications")
    .whereIn("delivery_status", ["pending", "failed"])
    .where("attempts", "<", 5)
    .where("next_attempt_at", "<=", timestamp)
    .orderBy("created_at")
    .limit(50);
  if (onlyId) q.where({ id: onlyId });
  let sent = 0,
    failed = 0;
  for (const raw of await q) {
    const claimed = await db("notifications")
      .where({ id: raw.id, attempts: raw.attempts })
      .where("next_attempt_at", "<=", timestamp)
      .whereIn("delivery_status", ["pending", "failed"])
      .update({
        delivery_status: "sending",
        locked_at: timestamp,
        attempts: raw.attempts + 1,
      });
    if (!claimed) continue;
    const row = decode(raw);
    try {
      const mode = process.env.MAIL_TRANSPORT || "local";
      if (mode === "smtp") {
        if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST is required");
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          requireTLS: process.env.SMTP_REQUIRE_TLS !== "false",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
          connectionTimeout: 5000,
          socketTimeout: 10000,
        });
        try {
          await transport.sendMail({
            from:
              process.env.MAIL_FROM || "Brightloop <billing@brightloop.local>",
            to: row.recipient,
            subject: row.subject,
            text: row.body,
            messageId: `<${row.id}@brightloop.local>`,
            attachments: row.attachments || [],
          });
        } finally {
          transport.close();
        }
      } else if (mode === "local") {
        await mkdir("backend/data", { recursive: true });
        await appendFile(
          "backend/data/outbox.log",
          `[${timestamp}] LOCAL PREVIEW ONLY\nTO: ${row.recipient}\nSUBJECT: ${row.subject}\n${row.body}\nAttachments: ${(row.attachments || []).map((a) => a.filename).join(", ")}\n---\n`,
        );
      } else throw new Error("Unsupported MAIL_TRANSPORT");
      await db("notifications")
        .where({ id: row.id })
        .update({
          delivery_status: mode === "smtp" ? "sent" : "logged",
          sent_at: now(),
          last_error: null,
          locked_at: null,
        });
      sent++;
    } catch (e) {
      // Never persist credentials/server responses; only a generic delivery classification.
      await db("notifications")
        .where({ id: row.id })
        .update({
          delivery_status: "failed",
          last_error: e.code || "DELIVERY_FAILED",
          locked_at: null,
          next_attempt_at: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** raw.attempts) * 1000,
          ).toISOString(),
        });
      failed++;
    }
  }
  return { sent, failed };
}
