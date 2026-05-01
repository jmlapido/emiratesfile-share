import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, createSession } from '@/lib/auth';
import { getDB } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json() as { password?: string };
  const { password } = body;
  if (!password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  const hash = await hashPassword(password);
  const db = await getDB();
  const user = await db
    .prepare('SELECT id, name FROM users WHERE password_hash = ?')
    .bind(hash)
    .first<{ id: number; name: string }>();

  if (!user) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await createSession({ userId: user.id, userName: user.name });

  const res = NextResponse.json({ success: true, userName: user.name });
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  });
  return res;
}
