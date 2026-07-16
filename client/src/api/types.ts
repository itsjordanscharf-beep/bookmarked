export interface Progress {
  page: number;
  myTotalPages: number | null;
}

export interface OwnNote {
  id: string;
  page: number;
  text: string;
  emoji: string | null;
  createdAt: string;
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

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  coverUrl: string | null;
}

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  coverUrl: string | null;
  noteCount: number;
  progress: Progress;
  shareCount: number;
}

export interface ShareInfo {
  id: string;
  code: string;
  created_at: string;
  members: string[];
}

export interface BookDetail extends BookMeta {
  progress: Progress;
  myNotes: OwnNote[];
  friendNotes: VisibleNote[];
  hiddenFriendNotes: number;
  shares: ShareInfo[];
}

export interface SharedView {
  book: BookMeta;
  isOwner: boolean;
  progress: Progress;
  ownerNotes: VisibleNote[];
  hiddenCount: number;
  myNotesBack: OwnNote[];
}

export interface BookSearchResult {
  externalId: string;
  title: string;
  author: string;
  totalPages: number | null;
  coverUrl: string | null;
}
