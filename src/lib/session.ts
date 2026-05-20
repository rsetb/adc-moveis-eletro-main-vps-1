import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('AVISO: SESSION_SECRET não definido em produção. Defina esta variável de ambiente no servidor.');
}

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'default-dev-secret-troque-em-producao-32c'
);
const COOKIE = 'session';

export type SessionPayload = {
  userId: string;
  role: string;
  name: string;
  username: string;
};

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(SECRET);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
