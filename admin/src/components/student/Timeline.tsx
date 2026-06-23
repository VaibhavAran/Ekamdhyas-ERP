import type { StudentAcademicRecord } from '../../types/student';

export function Timeline({ records }: { records: StudentAcademicRecord[] }) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-bold text-slate-900">Academic History Timeline</h3>
      <div className="relative space-y-0">
        {records.map((record, index) => (
          <div key={record.id} className="relative flex gap-4 pb-6">
            {index < records.length - 1 && (
              <div className="absolute left-[7px] top-5 h-full w-0.5 bg-slate-200" />
            )}
            <div className="mt-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-[3px] border-blue-500 bg-white shadow-sm" />
            <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    {record.academicYearName} &rarr; {record.className}
                    {record.division ? ` ${record.division}` : ''}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {record.boardName} | Roll {record.rollNumber || '-'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    record.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : record.status === 'Promoted'
                      ? 'bg-blue-100 text-blue-700'
                      : record.status === 'Passed Out'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {record.status}
                </span>
              </div>
              {record.remarks && (
                <p className="mt-2 text-sm text-slate-600">{record.remarks}</p>
              )}
              {record.admissionDate && (
                <p className="mt-1 text-xs text-slate-400">
                  Admitted: {record.admissionDate}
                </p>
              )}
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-slate-500 font-medium">No academic records yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
