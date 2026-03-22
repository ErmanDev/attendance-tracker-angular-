import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface Classroom {
  id: number;
  subjectName: string;
  course: string;
  year: string;
  room: string;
  createdAt: string;
}

export type StudentGender = 'male' | 'female';

export interface Student {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: StudentGender;
  email?: string;
  studentId?: string;
  createdAt: string;
}

export interface CreateClassroomPayload {
  subjectName: string;
  course: string;
  year: string;
  room: string;
}

export interface CreateStudentPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: StudentGender;
  email?: string;
  studentId?: string;
}

export interface AttendanceSession {
  id: number;
  createdAt: string;
  label?: string;
}

export interface AttendanceSessionDetailRecord {
  studentId: number;
  present: boolean;
  firstName: string;
  middleName?: string;
  lastName: string;
  studentIdLabel?: string;
  gender: string;
  email?: string;
}

export interface SubmitAttendancePayload {
  label?: string;
  records: { studentId: number; present: boolean }[];
}

@Injectable({ providedIn: 'root' })
export class ClassroomService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<{ classrooms: Classroom[] }>('/api/classrooms');
  }

  get(id: number) {
    return this.http.get<{ classroom: Classroom }>(`/api/classrooms/${id}`);
  }

  listStudents(classroomId: number) {
    return this.http.get<{ students: Student[] }>(`/api/classrooms/${classroomId}/students`);
  }

  create(payload: CreateClassroomPayload) {
    return this.http.post<{ classroom: Classroom }>('/api/classrooms', payload);
  }

  delete(id: number) {
    return this.http.delete<void>(`/api/classrooms/${id}`);
  }

  createStudent(classroomId: number, payload: CreateStudentPayload) {
    return this.http.post<{ student: Student }>(`/api/classrooms/${classroomId}/students`, payload);
  }

  updateStudent(classroomId: number, studentRowId: number, payload: CreateStudentPayload) {
    return this.http.patch<{ student: Student }>(
      `/api/classrooms/${classroomId}/students/${studentRowId}`,
      payload,
    );
  }

  deleteStudent(classroomId: number, studentRowId: number) {
    return this.http.delete<void>(`/api/classrooms/${classroomId}/students/${studentRowId}`);
  }

  listAttendanceSessions(classroomId: number) {
    return this.http.get<{ sessions: AttendanceSession[] }>(
      `/api/classrooms/${classroomId}/attendance-sessions`,
    );
  }

  getAttendanceSession(classroomId: number, sessionId: number) {
    return this.http.get<{
      session: AttendanceSession;
      records: AttendanceSessionDetailRecord[];
    }>(`/api/classrooms/${classroomId}/attendance-sessions/${sessionId}`);
  }

  submitAttendance(classroomId: number, payload: SubmitAttendancePayload) {
    return this.http.post<{ session: AttendanceSession }>(
      `/api/classrooms/${classroomId}/attendance-sessions`,
      payload,
    );
  }

  deleteAttendanceSession(classroomId: number, sessionId: number) {
    return this.http.delete<void>(
      `/api/classrooms/${classroomId}/attendance-sessions/${sessionId}`,
    );
  }
}
