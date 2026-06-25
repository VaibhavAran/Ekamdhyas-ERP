import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AttendanceRecord,
  AttendanceSession,
  ClassAttendanceSummary,
  StudentAttendanceSummary,
  DefaulterStudent,
  DailyAttendanceDetail,
  MonthlyTrendDay,
  AttendanceDashboardStats,
} from '../types/attendanceAnalytics';
import type { Board, ClassModel, AcademicYear } from '../types/board';

interface StudentDoc {
  uid: string;
  name: string;
  roll_no: string;
  class_id: string;
  class_name: string;
  board_id: string;
  board_name: string;
  batch_id?: string;
  batch_name?: string;
  academic_year_id?: string;
  parentMobile?: string;
  grNumber?: string;
  status: string;
}

async function fetchDocs(collectionName: string): Promise<any[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));
}

async function fetchSessionsForRange(
  startDate: string,
  endDate: string,
  classId?: string
): Promise<AttendanceSession[]> {
  let q: any = query(
    collection(db, 'attendance_sessions'),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  if (classId) {
    q = query(q, where('class_id', '==', classId));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as AttendanceSession));
}

async function fetchAttendanceForSessions(
  sessionIds: string[]
): Promise<AttendanceRecord[]> {
  if (sessionIds.length === 0) return [];
  const chunkSize = 10;
  let all: AttendanceRecord[] = [];
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize);
    const q = query(
      collection(db, 'attendance'),
      where('attendance_session_id', 'in', chunk)
    );
    const snap = await getDocs(q);
    all = all.concat(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as AttendanceRecord)));
  }
  return all;
}

function getDateRangeForMonth(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function computeStudentStats(
  studentId: string,
  records: AttendanceRecord[]
): { present: number; absent: number; late: number; total: number } {
  const studentRecords = records.filter((r) => r.student_id === studentId);
  return {
    present: studentRecords.filter((r) => r.status === 'present').length,
    absent: studentRecords.filter((r) => r.status === 'absent').length,
    late: studentRecords.filter((r) => r.status === 'late').length,
    total: studentRecords.length,
  };
}

export async function fetchMetadata() {
  const [boards, classes, academicYears, rawStudents] = await Promise.all([
    fetchDocs('boards'),
    fetchDocs('classes'),
    fetchDocs('academic_years'),
    fetchDocs('students'),
  ]);

  const students = rawStudents.filter((s: any) => s.role === 'student') as StudentDoc[];

  return {
    boards: boards as Board[],
    classes: classes as ClassModel[],
    academicYears: academicYears as AcademicYear[],
    students,
  };
}

export async function fetchAttendanceInRange(
  startDate: string,
  endDate: string,
  classId?: string
): Promise<{ sessions: AttendanceSession[]; records: AttendanceRecord[] }> {
  const sessions = await fetchSessionsForRange(startDate, endDate, classId);
  const sessionIds = sessions.map((s) => s.id);
  const records = await fetchAttendanceForSessions(sessionIds);
  return { sessions, records };
}

export function computeDashboardStats(
  records: AttendanceRecord[]
): AttendanceDashboardStats {
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.date === today);
  const todayPresent = todayRecords.filter((r) => r.status === 'present').length;
  const todayAbsent = todayRecords.filter((r) => r.status === 'absent').length;
  const todayLate = todayRecords.filter((r) => r.status === 'late').length;
  const todayTotal = todayPresent + todayAbsent + todayLate;
  const todayPercentage = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

  const totalPresent = records.filter((r) => r.status === 'present').length;
  const totalAbsent = records.filter((r) => r.status === 'absent').length;
  const totalLate = records.filter((r) => r.status === 'late').length;
  const overallTotal = totalPresent + totalAbsent + totalLate;
  const overallRate = overallTotal > 0 ? Math.round((totalPresent / overallTotal) * 100) : 0;

  return {
    todayPercentage,
    totalPresent,
    totalAbsent,
    totalLate,
    overallRate,
  };
}

export function computeClassWiseAttendance(
  records: AttendanceRecord[],
  classes: ClassModel[],
  students: StudentDoc[]
): ClassAttendanceSummary[] {
  const classMap = new Map<string, { board: string; boardName: string; name: string; division: string }>();
  classes.forEach((c) => {
    classMap.set(c.id, { board: c.board_id, boardName: c.board_name, name: c.name, division: c.division || '' });
  });

  const classStudentCounts = new Map<string, Set<string>>();
  students.forEach((s) => {
    if (!classStudentCounts.has(s.class_id)) classStudentCounts.set(s.class_id, new Set());
    classStudentCounts.get(s.class_id)!.add(s.uid);
  });

  const classRecords = new Map<string, AttendanceRecord[]>();
  records.forEach((r) => {
    const student = students.find((s) => s.uid === r.student_id);
    if (student) {
      const cid = student.class_id;
      if (!classRecords.has(cid)) classRecords.set(cid, []);
      classRecords.get(cid)!.push(r);
    }
  });

  const summaries: ClassAttendanceSummary[] = [];
  classStudentCounts.forEach((studentIds, classId) => {
    const classInfo = classMap.get(classId);
    if (!classInfo) return;
    const cRecords = classRecords.get(classId) || [];
    const present = cRecords.filter((r) => r.status === 'present').length;
    const absent = cRecords.filter((r) => r.status === 'absent').length;
    const late = cRecords.filter((r) => r.status === 'late').length;
    const total = present + absent + late;
    summaries.push({
      classId,
      className: classInfo.name,
      boardId: classInfo.board,
      boardName: classInfo.boardName,
      division: classInfo.division,
      totalStudents: studentIds.size,
      present,
      absent,
      late,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    });
  });

  return summaries.sort((a, b) => a.className.localeCompare(b.className));
}

