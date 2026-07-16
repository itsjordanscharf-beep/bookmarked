import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "./db";
import { authRouter } from "./routes/auth";
import { booksRouter } from "./routes/books";
import { sharedRouter } from "./routes/shared";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/books", booksRouter);
app.use("/api/shared", sharedRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`Bookmarked server listening on http://localhost:${PORT}`);
});
