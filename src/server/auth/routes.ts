import type { Express, Request, Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jwtSecret } from './jwt';
import { getDb } from '../db/init';
import { createUser, findUserByEmail, type UserRow } from '../db/users';

const SALT_ROUNDS = 10;

function toPublicUser(row: UserRow) {
  return { id: row.id, email: row.email, name: row.name };
}

function isSqliteConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: string }).code === 'string' &&
    (err as { code: string }).code.startsWith('SQLITE_CONSTRAINT')
  );
}

export function registerAuthRoutes(app: Express): void {
  getDb();

  const router = Router();

  router.post('/register', (req: Request, res: Response) => {
    const body = req.body as { name?: string; email?: string; password?: string };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!name || name.length < 2) {
      res.status(400).json({ message: 'Name must be at least 2 characters.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'Valid email is required.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    const database = getDb();
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

    try {
      const row = createUser(database, name, email, passwordHash);
      res.status(201).json({ user: toPublicUser(row) });
    } catch (err: unknown) {
      if (isSqliteConstraintError(err)) {
        res.status(409).json({ message: 'That email is already registered.' });
        return;
      }
      console.error(err);
      res.status(500).json({ message: 'Registration failed.' });
    }
  });

  router.post('/login', (req: Request, res: Response) => {
    const body = req.body as { email?: string; password?: string };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const database = getDb();
    const user = findUserByEmail(database, email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { sub: String(user.id), email: user.email },
      jwtSecret(),
      { expiresIn: '7d' },
    );

    res.json({ token, user: toPublicUser(user) });
  });

  app.use('/api/auth', router);
}
