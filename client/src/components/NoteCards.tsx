import { useState } from "react";
import type { OwnNote, VisibleNote } from "../api/types";

export function OwnNoteCard({ note }: { note: OwnNote }) {
  return (
    <div className="note-card">
      <div className="note-card-head">
        <span className="note-location">Page {note.page}</span>
        {note.emoji && <span className="note-emoji">{note.emoji}</span>}
      </div>
      <p className="note-text">{note.text}</p>
    </div>
  );
}

export function RevealableNoteCard({
  note,
  onReveal,
}: {
  note: VisibleNote;
  onReveal: (noteId: string) => Promise<{ text: string }>;
}) {
  const [revealed, setRevealed] = useState(note.revealed);
  const [text, setText] = useState(note.text);
  const [revealing, setRevealing] = useState(false);

  if (!revealed) {
    return (
      <button
        className="note-card note-locked btn-block"
        disabled={revealing}
        onClick={async () => {
          setRevealing(true);
          try {
            const result = await onReveal(note.id);
            setText(result.text);
            setRevealed(true);
          } finally {
            setRevealing(false);
          }
        }}
      >
        <span>
          <span className="note-location">Page {note.page}</span>
          {" — "}
          <em>{revealing ? "revealing…" : `note from ${note.creatorName}, tap to reveal`}</em>
        </span>
        <span>🔓</span>
      </button>
    );
  }

  return (
    <div className="note-card">
      <div className="note-card-head">
        <span className="note-location">Page {note.page}</span>
        {note.emoji && <span className="note-emoji">{note.emoji}</span>}
      </div>
      <p className="note-text">{text}</p>
      <p className="note-from">from {note.creatorName}</p>
    </div>
  );
}

export function HiddenAheadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="hidden-ahead">
      <span>🔒</span>
      <span>
        {count} {count === 1 ? "note" : "notes"} hidden ahead — keep reading to unlock{" "}
        {count === 1 ? "it" : "them"}
      </span>
    </div>
  );
}
