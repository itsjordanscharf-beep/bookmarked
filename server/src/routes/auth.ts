import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { uuid } from "../util/ids";
import { JWT_SECRET, COOKIE_NAME, requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 24 * 30,
};

authRouter.post("/register", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)"
  ).run(id, email.toLowerCase(), passwordHash, name);

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, cookieOpts);
  res.status(201).json({ id, email: email.toLowerCase(), name });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = db
    .prepare("SELECT id, email, password_hash, name FROM users WHERE email = ?")
    .get(email.toLowerCase()) as
    | { id: string; email: string; password_hash: string; name: string }
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, cookieOpts);
  res.json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});
