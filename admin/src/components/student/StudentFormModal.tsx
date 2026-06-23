import { FiAward, FiCalendar, FiFileText, FiUser, FiUsers } from 'react-icons/fi';
import { Field, Select, SectionTitle } from './FormControls';
import type { StudentForm, StudentStatus } from '../../types/student';
import { STUDENT_STATUS_STYLES } from '../../types/student';
import type { AcademicYear, Board, ClassModel } from '../../types/board';

export function StudentFormModal({
  mode,
  form,
  setForm,
  academicYears,
  boards,
  classes,
  onClose,
  onSubmit,
  onMarkPassedOut,
  isSubmitting,
}: {
  mode: 'add' | 'edit';
  form: StudentForm;
  setForm: (form: StudentForm) => void;
  academicYears: AcademicYear[];
  boards: Board[];
  classes: ClassModel[];
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onMarkPassedOut?: () => void;
  isSubmitting: boolean;
}) {
  const canMarkPassedOut = mode === 'edit' && form.status !== 'Passed Out';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 backdrop-blur-sm px-6 py-5">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === 'add' ? 'Add New Student' : 'Edit Student'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-8">
          {/* Academic Information */}
          <div>
            <SectionTitle icon={<FiCalendar />} title="Academic Information" />
            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <Select
                value={form.academicYearId}
                onChange={(value) => setForm({ ...form, academicYearId: value, classId: '' })}
                options={academicYears.map((y) => [y.id, y.name])}
                placeholder="Academic Year *"
              />
              <Select
                value={form.boardId}
                onChange={(value) => setForm({ ...form, boardId: value, classId: '' })}
                options={boards.map((b) => [b.id, b.name])}
                placeholder="Board *"
              />
              <Select
                value={form.classId}
                onChange={(value) =>
                  setForm({
                    ...form,
                    classId: value,
                    division: classes.find((c) => c.id === value)?.division || form.division,
                  })
                }
                options={classes.map((c) => [c.id, `${c.name}${c.division ? ` - ${c.division}` : ''}`])}
                placeholder="Class *"
              />
              <Field
                label="Division"
                value={form.division}
                onChange={(value) => setForm({ ...form, division: value })}
              />
              <Field
                label="Roll Number"
                value={form.rollNumber}
                onChange={(value) => setForm({ ...form, rollNumber: value })}
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Admission Date"
                type="date"
                value={form.admissionDate}
                onChange={(value) => setForm({ ...form, admissionDate: value })}
              />
              <Select
                value={form.status}
                onChange={(value) => setForm({ ...form, status: value as StudentStatus })}
                options={(Object.keys(STUDENT_STATUS_STYLES) as StudentStatus[]).map((s) => [s, s])}
                placeholder="Student Status"
              />
              <Field
                label="Remarks"
                value={form.remarks}
                onChange={(value) => setForm({ ...form, remarks: value })}
              />
            </div>
          </div>

          {/* Student Information */}
          <div>
            <SectionTitle icon={<FiUser />} title="Student Information" />
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field
                required
                label="GR / Admission Number"
                value={form.grNumber}
                onChange={(value) => setForm({ ...form, grNumber: value })}
              />
              <Field
                required
                label="First Name"
                value={form.firstName}
                onChange={(value) => setForm({ ...form, firstName: value })}
              />
              <Field
                label="Middle Name"
                value={form.middleName}
                onChange={(value) => setForm({ ...form, middleName: value })}
              />
              <Field
                label="Last Name"
                value={form.lastName}
                onChange={(value) => setForm({ ...form, lastName: value })}
              />
              <Select
                value={form.gender}
                onChange={(value) => setForm({ ...form, gender: value })}
                options={['Male', 'Female', 'Other'].map((v) => [v, v])}
                placeholder="Gender"
              />
              <Field
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(value) => setForm({ ...form, dateOfBirth: value })}
              />
              <Field
                label="Blood Group"
                value={form.bloodGroup}
                onChange={(value) => setForm({ ...form, bloodGroup: value })}
                placeholder="e.g. A+, B+, O+"
              />
              <Field
                label="Aadhaar Number"
                value={form.aadhaarNumber}
                onChange={(value) => setForm({ ...form, aadhaarNumber: value })}
                placeholder="12-digit number"
              />
              <div className="md:col-span-4">
                <Field
                  label="Student Photo URL"
                  value={form.photoUrl}
                  onChange={(value) => setForm({ ...form, photoUrl: value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Parent Information */}
          <div>
            <SectionTitle icon={<FiUsers />} title="Parent Information" />
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Father Name"
                value={form.fatherName}
                onChange={(value) => setForm({ ...form, fatherName: value })}
              />
              <Field
                label="Mother Name"
                value={form.motherName}
                onChange={(value) => setForm({ ...form, motherName: value })}
              />
              <Field
                required
                label="Parent Mobile"
                value={form.parentMobile}
                onChange={(value) => setForm({ ...form, parentMobile: value })}
              />
              <Field
                label="Alternate Mobile"
                value={form.parentAlternateMobile}
                onChange={(value) => setForm({ ...form, parentAlternateMobile: value })}
              />
              <Field
                label="Parent Email"
                type="email"
                value={form.parentEmail}
                onChange={(value) => setForm({ ...form, parentEmail: value })}
              />
              <Field
                label="Occupation"
                value={form.occupation}
                onChange={(value) => setForm({ ...form, occupation: value })}
              />
            </div>
          </div>

          {/* Address Information */}
          <div>
            <SectionTitle icon={<FiFileText />} title="Address Information" />
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="md:col-span-4">
                <Field
                  label="Address"
                  value={form.address}
                  onChange={(value) => setForm({ ...form, address: value })}
                />
              </div>
              <Field
                label="City"
                value={form.city}
                onChange={(value) => setForm({ ...form, city: value })}
              />
              <Field
                label="State"
                value={form.state}
                onChange={(value) => setForm({ ...form, state: value })}
              />
              <Field
                label="Pincode"
                value={form.pincode}
                onChange={(value) => setForm({ ...form, pincode: value })}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-5">
            {canMarkPassedOut && onMarkPassedOut ? (
              <button
                type="button"
                onClick={onMarkPassedOut}
                disabled={isSubmitting}
                className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-bold text-purple-700 hover:bg-purple-100 flex items-center gap-2 transition-colors disabled:opacity-60"
              >
                <FiAward /> Mark as Passed Out
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-100 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {isSubmitting ? 'Saving...' : mode === 'add' ? 'Create Student' : 'Update Student'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
