export type LocationType = "page" | "chapter";
export type BookType = "pages" | "chapters";

export interface Chapter {
  idx: number;
  title: string;
}

export interface Progress {
  locationType: LocationType;
  locationValue: number;
}

export interface OwnNote {
  id: string;
  locationType: LocationType;
  locationValue: number;
  text: string;
  emoji: string | null;
  createdAt: string;
}

export interface VisibleNote {
  id: string;
  locationType: LocationType;
  locationValue: number;
  creatorType: "owner" | "viewer";
  creatorName: string;
  emoji: string | null;
  createdAt: string;
  revealed: boolean;
  text?: string;
}

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  type: BookType;
  totalPages: number | null;
  chapters: Chapter[];
}

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  type: BookType;
  totalPages: number | null;
  noteCount: number;
  progress: Progress;
  shareCount: number;
}

export interface BookDetail extends BookMeta {
  progress: Progress;
  myNotes: OwnNote[];
  friendNotes: VisibleNote[];
  hiddenFriendNotes: number;
  shares: { id: string; code: string; created_at: string }[];
}

export interface SharedView {
  book: BookMeta;
  displayName: string;
  progress: Progress;
  ownerNotes: VisibleNote[];
  hiddenCount: number;
  myNotesBack: OwnNote[];
}

export function locationLabel(type: LocationType, value: number, chapters?: Chapter[]): string {
  if (type === "chapter") {
    const chapter = chapters?.find((c) => c.idx === value);
    return chapter ? `Ch. ${value} — ${chapter.title}` : `Chapter ${value}`;
  }
  return `Page ${value}`;
}
