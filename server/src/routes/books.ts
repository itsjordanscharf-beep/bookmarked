import { Router } from "express";
import { db } from "../db";
import { uuid, shareCode } from "../util/ids";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { getProgress, setProgress, BookRow } from "../util/progress";
import { partitionNotes, NoteRow } from "../util/spoiler";

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
        .prepare("SELECT COUNT(*) as c FROM notes WHERE book_id = ? AND creator_type = 'owner'")
        .get(book.id) as { c: number }
    ).c;
    const progress = getProgress(book, "owner", req.userId!);
    const shareCount = (
      db.prepare("SELECT COUNT(*) as c FROM shares WHERE book_id = ?").get(book.id) as {
        c: number;
      }
    ).c;
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      type: book.type,
      totalPages: book.total_pages,
      noteCount,
      progress,
      shareCount,
    };
  });

  res.json(result);
});

// Add a book
booksRouter.post("/", (req: AuthedRequest, res) => {
  const { title, author, type, totalPages, chapters } = req.body || {};
  if (!title || !author || !type) {
    return res.status(400).json({ error: "title, author, and type are required" });
  }
  if (type !== "pages" && type !== "chapters") {
    return res.status(400).json({ error: "type must be 'pages' or 'chapters'" });
  }
  if (type === "pages" && (!totalPages || totalPages < 1)) {
    return res.status(400).json({ error: "totalPages is required for page-based books" });
  }
  if (type === "chapters" && (!Array.isArray(chapters) || chapters.length === 0)) {
    return res.status(400).json({ error: "chapters list is required for chapter-based books" });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO books (id, owner_id, title, author, type, total_pages) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.userId, title, author, type, type === "pages" ? totalPages : null);

  if (type === "chapters") {
    const insert = db.prepare(`INSERT INTO chapters (id, book_id, idx, title) VALUES (?, ?, ?, ?)`);
    chapters.forEach((title: string, i: number) => insert.run(uuid(), id, i + 1, title));
  }

  res.status(201).json({ id });
});

// Book detail: chapters, own notes, own progress, friend notes-back (spoiler filtered), shares
booksRouter.get("/:id", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const chapters = db
    .prepare("SELECT idx, title FROM chapters WHERE book_id = ? ORDER BY idx")
    .all(book.id);

  const myNotes = (
    db
      .prepare(
        `SELECT * FROM notes WHERE book_id = ? AND creator_type = 'owner' ORDER BY location_value, created_at`
      )
      .all(book.id) as NoteRow[]
  ).map((n) => ({
    id: n.id,
    locationType: n.location_type,
    locationValue: n.location_value,
    text: n.text,
    emoji: n.emoji,
    createdAt: n.created_at,
  }));

  const progress = getProgress(book, "owner", req.userId!);

  const friendNoteRows = db
    .prepare(`SELECT * FROM notes WHERE book_id = ? AND creator_type = 'viewer'`)
    .all(book.id) as NoteRow[];
  const { visible: friendNotes, hiddenCount: hiddenFriendNotes } = partitionNotes(
    friendNoteRows,
    progress.locationValue,
    "owner",
    req.userId!
  );

  const shares = db
    .prepare("SELECT id, code, created_at FROM shares WHERE book_id = ? ORDER BY created_at DESC")
    .all(book.id);

  res.json({
    id: book.id,
    title: book.title,
    author: book.author,
    type: book.type,
    totalPages: book.total_pages,
    chapters,
    progress,
    myNotes,
    friendNotes,
    hiddenFriendNotes,
    shares,
  });
});

// Log a note as the owner
booksRouter.post("/:id/notes", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const { locationType, locationValue, text, emoji } = req.body || {};
  if (!locationType || locationValue == null || !text) {
    return res.status(400).json({ error: "locationType, locationValue, and text are required" });
  }
  if (locationType !== (book.type === "chapters" ? "chapter" : "page")) {
    return res.status(400).json({ error: `This book is organized by ${book.type}` });
  }

  const id = uuid();
  const userRow = db.prepare("SELECT name FROM users WHERE id = ?").get(req.userId) as {
    name: string;
  };
  db.prepare(
    `INSERT INTO notes (id, book_id, creator_type, creator_name, location_type, location_value, text, emoji)
     VALUES (?, ?, 'owner', ?, ?, ?, ?, ?)`
  ).run(id, book.id, userRow.name, locationType, locationValue, text, emoji || null);

  res.status(201).json({ id });
});

// Set my reading progress
booksRouter.put("/:id/progress", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const { locationType, locationValue } = req.body || {};
  if (!locationType || locationValue == null) {
    return res.status(400).json({ error: "locationType and locationValue are required" });
  }
  setProgress(book, "owner", req.userId!, locationType, locationValue);
  res.json(getProgress(book, "owner", req.userId!));
});

// Reveal a friend note-back (owner-side reveal tap)
booksRouter.post("/:id/notes/:noteId/reveal", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const note = db
    .prepare("SELECT * FROM notes WHERE id = ? AND book_id = ?")
    .get(req.params.noteId, book.id) as NoteRow | undefined;
  if (!note) return res.status(404).json({ error: "Note not found" });

  const progress = getProgress(book, "owner", req.userId!);
  if (note.location_value > progress.locationValue) {
    return res.status(403).json({ error: "You haven't reached this part yet" });
  }

  db.prepare(
    `INSERT OR IGNORE INTO reveals (id, subject_type, subject_id, note_id) VALUES (?, 'owner', ?, ?)`
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

booksRouter.get("/:id/shares", (req: AuthedRequest, res) => {
  const book = loadOwnedBook(req, res);
  if (!book) return;

  const shares = db
    .prepare("SELECT id, code, created_at FROM shares WHERE book_id = ? ORDER BY created_at DESC")
    .all(book.id) as { id: string; code: string; created_at: string }[];

  const withViewers = shares.map((s) => {
    const viewers = db
      .prepare("SELECT id, display_name FROM viewers WHERE share_id = ?")
      .all(s.id) as { id: string; display_name: string }[];
    return { ...s, viewers };
  });

  res.json(withViewers);
});
