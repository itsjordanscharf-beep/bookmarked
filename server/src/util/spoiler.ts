import { db } from "../db";
import { BookRow, effectiveTotalPages, getProgress } from "./progress";

export interface NoteRow {
  id: string;
  book_id: string;
  user_id: string;
  page: number;
  text: string;
  emoji: string | null;
  created_at: string;
  creator_name: string;
}

export interface VisibleNote {
  id: string;
  page: number;
  creatorId: string;
  creatorName: string;
  emoji: string | null;
  createdAt: string;
  revealed: boolean;
  text?: string;
}

export function notesForBook(bookId: string): NoteRow[] {
  return db
    .prepare(
      `SELECT notes.*, users.name as creator_name FROM notes
       JOIN users ON users.id = notes.user_id
       WHERE notes.book_id = ?`
    )
    .all(bookId) as NoteRow[];
}

// Notes are compared by percentage-through-the-book, not raw page number, so
// two readers on different editions (e.g. Kindle vs. a paperback with a
// different page count) still unlock the same notes at the same point in
// the story. A note is available once the viewer's percent progress has
// reached the note's percent position; anything further ahead stays fully
// hidden and only contributes to the "hidden ahead" count. Available notes
// still withhold their text until explicitly revealed by the viewer.
export function partitionNotes(
  book: BookRow,
  notes: NoteRow[],
  viewerId: string
): { visible: VisibleNote[]; hiddenCount: number } {
  const viewerProgress = getProgress(book.id, viewerId);
  const viewerTotal = viewerProgress.myTotalPages || book.total_pages;
  const viewerPercent = viewerTotal > 0 ? viewerProgress.page / viewerTotal : 0;

  const revealedIds = new Set(
    (
      db.prepare(`SELECT note_id FROM reveals WHERE user_id = ?`).all(viewerId) as {
        note_id: string;
      }[]
    ).map((r) => r.note_id)
  );

  const visible: VisibleNote[] = [];
  let hiddenCount = 0;

  for (const n of notes) {
    const creatorTotal = effectiveTotalPages(book, n.user_id);
    const notePercent = creatorTotal > 0 ? n.page / creatorTotal : 0;

    if (notePercent <= viewerPercent) {
      const revealed = revealedIds.has(n.id);
      visible.push({
        id: n.id,
        page: n.page,
        creatorId: n.user_id,
        creatorName: n.creator_name,
        emoji: n.emoji,
        createdAt: n.created_at,
        revealed,
        text: revealed ? n.text : undefined,
      });
    } else {
      hiddenCount++;
    }
  }

  visible.sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));

  return { visible, hiddenCount };
}
