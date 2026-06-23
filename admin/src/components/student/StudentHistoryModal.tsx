import type { StudentRow } from '../../types/student';
import { fullName } from '../../services/studentService';
import { BaseModal } from './BaseModal';
import { Timeline } from './Timeline';

export function StudentHistoryModal({ student, onClose }: { student: StudentRow; onClose: () => void }) {
  return (
    <BaseModal title={`Academic History - ${fullName(student)}`} onClose={onClose} width="max-w-4xl">
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{fullName(student)}</span>
            {' '}&mdash; GR: {student.grNumber} | ID: {student.studentId}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {student.records.length} academic record{student.records.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Timeline records={student.records} />
      </div>
    </BaseModal>
  );
}
