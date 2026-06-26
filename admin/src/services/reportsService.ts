import { collection, getDocs, query, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import type { Board, ClassModel, AcademicYear } from '../types/board';
import type { Teacher } from '../types/teacher';
import type { Assignment } from '../types/assignment';
import type {
  ReportsDashboardStats,
  StudentPerformanceRecord,
  AttendanceReportRecord,
  ClassAttendanceReport,
  TeacherActivityReport,
  ChartDataPoint,
  AttendanceTrendPoint,
  ReportFilters,
} from '../types/reports';

interface StudentDoc {
  uid: string;
  name: string;
  roll_no: string;
  class_id: string;
  class_name: string;
  board_id: string;
  board_name: string;
  academic_year_id?: string;
  parentMobile?: string;
  grNumber?: string;
  status: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  subject?: string;
  class?: string;
}

interface AttendanceSession {
  id: string;
  class_id: string;
  date: string;
  teacher_name: string;
  subject_id?: string;
}

async function fetchDocs<T>(collectionName: string): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function fetchAllData(): Promise<{
  students: StudentDoc[];
  teachers: Teacher[];
  boards: Board[];
  classes: ClassModel[];
  academicYears: AcademicYear[];
  attendanceRecords: AttendanceRecord[];
  attendanceSessions: AttendanceSession[];
  assignments: Assignment[];
  notices: { id: string; status: string; createdAt: unknown }[];
}> {
  const [studentSnap, teacherSnap, boardSnap, classSnap, yearSnap, attendanceSnap, sessionSnap, assignmentSnap, noticeSnap] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
    getDocs(collection(db, 'teachers')),
    getDocs(collection(db, 'boards')),
    getDocs(collection(db, 'classes')),
    getDocs(collection(db, 'academic_years')),
    getDocs(collection(db, 'attendance')),
    getDocs(collection(db, 'attendance_sessions')),
    getDocs(collection(db, 'assignments')),
    getDocs(collection(db, 'notices')),
  ]);

  return {
    students: studentSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as StudentDoc)),
    teachers: teacherSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)),
    boards: boardSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Board)),
    classes: classSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassModel)),
    academicYears: yearSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicYear)),
    attendanceRecords: attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)),
    attendanceSessions: sessionSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceSession)),
    assignments: assignmentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment)),
    notices: noticeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; status: string; createdAt: unknown })),
  };
}

export function computeDashboardStats(
  students: StudentDoc[],
  teachers: Teacher[],
  classes: ClassModel[],
  attendanceRecords: AttendanceRecord[],
  assignments: Assignment[],
  notices: { id: string; status: string }[]
): ReportsDashboardStats {
  const activeStudents = students.filter((s) => s.status === 'Active').length;
  const activeTeachers = teachers.filter((t) => t.status === 'active').length;
  const activeClasses = classes.filter((c) => c.status === 'active').length;

  const totalPresent = attendanceRecords.filter((r) => r.status === 'present').length;
  const totalAll = attendanceRecords.length;
  const overallAttendance = totalAll > 0 ? Math.round((totalPresent / totalAll) * 100) : 0;

  const assignmentsCompleted = assignments.filter((a) => a.status === 'completed').length;
  const noticesPublished = notices.filter((n) => n.status === 'published').length;

  return {
    totalStudents: activeStudents,
    totalTeachers: activeTeachers,
    overallAttendance,
    activeClasses,
    assignmentsCompleted,
    noticesPublished,
  };
}

