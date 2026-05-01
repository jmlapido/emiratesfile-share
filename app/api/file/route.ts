import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { getBucket } from '@/lib/r2';

type LockRow = {
  locked_by: number | null;
  locked_at: string | null;
  locked_by_name: string | null;
  last_downloaded_by: number | null;
  last_downloaded_at: string | null;
  last_downloaded_by_name: string | null;
  last_uploaded_by: number | null;
  last_uploaded_at: string | null;
  last_uploaded_by_name: string | null;
};

type FileRow = {
  id: number;
  revision: number;
  original_name: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by_name: string;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDB();

  const file = await db
    .prepare(
      `SELECT f.id, f.revision, f.original_name, f.size_bytes, f.uploaded_at,
              u.name as uploaded_by_name
       FROM files f
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.is_current = 1
       LIMIT 1`
    )
    .first<FileRow>();

  const lock = await db
    .prepare(
      `SELECT ls.*,
              lu.name as locked_by_name,
              du.name as last_downloaded_by_name,
              uu.name as last_uploaded_by_name
       FROM lock_state ls
       LEFT JOIN users lu ON ls.locked_by = lu.id
       LEFT JOIN users du ON ls.last_downloaded_by = du.id
       LEFT JOIN users uu ON ls.last_uploaded_by = uu.id
       WHERE ls.id = 1`
    )
    .first<LockRow>();

  return NextResponse.json({ file, lock, currentUser: session });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const force = req.nextUrl.searchParams.get('force') === '1';
  const db = await getDB();
  const bucket = await getBucket();

  const lock = await db
    .prepare('SELECT locked_by FROM lock_state WHERE id = 1')
    .first<{ locked_by: number | null }>();

  if (lock?.locked_by !== null && lock?.locked_by !== undefined && lock.locked_by !== session.userId) {
    return NextResponse.json({ error: 'File is locked by another user' }, { status: 423 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const fileHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (!force) {
    const dup = await db
      .prepare(
        `SELECT f.uploaded_at, u.name as uploaded_by_name
         FROM files f
         JOIN users u ON f.uploaded_by = u.id
         WHERE f.file_hash = ?
         LIMIT 1`
      )
      .bind(fileHash)
      .first<{ uploaded_at: string; uploaded_by_name: string }>();

    if (dup) {
      return NextResponse.json(
        { duplicate: true, uploadedBy: dup.uploaded_by_name, uploadedAt: dup.uploaded_at },
        { status: 409 }
      );
    }
  }

  const maxRev = await db
    .prepare('SELECT MAX(revision) as max_rev FROM files')
    .first<{ max_rev: number | null }>();
  const revision = (maxRev?.max_rev ?? 0) + 1;

  const r2Key = `files/rev-${revision}-${Date.now()}-${file.name}`;
  await bucket.put(r2Key, bytes, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  await db.prepare('UPDATE files SET is_current = 0').run();

  const insertResult = await db
    .prepare(
      `INSERT INTO files (revision, original_name, r2_key, size_bytes, file_hash, uploaded_by, is_current)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .bind(revision, file.name, r2Key, bytes.length, fileHash, session.userId)
    .run();

  const newFileId = insertResult.meta.last_row_id;

  await db
    .prepare(
      `UPDATE lock_state SET locked_by = NULL, locked_at = NULL,
       last_uploaded_by = ?, last_uploaded_at = datetime('now') WHERE id = 1`
    )
    .bind(session.userId)
    .run();

  await db
    .prepare(`INSERT INTO history (file_id, user_id, action) VALUES (?, ?, 'upload')`)
    .bind(newFileId, session.userId)
    .run();

  // Prune to 15 versions
  const allFiles = await db
    .prepare('SELECT id, r2_key FROM files ORDER BY revision ASC')
    .all<{ id: number; r2_key: string }>();

  if (allFiles.results.length > 15) {
    const toDelete = allFiles.results.slice(0, allFiles.results.length - 15);
    for (const f of toDelete) {
      await bucket.delete(f.r2_key);
      await db.prepare('DELETE FROM history WHERE file_id = ?').bind(f.id).run();
      await db.prepare('DELETE FROM files WHERE id = ?').bind(f.id).run();
    }
  }

  return NextResponse.json({ success: true, revision });
}
