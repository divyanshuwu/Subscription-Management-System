import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { db, id, now, audit } from "./db.mjs";
import { email } from "./services.mjs";
export const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error(
      "JWT_SECRET must contain at least 32 characters. Copy .env.example to .env.",
    );
  return value;
};
export const password = z
  .string()
  .min(9)
  .max(128)
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Include a special character");
export const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((s) => s.toLowerCase()),
  password,
  company: z.string().max(100).optional(),
});
const hashToken = (value) => createHash("sha256").update(value).digest("hex");
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  company: u.company,
  role: u.role,
});
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
export async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res.status(401).json({ error: "Authentication required" });
    req.user = jwt.verify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "brightloop",
      audience: "brightloop-local",
    });
    const current = await db("users").where({id:req.user.sub}).select("role", "token_version").first();
    if (!current || current.role !== req.user.role || current.token_version !== (req.user.ver || 0))
      return res.status(401).json({error:"Session revoked; please sign in again"});
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ error: "You do not have permission for this action" });
export const staff = roles("ADMIN", "STAFF");
export const admin = roles("ADMIN");
export function scope(req, row) {
  if (!row) fail(404, "Record not found");
  if (req.user.role === "CUSTOMER" && row.customer_id !== req.user.sub)
    fail(403, "This record belongs to another customer");
  return row;
}
async function tokens(user, trx = db) {
  const refresh = randomBytes(40).toString("hex");
  await trx("refresh_tokens").insert({
    id: hashToken(refresh),
    user_id: user.id,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  return {
    user: publicUser(user),
    access_token: jwt.sign({ role: user.role, name: user.name, ver: user.token_version || 0 }, secret(), {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: "15m",
      issuer: "brightloop",
      audience: "brightloop-local",
    }),
    refresh_token: refresh,
  };
}
export function authRoutes(app, limiter) {
  const create = (role) => async (req, res) => {
    const value = userSchema.parse(req.body);
    if (await db("users").where({ email: value.email }).first())
      fail(409, "An account with this email already exists");
    const user = {
      id: id(),
      created_at: now(),
      name: value.name,
      email: value.email,
      company: value.company || "",
      role,
      password_hash: await bcrypt.hash(value.password, 12),
    };
    await db.transaction(async (trx) => {
      await trx("users").insert(user);
      await audit(
        trx,
        "user",
        user.id,
        req.user?.sub || user.id,
        "created",
        null,
        publicUser(user),
      );
    });
    res
      .status(201)
      .json(role === "CUSTOMER" ? await tokens(user) : publicUser(user));
  };
  app.post("/api/auth/signup", limiter, create("CUSTOMER"));
  app.post("/api/admin/staff", auth, admin, create("STAFF"));
  app.post("/api/auth/login", limiter, async (req, res) => {
    const { email: address, password: pass } = z
      .object({ email: z.email(), password: z.string().max(128) })
      .parse(req.body);
    const user = await db("users")
      .where({ email: address.toLowerCase() })
      .first();
    if (!user || !(await bcrypt.compare(pass, user.password_hash)))
      fail(401, "Incorrect email or password");
    res.json(await tokens(user));
  });
  app.post("/api/auth/refresh", limiter, async (req, res) => {
    const value = z
      .object({ refresh_token: z.string().min(20) })
      .parse(req.body);
    const result = await db.transaction(async (trx) => {
      const row = await trx("refresh_tokens")
        .where({ id: hashToken(value.refresh_token) })
        .first();
      if (!row || row.expires_at < now()) fail(401, "Refresh token expired");
      const count = await trx("refresh_tokens").where({ id: row.id }).delete();
      if (!count) fail(401, "Refresh token already used");
      return tokens(await trx("users").where({ id: row.user_id }).first(), trx);
    });
    res.json(result);
  });
  app.post("/api/auth/logout", auth, async (req, res) => {
    await db.transaction(async trx => {
      await trx("refresh_tokens").where({user_id:req.user.sub}).delete();
      await trx("users").where({id:req.user.sub}).increment("token_version",1);
    });
    res.json({ message: "Signed out" });
  });
  app.get("/api/auth/me", auth, async (req, res) =>
    res.json(publicUser(await db("users").where({ id: req.user.sub }).first())),
  );
  app.post("/api/auth/forgot-password", limiter, async (req, res) => {
    const { email: address } = z.object({ email: z.email() }).parse(req.body);
    const user = await db("users")
      .where({ email: address.toLowerCase() })
      .first();
    if (user) {
      const token = randomBytes(32).toString("hex");
      await db("password_resets").insert({
        id: hashToken(token),
        user_id: user.id,
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
        used: false,
      });
      await email(
        `reset:${id()}`,
        user.email,
        "Reset your Brightloop password",
        `Reset your password within 30 minutes: ${process.env.PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/#reset=${encodeURIComponent(token)}\nIgnore this message if you did not request it.`,
      );
    }
    res.json({
      message:
        "If the email is registered, reset instructions have been queued for delivery.",
    });
  });
  app.post("/api/auth/reset-password", limiter, async (req, res) => {
    const data = z
      .object({ token: z.string().min(20), password })
      .parse(req.body);
    const password_hash = await bcrypt.hash(data.password, 12);
    await db.transaction(async (trx) => {
      const row = await trx("password_resets")
        .where({ id: hashToken(data.token), used: false })
        .first();
      if (!row || row.expires_at < now())
        fail(400, "Invalid or expired reset token");
      const used = await trx("password_resets")
        .where({ id: row.id, used: false })
        .update({ used: true });
      if (!used) fail(409, "Token already used");
      await trx("users").where({ id: row.user_id }).update({ password_hash }).increment("token_version",1);
      await trx("refresh_tokens").where({ user_id: row.user_id }).delete();
      await audit(
        trx,
        "user",
        row.user_id,
        row.user_id,
        "password_reset",
        null,
        { password_changed: true },
      );
    });
    res.json({ message: "Password updated. Please sign in." });
  });
}
