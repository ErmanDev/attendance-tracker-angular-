import type { Express, Request, Response } from 'express';
import { Router } from 'express';
import { getBearerUserId } from '../auth/jwt';
import { getDb } from '../db/init';
import {
  createClassroom,
  deleteClassroomForUser,
  getClassroomForUser,
  listClassroomsByUserId,
  type ClassroomRow,
} from '../db/classrooms';
import {
  createAttendanceSession,
  deleteAttendanceSession,
  getAttendanceSessionDetail,
  listAttendanceSessions,
  type AttendanceSessionRow,
} from '../db/attendance';
import {
  classroomHasStudentId,
  createStudent,
  deleteStudent,
  getStudentInClassroom,
  listStudentsByClassroomId,
  updateStudent,
  type StudentRow,
} from '../db/students';
import { sqliteUtcToIso8601 } from '../sqlite-datetime';

function toPublicClassroom(row: ClassroomRow) {
  return {
    id: row.id,
    subjectName: row.subject_name,
    course: row.course,
    year: row.year,
    room: row.room,
    createdAt: sqliteUtcToIso8601(row.created_at),
  };
}

function toPublicStudent(row: StudentRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    middleName: row.middle_name ?? undefined,
    lastName: row.last_name,
    gender: row.gender,
    email: row.email ?? undefined,
    studentId: row.student_id ?? undefined,
    createdAt: sqliteUtcToIso8601(row.created_at),
  };
}

function toPublicAttendanceSession(row: AttendanceSessionRow) {
  return {
    id: row.id,
    createdAt: sqliteUtcToIso8601(row.created_at),
    label: row.label ?? undefined,
  };
}

function parseId(param: string | undefined): number | null {
  if (param === undefined) {
    return null;
  }
  const n = parseInt(param, 10);
  return Number.isFinite(n) ? n : null;
}

function parseIdParam(param: string | string[] | undefined): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  return parseId(raw);
}

function isSqliteUniqueStudentIdError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return false;
  }
  const code = String((err as { code: unknown }).code);
  return code === 'SQLITE_CONSTRAINT_UNIQUE';
}

function parseStudentBody(body: unknown):
  | {
      ok: true;
      firstName: string;
      middleName: string | null;
      lastName: string;
      gender: string;
      email: string | null;
      studentId: string | null;
    }
  | { ok: false; status: number; message: string } {
  const b = body as {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    gender?: string;
    email?: string;
    studentId?: string;
  };
  const firstName = typeof b.firstName === 'string' ? b.firstName.trim() : '';
  const middleRaw = typeof b.middleName === 'string' ? b.middleName.trim() : '';
  const lastName = typeof b.lastName === 'string' ? b.lastName.trim() : '';
  const genderRaw = typeof b.gender === 'string' ? b.gender.trim().toLowerCase() : '';
  const emailRaw = typeof b.email === 'string' ? b.email.trim() : '';
  const studentIdRaw = typeof b.studentId === 'string' ? b.studentId.trim() : '';

  if (!firstName) {
    return { ok: false, status: 400, message: 'First name is required.' };
  }
  if (!lastName) {
    return { ok: false, status: 400, message: 'Last name is required.' };
  }
  if (genderRaw !== 'male' && genderRaw !== 'female') {
    return { ok: false, status: 400, message: 'Gender must be male or female.' };
  }

  const middleName = middleRaw.length > 0 ? middleRaw : null;
  const email = emailRaw.length > 0 ? emailRaw : null;
  const studentId = studentIdRaw.length > 0 ? studentIdRaw : null;

  return {
    ok: true,
    firstName,
    middleName,
    lastName,
    gender: genderRaw,
    email,
    studentId,
  };
}

