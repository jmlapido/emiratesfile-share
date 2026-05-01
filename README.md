# Emirates File Share

A password-protected web app for sharing a single Excel file with a full version history. Users download the file, modify it, and upload the new version. A download lock prevents conflicts — no one else can download until the current holder uploads a new version or presses **Skip**.

**Live:** https://emiratesfile-share.sntae.workers.dev

---

## Features

- **Password-only login** — no username, just a password per person
- **Download → upload cycle** — when someone downloads, the file is locked for everyone else until they re-upload or skip
- **Skip button** — the downloader can release the lock without uploading a new version
- **Version history** — up to 15 versions stored; every version is individually downloadable
- **Duplicate detection** — SHA-256 content hash check warns if you upload the same file content as a previous revision
- **Event log CSV export** — download a full audit trail of all uploads, downloads, and skips
- **Activity panel** — shows who last downloaded, when, and current lock status in real time (auto-refreshes every 30 s)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite) |
| File storage | Cloudflare R2 |
| Auth | JWT cookie (`jose`) |
| Styling | Tailwind CSS v4 |

---

## Project Structure

```
emiratesfile-share/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # Main 75/25 split page
│   ├── login/page.tsx
│   └── api/
│       ├── auth/route.ts               # POST login
│       ├── auth/logout/route.ts        # POST logout
│       ├── file/route.ts               # GET status | POST upload
│       ├── file/download/route.ts      # GET download + set lock
│       ├── file/skip/route.ts          # POST release lock
│       └── history/
│           ├── route.ts                # GET event log
│           ├── [id]/download/route.ts  # GET specific version
│           └── export/route.ts         # GET CSV export
├── components/
│   ├── FilePanel.tsx                   # Left 75% — download/upload
│   └── HistoryPanel.tsx                # Right 25% — history list
├── lib/
│   ├── auth.ts                         # JWT + SHA-256 password hash
│   ├── db.ts                           # D1 helper
│   └── r2.ts                           # R2 helper
├── migrations/
│   └── 0001_init.sql                   # Schema + seeded users
├── middleware.ts                       # Cookie presence guard
├── wrangler.toml                       # Cloudflare config
└── open-next.config.ts
```

---

## Local Development

### Prerequisites

- Node.js 18+
- A Cloudflare account with Wrangler authenticated (`npx wrangler login`)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create Cloudflare resources (first time only)
npx wrangler d1 create emiratesfile-share-db
npx wrangler r2 bucket create emiratesfile-share

# 3. Update wrangler.toml with the database_id returned in step 2

# 4. Apply database schema and seed users
npm run db:migrate:local

# 5. Start the local dev server
npx wrangler dev --local
```

Open http://localhost:8787 — the login page should appear.

---

## Deploy to Cloudflare

```bash
# 1. Apply migration to remote database (first deploy only)
npm run db:migrate:remote

# 2. Build and deploy
npm run deploy
```

The `deploy` script runs `opennextjs-cloudflare build` then `wrangler deploy`.

---

## Managing Users

Users are stored in the D1 `users` table. Each user has a **name** and a **SHA-256 hashed password** (plain text is never stored).

### Default accounts

| Name | Password |
|---|---|
| Matthew | `matthew123` |
| Joy | `joy123` |
| Alex | `alex123` |
| Admin | `admin123` |

### Adding a new account

1. Generate the SHA-256 hash of the password. You can use a browser console:

   ```js
   const hash = await crypto.subtle.digest(
     "SHA-256",
     new TextEncoder().encode("yourpassword")
   );
   console.log([...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join(""));
   ```

   Or Node.js:
   ```bash
   node -e "
     const crypto = require('crypto');
     console.log(crypto.createHash('sha256').update('yourpassword').digest('hex'));
   "
   ```

2. Insert the user into D1:

   **Remote (production):**
   ```bash
   npx wrangler d1 execute emiratesfile-share-db --remote --command \
     "INSERT INTO users (name, password_hash) VALUES ('NewUser', '<hash-here>');"
   ```

   **Local (development):**
   ```bash
   npx wrangler d1 execute emiratesfile-share-db --local --command \
     "INSERT INTO users (name, password_hash) VALUES ('NewUser', '<hash-here>');"
   ```

### Changing a password

Generate the new hash (same as above), then:

```bash
# Remote
npx wrangler d1 execute emiratesfile-share-db --remote --command \
  "UPDATE users SET password_hash = '<new-hash>' WHERE name = 'Matthew';"

# Local
npx wrangler d1 execute emiratesfile-share-db --local --command \
  "UPDATE users SET password_hash = '<new-hash>' WHERE name = 'Matthew';"
```

### Removing a user

```bash
npx wrangler d1 execute emiratesfile-share-db --remote --command \
  "DELETE FROM users WHERE name = 'Alex';"
```

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,          -- SHA-256 hex
  created_at    TEXT DEFAULT (datetime('now'))
);

-- File versions (max 15 kept)
CREATE TABLE files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  revision      INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  r2_key        TEXT NOT NULL,          -- R2 object key
  size_bytes    INTEGER NOT NULL,
  file_hash     TEXT NOT NULL,          -- SHA-256 for duplicate detection
  uploaded_by   INTEGER REFERENCES users(id),
  uploaded_at   TEXT DEFAULT (datetime('now')),
  is_current    INTEGER DEFAULT 1
);

-- Event log
CREATE TABLE history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id   INTEGER REFERENCES files(id),
  user_id   INTEGER REFERENCES users(id),
  action    TEXT NOT NULL CHECK(action IN ('upload','download','skip')),
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Singleton download lock
CREATE TABLE lock_state (
  id                 INTEGER PRIMARY KEY CHECK(id = 1),
  locked_by          INTEGER REFERENCES users(id),
  locked_at          TEXT,
  last_downloaded_by INTEGER REFERENCES users(id),
  last_downloaded_at TEXT,
  last_uploaded_by   INTEGER REFERENCES users(id),
  last_uploaded_at   TEXT
);
```

---

## Environment Variables

Set in `wrangler.toml` under `[vars]`:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret key for signing session JWTs — change before deploying |

To rotate the secret, update `wrangler.toml` and redeploy. All existing sessions will be invalidated (everyone gets logged out).

---

## Known Limitations

- **Single file only** — designed for one shared Excel file. Uploading replaces the current version.
- **15 version limit** — the oldest version is automatically deleted when a 16th is uploaded.
- **No self-service password reset** — passwords must be changed via Wrangler CLI.
- **Windows build note** — `@opennextjs/cloudflare` has partial Windows compatibility. The build includes patches for Windows path handling. WSL is recommended for CI/CD.
