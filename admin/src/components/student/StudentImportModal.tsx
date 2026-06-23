import { FiDownload, FiUpload } from 'react-icons/fi';
import { BaseModal } from './BaseModal';
import type { ImportRow } from '../../types/student';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export function StudentImportModal({
  rows,
  onFile,
  onImport,
  onTemplate,
  onClose,
  isSubmitting,
}: {
  rows: ImportRow[];
  onFile: (file: File) => void;
  onImport: () => void;
  onTemplate: () => void;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  const valid = rows.filter((r) => r.errors.length === 0).length;
  const invalid = rows.length - valid;

  return (
    <BaseModal title="Bulk Student Import" onClose={onClose} width="max-w-6xl">
      <div className="space-y-5">
        {/* Upload Actions */}
        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-bold text-blue-700 hover:bg-blue-100 flex items-center gap-2 transition-colors">
            <FiUpload /> Upload CSV / Excel
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <button
            onClick={onTemplate}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <FiDownload /> Sample Template
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Total Records" value={rows.length} />
          <Stat label="Valid Records" value={valid} />
          <Stat label="Invalid Records" value={invalid} />
        </div>

        {/* Preview Table */}
        <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="p-3 font-semibold text-slate-700">Row</th>
                <th className="p-3 font-semibold text-slate-700">GR Number</th>
                <th className="p-3 font-semibold text-slate-700">Name</th>
                <th className="p-3 font-semibold text-slate-700">Status</th>
                <th className="p-3 font-semibold text-slate-700">Errors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-slate-600">{row.rowNumber}</td>
                  <td className="p-3 font-mono text-slate-700">{row.grNumber}</td>
                  <td className="p-3 font-medium text-slate-800">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="p-3">
                    {row.errors.length ? (
                      <span className="text-red-600 font-bold">Invalid</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">Valid</span>
                    )}
                  </td>
                  <td className="p-3 text-red-600 text-xs">{row.errors.join('; ')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Upload a file to preview records before import.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={isSubmitting || valid === 0}
            className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? 'Importing...' : `Import ${valid} Valid Student${valid !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