export function registerClassroomRoutes(app: Express): void {
  getDb();

  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const rows = listClassroomsByUserId(getDb(), userId);
    res.json({ classrooms: rows.map(toPublicClassroom) });
  });

  router.post('/', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }

    const body = req.body as {
      subjectName?: string;
      course?: string;
      year?: string;
      room?: string;
    };
    const subjectName = typeof body.subjectName === 'string' ? body.subjectName.trim() : '';
    const course = typeof body.course === 'string' ? body.course.trim() : '';
    const year = typeof body.year === 'string' ? body.year.trim() : '';
    const room = typeof body.room === 'string' ? body.room.trim() : '';

    if (!subjectName) {
      res.status(400).json({ message: 'Subject name is required.' });
      return;
    }
    if (!course) {
      res.status(400).json({ message: 'Course is required.' });
      return;
    }
    if (!year) {
      res.status(400).json({ message: 'Year is required.' });
      return;
    }
    if (!room) {
      res.status(400).json({ message: 'Room is required.' });
      return;
    }

    try {
      const row = createClassroom(getDb(), userId, subjectName, course, year, room);
      res.status(201).json({ classroom: toPublicClassroom(row) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Could not create classroom.' });
    }
  });

  router.get('/:id/students', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    if (classroomId === null) {
      res.status(400).json({ message: 'Invalid classroom id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    const rows = listStudentsByClassroomId(database, classroomId);
    res.json({ students: rows.map(toPublicStudent) });
  });

  router.post('/:id/students', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    if (classroomId === null) {
      res.status(400).json({ message: 'Invalid classroom id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }

    const parsed = parseStudentBody(req.body);
    if (!parsed.ok) {
      res.status(parsed.status).json({ message: parsed.message });
      return;
    }
    const { firstName, middleName, lastName, gender: genderRaw, email, studentId } = parsed;

    if (studentId !== null && classroomHasStudentId(database, classroomId, studentId)) {
      res.status(409).json({
        message: 'This student ID is already used in this classroom. Choose a different ID.',
      });
      return;
    }

    try {
      const row = createStudent(
        database,
        classroomId,
        firstName,
        middleName,
        lastName,
        genderRaw,
        email,
        studentId,
      );
      res.status(201).json({ student: toPublicStudent(row) });
    } catch (err: unknown) {
      if (isSqliteUniqueStudentIdError(err)) {
        res.status(409).json({
          message: 'This student ID is already used in this classroom. Choose a different ID.',
        });
        return;
      }
      console.error(err);
      res.status(500).json({ message: 'Could not add student.' });
    }
  });

  router.patch('/:id/students/:studentId', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    const studentRowId = parseIdParam(req.params['studentId']);
    if (classroomId === null || studentRowId === null) {
      res.status(400).json({ message: 'Invalid id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    const existing = getStudentInClassroom(database, classroomId, studentRowId);
    if (!existing) {
      res.status(404).json({ message: 'Student not found.' });
      return;
    }

    const parsed = parseStudentBody(req.body);
    if (!parsed.ok) {
      res.status(parsed.status).json({ message: parsed.message });
      return;
    }
    const { firstName, middleName, lastName, gender: genderRaw, email, studentId } = parsed;

    if (
      studentId !== null &&
      classroomHasStudentId(database, classroomId, studentId, studentRowId)
    ) {
      res.status(409).json({
        message: 'This student ID is already used in this classroom. Choose a different ID.',
      });
      return;
    }

    try {
      const row = updateStudent(
        database,
        classroomId,
        studentRowId,
        firstName,
        middleName,
        lastName,
        genderRaw,
        email,
        studentId,
      );
      res.json({ student: toPublicStudent(row) });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        res.status(404).json({ message: 'Student not found.' });
        return;
      }
      if (isSqliteUniqueStudentIdError(err)) {
        res.status(409).json({
          message: 'This student ID is already used in this classroom. Choose a different ID.',
        });
        return;
      }
      console.error(err);
      res.status(500).json({ message: 'Could not update student.' });
    }
  });

  router.delete('/:id/students/:studentId', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    const studentRowId = parseIdParam(req.params['studentId']);
    if (classroomId === null || studentRowId === null) {
      res.status(400).json({ message: 'Invalid id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    const removed = deleteStudent(database, classroomId, studentRowId);
    if (!removed) {
      res.status(404).json({ message: 'Student not found.' });
      return;
    }
    res.status(204).send();
  });

  router.get('/:id/attendance-sessions/:sessionId', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    const sessionId = parseIdParam(req.params['sessionId']);
    if (classroomId === null || sessionId === null) {
      res.status(400).json({ message: 'Invalid id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    const detail = getAttendanceSessionDetail(database, classroomId, sessionId);
    if (!detail) {
      res.status(404).json({ message: 'Attendance session not found.' });
      return;
    }
    res.json({
      session: toPublicAttendanceSession(detail.session),
      records: detail.records.map((r) => ({
        studentId: r.studentRowId,
        present: r.present,
        firstName: r.firstName,
        middleName: r.middleName ?? undefined,
        lastName: r.lastName,
        studentIdLabel: r.schoolStudentId ?? undefined,
        gender: r.gender,
        email: r.email ?? undefined,
      })),
    });
  });

  router.delete('/:id/attendance-sessions/:sessionId', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    const sessionId = parseIdParam(req.params['sessionId']);
    if (classroomId === null || sessionId === null) {
      res.status(400).json({ message: 'Invalid id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    const removed = deleteAttendanceSession(database, classroomId, sessionId);
    if (!removed) {
      res.status(404).json({ message: 'Attendance session not found.' });
      return;
    }
    res.status(204).send();
  });

  router.get('/:id/attendance-sessions', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    if (classroomId === null) {
      res.status(400).json({ message: 'Invalid classroom id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    const rows = listAttendanceSessions(database, classroomId);
    res.json({ sessions: rows.map(toPublicAttendanceSession) });
  });

  router.post('/:id/attendance-sessions', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    if (classroomId === null) {
      res.status(400).json({ message: 'Invalid classroom id.' });
      return;
    }
    const database = getDb();
    const classroom = getClassroomForUser(database, classroomId, userId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }

    const body = req.body as {
      label?: string;
      records?: { studentId?: number; present?: boolean }[];
    };
    const labelRaw = typeof body.label === 'string' ? body.label.trim() : '';
    const label = labelRaw.length > 0 ? labelRaw : null;
    const recordsRaw = Array.isArray(body.records) ? body.records : null;
    if (!recordsRaw || recordsRaw.length === 0) {
      res.status(400).json({ message: 'Attendance records are required.' });
      return;
    }

    const roster = listStudentsByClassroomId(database, classroomId);
    const rosterIds = new Set(roster.map((s) => s.id));
    const payload: { studentRowId: number; present: boolean }[] = [];
    const seen = new Set<number>();
    for (const r of recordsRaw) {
      const sid = typeof r.studentId === 'number' && Number.isFinite(r.studentId) ? r.studentId : null;
      const present = Boolean(r.present);
      if (sid === null) {
        res.status(400).json({ message: 'Each record needs a valid student id.' });
        return;
      }
      if (!rosterIds.has(sid)) {
        res.status(400).json({ message: 'Unknown student in this classroom.' });
        return;
      }
      if (seen.has(sid)) {
        res.status(400).json({ message: 'Duplicate student in attendance payload.' });
        return;
      }
      seen.add(sid);
      payload.push({ studentRowId: sid, present });
    }
    if (seen.size !== rosterIds.size) {
      res.status(400).json({
        message: 'Mark attendance for every student in the class (one row per person).',
      });
      return;
    }

    try {
      const row = createAttendanceSession(database, classroomId, userId, label, payload);
      res.status(201).json({ session: toPublicAttendanceSession(row) });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'INVALID_STUDENT') {
        res.status(400).json({ message: 'Could not save attendance for one or more students.' });
        return;
      }
      console.error(err);
      res.status(500).json({ message: 'Could not save attendance.' });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    if (classroomId === null) {
      res.status(400).json({ message: 'Invalid classroom id.' });
      return;
    }
    const database = getDb();
    const removed = deleteClassroomForUser(database, classroomId, userId);
    if (!removed) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    res.status(204).send();
  });

  router.get('/:id', (req: Request, res: Response) => {
    const userId = getBearerUserId(req.headers.authorization);
    if (userId === null) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    const classroomId = parseIdParam(req.params['id']);
    if (classroomId === null) {
      res.status(400).json({ message: 'Invalid classroom id.' });
      return;
    }
    const row = getClassroomForUser(getDb(), classroomId, userId);
    if (!row) {
      res.status(404).json({ message: 'Classroom not found.' });
      return;
    }
    res.json({ classroom: toPublicClassroom(row) });
  });

  app.use('/api/classrooms', router);
}
