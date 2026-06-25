import React, { useState, useEffect, useMemo } from 'react';
import {
  FiX, FiUser, FiMail, FiPhone, FiMapPin, FiBriefcase,
  FiBook, FiAward, FiUsers, FiLoader, FiLock,
  FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import type { TeacherForm } from '../../types/teacher';
import type { Board, ClassModel, AcademicYear } from '../../types/board';

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface TeacherFormModalProps {
  mode: 'add' | 'edit';
  form: TeacherForm;
  setForm: React.Dispatch<React.SetStateAction<TeacherForm>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  validationErrors: Record<string, string>;
}

export function TeacherFormModal({
  mode,
  form,
  setForm,
  onClose,
  onSubmit,
  isSubmitting,
  validationErrors,
}: TeacherFormModalProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    personal: true,
    professional: false,
    academic: false,
    login: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [boardSnap, classSnap, subjectSnap, yearSnap] = await Promise.all([
          getDocs(collection(db, 'boards')),
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'subjects')),
          getDocs(collection(db, 'academic_years')),
        ]);
        setBoards(boardSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Board)));
        setClasses(classSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassModel)));
        setSubjects(subjectSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
        setAcademicYears(yearSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicYear)));
      } catch (error) {
        console.error('Error fetching form data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const activeBoards = useMemo(() => boards.filter((b) => b.status === 'active'), [boards]);
  const filteredClasses = useMemo(
    () =>
      classes.filter(
        (c) =>
          c.status === 'active' &&
          (form.assignedBoards.length === 0 || form.assignedBoards.includes(c.board_id))
      ),
    [classes, form.assignedBoards]
  );
  const activeYears = useMemo(() => academicYears.filter((y) => y.isActive), [academicYears]);

  const handleBoardToggle = (boardId: string, boardName: string) => {
    setForm((prev) => {
      const exists = prev.assignedBoards.includes(boardId);
      return {
        ...prev,
        assignedBoards: exists
          ? prev.assignedBoards.filter((id) => id !== boardId)
          : [...prev.assignedBoards, boardId],
        assignedBoardNames: exists
          ? prev.assignedBoardNames.filter((n) => n !== boardName)
          : [...prev.assignedBoardNames, boardName],
      };
    });
  };

  const handleSubjectToggle = (subjectId: string, subjectName: string) => {
    setForm((prev) => {
      const exists = prev.assignedSubjects.includes(subjectId);
      return {
        ...prev,
        assignedSubjects: exists
          ? prev.assignedSubjects.filter((id) => id !== subjectId)
          : [...prev.assignedSubjects, subjectId],
        assignedSubjectNames: exists
          ? prev.assignedSubjectNames.filter((n) => n !== subjectName)
          : [...prev.assignedSubjectNames, subjectName],
      };
    });
  };

  const handleClassToggle = (classId: string, className: string) => {
    setForm((prev) => {
      const exists = prev.assignedClasses.includes(classId);
      return {
        ...prev,
        assignedClasses: exists
          ? prev.assignedClasses.filter((id) => id !== classId)
          : [...prev.assignedClasses, classId],
        assignedClassNames: exists
          ? prev.assignedClassNames.filter((n) => n !== className)
          : [...prev.assignedClassNames, className],
      };
    });
  };

  const error = (field: string) => validationErrors[field];

  const SectionHeader = ({
    section,
    title,
    icon: Icon,
  }: {
    section: string;
    title: string;
    icon: React.ElementType;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-5 py-3.5 text-left transition-colors hover:bg-slate-100"
    >
      <div className="flex items-center gap-3">
        <Icon className="text-blue-600" />
        <span className="font-bold text-slate-900">{title}</span>
      </div>
      {openSections[section] ? (
        <FiChevronUp className="text-slate-400" />
      ) : (
        <FiChevronDown className="text-slate-400" />
      )}
    </button>
  );

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/10 ${
      error(field) ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
    }`;

  if (isLoadingData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-2xl rounded-3xl bg-white p-12 shadow-2xl">
          <div className="flex flex-col items-center">
            <FiLoader className="animate-spin text-3xl text-blue-600 mb-4" />
            <p className="font-medium text-slate-600">Loading form data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === 'add' ? 'Add New Teacher' : 'Edit Teacher Profile'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-8 space-y-5">
          {/* Employee ID */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Employee ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="text"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className={inputClass('employeeId')}
                placeholder="e.g. EMP001"
                disabled={mode === 'edit'}
              />
            </div>
            {error('employeeId') && (
              <p className="mt-1 text-xs text-red-500">{error('employeeId')}</p>
            )}
          </div>

          {/* Personal Details */}
          <div className="space-y-4">
            <SectionHeader section="personal" title="Personal Details" icon={FiUser} />
            {openSections.personal && (
              <div className="space-y-4 pl-2">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={form.personalDetails.firstName}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personalDetails: { ...form.personalDetails, firstName: e.target.value },
                        })
                      }
                      className={inputClass('firstName')}
                      placeholder="First name"
                    />
                    {error('firstName') && (
                      <p className="mt-1 text-xs text-red-500">{error('firstName')}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Middle Name</label>
                    <input
                      type="text"
                      value={form.personalDetails.middleName}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personalDetails: { ...form.personalDetails, middleName: e.target.value },
                        })
                      }
                      className={inputClass('middleName')}
                      placeholder="Middle name"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={form.personalDetails.lastName}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personalDetails: { ...form.personalDetails, lastName: e.target.value },
                        })
                      }
                      className={inputClass('lastName')}
                      placeholder="Last name"
                    />
                    {error('lastName') && (
                      <p className="mt-1 text-xs text-red-500">{error('lastName')}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={form.personalDetails.gender}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personalDetails: { ...form.personalDetails, gender: e.target.value },
                        })
                      }
                      className={inputClass('gender')}
                    >
                      <option value="" disabled>Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Date of Birth</label>
                    <input
                      type="date"
                      value={form.personalDetails.dateOfBirth}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personalDetails: { ...form.personalDetails, dateOfBirth: e.target.value },
                        })
                      }
                      className={inputClass('dateOfBirth')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="tel"
                        value={form.personalDetails.mobileNumber}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            personalDetails: { ...form.personalDetails, mobileNumber: e.target.value },
                          })
                        }
                        className={inputClass('mobileNumber')}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                      />
                    </div>
                    {error('mobileNumber') && (
                      <p className="mt-1 text-xs text-red-500">{error('mobileNumber')}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="email"
                        value={form.personalDetails.email}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            personalDetails: { ...form.personalDetails, email: e.target.value },
                          })
                        }
                        className={inputClass('email')}
                        placeholder="teacher@school.edu"
                        disabled={mode === 'edit'}
                      />
                    </div>
                    {error('email') && (
                      <p className="mt-1 text-xs text-red-500">{error('email')}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Address</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-3.5 text-slate-400" />
                    <textarea
                      value={form.personalDetails.address}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personalDetails: { ...form.personalDetails, address: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 resize-none"
                      rows={2}
                      placeholder="Full address"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Professional Details */}
          <div className="space-y-4">
            <SectionHeader section="professional" title="Professional Details" icon={FiBriefcase} />
            {openSections.professional && (
              <div className="space-y-4 pl-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Joining Date</label>
                    <input
                      type="date"
                      value={form.professionalDetails.joiningDate}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          professionalDetails: { ...form.professionalDetails, joiningDate: e.target.value },
                        })
                      }
                      className={inputClass('joiningDate')}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={form.professionalDetails.designation}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          professionalDetails: { ...form.professionalDetails, designation: e.target.value },
                        })
                      }
                      className={inputClass('designation')}
                      placeholder="e.g. Senior Teacher"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Qualification</label>
                    <input
                      type="text"
                      value={form.professionalDetails.qualification}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          professionalDetails: { ...form.professionalDetails, qualification: e.target.value },
                        })
                      }
                      className={inputClass('qualification')}
                      placeholder="e.g. M.Sc., B.Ed."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Experience</label>
                    <input
                      type="text"
                      value={form.professionalDetails.experience}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          professionalDetails: { ...form.professionalDetails, experience: e.target.value },
                        })
                      }
                      className={inputClass('experience')}
                      placeholder="e.g. 5 years"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Academic Details - only in edit mode */}
          {mode === 'edit' && (
          <div className="space-y-4">
            <SectionHeader section="academic" title="Academic Details" icon={FiBook} />
            {openSections.academic && (
              <div className="space-y-5 pl-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Academic Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    className={inputClass('academicYear')}
                  >
                    <option value="" disabled>Select Academic Year</option>
                    {activeYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                  {error('academicYear') && (
                    <p className="mt-1 text-xs text-red-500">{error('academicYear')}</p>
                  )}
                </div>

                {/* Assigned Boards */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Assigned Board(s)</label>
                  <div className="flex flex-wrap gap-2">
                    {activeBoards.map((board) => (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => handleBoardToggle(board.id, board.name)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          form.assignedBoards.includes(board.id)
                            ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <FiAward className="text-xs" />
                        {board.name}
                      </button>
                    ))}
                    {activeBoards.length === 0 && (
                      <p className="text-sm text-slate-400">No active boards found</p>
                    )}
                  </div>
                </div>

                {/* Assigned Classes */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Assigned Class(es)</label>
                  <div className="flex flex-wrap gap-2">
                    {filteredClasses.map((cls) => (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleClassToggle(cls.id, cls.name)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          form.assignedClasses.includes(cls.id)
                            ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <FiUsers className="text-xs" />
                        {cls.name} {cls.division && `- ${cls.division}`}
                      </button>
                    ))}
                    {filteredClasses.length === 0 && (
                      <p className="text-sm text-slate-400">
                        {form.assignedBoards.length === 0
                          ? 'Select boards first to see available classes'
                          : 'No active classes for selected boards'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Assigned Subjects */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Assigned Subject(s)</label>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => handleSubjectToggle(subject.id, subject.name)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          form.assignedSubjects.includes(subject.id)
                            ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <FiBook className="text-xs" />
                        {subject.name}
                        {subject.code && (
                          <span className="text-xs text-slate-400">({subject.code})</span>
                        )}
                      </button>
                    ))}
                    {subjects.length === 0 && (
                      <p className="text-sm text-slate-400">No subjects found</p>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
          )}

          {/* Login Details */}
          <div className="space-y-4">
            <SectionHeader section="login" title="Login Details" icon={FiLock} />
            {openSections.login && (
              <div className="space-y-4 pl-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className={inputClass('username')}
                      placeholder="Login username"
                    />
                    {error('username') && (
                      <p className="mt-1 text-xs text-red-500">{error('username')}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Password {mode === 'add' && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required={mode === 'add'}
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className={inputClass('password')}
                        placeholder={mode === 'edit' ? 'Leave blank to keep current' : 'Set password (min 6 chars)'}
                      />
                    </div>
                    {error('password') && (
                      <p className="mt-1 text-xs text-red-500">{error('password')}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, status: 'active' })}
                      className={`py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        form.status === 'active'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${form.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, status: 'inactive' })}
                      className={`py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        form.status === 'inactive'
                          ? 'bg-slate-100 border-slate-300 text-slate-700 ring-2 ring-slate-500/20'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${form.status === 'inactive' ? 'bg-slate-500' : 'bg-slate-300'}`} />
                      Inactive
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <FiLoader className="animate-spin text-lg" /> : mode === 'add' ? 'Create Teacher' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
