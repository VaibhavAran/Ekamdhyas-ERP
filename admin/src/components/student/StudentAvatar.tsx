import type { StudentMaster } from '../../types/student';
import { fullName } from '../../services/studentService';

export function StudentAvatar({ student, size = 'md' }: { student: StudentMaster; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-16 w-16 text-xl',
  };

  if (student.photoUrl) {
    return (
      <img
        src={student.photoUrl}
        alt={fullName(student)}
        className={`${sizes[size]} rounded-full object-cover border-2 border-slate-200 shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-sm`}
    >
      {(student.firstName || '?').charAt(0).toUpperCase()}
    </div>
  );
}
