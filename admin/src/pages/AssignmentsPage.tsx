import { useEffect, useMemo, useState } from 'react';
import {
  FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiClock,
  FiCheckCircle, FiAlertTriangle, FiBarChart2, FiUsers,
  FiLoader, FiClipboard, FiBook, FiTrendingUp,
} from 'react-icons/fi';
import type { AcademicYear, Board, ClassModel } from '../types/board';
import type { Teacher } from '../types/teacher';
import type {
  Assignment,
  AssignmentForm,
  AssignmentSubmission,
  SubmissionDetail,
} from '../types/assignment';
import { EMPTY_ASSIGNMENT_FORM, ASSIGNMENT_STATUS_STYLES } from '../types/assignment';
import {
  fetchAllAssignments,
  fetchAllSubmissions,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  fetchMetadata,
  fetchStudents,
  computeAssignmentStats,
  computeClassWiseCompletion,
  computeSubjectWiseCompletion,
  computeTeacherWiseActivity,
  computeSubmissionDetails,
} from '../services/assignmentService';
import {
  Toast,
  AssignmentFormModal,
  AssignmentViewModal,
  SubmissionListModal,
} from '../components/assignment';

type Tab = 'dashboard' | 'list' | 'analytics';

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ uid: string; name: string; grNumber?: string; class_id?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterBoard, setFilterBoard] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [activeModal, setActiveModal] = useState<'add' | 'edit' | 'view' | 'submissions' | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [assignmentsData, submissionsData, metadata] = await Promise.all([
        fetchAllAssignments(),
        fetchAllSubmissions(),
        fetchMetadata(),
      ]);
      setAssignments(assignmentsData);
      setSubmissions(submissionsData);
      setAcademicYears(metadata.academicYears);
      setBoards(metadata.boards);
      setClasses(metadata.classes);
      setTeachers(metadata.teachers);
      setSubjects(metadata.subjects);

      const activeYear = metadata.academicYears.find((y) => y.isActive);
      if (activeYear) setFilterYear(activeYear.id);

      const studentData = await fetchStudents();
      setStudents(studentData);
    } catch (error) {
      console.error(error);
      showToast('Failed to load assignment data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const activeYear = academicYears.find((y) => y.isActive);
    if (activeYear && !filterYear) setFilterYear(activeYear.id);
  }, [academicYears, filterYear]);

  const filteredClasses = useMemo(
    () => classes.filter((c) => !filterBoard || c.board_id === filterBoard),
    [classes, filterBoard]
  );

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || a.title.toLowerCase().includes(term) || a.subjectName.toLowerCase().includes(term);
      const matchesYear = !filterYear || a.academicYearId === filterYear;
      const matchesBoard = !filterBoard || a.boardId === filterBoard;
      const matchesClass = !filterClass || a.classId === filterClass;
      const matchesSubject = !filterSubject || a.subjectId === filterSubject;
      const matchesTeacher = !filterTeacher || a.teacherId === filterTeacher;
      const matchesStatus = !filterStatus || a.status === filterStatus;
      return matchesSearch && matchesYear && matchesBoard && matchesClass && matchesSubject && matchesTeacher && matchesStatus;
    });
  }, [assignments, searchTerm, filterYear, filterBoard, filterClass, filterSubject, filterTeacher, filterStatus]);

  const stats = useMemo(() => computeAssignmentStats(assignments, submissions), [assignments, submissions]);
  const classWiseData = useMemo(() => computeClassWiseCompletion(assignments, submissions), [assignments, submissions]);
  const subjectWiseData = useMemo(() => computeSubjectWiseCompletion(assignments, submissions), [assignments, submissions]);
  const teacherWiseData = useMemo(() => computeTeacherWiseActivity(assignments, submissions), [assignments, submissions]);

  const getSubmissionInfo = (assignmentId: string) => {
    const assignmentSubs = submissions.filter((s) => s.assignmentId === assignmentId);
    const totalStudentsForAssignment = students.filter((s) => {
      const assignment = assignments.find((a) => a.id === assignmentId);
      return assignment && (!assignment.classId || s.class_id === assignment.classId);
    }).length;
    const submitted = assignmentSubs.filter((s) => s.status === 'submitted' || s.status === 'reviewed').length;
    const percentage = totalStudentsForAssignment > 0 ? Math.round((submitted / totalStudentsForAssignment) * 100) : 0;
    return { total: totalStudentsForAssignment, submitted, percentage };
  };

  const openAddModal = () => {
    setForm({ ...EMPTY_ASSIGNMENT_FORM, assignedDate: new Date().toISOString().split('T')[0] });
    setActiveModal('add');
  };

  const openEditModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setForm({
      title: assignment.title,
      description: assignment.description,
      subjectId: assignment.subjectId,
      subjectName: assignment.subjectName,
      teacherId: assignment.teacherId,
      teacherName: assignment.teacherName,
      academicYearId: assignment.academicYearId,
      academicYearName: assignment.academicYearName,
      boardId: assignment.boardId,
      boardName: assignment.boardName,
      classId: assignment.classId,
      className: assignment.className,
      divisionId: assignment.divisionId,
      divisionName: assignment.divisionName,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
      attachmentUrl: assignment.attachmentUrl,
      attachmentName: assignment.attachmentName,
      status: assignment.status,
    });
    setActiveModal('edit');
  };

  const openViewModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setActiveModal('view');
  };

  const openSubmissionsModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setActiveModal('submissions');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (activeModal === 'add') {
        await createAssignment(form);
        showToast('Assignment created successfully.', 'success');
      } else if (activeModal === 'edit' && selectedAssignment) {
        await updateAssignment(selectedAssignment.id, form);
        showToast('Assignment updated successfully.', 'success');
      }
      setActiveModal(null);
      await fetchData();
    } catch (error) {
      console.error(error);
      showToast('Failed to save assignment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAssignment(id);
      showToast('Assignment deleted successfully.', 'success');
      setDeleteConfirm(null);
      await fetchData();
    } catch (error) {
      console.error(error);
      showToast('Failed to delete assignment.', 'error');
    }
  };

  const getSubmissionDetails = (assignment: Assignment): SubmissionDetail[] => {
    const assignmentSubs = submissions.filter((s) => s.assignmentId === assignment.id);
    return computeSubmissionDetails(students, assignmentSubs, assignment.classId);
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <FiBarChart2 size={16} /> },
    { key: 'list', label: 'Assignment List', icon: <FiClipboard size={16} /> },
    { key: 'analytics', label: 'Analytics', icon: <FiTrendingUp size={16} /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <FiLoader className="animate-spin text-blue-500 text-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assignment Monitoring</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor assignments, track submissions, and analyze completion</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <FiPlus size={18} />
          Create Assignment
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Assignments</p>
                <FiClipboard className="text-blue-500" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active</p>
                <FiCheckCircle className="text-emerald-500" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.active}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed</p>
                <FiCheckCircle className="text-blue-500" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-blue-600">{stats.completed}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending</p>
                <FiClock className="text-amber-500" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Overdue</p>
                <FiAlertTriangle className="text-rose-500" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-rose-600">{stats.overdue}</p>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Recent Assignments</h3>
              <button
                onClick={() => setActiveTab('list')}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Title</th>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Subject</th>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Class</th>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Due Date</th>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Submissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.slice(0, 5).map((a) => {
                    const info = getSubmissionInfo(a.id);
                    return (
                      <tr key={a.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-slate-900 max-w-[200px] truncate">{a.title}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{a.subjectName}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{a.className}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ASSIGNMENT_STATUS_STYLES[a.status]}`}>
                            {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {info.submitted}/{info.total} ({info.percentage}%)
                        </td>
                      </tr>
                    );
                  })}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <FiClipboard className="mx-auto mb-2 text-3xl" />
                        <p className="font-medium">No assignments yet</p>
                        <p className="mt-1 text-sm">Create your first assignment to get started</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or subject..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">All Years</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
                <select
                  value={filterBoard}
                  onChange={(e) => setFilterBoard(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">All Boards</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">All Classes</option>
                  {filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">All Teachers</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {[t.personalDetails.firstName, t.personalDetails.middleName, t.personalDetails.lastName].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Title</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Subject</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Teacher</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Year</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Board</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Class</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Due Date</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Submissions</th>
                    <th className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.map((a) => {
                    const info = getSubmissionInfo(a.id);
                    return (
                      <tr key={a.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-4 px-6 text-sm font-medium text-slate-900 max-w-[180px] truncate">{a.title}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">{a.subjectName}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">{a.teacherName}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">{a.academicYearName}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">{a.boardName}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">{a.className}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">
                          {a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ASSIGNMENT_STATUS_STYLES[a.status]}`}>
                            {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => openSubmissionsModal(a)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {info.submitted}/{info.total} ({info.percentage}%)
                          </button>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openViewModal(a)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="View"
                            >
                              <FiEye size={16} />
                            </button>
                            <button
                              onClick={() => openEditModal(a)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 size={16} />
                            </button>
                            {deleteConfirm === a.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(a.id)}
                                  className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(a.id)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAssignments.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <FiClipboard className="mx-auto mb-2 text-3xl" />
                        <p className="font-medium">No assignments found</p>
                        <p className="mt-1 text-sm">Try adjusting your filters or create a new assignment</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
              Showing {filteredAssignments.length} of {assignments.length} assignments
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiUsers className="text-blue-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Class-wise Completion</h3>
              </div>
              {classWiseData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No data available</p>
              ) : (
                <div className="space-y-3">
                  {classWiseData.map((item) => (
                    <div key={item.className}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{item.className}</span>
                        <span className="text-xs font-bold text-slate-500">{item.percentage}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiBook className="text-purple-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Subject-wise Completion</h3>
              </div>
              {subjectWiseData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No data available</p>
              ) : (
                <div className="space-y-3">
                  {subjectWiseData.map((item) => (
                    <div key={item.subjectName}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{item.subjectName}</span>
                        <span className="text-xs font-bold text-slate-500">{item.percentage}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiBarChart2 className="text-emerald-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Teacher-wise Activity</h3>
              </div>
              {teacherWiseData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No data available</p>
              ) : (
                <div className="space-y-3">
                  {teacherWiseData.map((item) => (
                    <div key={item.teacherName}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{item.teacherName}</span>
                        <span className="text-xs font-bold text-slate-500">{item.total} assigned / {item.submitted} submitted</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiTrendingUp className="text-amber-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Overall Summary</h3>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-100">Overall Submission Rate</p>
                  <p className="mt-1 text-4xl font-bold">{stats.overallPercentage}%</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-400/30">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${stats.overallPercentage}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-emerald-50 p-3 text-center">
                    <p className="text-xl font-bold text-emerald-700">{stats.submittedCount}</p>
                    <p className="text-xs font-semibold text-emerald-500">Submitted</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center">
                    <p className="text-xl font-bold text-amber-700">{stats.pendingCount}</p>
                    <p className="text-xs font-semibold text-amber-500">Pending</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-3 text-center">
                    <p className="text-xl font-bold text-rose-700">{stats.lateCount}</p>
                    <p className="text-xs font-semibold text-rose-500">Late</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'add' && (
        <AssignmentFormModal
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onClose={() => setActiveModal(null)}
          academicYears={academicYears}
          boards={boards}
          classes={classes}
          teachers={teachers}
          subjects={subjects}
          filteredClasses={filteredClasses}
          divisions={[...new Set(filteredClasses.map((c) => c.division).filter(Boolean))]}
          isSubmitting={isSubmitting}
        />
      )}

      {activeModal === 'edit' && selectedAssignment && (
        <AssignmentFormModal
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onClose={() => setActiveModal(null)}
          isEdit
          academicYears={academicYears}
          boards={boards}
          classes={classes}
          teachers={teachers}
          subjects={subjects}
          filteredClasses={filteredClasses}
          divisions={[...new Set(filteredClasses.map((c) => c.division).filter(Boolean))]}
          isSubmitting={isSubmitting}
        />
      )}

      {activeModal === 'view' && selectedAssignment && (
        <AssignmentViewModal assignment={selectedAssignment} onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'submissions' && selectedAssignment && (
        <SubmissionListModal
          assignment={selectedAssignment}
          submissions={getSubmissionDetails(selectedAssignment)}
          totalStudents={getSubmissionInfo(selectedAssignment.id).total}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
