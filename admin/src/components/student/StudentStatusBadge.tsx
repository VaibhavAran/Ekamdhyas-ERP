import type { StudentStatus } from '../../types/student';
import { STUDENT_STATUS_STYLES } from '../../types/student';

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STUDENT_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
