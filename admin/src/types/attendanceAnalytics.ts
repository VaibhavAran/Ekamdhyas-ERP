export interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_session_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  subject?: string;
  class?: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  subject_id: string;
  batch_id: string;
  date: string;
  teacher_name: string;
  completed_at: unknown;
}

export interface ClassAttendanceSummary {
  classId: string;
  className: string;
  boardId: string;
  boardName: string;
  division: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export interface StudentAttendanceSummary {
  studentId: string;
  name: string;
  grNumber: string;
  className: string;
  boardName: string;
  division: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  percentage: number;
  parentMobile: string;
}

export interface DefaulterStudent {
  studentId: string;
  name: string;
  className: string;
  boardName: string;
  division: string;
  percentage: number;
  parentMobile: string;
  presentDays: number;
  totalWorkingDays: number;
}

export interface DailyAttendanceDetail {
  studentId: string;
  name: string;
  grNumber: string;
  className: string;
  boardName: string;
  division: string;
  status: 'present' | 'absent' | 'late';
}

export interface MonthlyTrendDay {
  date: string;
  dayLabel: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

export interface AttendanceDashboardStats {
  todayPercentage: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  overallRate: number;
}

export interface AttendanceFilterState {
  academicYear: string;
  board: string;
  class: string;
  division: string;
  date: string;
  month: string;
}
