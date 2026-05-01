import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { getBucket } from '@/lib/r2';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const fileId = parseInt(id);
  if (isNaN(fileId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const db = await getDB();
  const bucket = await getBucket();

  const file = await db
    .prepare('SELECT original_name, r2_key, revision FROM files WHERE id = ?')
    .bind(fileId)
    .first<{ original_name: string; r2_key: string; revision: number }>();

  if (!file) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

  const object = await bucket.get(file.r2_key);
  if (!object) return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });

  const arrayBuffer = await object.arrayBuffer();
  const nameWithRev = `rev${file.revision}-${file.original_name}`;

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nameWithRev}"`,
    },
  });
}
