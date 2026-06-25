import {
  FiX, FiUser, FiMail, FiPhone, FiMapPin, FiCalendar, FiBriefcase,
  FiBook, FiUsers, FiClock, FiCheckCircle,
} from 'react-icons/fi';
import type { Teacher } from '../../types/teacher';
import { getTeacherFullName, getTeacherInitials } from '../../types/teacher';

interface TeacherProfileModalProps {
  teacher: Teacher;
  onClose: () => void;
}

export function TeacherProfileModal({ teacher, onClose }: TeacherProfileModalProps) {
  const fullName = getTeacherFullName(teacher);
  const initials = getTeacherInitials(teacher);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-2xl shadow-lg shadow-blue-600/20">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{fullName}</h2>
              <div className="text-slate-500 text-sm font-medium mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <FiBriefcase className="text-slate-400" />
                  {teacher.employeeId}
                </span>
                {teacher.professionalDetails.designation && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{teacher.professionalDetails.designation}</span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                  teacher.status === 'active' ? 'text-emerald-600' : 'text-slate-500'
                }`}>
                  {teacher.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors bg-white shadow-sm border border-slate-200"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Personal Information */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={FiUser} label="Full Name" value={fullName} />
              <InfoItem icon={FiUser} label="Gender" value={teacher.personalDetails.gender || '-'} />
              <InfoItem icon={FiCalendar} label="Date of Birth" value={teacher.personalDetails.dateOfBirth || '-'} />
              <InfoItem icon={FiPhone} label="Mobile Number" value={teacher.personalDetails.mobileNumber || '-'} />
              <InfoItem icon={FiMail} label="Email" value={teacher.personalDetails.email} />
              <InfoItem icon={FiMapPin} label="Address" value={teacher.personalDetails.address || '-'} span />
            </div>
          </div>

          {/* Professional Information */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Professional Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={FiBriefcase} label="Employee ID" value={teacher.employeeId} />
              <InfoItem icon={FiBriefcase} label="Designation" value={teacher.professionalDetails.designation || '-'} />
              <InfoItem icon={FiCalendar} label="Joining Date" value={teacher.professionalDetails.joiningDate || '-'} />
              <InfoItem icon={FiBook} label="Qualification" value={teacher.professionalDetails.qualification || '-'} />
              <InfoItem icon={FiClock} label="Experience" value={teacher.professionalDetails.experience || '-'} />
            </div>
          </div>

          {/* Assigned Subjects */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Assigned Subjects</h3>
            {teacher.assignedSubjectNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {teacher.assignedSubjectNames.map((subject, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700"
                  >
                    <FiBook className="text-xs" />
                    {subject}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No subjects assigned</p>
            )}
          </div>

          {/* Assigned Classes */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Assigned Classes</h3>
            {teacher.assignedClassNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {teacher.assignedClassNames.map((cls, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 border border-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700"
                  >
                    <FiUsers className="text-xs" />
                    {cls}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No classes assigned</p>
            )}
          </div>

          {/* Attendance Summary (Placeholder) */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Attendance Summary</h3>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <FiClock className="mx-auto text-3xl text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Attendance data will appear here once integrated with the attendance module.</p>
            </div>
          </div>

          {/* Activity Summary (Placeholder) */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Activity Summary</h3>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <FiCheckCircle className="mx-auto text-3xl text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Activity logs will appear here once the module is active.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-8 py-5 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-md"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  span,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 ${span ? 'col-span-2' : ''}`}>
      <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
        <Icon className="text-sm" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-0.5 font-medium text-slate-900 break-words">{value}</div>
      </div>
    </div>
  );
}
