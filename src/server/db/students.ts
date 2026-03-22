import Database from 'better-sqlite3';

type SqliteDatabase = InstanceType<typeof Database>;

export interface StudentRow {
  id: number;
  classroom_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string;
  email: string | null;
  student_id: string | null;
  created_at: string;
}

/**
 * Case-insensitive match; use before insert/update when student_id is non-empty.
 * When `excludeStudentRowId` is set, ignores that row (for updates).
 */
export function classroomHasStudentId(
  database: SqliteDatabase,
  classroomId: number,
  studentId: string,
  excludeStudentRowId?: number,
): boolean {
  if (excludeStudentRowId !== undefined) {
    const row = database
      .prepare(
        `SELECT 1 FROM students
         WHERE classroom_id = ? AND lower(trim(student_id)) = lower(trim(?)) AND id != ?
         LIMIT 1`,
      )
      .get(classroomId, studentId, excludeStudentRowId);
    return row !== undefined;
  }
  const row = database
    .prepare(
      `SELECT 1 FROM students
       WHERE classroom_id = ? AND lower(trim(student_id)) = lower(trim(?))
       LIMIT 1`,
    )
    .get(classroomId, studentId);
  return row !== undefined;
}

export function getStudentInClassroom(
  database: SqliteDatabase,
  classroomId: number,
  studentRowId: number,
): StudentRow | undefined {
  return database
    .prepare(`SELECT * FROM students WHERE id = ? AND classroom_id = ?`)
    .get(studentRowId, classroomId) as StudentRow | undefined;
}

export function listStudentsByClassroomId(
  database: SqliteDatabase,
  classroomId: number,
): StudentRow[] {
  return database
    .prepare(
      `SELECT * FROM students WHERE classroom_id = ?
       ORDER BY last_name COLLATE NOCASE ASC, first_name COLLATE NOCASE ASC`,
    )
    .all(classroomId) as StudentRow[];
}

export function createStudent(
  database: SqliteDatabase,
  classroomId: number,
  firstName: string,
  middleName: string | null,
  lastName: string,
  gender: string,
  email: string | null,
  studentId: string | null,
): StudentRow {
  const insert = database.prepare(
    `INSERT INTO students (
      classroom_id, first_name, middle_name, last_name, gender, email, student_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const result = insert.run(
    classroomId,
    firstName,
    middleName,
    lastName,
    gender,
    email,
    studentId,
  );
  const row = database.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid) as
    | StudentRow
    | undefined;
  if (!row) {
    throw new Error('Failed to read student after insert');
  }
  return row;
}

export function updateStudent(
  database: SqliteDatabase,
  classroomId: number,
  studentRowId: number,
  firstName: string,
  middleName: string | null,
  lastName: string,
  gender: string,
  email: string | null,
  studentId: string | null,
): StudentRow {
  const result = database
    .prepare(
      `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, gender = ?, email = ?, student_id = ?
       WHERE id = ? AND classroom_id = ?`,
    )
    .run(firstName, middleName, lastName, gender, email, studentId, studentRowId, classroomId);
  if (result.changes === 0) {
    throw new Error('NOT_FOUND');
  }
  const row = database.prepare(`SELECT * FROM students WHERE id = ?`).get(studentRowId) as
    | StudentRow
    | undefined;
  if (!row) {
    throw new Error('Failed to read student after update');
  }
  return row;
}

export function deleteStudent(
  database: SqliteDatabase,
  classroomId: number,
  studentRowId: number,
): boolean {
  const result = database
    .prepare(`DELETE FROM students WHERE id = ? AND classroom_id = ?`)
    .run(studentRowId, classroomId);
  return result.changes > 0;
}
