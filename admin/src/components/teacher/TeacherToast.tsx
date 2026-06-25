import { FiCheck, FiAlertCircle } from 'react-icons/fi';

interface TeacherToastProps {
  message: string;
  type: 'success' | 'error';
}

export function TeacherToast({ message, type }: TeacherToastProps) {
  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900/95 backdrop-blur-sm px-6 py-4 text-white shadow-2xl animate-in slide-in-from-top-5">
      {type === 'success' ? (
        <FiCheck className="text-emerald-400 text-xl" />
      ) : (
        <FiAlertCircle className="text-red-400 text-xl" />
      )}
      <p className="font-medium">{message}</p>
    </div>
  );
}
