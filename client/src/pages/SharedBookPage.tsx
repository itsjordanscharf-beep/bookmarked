import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { viewerApi, getViewerSession, saveViewerSession, ApiError } from "../api/client";
import type { BookMeta, SharedView } from "../api/types";
import { EmojiPicker } from "../components/EmojiPicker";
import { OwnNoteCard, RevealableNoteCard, HiddenAheadBadge, locTypeForBook } from "../components/NoteCards";

export function SharedBookPage() {
  const { code } = useParams<{ code: string }>();
  const [bookMeta, setBookMeta] = useState<BookMeta | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<SharedView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);

  const [progressValue, setProgressValue] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  const [noteLocation, setNoteLocation] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteEmoji, setNoteEmoji] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!code) return;
    viewerApi
      .get(`/shared/${code}`, "")
      .then(setBookMeta)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));

    const session = getViewerSession(code);
    if (session) setToken(session.viewerToken);
  }, [code]);

  async function loadView(t: string) {
    if (!code) return;
    const data = await viewerApi.get(`/shared/${code}/view`, t);
    setView(data);
    setProgressValue(String(data.progress.locationValue));
  }

  useEffect(() => {
    if (token) loadView(token).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!code) return;
    setJoining(true);
    setError(null);
    try {
      const result = await viewerApi.post(`/shared/${code}/join`, null, { displayName });
      saveViewerSession(code, result);
      setToken(result.viewerToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  async function handleProgressSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code || !token || !bookMeta) return;
    setSavingProgress(true);
    try {
      await viewerApi.put(`/shared/${code}/progress`, token, {
        locationType: locTypeForBook(bookMeta.type),
        locationValue: Number(progressValue),
      });
      await loadView(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update progress");
    } finally {
      setSavingProgress(false);
    }
  }

  async function handleNoteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code || !token || !bookMeta) return;
    setSavingNote(true);
    try {
      await viewerApi.post(`/shared/${code}/notes`, token, {
        locationType: locTypeForBook(bookMeta.type),
        locationValue: Number(noteLocation),
        text: noteText,
        emoji: noteEmoji,
      });
      setNoteLocation("");
      setNoteText("");
      setNoteEmoji(null);
      await loadView(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function revealOwnerNote(noteId: string) {
    if (!code || !token) throw new Error("Not ready");
    return viewerApi.post(`/shared/${code}/notes/${noteId}/reveal`, token);
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

  if (!bookMeta) {
    return (
      <div className="app-shell">
        <main className="main">
          <div className="spinner-page">Opening shared book…</div>
        </main>
      </div>
    );
  }

  if (!token || !view) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <span className="brand">
            <span className="brand-mark">🔖</span> Bookmarked
          </span>
        </header>
        <main className="main">
          <div className="page-header">
            <h1 className="serif">{bookMeta.title}</h1>
            <p className="author muted">{bookMeta.author}</p>
          </div>
          <div className="card join-card">
            <p className="serif" style={{ fontSize: "1.1rem" }}>
              You've been sent this book's reactions
            </p>
            <p className="muted">
              Enter your name, then set your own reading progress — you'll only see notes for
              parts you've already reached.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleJoin}>
              <div className="field">
                <label htmlFor="displayName">Your name</label>
                <input
                  id="displayName"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-block" disabled={joining}>
                {joining ? "Joining…" : "Start reading along"}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const progressPct =
    bookMeta.type === "pages" && bookMeta.totalPages
      ? Math.min(100, Math.round((view.progress.locationValue / bookMeta.totalPages) * 100))
      : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark">🔖</span> Bookmarked
        </span>
        <span className="muted">Reading as {view.displayName}</span>
      </header>
      <main className="main">
        <div className="page-header">
          <h1 className="serif">{bookMeta.title}</h1>
          <p className="author muted">{bookMeta.author}</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <section className="card">
          <h3 style={{ marginTop: 0 }}>Your progress</h3>
          {progressPct !== null && (
            <div className="progress-track" style={{ marginBottom: 14 }}>
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          )}
          <form onSubmit={handleProgressSubmit} className="progress-block">
            <div className="field" style={{ marginBottom: 0, flex: "0 0 160px" }}>
              <label htmlFor="progress">
                {bookMeta.type === "pages" ? "Currently on page" : "Currently on chapter"}
              </label>
              <input
                id="progress"
                type="number"
                min={0}
                max={bookMeta.type === "pages" ? bookMeta.totalPages ?? undefined : bookMeta.chapters.length}
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" disabled={savingProgress}>
              {savingProgress ? "Saving…" : "Update progress"}
            </button>
          </form>
          {bookMeta.type === "chapters" && (
            <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: "0.85rem" }}>
              {bookMeta.chapters.map((c) => c.title).join(" · ")}
            </p>
          )}
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
                <RevealableNoteCard
                  key={n.id}
                  note={n}
                  chapters={bookMeta.chapters}
                  onReveal={revealOwnerNote}
                />
              ))}
            </div>
            <HiddenAheadBadge count={view.hiddenCount} />
          </>
        )}

        <h3 className="section-title">Leave a note back</h3>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Duel reactions — leave your own note at a page or chapter you've already reached.
          </p>
          <form onSubmit={handleNoteSubmit}>
            <div className="field-row">
              <div className="field" style={{ flex: "0 0 160px" }}>
                <label htmlFor="noteLocation">{bookMeta.type === "pages" ? "Page" : "Chapter"}</label>
                <input
                  id="noteLocation"
                  type="number"
                  min={0}
                  max={view.progress.locationValue}
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
                <OwnNoteCard key={n.id} note={n} chapters={bookMeta.chapters} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
