export interface User {
  id: string;
  name: string;
  rollNumber?: string;
  roll_no?: string;
  department?: string;
  department_id?: string;
  department_name?: string;
  class?: string;
  class_id?: string;
  class_name?: string;
  batch_id?: string;
  batch_name?: string;
  semester?: string;
  academicYear?: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  status?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  subject?: string;
  subject_name?: string;
  attendance_session_id?: string;
  start_time?: string;
  end_time?: string;
  slot_time?: string;
  class_id?: string;
  batch_id?: string;
  status: 'Present' | 'Absent' | 'present' | 'absent';
}

export interface SubjectAttendance {
  subject: string;
  totalLectures: number;
  presentCount: number;
}

export interface TimeTableItem {
  id: string;
  day: string;
  subject: string;
  faculty: string;
  time: string;
  room: string;
}

export interface NotificationItem {
  id: string;
  sender: string;
  role: 'teacher' | 'admin';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  category: 'academic' | 'exam' | 'event' | 'holiday';
}

export interface AttendanceSessionDoc {
  id: string;
  class_id?: string;
  batch_id?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  teacher_name?: string | null;
  date?: string | null;
  day?: string | null;
  created_at?: unknown;
  completed_at?: unknown;
}

export interface TimetableEntryDoc {
  id: string;
  class_id?: string;
  class_name?: string;
  batch_id?: string | null;
  batch_name?: string | null;
  day: string;
  start_time: string;
  end_time: string;
  subject_id?: string | null;
  subject_name?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  is_break?: boolean;
}

export interface LectureOverrideDoc {
  id: string;
  date: string;
  original_timetable_id: string;
  class_id: string;
  class_name: string;
  start_time: string;
  end_time: string;
  replacement_teacher_id: string;
  replacement_teacher_name: string;
  replacement_subject_id: string;
  replacement_subject_name: string;
  status: 'active' | 'cancelled';
  type: 'teacher_substitute';
  request_id?: string;
  original_teacher_id?: string;
  original_teacher_name?: string;
  original_subject_id?: string;
  original_subject_name?: string;
  created_at?: unknown;
}

export interface StudentTimetableEntry {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  subject_name: string;
  teacher_name: string;
  room?: string;
  is_break?: boolean;
  is_substitute?: boolean;
  original_timetable_id?: string;
  substitute_badge?: string;
}

export interface StudentTimetableView {
  timetable: StudentTimetableEntry[];
  todayClasses: StudentTimetableEntry[];
  slots: string[];
  todayName: string;
}

export interface DashboardSubjectProgress {
  subject: string;
  totalLectures: number;
  presentCount: number;
}

export interface DashboardTrendPoint {
  name: string;
  attendance: number;
  status: 'Present' | 'Absent';
  label: string;
}

export interface RecentAttendanceItem {
  id: string;
  subject: string;
  status: 'Present' | 'Absent';
  timestamp: string;
}
