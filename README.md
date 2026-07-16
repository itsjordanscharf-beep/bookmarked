# Bookmarked

Track your reactions while reading a book, and share them with friends without spoiling anything. As you read, log short notes tied to a page or chapter. When you share a book, friends set their own reading progress and only ever see your notes for parts they've already reached — everything ahead stays hidden.

## How the spoiler lock works

- A note becomes **available** once a reader's progress reaches its page/chapter (progress ≥ location) — but it shows only as a "tap to reveal" card, not the content itself.
- Notes further ahead than the reader's progress are **fully hidden**, surfaced only as an aggregate "🔒 X notes hidden ahead" badge.
- Revealing is per-reader and sticky — once tapped, a note stays revealed on later visits.
- The same rule applies symmetrically to "notes left back" from a friend to you: your own progress gates what you see of theirs.

## Project layout

- `server/` — Express + TypeScript + SQLite (better-sqlite3) API
- `client/` — React + TypeScript + Vite frontend

## Running locally

```bash
# Terminal 1
cd server
npm install
npm run dev   # http://localhost:4000

# Terminal 2
cd client
npm install
npm run dev   # http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173, create an account, add a book, log some notes, set your progress, and generate a share link. Open that link in another browser (or incognito window) to see the friend's spoiler-safe view.

## Core flow (implemented)

1. Add a book (title, author, total pages or a chapter list)
2. Log short notes/reactions tied to a page or chapter, with multiple notes per book
3. Set your own reading progress
4. Generate a shareable link/code for a book
5. Friends open the link, set their own progress, and see locked/unlocked notes
6. Notes unlock automatically (as available-to-reveal) as progress advances

## Nice-to-haves (implemented)

- Personal library view of all your books
- Friends can leave a note back at the same page/chapter (dueling reactions), spoiler-gated the same way in both directions
- Emoji reaction tagging on notes
