import { db } from "../db";
import { uuid } from "./ids";

export interface BookRow {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  type: "pages" | "chapters";
  total_pages: number | null;
  created_at: string;
}

export function getProgress(
  book: BookRow,
  subjectType: "owner" | "viewer",
  subjectId: string
): { locationType: "page" | "chapter"; locationValue: number } {
  const row = db
    .prepare(
      `SELECT location_type, location_value FROM progress
       WHERE subject_type = ? AND subject_id = ? AND book_id = ?`
    )
    .get(subjectType, subjectId, book.id) as
    | { location_type: "page" | "chapter"; location_value: number }
    | undefined;

  if (row) return { locationType: row.location_type, locationValue: row.location_value };
  return { locationType: book.type === "chapters" ? "chapter" : "page", locationValue: 0 };
}

export function setProgress(
  book: BookRow,
  subjectType: "owner" | "viewer",
  subjectId: string,
  locationType: "page" | "chapter",
  locationValue: number
) {
  const existing = db
    .prepare(
      `SELECT id FROM progress WHERE subject_type = ? AND subject_id = ? AND book_id = ?`
    )
    .get(subjectType, subjectId, book.id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE progress SET location_type = ?, location_value = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(locationType, locationValue, existing.id);
  } else {
    db.prepare(
      `INSERT INTO progress (id, subject_type, subject_id, book_id, location_type, location_value)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuid(), subjectType, subjectId, book.id, locationType, locationValue);
  }
}
