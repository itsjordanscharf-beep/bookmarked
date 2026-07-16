import { db } from "../db";

export interface NoteRow {
  id: string;
  book_id: string;
  creator_type: "owner" | "viewer";
  creator_viewer_id: string | null;
  creator_name: string;
  location_type: "page" | "chapter";
  location_value: number;
  text: string;
  emoji: string | null;
  created_at: string;
}

export interface VisibleNote {
  id: string;
  locationType: "page" | "chapter";
  locationValue: number;
  creatorType: "owner" | "viewer";
  creatorName: string;
  emoji: string | null;
  createdAt: string;
  revealed: boolean;
  text?: string;
}

// A note is available (shown, at least as a locked card) once the reader's
// progress has reached its location; anything further ahead stays fully
// hidden and only contributes to the "hidden ahead" count. Available notes
// still withhold their text until explicitly revealed by the reader.
export function partitionNotes(
  notes: NoteRow[],
  progressValue: number,
  subjectType: "owner" | "viewer",
  subjectId: string
): { visible: VisibleNote[]; hiddenCount: number } {
  const revealedIds = new Set(
    (
      db
        .prepare(`SELECT note_id FROM reveals WHERE subject_type = ? AND subject_id = ?`)
        .all(subjectType, subjectId) as { note_id: string }[]
    ).map((r) => r.note_id)
  );

  const visible: VisibleNote[] = [];
  let hiddenCount = 0;

  for (const n of notes) {
    if (n.location_value <= progressValue) {
      const revealed = revealedIds.has(n.id);
      visible.push({
        id: n.id,
        locationType: n.location_type,
        locationValue: n.location_value,
        creatorType: n.creator_type,
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

  visible.sort(
    (a, b) => a.locationValue - b.locationValue || a.createdAt.localeCompare(b.createdAt)
  );

  return { visible, hiddenCount };
}
