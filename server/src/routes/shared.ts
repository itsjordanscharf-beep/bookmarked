import { Router } from "express";
import { db } from "../db";
import { uuid, viewerToken as genViewerToken } from "../util/ids";
import { getProgress, setProgress, BookRow } from "../util/progress";
import { partitionNotes, NoteRow } from "../util/spoiler";

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

function loadViewer(share: ShareRow, req: any, res: any) {
  const token = req.header("X-Viewer-Token");
  if (!token) {
    res.status(401).json({ error: "Missing viewer token" });
    return null;
  }
  const viewer = db
    .prepare("SELECT * FROM viewers WHERE token = ? AND share_id = ?")
    .get(token, share.id) as { id: string; display_name: string } | undefined;
  if (!viewer) {
    res.status(401).json({ error: "Unknown viewer token for this share" });
    return null;
  }
  return viewer;
}

function bookMeta(book: BookRow) {
  const chapters = db
    .prepare("SELECT idx, title FROM chapters WHERE book_id = ? ORDER BY idx")
    .all(book.id);
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    type: book.type,
    totalPages: book.total_pages,
    chapters,
  };
}

// Public: fetch book meta for a share code (no viewer identity required yet)
sharedRouter.get("/:code", (req, res) => {
  const share = loadShare(req.params.code, res);
  if (!share) return;
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  res.json(bookMeta(book));
});

// Join a share as a friend, get back a persistent viewer token
sharedRouter.post("/:code/join", (req, res) => {
  const share = loadShare(req.params.code, res);
  if (!share) return;

  const { displayName } = req.body || {};
  if (!displayName || !String(displayName).trim()) {
    return res.status(400).json({ error: "displayName is required" });
  }

  const id = uuid();
  const token = genViewerToken();
  db.prepare(
    `INSERT INTO viewers (id, share_id, token, display_name) VALUES (?, ?, ?, ?)`
  ).run(id, share.id, token, String(displayName).trim());

  res.status(201).json({ viewerId: id, viewerToken: token, displayName: displayName.trim() });
});

// Friend's view: book + own progress + spoiler-filtered owner notes + own notes-back
sharedRouter.get("/:code/view", (req, res) => {
  const share = loadShare(req.params.code, res);
  if (!share) return;
  const viewer = loadViewer(share, req, res);
  if (!viewer) return;

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  const progress = getProgress(book, "viewer", viewer.id);

  const ownerNoteRows = db
    .prepare(`SELECT * FROM notes WHERE book_id = ? AND creator_type = 'owner'`)
    .all(book.id) as NoteRow[];
  const { visible: ownerNotes, hiddenCount } = partitionNotes(
    ownerNoteRows,
    progress.locationValue,
    "viewer",
    viewer.id
  );

  const myNotesBack = (
    db
      .prepare(
        `SELECT * FROM notes WHERE book_id = ? AND creator_type = 'viewer' AND creator_viewer_id = ?
         ORDER BY location_value, created_at`
      )
      .all(book.id, viewer.id) as NoteRow[]
  ).map((n) => ({
    id: n.id,
    locationType: n.location_type,
    locationValue: n.location_value,
    text: n.text,
    emoji: n.emoji,
    createdAt: n.created_at,
  }));

  res.json({
    book: bookMeta(book),
    displayName: viewer.display_name,
    progress,
    ownerNotes,
    hiddenCount,
    myNotesBack,
  });
});

// Friend updates their own progress
sharedRouter.put("/:code/progress", (req, res) => {
  const share = loadShare(req.params.code, res);
  if (!share) return;
  const viewer = loadViewer(share, req, res);
  if (!viewer) return;

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  const { locationType, locationValue } = req.body || {};
  if (!locationType || locationValue == null) {
    return res.status(400).json({ error: "locationType and locationValue are required" });
  }
  setProgress(book, "viewer", viewer.id, locationType, locationValue);
  res.json(getProgress(book, "viewer", viewer.id));
});

// Friend taps to reveal an available (unlocked) note
sharedRouter.post("/:code/notes/:noteId/reveal", (req, res) => {
  const share = loadShare(req.params.code, res);
  if (!share) return;
  const viewer = loadViewer(share, req, res);
  if (!viewer) return;

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  const note = db
    .prepare("SELECT * FROM notes WHERE id = ? AND book_id = ?")
    .get(req.params.noteId, book.id) as NoteRow | undefined;
  if (!note) return res.status(404).json({ error: "Note not found" });

  const progress = getProgress(book, "viewer", viewer.id);
  if (note.location_value > progress.locationValue) {
    return res.status(403).json({ error: "You haven't reached this part yet" });
  }

  db.prepare(
    `INSERT OR IGNORE INTO reveals (id, subject_type, subject_id, note_id) VALUES (?, 'viewer', ?, ?)`
  ).run(uuid(), viewer.id, note.id);

  res.json({ id: note.id, text: note.text });
});

// Friend leaves a note back for the owner (dueling reactions)
sharedRouter.post("/:code/notes", (req, res) => {
  const share = loadShare(req.params.code, res);
  if (!share) return;
  const viewer = loadViewer(share, req, res);
  if (!viewer) return;

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(share.book_id) as BookRow;
  const { locationType, locationValue, text, emoji } = req.body || {};
  if (!locationType || locationValue == null || !text) {
    return res.status(400).json({ error: "locationType, locationValue, and text are required" });
  }
  if (locationType !== (book.type === "chapters" ? "chapter" : "page")) {
    return res.status(400).json({ error: `This book is organized by ${book.type}` });
  }

  const progress = getProgress(book, "viewer", viewer.id);
  if (locationValue > progress.locationValue) {
    return res.status(403).json({ error: "You can only leave notes up to your own progress" });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO notes (id, book_id, creator_type, creator_viewer_id, creator_name, location_type, location_value, text, emoji)
     VALUES (?, ?, 'viewer', ?, ?, ?, ?, ?, ?)`
  ).run(id, book.id, viewer.id, viewer.display_name, locationType, locationValue, text, emoji || null);

  res.status(201).json({ id });
});
