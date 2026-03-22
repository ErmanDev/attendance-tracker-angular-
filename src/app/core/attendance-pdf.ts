import type { Classroom } from './classroom.service';

export interface AttendancePdfRecord {
  schoolStudentId?: string;
  fullName: string;
  present: boolean;
  email?: string;
}

export interface AttendancePdfSessionMeta {
  id: number;
  createdAt: string;
  label?: string;
}

/** Loads jsPDF on demand, then builds and downloads a PDF (browser only). */
export async function downloadAttendancePdf(
  classroom: Classroom,
  session: AttendancePdfSessionMeta,
  records: AttendancePdfRecord[],
): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF();
  const title = classroom.subjectName;
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.text(`${classroom.course} · Year ${classroom.year} · Room ${classroom.room}`, 14, 26);
  doc.text(`Recorded: ${new Date(session.createdAt).toLocaleString()}`, 14, 32);
  let y = 38;
  if (session.label) {
    doc.text(`Label: ${session.label}`, 14, y);
    y += 6;
  }

  const body = records.map((r) => [
    r.schoolStudentId ?? '—',
    r.fullName,
    r.present ? 'Present' : 'Absent',
    r.email ?? '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Student ID', 'Name', 'Attendance', 'Email']],
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [128, 0, 128] },
  });

  const safeSubject = classroom.subjectName.replace(/[^\w\-]+/g, '-').slice(0, 40);
  doc.save(`attendance-${safeSubject}-${session.id}.pdf`);
}
