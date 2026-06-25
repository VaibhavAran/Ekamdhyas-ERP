import React, { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiLoader, FiUsers,
  FiBook, FiAlertCircle, FiUserCheck, FiTag,
} from 'react-icons/fi';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Teacher, TeacherForm } from '../types/teacher';
import type { Board, AcademicYear } from '../types/board';
import { getTeacherFullName, getTeacherInitials, EMPTY_TEACHER_FORM } from '../types/teacher';
import {
  fetchAllTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  validateEmployeeIdUnique,
  validateEmailUnique,
} from '../services/teacherService';
import {
  TeacherToast,
  TeacherFormModal,
  TeacherProfileModal,
  AssignModal,
} from '../components/teacher';

export function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterBoard, setFilterBoard] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [activeModal, setActiveModal] = useState<
    'add' | 'edit' | 'view' | 'assign' | null
  >(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherForm>({ ...EMPTY_TEACHER_FORM });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [teachersData, boardSnap, yearSnap] = await Promise.all([
        fetchAllTeachers(),
        getDocs(collection(db, 'boards')),
        getDocs(collection(db, 'academic_years')),
      ]);
      setTeachers(teachersData);
      setBoards(boardSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Board)));
      setAcademicYears(yearSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicYear)));
    } catch (error) {
      console.error('Error fetching teachers:', error);
      showToast('Failed to load teachers data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const validate = async (isEdit: boolean): Promise<boolean> => {
    const errors: Record<string, string> = {};

    if (!form.employeeId.trim()) {
      errors.employeeId = 'Employee ID is required';
    } else if (!isEdit) {
      const unique = await validateEmployeeIdUnique(form.employeeId);
      if (!unique) errors.employeeId = 'Employee ID already exists';
    }

    if (!form.personalDetails.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!form.personalDetails.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    const mobile = form.personalDetails.mobileNumber.trim();
    if (!mobile) {
      errors.mobileNumber = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(mobile)) {
      errors.mobileNumber = 'Enter a valid 10-digit mobile number';
    }

    if (!form.personalDetails.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalDetails.email)) {
      errors.email = 'Enter a valid email address';
    } else if (!isEdit) {
      const unique = await validateEmailUnique(form.personalDetails.email);
      if (!unique) errors.email = 'Email already registered';
    }

    if (!form.academicYear) {
      errors.academicYear = 'Academic year is required';
    }
    if (!form.username.trim()) {
      errors.username = 'Username is required';
    }
    if (!isEdit && !form.password.trim()) {
      errors.password = 'Password is required for new teacher';
    } else if (!isEdit && form.password.trim().length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAdd = () => {
    const activeYear = academicYears.find((y) => y.isActive);
    setForm({ ...EMPTY_TEACHER_FORM, academicYear: activeYear?.id || '' });
    setValidationErrors({});
    setSelectedTeacher(null);
    setActiveModal('add');
  };

  const openEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setForm({
      employeeId: teacher.employeeId,
      personalDetails: { ...teacher.personalDetails },
      professionalDetails: { ...teacher.professionalDetails },
      assignedBoards: teacher.assignedBoards || [],
      assignedBoardNames: teacher.assignedBoardNames || [],
      assignedClasses: teacher.assignedClasses || [],
      assignedClassNames: teacher.assignedClassNames || [],
      assignedSubjects: teacher.assignedSubjects || [],
      assignedSubjectNames: teacher.assignedSubjectNames || [],
      academicYear: teacher.academicYear || '',
      username: teacher.username || '',
      password: '',
      status: teacher.status,
    });
    setValidationErrors({});
    setActiveModal('edit');
  };

  const openView = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setActiveModal('view');
  };

  const openAssign = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setActiveModal('assign');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = activeModal === 'edit';
    const isValid = await validate(isEdit);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      if (isEdit && selectedTeacher) {
        await updateTeacher(selectedTeacher.id, form);
        showToast('Teacher updated successfully!', 'success');
      } else {
        await createTeacher(form);
        showToast('Teacher created successfully!', 'success');
      }
      setActiveModal(null);
      fetchData();
    } catch (error: any) {
      console.error('Error saving teacher:', error);
      showToast(error.message || 'Failed to save teacher', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    const name = getTeacherFullName(teacher);
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;
    try {
      await deleteTeacher(teacher.id);
      showToast('Teacher deleted successfully!', 'success');
      fetchData();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      showToast('Failed to delete teacher', 'error');
    }
  };

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const fullName = getTeacherFullName(t).toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        t.employeeId.toLowerCase().includes(term) ||
        fullName.includes(term) ||
        t.personalDetails.email.toLowerCase().includes(term);

      const matchesYear = !filterYear || t.academicYear === filterYear;
      const matchesBoard = !filterBoard || t.assignedBoards.includes(filterBoard);
      const matchesStatus = !filterStatus || t.status === filterStatus;

      return matchesSearch && matchesYear && matchesBoard && matchesStatus;
    });
  }, [teachers, searchTerm, filterYear, filterBoard, filterStatus]);

  const stats = useMemo(() => {
    const active = teachers.filter((t) => t.status === 'active').length;
    const inactive = teachers.filter((t) => t.status === 'inactive').length;
    return { total: teachers.length, active, inactive };
  }, [teachers]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {toast && <TeacherToast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Teacher Management</h1>
          <p className="mt-2 text-slate-500 font-medium">
            Manage teacher profiles, assignments, and class teacher allocations.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <FiPlus className="text-lg transition-transform group-hover:rotate-90" />
          Add New Teacher
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Teachers" value={stats.total} icon={FiUsers} color="blue" />
        <StatCard label="Active" value={stats.active} icon={FiUserCheck} color="emerald" />
        <StatCard label="Inactive" value={stats.inactive} icon={FiAlertCircle} color="slate" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, employee ID, or email..."
              className="pl-10 w-full border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">All Academic Years</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}{y.isActive ? ' (Active)' : ''}
              </option>
            ))}
          </select>
          <select
            value={filterBoard}
            onChange={(e) => setFilterBoard(e.target.value)}
            className="w-full border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">All Boards</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Teacher Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex justify-center">
          <FiLoader className="animate-spin text-3xl text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee ID', 'Teacher Name', 'Email', 'Mobile', 'Subjects', 'Classes', 'Status', 'Actions'].map(
                    (head) => (
                      <th key={head} className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-gray-500">
                        {head}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="py-3.5 px-6">
                      <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        {teacher.employeeId}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                          {getTeacherInitials(teacher)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{getTeacherFullName(teacher)}</div>
                          {teacher.professionalDetails.designation && (
                            <div className="text-xs text-slate-500">{teacher.professionalDetails.designation}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 text-sm">{teacher.personalDetails.email}</td>
                    <td className="py-3.5 px-6 text-slate-600 text-sm">{teacher.personalDetails.mobileNumber}</td>
                    <td className="py-3.5 px-6">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(teacher.assignedSubjectNames || []).slice(0, 2).map((sub, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            <FiBook className="text-[10px]" />{sub}
                          </span>
                        ))}
                        {(teacher.assignedSubjectNames || []).length > 2 && (
                          <span className="text-xs text-slate-500 font-medium">+{teacher.assignedSubjectNames.length - 2}</span>
                        )}
                        {(!teacher.assignedSubjectNames || teacher.assignedSubjectNames.length === 0) && (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {(teacher.assignedClassNames || []).slice(0, 2).map((cls, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            <FiUsers className="text-[10px]" />{cls}
                          </span>
                        ))}
                        {(teacher.assignedClassNames || []).length > 2 && (
                          <span className="text-xs text-slate-500 font-medium">+{teacher.assignedClassNames.length - 2}</span>
                        )}
                        {(!teacher.assignedClassNames || teacher.assignedClassNames.length === 0) && (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                          teacher.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${teacher.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {teacher.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          title="View Profile"
                          onClick={() => openView(teacher)}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <FiEye size={16} />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => openEdit(teacher)}
                          className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          title="Assign Subjects & Classes"
                          onClick={() => openAssign(teacher)}
                          className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                        >
                          <FiTag size={16} />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(teacher)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                        <FiUsers className="text-2xl text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-semibold mb-1">No teachers found</p>
                      <p className="text-slate-500 text-sm">
                        {teachers.length === 0
                          ? 'Add your first teacher to get started.'
                          : 'No teachers match your filter criteria.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <TeacherFormModal
          mode={activeModal}
          form={form}
          setForm={setForm}
          onClose={() => setActiveModal(null)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          validationErrors={validationErrors}
        />
      )}
      {activeModal === 'view' && selectedTeacher && (
        <TeacherProfileModal teacher={selectedTeacher} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'assign' && selectedTeacher && (
        <AssignModal
          teacher={selectedTeacher}
          onClose={() => setActiveModal(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-700', icon: 'text-slate-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`${c.bg} rounded-xl border border-${color === 'slate' ? 'slate' : color}-100 p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold ${c.text}`}>{value}</p>
        </div>
        <div className={`h-12 w-12 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`text-xl ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}
