CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT DEFAULT (datetime('now')),
  is_current INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER REFERENCES files(id),
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('upload','download','skip')),
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lock_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  locked_by INTEGER REFERENCES users(id),
  locked_at TEXT,
  last_downloaded_by INTEGER REFERENCES users(id),
  last_downloaded_at TEXT,
  last_uploaded_by INTEGER REFERENCES users(id),
  last_uploaded_at TEXT
);

INSERT OR IGNORE INTO lock_state (id) VALUES (1);

-- Seed users
-- Passwords (SHA-256): matthew123, joy123, alex123, admin123
INSERT OR IGNORE INTO users (id, name, password_hash) VALUES
  (1, 'Matthew', '85b63439cb0cfceee00c2952ed1bfced369723d6e076c5baeec1fbb67ab8b28a'),
  (2, 'Joy',     '814b8679e06c5f27c0e4e794e85d4923cab6e9882a52f474c78e99b304096dd6'),
  (3, 'Alex',    'd9508122cd143d69df229bf3624b7bcb2b8ac81ed210a0c926455ef119c12abd'),
  (4, 'Admin',   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');
