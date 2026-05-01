import { SignJWT, jwtVerify } from 'jose';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface SessionPayload {
  userId: number;
  userName: string;
}

async function getJwtSecret(): Promise<Uint8Array> {
  let secret: string;
  try {
    const { env } = await getCloudflareContext({ async: true });
    secret = env.JWT_SECRET;
  } catch {
    secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const secret = await getJwtSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const secret = await getJwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as number,
      userName: payload.userName as string,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
