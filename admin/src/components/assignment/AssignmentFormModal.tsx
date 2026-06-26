import { useState } from 'react';
import { FiSave } from 'react-icons/fi';
import { BaseModal } from './BaseModal';
import type { AssignmentForm } from '../../types/assignment';
import type { AcademicYear, Board, ClassModel } from '../../types/board';
import type { Teacher } from '../../types/teacher';

interface Props {
  form: AssignmentForm;
  setForm: React.Dispatch<React.SetStateAction<AssignmentForm>>;
  onSubmit: () => void;
  onClose: () => void;
  isEdit?: boolean;
  academicYears: AcademicYear[];
  boards: Board[];
  classes: ClassModel[];
  teachers: Teacher[];
  subjects: { id: string; name: string }[];
  filteredClasses: ClassModel[];
  divisions: string[];
  isSubmitting: boolean;
}

export function AssignmentFormModal({
  form,
  setForm,
  onSubmit,
  onClose,
  isEdit = false,
  academicYears,
  boards,
  classes,
  teachers,
  subjects,
  filteredClasses,
  divisions,
  isSubmitting,
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Assignment title is required.';
    if (!form.subjectId) errs.subjectId = 'Subject is required.';
    if (!form.teacherId) errs.teacherId = 'Teacher is required.';
    if (!form.dueDate) errs.dueDate = 'Due date is required.';
    if (!form.academicYearId) errs.academicYearId = 'Academic year is required.';
    if (!form.boardId) errs.boardId = 'Board is required.';
    if (!form.classId) errs.classId = 'Class is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit();
  };

  const handleChange = (field: keyof AssignmentForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubjectChange = (subjectId: string) => {
    const subject = subjects.find((s) => s.id === subjectId);
    setForm((prev) => ({ ...prev, subjectId, subjectName: subject?.name || '' }));
    if (errors.subjectId) setErrors((prev) => ({ ...prev, subjectId: '' }));
  };

  const handleTeacherChange = (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    const name = teacher
      ? [teacher.personalDetails.firstName, teacher.personalDetails.middleName, teacher.personalDetails.lastName]
          .filter(Boolean)
          .join(' ')
      : '';
    setForm((prev) => ({ ...prev, teacherId, teacherName: name }));
    if (errors.teacherId) setErrors((prev) => ({ ...prev, teacherId: '' }));
  };

  const handleBoardChange = (boardId: string) => {
    const board = boards.find((b) => b.id === boardId);
    setForm((prev) => ({ ...prev, boardId, boardName: board?.name || '', classId: '', className: '', divisionId: '', divisionName: '' }));
    if (errors.boardId) setErrors((prev) => ({ ...prev, boardId: '' }));
  };

  const handleClassChange = (classId: string) => {
    const cls = filteredClasses.find((c) => c.id === classId);
    setForm((prev) => ({
      ...prev,
      classId,
      className: cls?.name || '',
      divisionId: cls?.division || '',
      divisionName: cls?.division || '',
    }));
    if (errors.classId) setErrors((prev) => ({ ...prev, classId: '' }));
  };

  const handleYearChange = (yearId: string) => {
    const year = academicYears.find((y) => y.id === yearId);
    setForm((prev) => ({ ...prev, academicYearId: yearId, academicYearName: year?.name || '' }));
    if (errors.academicYearId) setErrors((prev) => ({ ...prev, academicYearId: '' }));
  };

  return (
    <BaseModal title={isEdit ? 'Edit Assignment' : 'Create Assignment'} onClose={onClose} width="max-w-3xl">
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            Assignment Title <span className="ml-0.5 text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter assignment title"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Enter assignment description"
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Subject <span className="ml-0.5 text-red-500">*</span>
            </label>
            <select
              value={form.subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.subjectId && <p className="mt-1 text-xs text-red-500">{errors.subjectId}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Teacher <span className="ml-0.5 text-red-500">*</span>
            </label>
            <select
              value={form.teacherId}
              onChange={(e) => handleTeacherChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">Select Teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {[t.personalDetails.firstName, t.personalDetails.middleName, t.personalDetails.lastName].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
            {errors.teacherId && <p className="mt-1 text-xs text-red-500">{errors.teacherId}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Academic Year <span className="ml-0.5 text-red-500">*</span>
            </label>
            <select
              value={form.academicYearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">Select Year</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
            {errors.academicYearId && <p className="mt-1 text-xs text-red-500">{errors.academicYearId}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Board <span className="ml-0.5 text-red-500">*</span>
            </label>
            <select
              value={form.boardId}
              onChange={(e) => handleBoardChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">Select Board</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.boardId && <p className="mt-1 text-xs text-red-500">{errors.boardId}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Class <span className="ml-0.5 text-red-500">*</span>
            </label>
            <select
              value={form.classId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={!form.boardId}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Class</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.classId && <p className="mt-1 text-xs text-red-500">{errors.classId}</p>}
          </div>
        </div>

        {divisions.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Division</label>
            <select
              value={form.divisionId}
              onChange={(e) => {
                const div = e.target.value;
                setForm((prev) => ({ ...prev, divisionId: div, divisionName: div }));
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">Select Division</option>
              {divisions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Assigned Date</label>
            <input
              type="date"
              value={form.assignedDate}
              onChange={(e) => handleChange('assignedDate', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Due Date <span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => handleChange('dueDate', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            />
            {errors.dueDate && <p className="mt-1 text-xs text-red-500">{errors.dueDate}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Attachment (Optional)</label>
          <input
            type="text"
            value={form.attachmentUrl}
            onChange={(e) => handleChange('attachmentUrl', e.target.value)}
            placeholder="Enter attachment URL"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Status</label>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <FiSave size={16} />
            )}
            {isEdit ? 'Update Assignment' : 'Create Assignment'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
