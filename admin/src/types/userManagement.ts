export type UserRole = 'admin' | 'teacher' | 'student';
export type UserAccountStatus = 'active' | 'inactive';

export interface SystemUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  lastLogin: string;
  createdAt: unknown;
  collection: 'controllers' | 'teachers' | 'students';
  phone?: string;
  className?: string;
  boardName?: string;
  employeeId?: string;
  department?: string;
}

export const USER_ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  teacher: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export const USER_STATUS_STYLES: Record<UserAccountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  inactive: 'bg-rose-100 text-rose-700 border-rose-200',
};
