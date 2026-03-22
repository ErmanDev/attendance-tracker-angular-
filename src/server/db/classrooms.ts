import Database from 'better-sqlite3';

type SqliteDatabase = InstanceType<typeof Database>;

export interface ClassroomRow {
  id: number;
  subject_name: string;
  course: string;
  year: string;
  room: string;
  created_by_user_id: number;
  created_at: string;
}

export function createClassroom(
  database: SqliteDatabase,
  createdByUserId: number,
  subjectName: string,
  course: string,
  year: string,
  room: string,
): ClassroomRow {
  const insert = database.prepare(
    'INSERT INTO classrooms (subject_name, course, year, room, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
  );
  const result = insert.run(subjectName, course, year, room, createdByUserId);
  const row = database.prepare('SELECT * FROM classrooms WHERE id = ?').get(result.lastInsertRowid) as
    | ClassroomRow
    | undefined;
  if (!row) {
    throw new Error('Failed to read classroom after insert');
  }
  return row;
}

export function listClassroomsByUserId(database: SqliteDatabase, userId: number): ClassroomRow[] {
  return database
    .prepare(
      'SELECT * FROM classrooms WHERE created_by_user_id = ? ORDER BY datetime(created_at) DESC',
    )
    .all(userId) as ClassroomRow[];
}

export function getClassroomForUser(
  database: SqliteDatabase,
  classroomId: number,
  userId: number,
): ClassroomRow | undefined {
  return database
    .prepare('SELECT * FROM classrooms WHERE id = ? AND created_by_user_id = ?')
    .get(classroomId, userId) as ClassroomRow | undefined;
}

export function deleteClassroomForUser(
  database: SqliteDatabase,
  classroomId: number,
  userId: number,
): boolean {
  const result = database
    .prepare('DELETE FROM classrooms WHERE id = ? AND created_by_user_id = ?')
    .run(classroomId, userId);
  return result.changes > 0;
}
