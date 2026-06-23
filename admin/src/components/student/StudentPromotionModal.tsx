import { useMemo } from 'react';
import { FiAward } from 'react-icons/fi';
import { BaseModal } from './BaseModal';
import { Select } from './FormControls';
import type { StudentRow } from '../../types/student';
import { fullName, getClassNumber } from '../../services/studentService';
import type { AcademicYear, Board, ClassModel } from '../../types/board';

export function StudentPromotionModal({
  promotion,
  setPromotion,
  academicYears,
  boards,
  classes,
  allClasses,
  eligibleStudents,
  onPromote,
  onMarkPassedOut,
  onClose,
}: {
  promotion: { fromYearId: string; toYearId: string; boardId: string; classId: string; targetClassId: string };
  setPromotion: (value: { fromYearId: string; toYearId: string; boardId: string; classId: string; targetClassId: string }) => void;
  academicYears: AcademicYear[];
  boards: Board[];
  classes: ClassModel[];
  allClasses: ClassModel[];
  eligibleStudents: StudentRow[];
  onPromote: () => void;
  onMarkPassedOut: () => void;
  onClose: () => void;
}) {
  const selectedClass = classes.find((c) => c.id === promotion.classId);

  const availableToYears = useMemo(() => {
    if (!promotion.fromYearId) return academicYears;
    const fromIndex = academicYears.findIndex((y) => y.id === promotion.fromYearId);
    return academicYears.slice(0, fromIndex);
  }, [academicYears, promotion.fromYearId]);

  const targetClasses = useMemo(() => {
    if (!selectedClass || !promotion.toYearId) return [];
    const currentNum = getClassNumber(selectedClass.name);
    return allClasses.filter((c) => {
      if (c.board_id !== promotion.boardId) return false;
      if (selectedClass.division && c.division && c.division !== selectedClass.division) return false;
      if (currentNum === null) return false;
      return getClassNumber(c.name) === currentNum + 1;
    });
  }, [selectedClass, promotion.toYearId, promotion.boardId, allClasses]);

  const isLastClass = selectedClass && promotion.toYearId && targetClasses.length === 0;
  const noNextClass = selectedClass && !promotion.toYearId;
  const hasTargetClass = promotion.targetClassId !== '';
  const canPromote = eligibleStudents.length > 0 && (isLastClass || hasTargetClass);

  return (
    <BaseModal title="Student Promotion" onClose={onClose} width="max-w-4xl">
      <div className="space-y-5">
        {/* Selection */}
        <div className="grid gap-4 md:grid-cols-4">
          <Select
            value={promotion.fromYearId}
            onChange={(value) => setPromotion({ ...promotion, fromYearId: value, classId: '', targetClassId: '' })}
            options={academicYears.map((y) => [y.id, y.name])}
            placeholder="From Year"
          />
          <Select
            value={promotion.toYearId}
            onChange={(value) => setPromotion({ ...promotion, toYearId: value, targetClassId: '' })}
            options={availableToYears.map((y) => [y.id, y.name])}
            placeholder="To Year"
          />
          <Select
            value={promotion.boardId}
            onChange={(value) => setPromotion({ ...promotion, boardId: value, classId: '', targetClassId: '' })}
            options={boards.map((b) => [b.id, b.name])}
            placeholder="Board"
          />
          <Select
            value={promotion.classId}
            onChange={(value) => setPromotion({ ...promotion, classId: value, targetClassId: '' })}
            options={classes.map((c) => [c.id, `${c.name}${c.division ? ` - ${c.division}` : ''}`])}
            placeholder="Source Class"
          />
        </div>

        {/* Target Class or Passed Out */}
        {selectedClass && (
          <div className="grid gap-4 md:grid-cols-2">
            {isLastClass ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">
                <p className="font-bold text-amber-900">
                  This is the final class ({selectedClass.name}) — no next class available in {availableToYears.find((y) => y.id === promotion.toYearId)?.name}.
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  You can mark these students as Passed Out instead of promoting.
                </p>
              </div>
            ) : noNextClass ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
                <p className="font-bold text-blue-900">
                  Select "To Year" to see available target classes for {selectedClass.name}.
                </p>
              </div>
            ) : promotion.toYearId && (
              <Select
                value={promotion.targetClassId}
                onChange={(value) => setPromotion({ ...promotion, targetClassId: value })}
                options={targetClasses.map((c) => [c.id, `${c.name}${c.division ? ` - ${c.division}` : ''}`])}
                placeholder="Target Class (same division)"
              />
            )}
          </div>
        )}

        {/* Info */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-bold text-blue-900">
            {eligibleStudents.length} eligible active student{eligibleStudents.length !== 1 ? 's' : ''}
            {selectedClass && ` in ${selectedClass.name}${selectedClass.division ? ` ${selectedClass.division}` : ''}`}
          </p>
          <p className="mt-1 text-sm text-blue-700">
            {isLastClass
              ? 'These students will be marked as Passed Out.'
              : 'Promotion creates new academic records in the target year and keeps all prior records intact.'}
          </p>
        </div>

        {/* Student List */}
        <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
          {eligibleStudents.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between border-b border-slate-100 p-3 hover:bg-slate-50 transition-colors"
            >
              <div>
                <span className="font-medium text-slate-900">{fullName(student)}</span>
                <span className="ml-2 text-sm text-slate-500">
                  {student.currentRecord?.className} - {student.currentRecord?.division}
                </span>
              </div>
              <span className="font-mono text-sm text-slate-600">{student.grNumber}</span>
            </div>
          ))}
          {eligibleStudents.length === 0 && (
            <p className="p-8 text-center text-slate-500">No eligible students for this selection.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          {isLastClass ? (
            <button
              onClick={onMarkPassedOut}
              disabled={eligibleStudents.length === 0}
              className="rounded-lg bg-purple-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-purple-600/20 hover:bg-purple-700 disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              <FiAward /> Mark {eligibleStudents.length} as Passed Out
            </button>
          ) : (
            <button
              onClick={onPromote}
              disabled={!canPromote}
              className="rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              Promote {eligibleStudents.length} Student{eligibleStudents.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
