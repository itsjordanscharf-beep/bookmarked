# Bookmarked

Track your reactions while reading a book, and share them with friends without spoiling anything. As you read, log short notes tied to a page. When you share a book, friends sign in, set their own reading progress, and only ever see your notes for parts they've already reached — everything ahead stays hidden.

## How the spoiler lock works

- Notes are compared by **percentage through the book**, not raw page number, so a Kindle reader and a print reader on different paginations still unlock the same notes at the same point in the story. Each reader can optionally record their own edition's total page count; it defaults to the book's reference page count otherwise.
- A note becomes **available** once a reader's percent progress reaches the note's percent position — but it shows only as a "tap to reveal" card, not the content itself.
- Notes further ahead are **fully hidden**, surfaced only as an aggregate "🔒 X notes hidden ahead" badge.
- Revealing is per-reader and sticky — once tapped, a note stays revealed on later visits.
- The same rule applies symmetrically to "notes left back" from a friend to you: your own progress gates what you see of theirs.

## Accounts

Friends must sign in (email/password or Google) before a share link reveals anything — there's no anonymous joining. This also means a friend's joined books show up in their own library.

## Project layout

- `server/` — Express + TypeScript + SQLite (better-sqlite3) API
- `client/` — React + TypeScript + Vite frontend

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `JWT_SECRET` | server | **Yes** in production | Signs session cookies. Generate with `openssl rand -hex 32`. |
| `DATABASE_PATH` | server | Recommended in production | Path to the SQLite file, e.g. a mounted volume like `/data/bookmarked.db`. Defaults to a local `data/` folder otherwise. |
| `GOOGLE_CLIENT_ID` | server | Only for Google sign-in | OAuth client ID used to verify Google ID tokens. |
| `VITE_GOOGLE_CLIENT_ID` | client (build-time) | Only for Google sign-in | Same client ID, baked into the frontend build so it can render Google's sign-in button. Must match `GOOGLE_CLIENT_ID`. |
| `GOOGLE_BOOKS_API_KEY` | server | Optional | Raises the rate limit on the book-search/autocomplete endpoint (Google Books API works without a key at low volume). |

### Setting up Google Sign-In

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project, then go to **APIs & Services → Credentials**.
2. Create an **OAuth client ID** of type **Web application**.
3. Under **Authorized JavaScript origins**, add every origin you'll load the app from (e.g. `http://localhost:5173` for local dev, and your production URL once you have it).
4. Copy the generated **Client ID** (not the secret — this flow never needs the client secret) into `GOOGLE_CLIENT_ID` (server) and `VITE_GOOGLE_CLIENT_ID` (client build).
5. Email/password sign-in keeps working regardless — Google is an additional option, not a replacement.

## Running locally

```bash
# Terminal 1
cd server
npm install
JWT_SECRET=dev-secret npm run dev   # http://localhost:4000

# Terminal 2
cd client
npm install
npm run dev   # http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173, create an account, add a book, log some notes, set your progress, and generate a share link. Open that link in another browser (or incognito window) — the friend must sign in before seeing anything.

## Core flow (implemented)

1. Add a book — search-as-you-type against Google Books autofills author, page count, and cover; total pages is the only required field
2. Log short notes/reactions tied to a page, with multiple notes per book
3. Set your own reading progress (optionally recording your own edition's page count)
4. Generate a shareable link/code for a book
5. Friends sign in, set their own progress, and see locked/unlocked notes (percentage-normalized across editions)
6. Notes unlock automatically (as available-to-reveal) as progress advances

## Nice-to-haves (implemented)

- Personal library view of all your books, including ones friends have joined
- Google Sign-In alongside email/password, for both the book owner and friends
- Friends can leave a note back at the same page (dueling reactions), spoiler-gated the same way in both directions
- Emoji reaction tagging on notes
