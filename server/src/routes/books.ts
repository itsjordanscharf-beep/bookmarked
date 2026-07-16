import { Router } from "express";
import { db } from "../db";
import { uuid, shareCode } from "../util/ids";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { getProgress, setProgress, effectiveTotalPages, BookRow } from "../util/progress";
import { partitionNotes, notesForBook } from "../util/spoiler";

export const booksRouter = Router();
booksRouter.use(requireAuth);

function loadOwnedBook(req: AuthedRequest, res: any): BookRow | null {
  const book = db
    .prepare("SELECT * FROM books WHERE id = ?")
    .get(req.params.id) as BookRow | undefined;
  if (!book || book.owner_id !== req.userId) {
    res.status(404).json({ error: "Book not found" });
    return null;
  }
  return book;
}

// Library: list of the owner's books with a quick summary
booksRouter.get("/", (req: AuthedRequest, res) => {
  const books = db
    .prepare("SELECT * FROM books WHERE owner_id = ? ORDER BY created_at DESC")
    .all(req.userId) as BookRow[];

  const result = books.map((book) => {
    const noteCount = (
      db
        .prepare("SELECT COUNT(*) as c FROM notes WHERE book_id = ? AND user_id = ?")
        .get(book.id, req.userId) as { c: number }
    ).c;
    const progress = getProgress(book.id, req.userId!);
    const shareCount = (
      db.prepare("SELECT COUNT(*) as c FROM shares WHERE book_id = ?").get(book.id) as {
        c: number;
      }
    ).c;
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      totalPages: book.total_pages,
      coverUrl: book.cover_url,
      noteCount,
      progress,
      shareCount,
    };
  });

  res.json(result);
});

// Add a book
booksRouter.post("/", (req: AuthedRequest, res) => {
  const { title, author, totalPages, coverUrl } = req.body || {};
  if (!title || !author || !totalPages || totalPages < 1) {
    return res.status(400).json({ error: "title, author, and totalPages are required" });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO books (id, owner_id, title, author, total_pages, cover_url) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.userId, title, author, totalPages, coverUrl || null);

  res.status(201).json({ id });
});

// Book detail: own notes, own progress, friend notes-back (spoiler filtered), shares
booksRouter.get("/:id", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const allNotes = notesForBook(book.id);

  const myNotes = allNotes
    .filter((n) => n.user_id === req.userId)
    .sort((a, b) => a.page - b.page || a.created_at.localeCompare(b.created_at))
    .map((n) => ({
      id: n.id,
      page: n.page,
      text: n.text,
      emoji: n.emoji,
      createdAt: n.created_at,
    }));

  const progress = getProgress(book.id, req.userId!);

  const friendNoteRows = allNotes.filter((n) => n.user_id !== req.userId);
  const { visible: friendNotes, hiddenCount: hiddenFriendNotes } = partitionNotes(
    book,
    friendNoteRows,
    req.userId!
  );

  const shares = (
    db
      .prepare("SELECT id, code, created_at FROM shares WHERE book_id = ? ORDER BY created_at DESC")
      .all(book.id) as { id: string; code: string; created_at: string }[]
  ).map((s) => {
    const members = db
      .prepare(
        `SELECT users.name FROM share_members
         JOIN users ON users.id = share_members.user_id
         WHERE share_members.share_id = ?`
      )
      .all(s.id) as { name: string }[];
    return { ...s, members: members.map((m) => m.name) };
  });

  res.json({
    id: book.id,
    title: book.title,
    author: book.author,
    totalPages: book.total_pages,
    coverUrl: book.cover_url,
    progress,
    myNotes,
    friendNotes,
    hiddenFriendNotes,
    shares,
  });
});

// Log a note as the book's owner
booksRouter.post("/:id/notes", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const { page, text, emoji } = req.body || {};
  if (page == null || !text) {
    return res.status(400).json({ error: "page and text are required" });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO notes (id, book_id, user_id, page, text, emoji) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, book.id, req.userId, page, text, emoji || null);

  res.status(201).json({ id });
});

// Set my reading progress
booksRouter.put("/:id/progress", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const { page, myTotalPages } = req.body || {};
  if (page == null) return res.status(400).json({ error: "page is required" });

  setProgress(book.id, req.userId!, page, myTotalPages);
  res.json(getProgress(book.id, req.userId!));
});

// Reveal a friend note-back (owner-side reveal tap)
booksRouter.post("/:id/notes/:noteId/reveal", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

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

// Create a share link/code for this book
booksRouter.post("/:id/shares", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const id = uuid();
  const code = shareCode();
  db.prepare(`INSERT INTO shares (id, book_id, code) VALUES (?, ?, ?)`).run(id, book.id, code);
  res.status(201).json({ id, code });
});
