import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { api, ApiError } from "../api/client";
import type { BookDetail } from "../api/types";
import { EmojiPicker } from "../components/EmojiPicker";
import { OwnNoteCard, RevealableNoteCard, HiddenAheadBadge, locTypeForBook } from "../components/NoteCards";

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [progressValue, setProgressValue] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  const [noteLocation, setNoteLocation] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteEmoji, setNoteEmoji] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  const [creatingShare, setCreatingShare] = useState(false);

  async function reload() {
    const data = await api.get(`/books/${id}`);
    setBook(data);
    setProgressValue(String(data.progress.locationValue));
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <Layout>
        <div className="error-banner">{error}</div>
      </Layout>
    );
  }

  if (!book) {
    return (
      <Layout>
        <div className="spinner-page">Loading book…</div>
      </Layout>
    );
  }

  const locType = locTypeForBook(book.type);
  const progressPct =
    book.type === "pages" && book.totalPages
      ? Math.min(100, Math.round((book.progress.locationValue / book.totalPages) * 100))
      : null;

  async function handleProgressSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingProgress(true);
    try {
      await api.put(`/books/${id}/progress`, {
        locationType: locType,
        locationValue: Number(progressValue),
      });
      await reload();
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
      await api.post(`/books/${id}/notes`, {
        locationType: locType,
        locationValue: Number(noteLocation),
        text: noteText,
        emoji: noteEmoji,
      });
      setNoteLocation("");
      setNoteText("");
      setNoteEmoji(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleCreateShare() {
    setCreatingShare(true);
    try {
      await api.post(`/books/${id}/shares`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create share link");
    } finally {
      setCreatingShare(false);
    }
  }

  async function revealFriendNote(noteId: string) {
    return api.post(`/books/${id}/notes/${noteId}/reveal`);
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="serif">{book.title}</h1>
        <p className="author muted">{book.author}</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="card">
        <h3 style={{ marginTop: 0 }}>My progress</h3>
        {progressPct !== null && (
          <div className="progress-track" style={{ marginBottom: 14 }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}
        <form onSubmit={handleProgressSubmit} className="progress-block">
          <div className="field" style={{ marginBottom: 0, flex: "0 0 160px" }}>
            <label htmlFor="progress">
              {book.type === "pages" ? "Currently on page" : "Currently on chapter"}
            </label>
            <input
              id="progress"
              type="number"
              min={0}
              max={book.type === "pages" ? book.totalPages ?? undefined : book.chapters.length}
              value={progressValue}
              onChange={(e) => setProgressValue(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" disabled={savingProgress}>
            {savingProgress ? "Saving…" : "Update progress"}
          </button>
        </form>
        {book.type === "chapters" && (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: "0.85rem" }}>
            {book.chapters.map((c) => c.title).join(" · ")}
          </p>
        )}
      </section>

      <h3 className="section-title">Log a note</h3>
      <div className="card">
        <form onSubmit={handleNoteSubmit}>
          <div className="field-row">
            <div className="field" style={{ flex: "0 0 160px" }}>
              <label htmlFor="noteLocation">
                {book.type === "pages" ? "Page" : "Chapter"}
              </label>
              <input
                id="noteLocation"
                type="number"
                min={0}
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
              placeholder="What just happened?!"
            />
          </div>
          <button className="btn btn-primary" disabled={savingNote}>
            {savingNote ? "Saving…" : "Add note"}
          </button>
        </form>
      </div>

      <h3 className="section-title">My notes ({book.myNotes.length})</h3>
      {book.myNotes.length === 0 ? (
        <p className="muted">No notes yet — log your first reaction above.</p>
      ) : (
        <div className="note-list">
          {book.myNotes.map((n) => (
            <OwnNoteCard key={n.id} note={n} chapters={book.chapters} />
          ))}
        </div>
      )}

      <h3 className="section-title">Share this book</h3>
      <div className="card">
        {book.shares.length === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Generate a link so a friend can follow along with their own progress.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            {book.shares.map((s) => {
              const url = `${window.location.origin}/shared/${s.code}`;
              return (
                <div key={s.id}>
                  <div className="share-code-box">
                    <span style={{ flex: 1 }}>{url}</span>
                    <button
                      className="btn btn-ghost"
                      onClick={() => navigator.clipboard.writeText(url)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button className="btn btn-secondary" onClick={handleCreateShare} disabled={creatingShare}>
          {creatingShare ? "Creating…" : "+ New share link"}
        </button>
      </div>

      <h3 className="section-title">Notes from friends</h3>
      {book.friendNotes.length === 0 && book.hiddenFriendNotes === 0 ? (
        <p className="muted">
          Nothing yet — once a friend leaves a note back, it'll show up here (spoiler-safe, based
          on your own progress).
        </p>
      ) : (
        <>
          <div className="note-list">
            {book.friendNotes.map((n) => (
              <RevealableNoteCard
                key={n.id}
                note={n}
                chapters={book.chapters}
                onReveal={revealFriendNote}
              />
            ))}
          </div>
          <HiddenAheadBadge count={book.hiddenFriendNotes} />
        </>
      )}
    </Layout>
  );
}
