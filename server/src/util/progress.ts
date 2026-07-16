import { db } from "../db";
import { uuid } from "./ids";

export interface BookRow {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  total_pages: number;
  cover_url: string | null;
  created_at: string;
}

export interface ProgressInfo {
  page: number;
  myTotalPages: number | null;
}

export function getProgress(bookId: string, userId: string): ProgressInfo {
  const row = db
    .prepare(`SELECT page, my_total_pages FROM progress WHERE user_id = ? AND book_id = ?`)
    .get(userId, bookId) as { page: number; my_total_pages: number | null } | undefined;
  if (row) return { page: row.page, myTotalPages: row.my_total_pages };
  return { page: 0, myTotalPages: null };
}

export function setProgress(
  bookId: string,
  userId: string,
  page: number,
  myTotalPages?: number | null
) {
  const existing = db
    .prepare(`SELECT id, my_total_pages FROM progress WHERE user_id = ? AND book_id = ?`)
    .get(userId, bookId) as { id: string; my_total_pages: number | null } | undefined;

  const totalToUse = myTotalPages !== undefined ? myTotalPages : existing?.my_total_pages ?? null;

  if (existing) {
    db.prepare(
      `UPDATE progress SET page = ?, my_total_pages = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(page, totalToUse, existing.id);
  } else {
    db.prepare(
      `INSERT INTO progress (id, user_id, book_id, page, my_total_pages) VALUES (?, ?, ?, ?, ?)`
    ).run(uuid(), userId, bookId, page, totalToUse);
  }
}

// A reader's own recorded edition length, falling back to the book's
// reference page count, so a Kindle reader and a print reader can compare
// progress by percentage-through-the-book rather than raw page number.
export function effectiveTotalPages(book: BookRow, userId: string): number {
  const row = db
    .prepare(`SELECT my_total_pages FROM progress WHERE user_id = ? AND book_id = ?`)
    .get(userId, book.id) as { my_total_pages: number | null } | undefined;
  return row?.my_total_pages || book.total_pages;
}

export function ensureMembership(bookId: string, userId: string) {
  const existing = db
    .prepare(`SELECT id FROM progress WHERE user_id = ? AND book_id = ?`)
    .get(userId, bookId);
  if (!existing) {
    db.prepare(
      `INSERT INTO progress (id, user_id, book_id, page, my_total_pages) VALUES (?, ?, ?, 0, NULL)`
    ).run(uuid(), userId, bookId);
  }
}
