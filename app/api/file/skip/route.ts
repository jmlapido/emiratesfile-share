import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getDB } from '@/lib/db';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDB();

  const lock = await db
    .prepare('SELECT locked_by FROM lock_state WHERE id = 1')
    .first<{ locked_by: number | null }>();

  if (lock?.locked_by !== session.userId) {
    return NextResponse.json({ error: 'You do not hold the lock' }, { status: 403 });
  }

  const file = await db
    .prepare('SELECT id FROM files WHERE is_current = 1 LIMIT 1')
    .first<{ id: number }>();

  await db.prepare('UPDATE lock_state SET locked_by = NULL, locked_at = NULL WHERE id = 1').run();

  if (file) {
    await db
      .prepare(`INSERT INTO history (file_id, user_id, action) VALUES (?, ?, 'skip')`)
      .bind(file.id, session.userId)
      .run();
  }

  return NextResponse.json({ success: true });
}
