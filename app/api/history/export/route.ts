import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getDB } from '@/lib/db';

type HistoryRow = {
  timestamp: string;
  action: string;
  user_name: string;
  revision: number | null;
  original_name: string | null;
  size_bytes: number | null;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDB();

  const results = await db
    .prepare(
      `SELECT h.timestamp, h.action,
              u.name as user_name,
              f.revision, f.original_name, f.size_bytes
       FROM history h
       LEFT JOIN users u ON h.user_id = u.id
       LEFT JOIN files f ON h.file_id = f.id
       ORDER BY h.timestamp DESC`
    )
    .all<HistoryRow>();

  const rows = results.results;
  const csv = [
    'Timestamp,Action,User,Revision,File Name,Size (bytes)',
    ...rows.map(
      (r) =>
        `"${r.timestamp}","${r.action}","${r.user_name ?? ''}","${r.revision ?? ''}","${r.original_name ?? ''}","${r.size_bytes ?? ''}"`
    ),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="file-history-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
