import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { api, ApiError } from "../api/client";
import type { BookSearchResult } from "../api/types";

export function AddBookPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<BookSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const suppressNextSearch = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (suppressNextSearch.current) {
      suppressNextSearch.current = false;
      return;
    }
    const q = title.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      api
        .get(`/book-search?q=${encodeURIComponent(q)}`)
        .then((results: BookSearchResult[]) => {
          setSuggestions(results);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [title]);

  function selectSuggestion(result: BookSearchResult) {
    suppressNextSearch.current = true;
    setTitle(result.title);
    setAuthor(result.author);
    if (result.totalPages) setTotalPages(String(result.totalPages));
    setCoverUrl(result.coverUrl);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post("/books", {
        title,
        author,
        totalPages: Number(totalPages),
        coverUrl,
      });
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
        <p className="muted">Start typing a title — we'll fill in the details.</p>
      </div>
      <div className="card">
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ position: "relative" }}>
            <label htmlFor="title">Title</label>
            <input
              id="title"
              required
              autoComplete="off"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setCoverUrl(null);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {searching && (
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                Searching…
              </span>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="autocomplete-list">
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.externalId}
                    className="autocomplete-item"
                    onMouseDown={() => selectSuggestion(s)}
                  >
                    {s.coverUrl ? (
                      <img src={s.coverUrl} alt="" className="autocomplete-cover" />
                    ) : (
                      <span className="autocomplete-cover autocomplete-cover-placeholder">📕</span>
                    )}
                    <span className="autocomplete-text">
                      <span className="autocomplete-title">{s.title}</span>
                      <span className="autocomplete-author muted">
                        {s.author}
                        {s.totalPages ? ` · ${s.totalPages} pages` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="author">Author</label>
              <input
                id="author"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: "0 0 140px" }}>
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
          </div>

          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Adding…" : "Add book"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
