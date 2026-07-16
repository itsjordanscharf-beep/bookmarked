import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import { uuid } from "../util/ids";
import { JWT_SECRET, COOKIE_NAME, requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 24 * 30,
};

interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

function issueSession(res: any, user: UserRow) {
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, cookieOpts);
}

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

  issueSession(res, { id, email: email.toLowerCase(), name, avatar_url: null });
  res.status(201).json({ id, email: email.toLowerCase(), name, avatarUrl: null });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = db
    .prepare("SELECT id, email, password_hash, name, avatar_url FROM users WHERE email = ?")
    .get(email.toLowerCase()) as
    | { id: string; email: string; password_hash: string | null; name: string; avatar_url: string | null }
    | undefined;

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  issueSession(res, user);
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url });
});

authRouter.post("/google", async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: "idToken is required" });
  if (!googleClient) {
    return res.status(500).json({ error: "Google sign-in is not configured on this server" });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Invalid Google credential" });
  }
  if (!payload?.sub || !payload.email) {
    return res.status(401).json({ error: "Google account is missing required profile info" });
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name || email;
  const avatarUrl = payload.picture || null;

  let user = db
    .prepare("SELECT id, email, name, avatar_url FROM users WHERE google_id = ?")
    .get(googleId) as UserRow | undefined;

  if (!user) {
    // Link to an existing email/password account with the same address,
    // otherwise create a fresh Google-only account.
    const existingByEmail = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email) as { id: string } | undefined;

    if (existingByEmail) {
      db.prepare("UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?").run(
        googleId,
        avatarUrl,
        existingByEmail.id
      );
      user = db
        .prepare("SELECT id, email, name, avatar_url FROM users WHERE id = ?")
        .get(existingByEmail.id) as UserRow;
    } else {
      const id = uuid();
      db.prepare(
        "INSERT INTO users (id, email, google_id, name, avatar_url) VALUES (?, ?, ?, ?, ?)"
      ).run(id, email, googleId, name, avatarUrl);
      user = { id, email, name, avatar_url: avatarUrl };
    }
  }

  issueSession(res, user);
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const user = db
    .prepare("SELECT id, email, name, avatar_url FROM users WHERE id = ?")
    .get(req.userId!) as UserRow | undefined;
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url });
});
