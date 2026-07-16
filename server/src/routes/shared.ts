import { Router } from "express";
import { db } from "../db";
import { uuid } from "../util/ids";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { getProgress, setProgress, effectiveTotalPages, ensureMembership, BookRow } from "../util/progress";
import { partitionNotes, notesForBook } from "../util/spoiler";

export const sharedRouter = Router();

interface ShareRow {
  id: string;
  book_id: string;
  code: string;
  created_at: string;
}

function loadShare(code: string, res: any): ShareRow | null {
  const share = db.prepare("SELECT * FROM shares WHERE code = ?").get(code) as
    | ShareRow
    | undefined;
  if (!share) {
    res.status(404).json({ error: "This share link doesn't exist" });
    return null;
  }
  return share;
}

function bookMeta(book: BookRow) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    totalPages: book.total_pages,
    coverUrl: book.cover_url,
  };
}

// Public: fetch book meta for a share code, used to render the "sign in to
// join" prompt before the visitor has an account or session.
sharedRouter.get("/:code", (req, res) => {
  const share = loadShare(String(req.params.code), res);
  if (!share) return;
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  res.json(bookMeta(book));
});

// Everything past this point requires a real account — friends must sign in
// (email or Google) before they can join a shared book.
sharedRouter.use(requireAuth);

function joinShare(share: ShareRow, userId: string) {
  db.prepare(
    `INSERT OR IGNORE INTO share_members (id, share_id, user_id) VALUES (?, ?, ?)`
  ).run(uuid(), share.id, userId);
  ensureMembership(share.book_id, userId);
}

// Friend's view: book + own progress + spoiler-filtered owner notes + own notes-back.
// Joining happens automatically on first view now that identity comes from
// a real account rather than an anonymous display name.
sharedRouter.get("/:code/view", (req: AuthedRequest, res) => {
  const share = loadShare(String(req.params.code), res);
  if (!share) return;
  joinShare(share, req.userId!);

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  const progress = getProgress(book.id, req.userId!);

  const allNotes = notesForBook(book.id);
  const ownerNoteRows = allNotes.filter((n) => n.user_id === book.owner_id);
  const { visible: ownerNotes, hiddenCount } = partitionNotes(book, ownerNoteRows, req.userId!);

  const myNotesBack = allNotes
    .filter((n) => n.user_id === req.userId && n.user_id !== book.owner_id)
    .sort((a, b) => a.page - b.page || a.created_at.localeCompare(b.created_at))
    .map((n) => ({
      id: n.id,
      page: n.page,
      text: n.text,
      emoji: n.emoji,
      createdAt: n.created_at,
    }));

  res.json({
    book: bookMeta(book),
    isOwner: book.owner_id === req.userId,
    progress,
    ownerNotes,
    hiddenCount,
    myNotesBack,
  });
});

// Friend updates their own progress (optionally recording their own edition's
// total page count for percentage-normalized spoiler comparisons)
sharedRouter.put("/:code/progress", (req: AuthedRequest, res) => {
  const share = loadShare(String(req.params.code), res);
  if (!share) return;
  joinShare(share, req.userId!);

  const { page, myTotalPages } = req.body || {};
  if (page == null) return res.status(400).json({ error: "page is required" });

  setProgress(share.book_id, req.userId!, page, myTotalPages);
  res.json(getProgress(share.book_id, req.userId!));
});

// Friend taps to reveal an available (unlocked) note
sharedRouter.post("/:code/notes/:noteId/reveal", (req: AuthedRequest, res) => {
  const share = loadShare(String(req.params.code), res);
  if (!share) return;
  joinShare(share, req.userId!);

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  const note = db
    .prepare("SELECT * FROM notes WHERE id = ? AND book_id = ?")
    .get(req.params.noteId, book.id) as { id: string; user_id: string; page: number; text: string } | undefined;
  if (!note) return res.status(404).json({ error: "Note not found" });

  const progress = getProgress(book.id, req.userId!);
  const viewerTotal = effectiveTotalPages(book, req.userId!);
  const creatorTotal = effectiveTotalPages(book, note.user_id);
  const viewerPercent = progress.page / viewerTotal;
  const notePercent = note.page / creatorTotal;
  if (notePercent > viewerPercent) {
    return res.status(403).json({ error: "You haven't reached this part yet" });
  }

  db.prepare(
    `INSERT OR IGNORE INTO reveals (id, user_id, note_id) VALUES (?, ?, ?)`
  ).run(uuid(), req.userId, note.id);

  res.json({ id: note.id, text: note.text });
});

// Friend leaves a note back for the owner (dueling reactions)
sharedRouter.post("/:code/notes", (req: AuthedRequest, res) => {
  const share = loadShare(String(req.params.code), res);
  if (!share) return;
  joinShare(share, req.userId!);

  const { page, text, emoji } = req.body || {};
  if (page == null || !text) {
    return res.status(400).json({ error: "page and text are required" });
  }

  const progress = getProgress(share.book_id, req.userId!);
  if (page > progress.page) {
    return res.status(403).json({ error: "You can only leave notes up to your own progress" });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO notes (id, book_id, user_id, page, text, emoji) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, share.book_id, req.userId, page, text, emoji || null);

  res.status(201).json({ id });
});
