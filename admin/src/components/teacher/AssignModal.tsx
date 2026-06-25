import { useState, useEffect, useMemo } from 'react';
import {
  FiX, FiBook, FiAward, FiUsers, FiCheck, FiLoader, FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Teacher } from '../../types/teacher';
import { updateTeacherAssignments } from '../../services/teacherService';
import type { Board, ClassModel } from '../../types/board';

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface AssignModalProps {
  teacher: Teacher;
  onClose: () => void;
  onUpdated: () => void;
}

export function AssignModal({ teacher, onClose, onUpdated }: AssignModalProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>(teacher.assignedBoards || []);
  const [selectedBoardNames, setSelectedBoardNames] = useState<string[]>(teacher.assignedBoardNames || []);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(teacher.assignedClasses || []);
  const [selectedClassNames, setSelectedClassNames] = useState<string[]>(teacher.assignedClassNames || []);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(teacher.assignedSubjects || []);
  const [selectedSubjectNames, setSelectedSubjectNames] = useState<string[]>(teacher.assignedSubjectNames || []);

  const [openSections, setOpenSections] = useState({ subjects: true, classes: true });

  const toggleSection = (section: 'subjects' | 'classes') => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [boardSnap, classSnap, subjectSnap] = await Promise.all([
          getDocs(collection(db, 'boards')),
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'subjects')),
        ]);
        setBoards(boardSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Board)));
        setClasses(classSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassModel)));
        setSubjects(subjectSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeBoards = useMemo(() => boards.filter((b) => b.status === 'active'), [boards]);
  const filteredClasses = useMemo(
    () =>
      classes.filter(
        (c) => c.status === 'active' && (selectedBoardIds.length === 0 || selectedBoardIds.includes(c.board_id))
      ),
    [classes, selectedBoardIds]
  );

  const toggleBoard = (id: string, name: string) => {
    const exists = selectedBoardIds.includes(id);
    setSelectedBoardIds(exists ? selectedBoardIds.filter((i) => i !== id) : [...selectedBoardIds, id]);
    setSelectedBoardNames(exists ? selectedBoardNames.filter((n) => n !== name) : [...selectedBoardNames, name]);
  };

  const toggleClass = (id: string, name: string) => {
    const exists = selectedClassIds.includes(id);
    setSelectedClassIds(exists ? selectedClassIds.filter((i) => i !== id) : [...selectedClassIds, id]);
    setSelectedClassNames(exists ? selectedClassNames.filter((n) => n !== name) : [...selectedClassNames, name]);
  };

  const toggleSubject = (id: string, name: string) => {
    const exists = selectedSubjectIds.includes(id);
    setSelectedSubjectIds(exists ? selectedSubjectIds.filter((i) => i !== id) : [...selectedSubjectIds, id]);
    setSelectedSubjectNames(exists ? selectedSubjectNames.filter((n) => n !== name) : [...selectedSubjectNames, name]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateTeacherAssignments(teacher.id, {
        assignedBoards: selectedBoardIds,
        assignedBoardNames: selectedBoardNames,
        assignedClasses: selectedClassIds,
        assignedClassNames: selectedClassNames,
        assignedSubjects: selectedSubjectIds,
        assignedSubjectNames: selectedSubjectNames,
      });
      showToast('Assignments updated successfully!', 'success');
      setTimeout(() => onUpdated(), 1000);
    } catch (error) {
      console.error('Error updating assignments:', error);
      showToast('Failed to update assignments', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const SectionHeader = ({
    section,
    title,
    icon: Icon,
  }: {
    section: 'subjects' | 'classes';
    title: string;
    icon: React.ElementType;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-5 py-3 text-left transition-colors hover:bg-slate-100"
    >
      <div className="flex items-center gap-3">
        <Icon className="text-blue-600" />
        <span className="font-bold text-slate-900 text-sm">{title}</span>
      </div>
      {openSections[section] ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {toast && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-xl bg-slate-900/95 backdrop-blur-sm px-4 py-3 text-white shadow-lg">
            {toast.type === 'success' ? <FiCheck className="text-emerald-400" /> : <FiX className="text-red-400" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Assign Subjects &amp; Classes</h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure subject and class assignments for this teacher
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <FiX className="text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <FiLoader className="animate-spin text-2xl text-blue-600" />
            </div>
          ) : (
            <>
              {/* Subjects Section */}
              <div className="space-y-3">
                <SectionHeader section="subjects" title="Assigned Subjects" icon={FiBook} />
                {openSections.subjects && (
                  <div className="flex flex-wrap gap-2 pl-2">
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => toggleSubject(subject.id, subject.name)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          selectedSubjectIds.includes(subject.id)
                            ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <FiBook className="text-xs" />
                        {subject.name}
                        {subject.code && <span className="text-xs text-slate-400">({subject.code})</span>}
                        {selectedSubjectIds.includes(subject.id) && <FiCheck className="text-xs" />}
                      </button>
                    ))}
                    {subjects.length === 0 && <p className="text-sm text-slate-400">No subjects found</p>}
                  </div>
                )}
              </div>

              {/* Classes Section */}
              <div className="space-y-3">
                <SectionHeader section="classes" title="Assigned Boards &amp; Classes" icon={FiUsers} />
                {openSections.classes && (
                  <div className="space-y-4 pl-2">
                    {/* Boards */}
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Boards</label>
                      <div className="flex flex-wrap gap-2">
                        {activeBoards.map((board) => (
                          <button
                            key={board.id}
                            type="button"
                            onClick={() => toggleBoard(board.id, board.name)}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                              selectedBoardIds.includes(board.id)
                                ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <FiAward className="text-xs" />
                            {board.name}
                            {selectedBoardIds.includes(board.id) && <FiCheck className="text-xs" />}
                          </button>
                        ))}
                        {activeBoards.length === 0 && <p className="text-sm text-slate-400">No active boards</p>}
                      </div>
                    </div>

                    {/* Classes */}
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Classes</label>
                      <div className="flex flex-wrap gap-2">
                        {filteredClasses.map((cls) => (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => toggleClass(cls.id, cls.name)}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                              selectedClassIds.includes(cls.id)
                                ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <FiUsers className="text-xs" />
                            {cls.name} {cls.division && `- ${cls.division}`}
                            {selectedClassIds.includes(cls.id) && <FiCheck className="text-xs" />}
                          </button>
                        ))}
                        {filteredClasses.length === 0 && (
                          <p className="text-sm text-slate-400">
                            {selectedBoardIds.length === 0 ? 'Select boards first' : 'No classes for selected boards'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? <FiLoader className="animate-spin text-lg" /> : 'Save All Assignments'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
