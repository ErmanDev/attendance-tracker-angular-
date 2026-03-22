import Database from 'better-sqlite3';

type SqliteDatabase = InstanceType<typeof Database>;

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export function findUserByEmail(database: SqliteDatabase, email: string): UserRow | undefined {
  return database.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as
    | UserRow
    | undefined;
}

export function createUser(
  database: SqliteDatabase,
  name: string,
  email: string,
  passwordHash: string,
): UserRow {
  const normalized = email.toLowerCase();
  const insert = database.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
  );
  const result = insert.run(name, normalized, passwordHash);
  const row = database.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as
    | UserRow
    | undefined;
  if (!row) {
    throw new Error('Failed to read user after insert');
  }
  return row;
}
