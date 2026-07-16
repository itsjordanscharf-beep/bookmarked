import { Router } from "express";
import { requireAuth } from "../middleware/auth";

export const bookSearchRouter = Router();
bookSearchRouter.use(requireAuth);

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

interface GoogleBooksItem {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    pageCount?: number;
    imageLinks?: { thumbnail?: string };
  };
}

bookSearchRouter.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("fields", "items(id,volumeInfo(title,authors,pageCount,imageLinks))");
  if (GOOGLE_BOOKS_API_KEY) url.searchParams.set("key", GOOGLE_BOOKS_API_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return res.json([]);
    const data = (await response.json()) as { items?: GoogleBooksItem[] };

    const results = (data.items || [])
      .filter((item) => item.volumeInfo?.title)
      .map((item) => ({
        externalId: item.id,
        title: item.volumeInfo!.title as string,
        author: (item.volumeInfo!.authors || []).join(", ") || "Unknown author",
        totalPages: item.volumeInfo!.pageCount || null,
        coverUrl: item.volumeInfo!.imageLinks?.thumbnail?.replace("http://", "https://") || null,
      }));

    res.json(results);
  } catch {
    res.json([]);
  }
});
