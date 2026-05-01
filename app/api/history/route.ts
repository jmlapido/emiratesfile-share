import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDB();

  const results = await db
    .prepare(
      `SELECT h.id, h.action, h.timestamp,
              u.name as user_name,
              f.id as file_id, f.revision, f.original_name, f.size_bytes
       FROM history h
       LEFT JOIN users u ON h.user_id = u.id
       LEFT JOIN files f ON h.file_id = f.id
       ORDER BY h.timestamp DESC
       LIMIT 100`
    )
    .all();

  return NextResponse.json({ history: results.results });
}
