import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { api } from "../api/client";
import type { BookSummary } from "../api/types";

export function LibraryPage() {
  const [books, setBooks] = useState<BookSummary[] | null>(null);

  useEffect(() => {
    api.get("/books").then(setBooks);
  }, []);

  return (
    <Layout>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="serif">Your library</h1>
          <p className="muted">Every book you're logging reactions for.</p>
        </div>
        <Link to="/books/new" className="btn btn-primary">
          + Add a book
        </Link>
      </div>

      {books === null && <div className="spinner-page">Loading your shelf…</div>}

      {books && books.length === 0 && (
        <div className="card empty-state">
          <p className="serif" style={{ fontSize: "1.2rem" }}>
            Your shelf is empty
          </p>
          <p className="muted">Add your first book to start logging reactions.</p>
          <Link to="/books/new" className="btn btn-primary" style={{ marginTop: 14 }}>
            + Add a book
          </Link>
        </div>
      )}

      {books && books.length > 0 && (
        <div className="book-list">
          {books.map((b) => (
            <Link key={b.id} to={`/books/${b.id}`} className="card book-row">
              <div>
                <p className="book-row-title">{b.title}</p>
                <p className="book-row-author muted">{b.author}</p>
              </div>
              <div className="book-row-meta">
                <span className="pill">
                  {b.type === "pages"
                    ? `p. ${b.progress.locationValue}${b.totalPages ? ` / ${b.totalPages}` : ""}`
                    : `ch. ${b.progress.locationValue}`}
                </span>
                <span className="muted">{b.noteCount} notes</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
