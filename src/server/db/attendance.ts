import Database from 'better-sqlite3';

type SqliteDatabase = InstanceType<typeof Database>;

export interface AttendanceSessionRow {
  id: number;
  classroom_id: number;
  created_by_user_id: number;
  created_at: string;
  label: string | null;
}

export interface AttendanceRecordExport {
  studentRowId: number;
  present: boolean;
  firstName: string;
  middleName: string | null;
  lastName: string;
  schoolStudentId: string | null;
  gender: string;
  email: string | null;
}

export function createAttendanceSession(
  database: SqliteDatabase,
  classroomId: number,
  userId: number,
  label: string | null,
  records: { studentRowId: number; present: boolean }[],
): AttendanceSessionRow {
  const run = database.transaction(
    (cid: number, uid: number, lab: string | null, recs: { studentRowId: number; present: boolean }[]) => {
      const createdAt = new Date().toISOString();
      const insertS = database.prepare(
        `INSERT INTO attendance_sessions (classroom_id, created_by_user_id, label, created_at) VALUES (?, ?, ?, ?)`,
      );
      const ins = insertS.run(cid, uid, lab, createdAt);
      const sessionId = Number(ins.lastInsertRowid);

      const insertR = database.prepare(
        `INSERT INTO attendance_records (session_id, student_row_id, present) VALUES (?, ?, ?)`,
      );
      const validate = database.prepare(
        `SELECT id FROM students WHERE id = ? AND classroom_id = ?`,
      );
      for (const rec of recs) {
        const ok = validate.get(rec.studentRowId, cid);
        if (!ok) {
          throw new Error('INVALID_STUDENT');
        }
        insertR.run(sessionId, rec.studentRowId, rec.present ? 1 : 0);
      }

      return database
        .prepare(`SELECT * FROM attendance_sessions WHERE id = ?`)
        .get(sessionId) as AttendanceSessionRow;
    },
  );

  return run(classroomId, userId, label, records);
}

/** Returns whether a row was removed (session belonged to this classroom). */
export function deleteAttendanceSession(
  database: SqliteDatabase,
  classroomId: number,
  sessionId: number,
): boolean {
  const result = database
    .prepare(`DELETE FROM attendance_sessions WHERE id = ? AND classroom_id = ?`)
    .run(sessionId, classroomId);
  return result.changes > 0;
}

export function listAttendanceSessions(
  database: SqliteDatabase,
  classroomId: number,
): AttendanceSessionRow[] {
  return database
    .prepare(
      `SELECT * FROM attendance_sessions WHERE classroom_id = ? ORDER BY datetime(created_at) DESC`,
    )
    .all(classroomId) as AttendanceSessionRow[];
}

export function getAttendanceSessionDetail(
  database: SqliteDatabase,
  classroomId: number,
  sessionId: number,
): { session: AttendanceSessionRow; records: AttendanceRecordExport[] } | null {
  const session = database
    .prepare(`SELECT * FROM attendance_sessions WHERE id = ? AND classroom_id = ?`)
    .get(sessionId, classroomId) as AttendanceSessionRow | undefined;
  if (!session) {
    return null;
  }
  const rows = database
    .prepare(
      `SELECT ar.student_row_id AS studentRowId, ar.present, s.first_name, s.middle_name, s.last_name,
              s.student_id AS schoolStudentId, s.gender, s.email
       FROM attendance_records ar
       JOIN students s ON s.id = ar.student_row_id
       WHERE ar.session_id = ?
       ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`,
    )
    .all(sessionId) as {
    studentRowId: number;
    present: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    schoolStudentId: string | null;
    gender: string;
    email: string | null;
  }[];

  return {
    session,
    records: rows.map((row) => ({
      studentRowId: row.studentRowId,
      present: row.present === 1,
      firstName: row.first_name,
      middleName: row.middle_name,
      lastName: row.last_name,
      schoolStudentId: row.schoolStudentId,
      gender: row.gender,
      email: row.email,
    })),
  };
}
