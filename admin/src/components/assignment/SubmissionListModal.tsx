import { FiCheck, FiClock, FiX, FiExternalLink } from 'react-icons/fi';
import { BaseModal } from './BaseModal';
import { SUBMISSION_STATUS_STYLES } from '../../types/assignment';
import type { Assignment, SubmissionDetail } from '../../types/assignment';

interface Props {
  assignment: Assignment;
  submissions: SubmissionDetail[];
  totalStudents: number;
  onClose: () => void;
}

export function SubmissionListModal({ assignment, submissions, totalStudents, onClose }: Props) {
  const submitted = submissions.filter((s) => s.status === 'submitted' || s.status === 'reviewed').length;
  const pending = submissions.filter((s) => s.status === 'pending').length;
  const late = submissions.filter((s) => s.status === 'late').length;
  const percentage = totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0;

  return (
    <BaseModal title={`Submissions - ${assignment.title}`} onClose={onClose} width="max-w-4xl">
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{totalStudents}</p>
            <p className="mt-1 text-xs font-semibold text-blue-500 uppercase">Total Students</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{submitted}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-500 uppercase">Submitted</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{pending}</p>
            <p className="mt-1 text-xs font-semibold text-amber-500 uppercase">Pending</p>
          </div>
          <div className="rounded-xl bg-rose-50 p-4 text-center">
            <p className="text-2xl font-bold text-rose-700">{late}</p>
            <p className="mt-1 text-xs font-semibold text-rose-500 uppercase">Late</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Submission Progress</span>
            <span className="text-sm font-bold text-slate-900">{percentage}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">#</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Student Name</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">GR Number</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Submission Date</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Attachment</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <FiClock className="mx-auto mb-2 text-3xl" />
                      <p className="font-medium">No students found for this assignment</p>
                    </td>
                  </tr>
                ) : (
                  submissions.map((s, idx) => (
                    <tr key={s.studentId} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-600">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-slate-900">{s.studentName}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{s.grNumber}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {s.submission?.submissionDate
                          ? new Date(s.submission.submissionDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SUBMISSION_STATUS_STYLES[s.status]}`}
                        >
                          {s.status === 'submitted' && <FiCheck size={12} />}
                          {s.status === 'pending' && <FiClock size={12} />}
                          {s.status === 'late' && <FiX size={12} />}
                          {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {s.submission?.attachmentUrl ? (
                          <a
                            href={s.submission.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            <FiExternalLink size={14} />
                            View
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate">
                        {s.submission?.remarks || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