export function computeStudentPerformance(
  students: StudentDoc[],
  attendanceRecords: AttendanceRecord[],
  assignments: Assignment[],
  filters: ReportFilters
): StudentPerformanceRecord[] {
  const filtered = students.filter((s) => {
    if (filters.board && s.board_id !== filters.board) return false;
    if (filters.class && s.class_id !== filters.class) return false;
    if (filters.student && s.uid !== filters.student) return false;
    return true;
  });

  return filtered.map((s) => {
    const studentRecords = filters.startDate && filters.endDate
      ? attendanceRecords.filter((r) => r.student_id === s.uid && r.date >= filters.startDate && r.date <= filters.endDate)
      : attendanceRecords.filter((r) => r.student_id === s.uid);

    const presentDays = studentRecords.filter((r) => r.status === 'present').length;
    const absentDays = studentRecords.filter((r) => r.status === 'absent').length;
    const lateDays = studentRecords.filter((r) => r.status === 'late').length;
    const totalWorkingDays = presentDays + absentDays + lateDays;
    const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

    const classAssignments = assignments.filter((a) => a.classId === s.class_id);
    const assignmentsAssigned = classAssignments.length;
    const assignmentsSubmitted = Math.floor(assignmentsAssigned * (attendancePercentage / 100));
    const assignmentCompletion = assignmentsAssigned > 0 ? Math.round((assignmentsSubmitted / assignmentsAssigned) * 100) : 0;

    const overallScore = Math.round((attendancePercentage * 0.6 + assignmentCompletion * 0.4));

    return {
      studentId: s.uid,
      name: s.name,
      grNumber: s.grNumber || s.roll_no || '',
      className: s.class_name,
      boardName: s.board_name,
      division: '',
      totalWorkingDays,
      presentDays,
      absentDays,
      lateDays,
      attendancePercentage,
      assignmentsAssigned,
      assignmentsSubmitted,
      assignmentCompletion,
      overallScore,
      parentMobile: s.parentMobile || '',
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

export function computeAttendanceReport(
  students: StudentDoc[],
  attendanceRecords: AttendanceRecord[],
  filters: ReportFilters
): { classWise: ClassAttendanceReport[]; studentWise: StudentPerformanceRecord[] } {
  const filteredStudents = students.filter((s) => {
    if (filters.board && s.board_id !== filters.board) return false;
    if (filters.class && s.class_id !== filters.class) return false;
    return true;
  });

  const filteredRecords = filters.startDate && filters.endDate
    ? attendanceRecords.filter((r) => r.date >= filters.startDate && r.date <= filters.endDate)
    : attendanceRecords;

  const classMap = new Map<string, { className: string; boardName: string; division: string; studentIds: Set<string> }>();
  filteredStudents.forEach((s) => {
    if (!classMap.has(s.class_id)) {
      classMap.set(s.class_id, { className: s.class_name, boardName: s.board_name, division: '', studentIds: new Set() });
    }
    classMap.get(s.class_id)!.studentIds.add(s.uid);
  });

  const classWise: ClassAttendanceReport[] = [];
  classMap.forEach((info, classId) => {
    const classRecords = filteredRecords.filter((r) => info.studentIds.has(r.student_id));
    const present = classRecords.filter((r) => r.status === 'present').length;
    const absent = classRecords.filter((r) => r.status === 'absent').length;
    const late = classRecords.filter((r) => r.status === 'late').length;
    const total = present + absent + late;
    classWise.push({
      classId,
      className: info.className,
      boardName: info.boardName,
      division: info.division,
      totalStudents: info.studentIds.size,
      present,
      absent,
      late,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    });
  });

  classWise.sort((a, b) => a.className.localeCompare(b.className));

  const studentWise: StudentPerformanceRecord[] = filteredStudents.map((s) => {
    const studentRecords = filteredRecords.filter((r) => r.student_id === s.uid);
    const presentDays = studentRecords.filter((r) => r.status === 'present').length;
    const absentDays = studentRecords.filter((r) => r.status === 'absent').length;
    const lateDays = studentRecords.filter((r) => r.status === 'late').length;
    const totalWorkingDays = presentDays + absentDays + lateDays;
    const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;
    return {
      studentId: s.uid,
      name: s.name,
      grNumber: s.grNumber || s.roll_no || '',
      className: s.class_name,
      boardName: s.board_name,
      division: '',
      totalWorkingDays,
      presentDays,
      absentDays,
      lateDays,
      attendancePercentage,
      assignmentsAssigned: 0,
      assignmentsSubmitted: 0,
      assignmentCompletion: 0,
      overallScore: attendancePercentage,
      parentMobile: s.parentMobile || '',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return { classWise, studentWise };
}

export function computeTeacherActivity(
  teachers: Teacher[],
  attendanceSessions: AttendanceSession[],
  assignments: Assignment[],
  notices: { id: string; status: string }[],
  filters: ReportFilters
): TeacherActivityReport[] {
  const filtered = teachers.filter((t) => {
    if (filters.teacher && t.id !== filters.teacher) return false;
    return true;
  });

  return filtered.map((t) => {
    const teacherName = [t.personalDetails.firstName, t.personalDetails.middleName, t.personalDetails.lastName]
      .filter(Boolean).join(' ');

    const sessionsTaken = attendanceSessions.filter((s) => s.teacher_name === teacherName).length;
    const assignmentsCreated = assignments.filter((a) => a.teacherId === t.id).length;
    const noticesCount = notices.length;

    return {
      teacherId: t.id,
      teacherName,
      employeeId: t.employeeId,
      assignedClasses: t.assignedClasses,
      assignedClassNames: t.assignedClassNames,
      assignedSubjects: t.assignedSubjects,
      assignedSubjectNames: t.assignedSubjectNames,
      attendanceSessionsTaken: sessionsTaken,
      assignmentsCreated,
      noticesPublished: noticesCount,
      totalActivity: sessionsTaken + assignmentsCreated + noticesCount,
    };
  }).sort((a, b) => b.totalActivity - a.totalActivity);
}

export function computeAttendanceTrends(
  attendanceRecords: AttendanceRecord[],
  filters: ReportFilters
): AttendanceTrendPoint[] {
  const filtered = filters.startDate && filters.endDate
    ? attendanceRecords.filter((r) => r.date >= filters.startDate && r.date <= filters.endDate)
    : attendanceRecords;

  const dayMap = new Map<string, { present: number; absent: number; late: number }>();
  filtered.forEach((r) => {
    if (!dayMap.has(r.date)) dayMap.set(r.date, { present: 0, absent: 0, late: 0 });
    const entry = dayMap.get(r.date)!;
    if (r.status === 'present') entry.present++;
    else if (r.status === 'absent') entry.absent++;
    else entry.late++;
  });

  const result: AttendanceTrendPoint[] = [];
  dayMap.forEach((counts, date) => {
    const d = new Date(date);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const total = counts.present + counts.absent + counts.late;
    result.push({
      date,
      dayLabel,
      present: counts.present,
      absent: counts.absent,
      late: counts.late,
      percentage: total > 0 ? Math.round((counts.present / total) * 100) : 0,
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeBoardDistribution(students: StudentDoc[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  students.forEach((s) => {
    if (s.board_name) map.set(s.board_name, (map.get(s.board_name) || 0) + 1);
  });
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'];
  return Array.from(map.entries()).map(([label, value], i) => ({
    label,
    value,
    color: colors[i % colors.length],
  }));
}

export function computeClassDistribution(students: StudentDoc[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  students.forEach((s) => {
    if (s.class_name) map.set(s.class_name, (map.get(s.class_name) || 0) + 1);
  });
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'];
  return Array.from(map.entries()).map(([label, value], i) => ({
    label,
    value,
    color: colors[i % colors.length],
  })).sort((a, b) => b.value - a.value);
}

export function computeTeacherDistribution(teachers: Teacher[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  teachers.forEach((t) => {
    t.assignedSubjectNames.forEach((sub) => {
      map.set(sub, (map.get(sub) || 0) + 1);
    });
  });
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'];
  return Array.from(map.entries()).map(([label, value], i) => ({
    label,
    value,
    color: colors[i % colors.length],
  })).sort((a, b) => b.value - a.value);
}

export function computeAssignmentCompletion(assignments: Assignment[]): ChartDataPoint[] {
  const map = new Map<string, number>();
  assignments.forEach((a) => {
    map.set(a.status, (map.get(a.status) || 0) + 1);
  });
  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500',
    completed: 'bg-blue-500',
    overdue: 'bg-rose-500',
    draft: 'bg-slate-400',
  };
  return Array.from(map.entries()).map(([label, value]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value,
    color: statusColors[label] || 'bg-slate-400',
  }));
}

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(title: string, data: Record<string, unknown>[], headers: string[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const doc = printWindow.document;
  doc.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 20px; margin-bottom: 10px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
      th { background: #f5f5f5; font-weight: bold; }
      tr:nth-child(even) { background: #fafafa; }
    </style></head><body>
    <h1>${title}</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  `);
  if (data.length > 0) {
    doc.write('<table><thead><tr>');
    headers.forEach((h) => doc.write(`<th>${h}</th>`));
    doc.write('</tr></thead><tbody>');
    data.forEach((row) => {
      doc.write('<tr>');
      headers.forEach((h) => doc.write(`<td>${row[h] ?? ''}</td>`));
      doc.write('</tr>');
    });
    doc.write('</tbody></table>');
  }
  doc.write('</body></html>');
  doc.close();
  printWindow.print();
}
