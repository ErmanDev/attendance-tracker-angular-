import jwt from 'jsonwebtoken';

export function jwtSecret(): string {
  return process.env['JWT_SECRET'] ?? 'dev-insecure-change-me';
}

/** Returns user id from `Authorization: Bearer <token>` or null if missing/invalid. */
export function getBearerUserId(authorization: string | undefined): number | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    const sub = payload.sub;
    const id = typeof sub === 'string' ? parseInt(sub, 10) : Number(sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}
