import { FiCalendar, FiBook, FiUser, FiHome, FiClock, FiLink } from 'react-icons/fi';
import { BaseModal } from './BaseModal';
import { ASSIGNMENT_STATUS_STYLES } from '../../types/assignment';
import type { Assignment } from '../../types/assignment';

interface Props {
  assignment: Assignment;
  onClose: () => void;
}

export function AssignmentViewModal({ assignment, onClose }: Props) {
  return (
    <BaseModal title="Assignment Details" onClose={onClose} width="max-w-2xl">
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{assignment.title}</h3>
          <span
            className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ASSIGNMENT_STATUS_STYLES[assignment.status]}`}
          >
            {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
          </span>
        </div>

        {assignment.description && (
          <div>
            <p className="text-sm text-slate-600 leading-relaxed">{assignment.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <FiBook className="mt-0.5 text-blue-500" size={18} />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{assignment.subjectName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <FiUser className="mt-0.5 text-emerald-500" size={18} />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Teacher</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{assignment.teacherName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <FiHome className="mt-0.5 text-purple-500" size={18} />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {assignment.className}
                {assignment.divisionName && ` - ${assignment.divisionName}`}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <FiCalendar className="mt-0.5 text-amber-500" size={18} />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Academic Year</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{assignment.academicYearName}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <FiClock size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">Assigned Date</p>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {assignment.assignedDate ? new Date(assignment.assignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <FiClock size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">Due Date</p>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
            </p>
          </div>
        </div>

        {assignment.attachmentUrl && (
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <FiLink size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">Attachment</p>
            </div>
            <a
              href={assignment.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {assignment.attachmentName || 'View Attachment'}
            </a>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
