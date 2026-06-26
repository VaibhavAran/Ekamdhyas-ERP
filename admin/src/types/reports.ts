export interface ReportsDashboardStats {
  totalStudents: number;
  totalTeachers: number;
  overallAttendance: number;
  activeClasses: number;
  assignmentsCompleted: number;
  noticesPublished: number;
}

export interface StudentPerformanceRecord {
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
  attendancePercentage: number;
  assignmentsAssigned: number;
  assignmentsSubmitted: number;
  assignmentCompletion: number;
  overallScore: number;
  parentMobile: string;
}

export interface AttendanceReportRecord {
  studentId: string;
  name: string;
  grNumber: string;
  className: string;
  boardName: string;
  division: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  subject: string;
}

export interface ClassAttendanceReport {
  classId: string;
  className: string;
  boardName: string;
  division: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export interface TeacherActivityReport {
  teacherId: string;
  teacherName: string;
  employeeId: string;
  assignedClasses: string[];
  assignedClassNames: string[];
  assignedSubjects: string[];
  assignedSubjectNames: string[];
  attendanceSessionsTaken: number;
  assignmentsCreated: number;
  noticesPublished: number;
  totalActivity: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface AttendanceTrendPoint {
  date: string;
  dayLabel: string;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export type ReportTab = 'overview' | 'student' | 'attendance' | 'teacher' | 'analytics';

export interface ReportFilters {
  academicYear: string;
  board: string;
  class: string;
  division: string;
  startDate: string;
  endDate: string;
  teacher: string;
  student: string;
}
