import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "node:path";
import "./db";
import { authRouter } from "./routes/auth";
import { booksRouter } from "./routes/books";
import { sharedRouter } from "./routes/shared";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/books", booksRouter);
app.use("/api/shared", sharedRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// In production the Vite build output is copied alongside dist/ (see
// Dockerfile) and served from the same origin/service as the API, so the
// browser never needs a separate frontend host or CORS for real usage.
if (isProduction) {
  const staticDir = path.join(__dirname, "..", "public");
  app.use(express.static(staticDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`Bookmarked server listening on http://localhost:${PORT}`);
});
