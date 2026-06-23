export type StudentStatus = 'Active' | 'Promoted' | 'Transferred' | 'Passed Out';
export type AcademicRecordStatus = 'Active' | 'Promoted' | 'Transferred' | 'Passed Out';

export interface StudentMaster {
  id: string;
  studentId: string;
  grNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  aadhaarNumber: string;
  photoUrl: string;
  fatherName: string;
  motherName: string;
  parentMobile: string;
  parentAlternateMobile: string;
  parentEmail: string;
  occupation: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: StudentStatus;
  role: 'student';
  created_at?: unknown;
  updated_at?: unknown;
}

export interface StudentAcademicRecord {
  id: string;
  studentId: string;
  studentDocId: string;
  academicYearId: string;
  academicYearName: string;
  boardId: string;
  boardName: string;
  classId: string;
  className: string;
  division: string;
  rollNumber: string;
  admissionDate: string;
  status: AcademicRecordStatus;
  remarks: string;
  created_at?: unknown;
}

export interface StudentRow extends StudentMaster {
  currentRecord?: StudentAcademicRecord;
  records: StudentAcademicRecord[];
}

export interface StudentForm extends Omit<StudentMaster, 'id' | 'studentId' | 'role' | 'created_at' | 'updated_at'> {
  academicYearId: string;
  boardId: string;
  classId: string;
  division: string;
  rollNumber: string;
  admissionDate: string;
  academicStatus: AcademicRecordStatus;
  remarks: string;
}

export interface ImportRow extends Partial<StudentForm> {
  rowNumber: number;
  errors: string[];
}

export const STUDENT_STATUS_STYLES: Record<StudentStatus, string> = {
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Promoted: 'bg-blue-100 text-blue-700 border-blue-200',
  Transferred: 'bg-amber-100 text-amber-700 border-amber-200',
  'Passed Out': 'bg-purple-100 text-purple-700 border-purple-200',
};

export const ALL_STUDENT_STATUSES = Object.keys(STUDENT_STATUS_STYLES) as StudentStatus[];

export const EMPTY_STUDENT_FORM: StudentForm = {
  grNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  bloodGroup: '',
  aadhaarNumber: '',
  photoUrl: '',
  fatherName: '',
  motherName: '',
  parentMobile: '',
  parentAlternateMobile: '',
  parentEmail: '',
  occupation: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  status: 'Active',
  academicYearId: '',
  boardId: '',
  classId: '',
  division: '',
  rollNumber: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  academicStatus: 'Active',
  remarks: '',
};

export const REQUIRED_IMPORT_FIELDS = ['grNumber', 'firstName'] as const;