export function computeStudentReport(
  records: AttendanceRecord[],
  students: StudentDoc[],
  searchTerm: string
): StudentAttendanceSummary[] {
  const term = searchTerm.toLowerCase();
  const filtered = students.filter((s) => {
    if (term) {
      const nameMatch = s.name.toLowerCase().includes(term);
      const grMatch = s.grNumber && s.grNumber.toLowerCase().includes(term);
      if (!nameMatch && !grMatch) return false;
    }
    return true;
  });

  return filtered.map((s) => {
    const stats = computeStudentStats(s.uid, records);
    const total = stats.present + stats.absent + stats.late;
    return {
      studentId: s.uid,
      name: s.name,
      grNumber: s.grNumber || s.roll_no || '',
      className: s.class_name,
      boardName: s.board_name,
      division: '',
      totalWorkingDays: total,
      presentDays: stats.present,
      absentDays: stats.absent,
      lateDays: stats.late,
      percentage: total > 0 ? Math.round((stats.present / total) * 100) : 0,
      parentMobile: s.parentMobile || '',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function computeMonthlyTrends(
  records: AttendanceRecord[],
  monthStr: string
): MonthlyTrendDay[] {
  const { start, end } = getDateRangeForMonth(monthStr);
  const monthRecords = records.filter((r) => r.date >= start && r.date <= end);

  const dayMap = new Map<string, { present: number; absent: number; late: number }>();
  const daysInMonth = new Date(
    parseInt(monthStr.split('-')[0]),
    parseInt(monthStr.split('-')[1]),
    0
  ).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    dayMap.set(dateStr, { present: 0, absent: 0, late: 0 });
  }

  monthRecords.forEach((r) => {
    const entry = dayMap.get(r.date);
    if (entry) {
      if (r.status === 'present') entry.present++;
      else if (r.status === 'absent') entry.absent++;
      else entry.late++;
    }
  });

  const result: MonthlyTrendDay[] = [];
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
      total,
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeDefaulters(
  records: AttendanceRecord[],
  students: StudentDoc[],
  threshold: number,
  boardFilter?: string,
  classFilter?: string
): DefaulterStudent[] {
  const filtered = students.filter((s) => {
    if (boardFilter && s.board_id !== boardFilter) return false;
    if (classFilter && s.class_id !== classFilter) return false;
    return true;
  });

  const result: DefaulterStudent[] = [];
  filtered.forEach((s) => {
    const stats = computeStudentStats(s.uid, records);
    const total = stats.present + stats.absent + stats.late;
    if (total === 0) return;
    const pct = Math.round((stats.present / total) * 100);
    if (pct < threshold) {
      result.push({
        studentId: s.uid,
        name: s.name,
        className: s.class_name,
        boardName: s.board_name,
        division: '',
        percentage: pct,
        parentMobile: s.parentMobile || '',
        presentDays: stats.present,
        totalWorkingDays: total,
      });
    }
  });

  return result.sort((a, b) => a.percentage - b.percentage);
}

export function computeDailyDetails(
  records: AttendanceRecord[],
  students: StudentDoc[],
  date: string
): DailyAttendanceDetail[] {
  const dayRecords = records.filter((r) => r.date === date);
  return students
    .map((s) => {
      const rec = dayRecords.find((r) => r.student_id === s.uid);
      return {
        studentId: s.uid,
        name: s.name,
        grNumber: s.grNumber || s.roll_no || '',
        className: s.class_name,
        boardName: s.board_name,
        division: '',
        status: (rec?.status || 'absent') as 'present' | 'absent' | 'late',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getMonthlyAverages(trends: MonthlyTrendDay[]): {
  dailyAvgPresent: number;
  dailyAvgAbsent: number;
  weeklyAvgPresent: number;
  monthlyAvg: number;
} {
  const daysWithData = trends.filter((d) => d.total > 0);
  if (daysWithData.length === 0) {
    return { dailyAvgPresent: 0, dailyAvgAbsent: 0, weeklyAvgPresent: 0, monthlyAvg: 0 };
  }
  const totalPresent = daysWithData.reduce((sum, d) => sum + d.present, 0);
  const totalAbsent = daysWithData.reduce((sum, d) => sum + d.absent, 0);
  const totalAll = totalPresent + totalAbsent + daysWithData.reduce((sum, d) => sum + d.late, 0);
  const dailyAvgPresent = Math.round(totalPresent / daysWithData.length);
  const dailyAvgAbsent = Math.round(totalAbsent / daysWithData.length);
  const weeks = Math.ceil(daysWithData.length / 7);
  const weeklyAvgPresent = Math.round(totalPresent / weeks);
  const monthlyAvg = totalAll > 0 ? Math.round((totalPresent / totalAll) * 100) : 0;

  return { dailyAvgPresent, dailyAvgAbsent, weeklyAvgPresent, monthlyAvg };
}
