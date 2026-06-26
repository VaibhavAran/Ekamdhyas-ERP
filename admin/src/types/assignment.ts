export type AssignmentStatus = 'active' | 'completed' | 'overdue' | 'draft';

export type SubmissionStatus = 'submitted' | 'pending' | 'late' | 'reviewed';

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  academicYearName: string;
  boardId: string;
  boardName: string;
  classId: string;
  className: string;
  divisionId: string;
  divisionName: string;
  assignedDate: string;
  dueDate: string;
  attachmentUrl: string;
  attachmentName: string;
  status: AssignmentStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AssignmentForm {
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  academicYearName: string;
  boardId: string;
  boardName: string;
  classId: string;
  className: string;
  divisionId: string;
  divisionName: string;
  assignedDate: string;
  dueDate: string;
  attachmentUrl: string;
  attachmentName: string;
  status: AssignmentStatus;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  grNumber: string;
  submissionDate: string;
  attachmentUrl: string;
  attachmentName: string;
  remarks: string;
  status: SubmissionStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface SubmissionDetail {
  studentId: string;
  studentName: string;
  grNumber: string;
  submission: AssignmentSubmission | null;
  status: SubmissionStatus;
}

export const EMPTY_ASSIGNMENT_FORM: AssignmentForm = {
  title: '',
  description: '',
  subjectId: '',
  subjectName: '',
  teacherId: '',
  teacherName: '',
  academicYearId: '',
  academicYearName: '',
  boardId: '',
  boardName: '',
  classId: '',
  className: '',
  divisionId: '',
  divisionName: '',
  assignedDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  attachmentUrl: '',
  attachmentName: '',
  status: 'active',
};

export const ASSIGNMENT_STATUS_STYLES: Record<AssignmentStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  overdue: 'bg-rose-100 text-rose-700 border-rose-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const SUBMISSION_STATUS_STYLES: Record<SubmissionStatus, string> = {
  submitted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  late: 'bg-rose-100 text-rose-700 border-rose-200',
  reviewed: 'bg-blue-100 text-blue-700 border-blue-200',
};

export const ALL_ASSIGNMENT_STATUSES: AssignmentStatus[] = ['active', 'completed', 'overdue', 'draft'];
