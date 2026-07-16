import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api/client";
import type { BookMeta, SharedView } from "../api/types";
import { EmojiPicker } from "../components/EmojiPicker";
import { OwnNoteCard, RevealableNoteCard, HiddenAheadBadge } from "../components/NoteCards";

export function SharedBookPage() {
  const { code } = useParams<{ code: string }>();
  const { user, loading: authLoading } = useAuth();
  const [bookMeta, setBookMeta] = useState<BookMeta | null>(null);
  const [view, setView] = useState<SharedView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [progressValue, setProgressValue] = useState("");
  const [myTotalPages, setMyTotalPages] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  const [noteLocation, setNoteLocation] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteEmoji, setNoteEmoji] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!code) return;
    api
      .get(`/shared/${code}`)
      .then(setBookMeta)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
  }, [code]);

  async function loadView() {
    if (!code) return;
    const data = await api.get(`/shared/${code}/view`);
    setView(data);
    setProgressValue(String(data.progress.page));
    setMyTotalPages(data.progress.myTotalPages ? String(data.progress.myTotalPages) : "");
  }

  useEffect(() => {
    if (user) loadView().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, code]);

  async function handleProgressSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingProgress(true);
    try {
      await api.put(`/shared/${code}/progress`, {
        page: Number(progressValue),
        myTotalPages: myTotalPages ? Number(myTotalPages) : null,
      });
      await loadView();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update progress");
    } finally {
      setSavingProgress(false);
    }
  }

  async function handleNoteSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingNote(true);
    try {
      await api.post(`/shared/${code}/notes`, {
        page: Number(noteLocation),
        text: noteText,
        emoji: noteEmoji,
      });
      setNoteLocation("");
      setNoteText("");
      setNoteEmoji(null);
      await loadView();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function revealOwnerNote(noteId: string) {
    return api.post(`/shared/${code}/notes/${noteId}/reveal`);
  }

  if (authLoading || (!bookMeta && !error)) {
    return (
      <div className="app-shell">
        <main className="main">
          <div className="spinner-page">Opening shared book…</div>
        </main>
      </div>
    );
  }

  if (error && !bookMeta) {
    return (
      <div className="app-shell">
        <main className="main">
          <div className="error-banner">{error}</div>
        </main>
      </div>
    );
  }

  const redirectParam = `?redirect=${encodeURIComponent(`/shared/${code}`)}`;

  if (!user) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <span className="brand">
            <span className="brand-mark">🔖</span> Bookmarked
          </span>
        </header>
        <main className="main">
          <div className="page-header">
            <h1 className="serif">{bookMeta!.title}</h1>
            <p className="author muted">{bookMeta!.author}</p>
          </div>
          <div className="card join-card">
            <p className="serif" style={{ fontSize: "1.1rem" }}>
              You've been sent this book's reactions
            </p>
            <p className="muted">
              Sign in to join — you'll set your own reading progress and only see notes for parts
              you've already reached.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
              <Link to={`/login${redirectParam}`} className="btn btn-primary">
                Log in
              </Link>
              <Link to={`/register${redirectParam}`} className="btn btn-secondary">
                Create an account
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app-shell">
        <main className="main">
          <div className="spinner-page">Loading…</div>
        </main>
      </div>
    );
  }

  const progressPct = Math.min(100, Math.round((view.progress.page / view.book.totalPages) * 100));

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark">🔖</span> Bookmarked
        </span>
        <span className="muted">Reading as {user.name}</span>
      </header>
      <main className="main">
        <div className="page-header">
          <h1 className="serif">{view.book.title}</h1>
          <p className="author muted">{view.book.author}</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <section className="card">
          <h3 style={{ marginTop: 0 }}>Your progress</h3>
          <div className="progress-track" style={{ marginBottom: 14 }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <form onSubmit={handleProgressSubmit} className="progress-block">
            <div className="field" style={{ marginBottom: 0, flex: "0 0 140px" }}>
              <label htmlFor="progress">Currently on page</label>
              <input
                id="progress"
                type="number"
                min={0}
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "0 0 200px" }}>
              <label htmlFor="myTotalPages">My edition's total pages (optional)</label>
              <input
                id="myTotalPages"
                type="number"
                min={1}
                placeholder={String(view.book.totalPages)}
                value={myTotalPages}
                onChange={(e) => setMyTotalPages(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" disabled={savingProgress}>
              {savingProgress ? "Saving…" : "Update progress"}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: "0.8rem" }}>
            On a different edition (like a Kindle) than the {view.book.totalPages}-page reference?
            Set your own page count above — notes unlock by percentage through the book, not raw
            page number.
          </p>
        </section>

        <h3 className="section-title">Notes unlocked so far</h3>
        {view.ownerNotes.length === 0 && view.hiddenCount === 0 ? (
          <p className="muted">No notes at all yet.</p>
        ) : (
          <>
            {view.ownerNotes.length === 0 && (
              <p className="muted">Nothing unlocked yet — update your progress as you read.</p>
            )}
            <div className="note-list">
              {view.ownerNotes.map((n) => (
                <RevealableNoteCard key={n.id} note={n} onReveal={revealOwnerNote} />
              ))}
            </div>
            <HiddenAheadBadge count={view.hiddenCount} />
          </>
        )}

        <h3 className="section-title">Leave a note back</h3>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Duel reactions — leave your own note at a page you've already reached.
          </p>
          <form onSubmit={handleNoteSubmit}>
            <div className="field-row">
              <div className="field" style={{ flex: "0 0 120px" }}>
                <label htmlFor="noteLocation">Page</label>
                <input
                  id="noteLocation"
                  type="number"
                  min={0}
                  max={view.progress.page}
                  required
                  value={noteLocation}
                  onChange={(e) => setNoteLocation(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Reaction</label>
                <EmojiPicker value={noteEmoji} onChange={setNoteEmoji} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="noteText">Note</label>
              <textarea
                id="noteText"
                rows={3}
                required
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Your reaction…"
              />
            </div>
            <button className="btn btn-primary" disabled={savingNote}>
              {savingNote ? "Saving…" : "Add note"}
            </button>
          </form>
        </div>

        {view.myNotesBack.length > 0 && (
          <>
            <h3 className="section-title">Notes you've left</h3>
            <div className="note-list">
              {view.myNotesBack.map((n) => (
                <OwnNoteCard key={n.id} note={n} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
