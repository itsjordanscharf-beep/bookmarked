import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { api, ApiError } from "../api/client";
import type { BookType } from "../api/types";

export function AddBookPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [type, setType] = useState<BookType>("pages");
  const [totalPages, setTotalPages] = useState("");
  const [chapterText, setChapterText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { title, author, type };
      if (type === "pages") {
        body.totalPages = Number(totalPages);
      } else {
        body.chapters = chapterText
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean);
      }
      const created = await api.post("/books", body);
      navigate(`/books/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="serif">Add a book</h1>
        <p className="muted">Tell us the basics — you'll log reactions next.</p>
      </div>
      <div className="card">
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="author">Author</label>
              <input
                id="author"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="type">This book is organized by</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as BookType)}>
              <option value="pages">Pages</option>
              <option value="chapters">Chapters</option>
            </select>
          </div>

          {type === "pages" ? (
            <div className="field">
              <label htmlFor="totalPages">Total pages</label>
              <input
                id="totalPages"
                type="number"
                min={1}
                required
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="chapters">Chapter titles (one per line, in order)</label>
              <textarea
                id="chapters"
                rows={6}
                required
                placeholder={"Chapter 1: The Beginning\nChapter 2: ..."}
                value={chapterText}
                onChange={(e) => setChapterText(e.target.value)}
              />
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Adding…" : "Add book"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
