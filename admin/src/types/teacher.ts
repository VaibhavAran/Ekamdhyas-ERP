export interface TeacherPersonalDetails {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  mobileNumber: string;
  email: string;
  address: string;
}

export interface TeacherProfessionalDetails {
  joiningDate: string;
  qualification: string;
  experience: string;
  designation: string;
}

export interface Teacher {
  id: string;
  employeeId: string;
  personalDetails: TeacherPersonalDetails;
  professionalDetails: TeacherProfessionalDetails;
  assignedBoards: string[];
  assignedBoardNames: string[];
  assignedClasses: string[];
  assignedClassNames: string[];
  assignedSubjects: string[];
  assignedSubjectNames: string[];
  academicYear: string;
  username: string;
  password?: string;
  status: 'active' | 'inactive';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface TeacherForm {
  employeeId: string;
  personalDetails: TeacherPersonalDetails;
  professionalDetails: TeacherProfessionalDetails;
  assignedBoards: string[];
  assignedBoardNames: string[];
  assignedClasses: string[];
  assignedClassNames: string[];
  assignedSubjects: string[];
  assignedSubjectNames: string[];
  academicYear: string;
  username: string;
  password: string;
  status: 'active' | 'inactive';
}

export const EMPTY_TEACHER_FORM: TeacherForm = {
  employeeId: '',
  personalDetails: {
    firstName: '',
    middleName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    mobileNumber: '',
    email: '',
    address: '',
  },
  professionalDetails: {
    joiningDate: '',
    qualification: '',
    experience: '',
    designation: '',
  },
  assignedBoards: [],
  assignedBoardNames: [],
  assignedClasses: [],
  assignedClassNames: [],
  assignedSubjects: [],
  assignedSubjectNames: [],
  academicYear: '',
  username: '',
  password: '',
  status: 'active',
};

export function getTeacherFullName(teacher: Teacher | TeacherForm): string {
  const { firstName, middleName, lastName } = teacher.personalDetails;
  return [firstName, middleName, lastName].filter(Boolean).join(' ');
}

export function getTeacherInitials(teacher: Teacher | TeacherForm): string {
  const { firstName, middleName, lastName } = teacher.personalDetails;
  const parts = [firstName, middleName, lastName].filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
