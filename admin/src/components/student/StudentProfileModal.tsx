import type { StudentRow } from '../../types/student';
import { fullName } from '../../services/studentService';
import { BaseModal } from './BaseModal';
import { StudentAvatar } from './StudentAvatar';
import { StudentStatusBadge } from './StudentStatusBadge';
import { InfoGrid } from './InfoGrid';
import { Timeline } from './Timeline';

export function StudentProfileModal({ student, onClose }: { student: StudentRow; onClose: () => void }) {
  const current = student.currentRecord;

  return (
    <BaseModal title="Student Profile" onClose={onClose} width="max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-5 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 p-6 border border-slate-200">
          <StudentAvatar student={student} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-slate-900 truncate">{fullName(student)}</h2>
            <p className="mt-1 text-sm text-slate-500 font-mono">
              {student.studentId} | GR: {student.grNumber}
            </p>
            <p className="text-sm text-slate-400">
              {student.gender} {student.dateOfBirth ? ` | DOB: ${student.dateOfBirth}` : ''}
              {student.bloodGroup ? ` | ${student.bloodGroup}` : ''}
            </p>
          </div>
          <div className="flex-shrink-0">
            <StudentStatusBadge status={student.status} />
          </div>
        </div>

        {/* Personal Details */}
        <InfoGrid
          title="Personal Details"
          rows={[
            ['Gender', student.gender],
            ['Date of Birth', student.dateOfBirth],
            ['Blood Group', student.bloodGroup],
            ['Aadhaar Number', student.aadhaarNumber],
          ]}
        />

        {/* Parent Details */}
        <InfoGrid
          title="Parent Details"
          rows={[
            ['Father Name', student.fatherName],
            ['Mother Name', student.motherName],
            ['Parent Mobile', student.parentMobile],
            ['Alternate Mobile', student.parentAlternateMobile],
            ['Parent Email', student.parentEmail],
            ['Occupation', student.occupation],
          ]}
        />

        {/* Address Details */}
        <InfoGrid
          title="Address Details"
          rows={[
            ['Address', student.address],
            ['City', student.city],
            ['State', student.state],
            ['Pincode', student.pincode],
          ]}
        />

        {/* Current Academic Information */}
        <InfoGrid
          title="Current Academic Information"
          rows={[
            ['Academic Year', current?.academicYearName],
            ['Board', current?.boardName],
            ['Class', current?.className],
            ['Division', current?.division],
            ['Roll Number', current?.rollNumber],
            ['Admission Date', current?.admissionDate],
          ]}
        />

        {/* Academic History Timeline */}
        <Timeline records={student.records} />

        {/* Future Sections */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <p className="font-semibold text-slate-500">Attendance Summary</p>
            <p className="mt-2 text-sm text-slate-400">Coming soon...</p>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <p className="font-semibold text-slate-500">Documents Section</p>
            <p className="mt-2 text-sm text-slate-400">Coming soon...</p>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
