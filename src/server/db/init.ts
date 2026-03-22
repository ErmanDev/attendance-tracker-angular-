import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type SqliteDatabase = InstanceType<typeof Database>;

let db: SqliteDatabase | null = null;

/** Runs on every getDb() so new tables apply even if the Node process kept an old connection. */
function ensureLatestSchema(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_name TEXT NOT NULL,
      course TEXT NOT NULL,
      year TEXT NOT NULL,
      room TEXT NOT NULL,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      gender TEXT NOT NULL,
      email TEXT,
      student_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      label TEXT
    );
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_row_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      present INTEGER NOT NULL CHECK (present IN (0, 1)),
      UNIQUE(session_id, student_row_id)
    );
  `);
  migrateStudentsLegacyColumns(database);
  ensureStudentIdUniqueIndex(database);
}

/** One non-empty student ID per classroom; case-insensitive (optional field: multiple NULLs allowed). */
function ensureStudentIdUniqueIndex(database: SqliteDatabase): void {
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_classroom_student_id_unique
    ON students(classroom_id, lower(trim(student_id)))
    WHERE student_id IS NOT NULL AND length(trim(student_id)) > 0
  `);
}

/** Older DBs used full_name only; copy into last_name and add name/gender columns. */
function migrateStudentsLegacyColumns(database: SqliteDatabase): void {
  const cols = database.prepare('PRAGMA table_info(students)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (names.has('first_name')) {
    return;
  }
  if (!names.has('full_name')) {
    return;
  }
  database.exec(`
    ALTER TABLE students ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE students ADD COLUMN middle_name TEXT;
    ALTER TABLE students ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE students ADD COLUMN gender TEXT NOT NULL DEFAULT 'male';
  `);
  database
    .prepare(
      `UPDATE students SET last_name = TRIM(full_name) WHERE TRIM(COALESCE(full_name, '')) != ''`,
    )
    .run();
  database
    .prepare(`UPDATE students SET last_name = '—' WHERE TRIM(COALESCE(last_name, '')) = ''`)
    .run();
  try {
    database.exec(`ALTER TABLE students DROP COLUMN full_name`);
  } catch {
    /* SQLite < 3.35: leave unused column */
  }
}

export function getDb(): SqliteDatabase {
  if (!db) {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = join(dataDir, 'app.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  ensureLatestSchema(db);
  return db;
}
