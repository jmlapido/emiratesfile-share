import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { getBucket } from '@/lib/r2';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDB();
  const bucket = await getBucket();

  const lock = await db
    .prepare('SELECT locked_by FROM lock_state WHERE id = 1')
    .first<{ locked_by: number | null }>();

  if (lock?.locked_by !== null && lock?.locked_by !== undefined && lock.locked_by !== session.userId) {
    return NextResponse.json({ error: 'File is locked by another user' }, { status: 423 });
  }

  const file = await db
    .prepare('SELECT id, original_name, r2_key FROM files WHERE is_current = 1 LIMIT 1')
    .first<{ id: number; original_name: string; r2_key: string }>();

  if (!file) return NextResponse.json({ error: 'No file available' }, { status: 404 });

  const object = await bucket.get(file.r2_key);
  if (!object) return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });

  await db
    .prepare(
      `UPDATE lock_state SET locked_by = ?, locked_at = datetime('now'),
       last_downloaded_by = ?, last_downloaded_at = datetime('now') WHERE id = 1`
    )
    .bind(session.userId, session.userId)
    .run();

  await db
    .prepare(`INSERT INTO history (file_id, user_id, action) VALUES (?, ?, 'download')`)
    .bind(file.id, session.userId)
    .run();

  const arrayBuffer = await object.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${file.original_name}"`,
      'Content-Length': String(arrayBuffer.byteLength),
    },
  });
}
