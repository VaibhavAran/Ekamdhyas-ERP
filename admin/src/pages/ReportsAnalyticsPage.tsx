import { useState, useEffect, useMemo } from 'react';
import {
  FiFilter, FiDownload, FiUsers, FiBarChart2, FiBook,
  FiSearch, FiCalendar, FiCheckCircle, FiClock, FiLoader,
  FiTrendingUp, FiAlertTriangle, FiUser, FiClipboard,
  FiAward, FiFileText, FiGrid,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import type { Board, ClassModel, AcademicYear } from '../types/board';
import type { Teacher } from '../types/teacher';
import type { Assignment } from '../types/assignment';
import type {
  ReportsDashboardStats,
  StudentPerformanceRecord,
  ClassAttendanceReport,
  TeacherActivityReport,
  AttendanceTrendPoint,
  ChartDataPoint,
  ReportFilters,
  ReportTab,
} from '../types/reports';
import {
  fetchAllData,
  computeDashboardStats,
  computeStudentPerformance,
  computeAttendanceReport,
  computeTeacherActivity,
  computeAttendanceTrends,
  computeBoardDistribution,
  computeClassDistribution,
  computeTeacherDistribution,
  computeAssignmentCompletion,
  exportToExcel,
  exportToPDF,
} from '../services/reportsService';
import { Toast } from '../components/assignment';

const EMPTY_FILTERS: ReportFilters = {
  academicYear: '',
  board: '',
  class: '',
  division: '',
  startDate: '',
  endDate: '',
  teacher: '',
  student: '',
};

export function ReportsAnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notices, setNotices] = useState<{ id: string; status: string }[]>([]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchAllData();
        setStudents(data.students);
        setTeachers(data.teachers);
        setBoards(data.boards);
        setClasses(data.classes);
        setAcademicYears(data.academicYears);
        setAttendanceRecords(data.attendanceRecords);
        setAttendanceSessions(data.attendanceSessions);
        setAssignments(data.assignments);
        setNotices(data.notices);

        const activeYear = data.academicYears.find((y) => y.isActive);
        if (activeYear) setFilters((prev) => ({ ...prev, academicYear: activeYear.id }));
      } catch (err) {
        console.error(err);
        showToast('Failed to load report data.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filteredClasses = useMemo(
    () => classes.filter((c) => !filters.board || c.board_id === filters.board),
    [classes, filters.board]
  );

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (filters.board && !t.assignedBoardNames.includes(boards.find((b) => b.id === filters.board)?.name || '')) return false;
      return true;
    });
  }, [teachers, filters.board, boards]);

  const stats = useMemo(
    () => computeDashboardStats(students, teachers, classes, attendanceRecords, assignments, notices),
    [students, teachers, classes, attendanceRecords, assignments, notices]
  );

  const studentPerformanceData = useMemo(
    () => computeStudentPerformance(students, attendanceRecords, assignments, filters),
    [students, attendanceRecords, assignments, filters]
  );

  const attendanceReportData = useMemo(
    () => computeAttendanceReport(students, attendanceRecords, filters),
    [students, attendanceRecords, filters]
  );

  const teacherActivityData = useMemo(
    () => computeTeacherActivity(teachers, attendanceSessions, assignments, notices, filters),
    [teachers, attendanceSessions, assignments, notices, filters]
  );

  const attendanceTrends = useMemo(
    () => computeAttendanceTrends(attendanceRecords, filters),
    [attendanceRecords, filters]
  );

  const boardDistribution = useMemo(() => computeBoardDistribution(students), [students]);
  const classDistribution = useMemo(() => computeClassDistribution(students), [students]);
  const teacherDistribution = useMemo(() => computeTeacherDistribution(teachers), [teachers]);
  const assignmentCompletionData = useMemo(() => computeAssignmentCompletion(assignments), [assignments]);

  const handleExportExcel = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) { showToast('No data to export.', 'error'); return; }
    exportToExcel(data, filename);
    showToast('Excel exported successfully.', 'success');
  };

  const handleExportPDF = (title: string, data: Record<string, unknown>[], headers: string[]) => {
    if (data.length === 0) { showToast('No data to export.', 'error'); return; }
    exportToPDF(title, data, headers);
  };

  const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: FiGrid },
    { key: 'student', label: 'Student Reports', icon: FiUser },
    { key: 'attendance', label: 'Attendance Reports', icon: FiCalendar },
    { key: 'teacher', label: 'Teacher Reports', icon: FiUsers },
    { key: 'analytics', label: 'Analytics', icon: FiTrendingUp },
  ];

  const summaryCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Teachers', value: stats.totalTeachers, icon: FiUser, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Overall Attendance', value: `${stats.overallAttendance}%`, icon: FiBarChart2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Active Classes', value: stats.activeClasses, icon: FiBook, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Assignments Done', value: stats.assignmentsCompleted, icon: FiClipboard, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Notices Published', value: stats.noticesPublished, icon: FiFileText, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <FiLoader className="animate-spin text-4xl text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reports & Analytics</h1>
          <p className="mt-1 text-slate-500 font-medium">Generate, filter, and export comprehensive school reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const exportData = getExportData();
              handleExportPDF(`Reports_${activeTab}`, exportData.rows, exportData.headers);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FiDownload size={16} /> Export PDF
          </button>
          <button
            onClick={() => {
              const exportData = getExportData();
              handleExportExcel(exportData.rows, `reports_${activeTab}`);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <FiDownload size={16} /> Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-sm">
          <FiFilter className="text-blue-600" /> Filters
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Academic Year</label>
            <select
              value={filters.academicYear}
              onChange={(e) => setFilters({ ...filters, academicYear: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Board</label>
            <select
              value={filters.board}
              onChange={(e) => setFilters({ ...filters, board: e.target.value, class: '' })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Boards</option>
              {boards.filter((b) => b.status === 'active').map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Class</label>
            <select
              value={filters.class}
              onChange={(e) => setFilters({ ...filters, class: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Classes</option>
              {filteredClasses.filter((c) => c.status === 'active').map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.division ? ` - ${c.division}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Teacher</label>
            <select
              value={filters.teacher}
              onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Teachers</option>
              {teachers.filter((t) => t.status === 'active').map((t) => (
                <option key={t.id} value={t.id}>
                  {[t.personalDetails.firstName, t.personalDetails.middleName, t.personalDetails.lastName].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              const activeYear = academicYears.find((y) => y.isActive);
              setFilters({ ...EMPTY_FILTERS, academicYear: activeYear?.id || '' });
            }}
            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-sm p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {summaryCards.map((s, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl ${s.bg} ${s.color}`}>
                    <s.icon size={20} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiBarChart2 className="text-blue-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Attendance Overview</h3>
              </div>
              <div className="space-y-3">
                {attendanceReportData.classWise.slice(0, 6).map((cls) => (
                  <div key={cls.classId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{cls.className}</span>
                      <span className="text-xs font-bold text-slate-500">{cls.percentage}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${cls.percentage >= 75 ? 'bg-emerald-500' : cls.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${cls.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiAward className="text-emerald-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Top Performers</h3>
              </div>
              <div className="space-y-3">
                {studentPerformanceData.slice(0, 6).map((s, i) => (
                  <div key={s.studentId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.className}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{s.overallScore}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiUsers className="text-purple-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Top Active Teachers</h3>
              </div>
              <div className="space-y-3">
                {teacherActivityData.slice(0, 6).map((t) => (
                  <div key={t.teacherId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t.teacherName}</p>
                      <p className="text-xs text-slate-500">{t.assignedClassNames.join(', ')}</p>
                    </div>
                    <span className="text-sm font-bold text-purple-600">{t.totalActivity} actions</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiClipboard className="text-amber-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Assignment Status</h3>
              </div>
              <div className="space-y-3">
                {assignmentCompletionData.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <span className="text-xs font-bold text-slate-500">{item.value}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                        style={{ width: `${assignments.length > 0 ? (item.value / assignments.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'student' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Student Performance Report</h3>
            <p className="text-sm text-slate-500 mt-1">{studentPerformanceData.length} students found</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['#', 'Name', 'GR No.', 'Class', 'Board', 'Working Days', 'Present', 'Absent', 'Late', 'Attendance %', 'Assignments', 'Performance'].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentPerformanceData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-16 text-center text-slate-400">
                      <FiUsers className="mx-auto text-3xl mb-3 text-slate-300" />
                      <p className="font-semibold">No student data found</p>
                    </td>
                  </tr>
                ) : (
                  studentPerformanceData.map((s, i) => (
                    <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{s.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.grNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.className}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.boardName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-center">{s.totalWorkingDays}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-center">{s.presentDays}</td>
                      <td className="px-4 py-3 text-sm font-bold text-rose-600 text-center">{s.absentDays}</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-600 text-center">{s.lateDays}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.attendancePercentage >= 75 ? 'bg-emerald-500' : s.attendancePercentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${s.attendancePercentage}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${s.attendancePercentage >= 75 ? 'text-emerald-600' : s.attendancePercentage >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {s.attendancePercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-center">{s.assignmentsSubmitted}/{s.assignmentsAssigned}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          s.overallScore >= 75 ? 'bg-emerald-100 text-emerald-700' : s.overallScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {s.overallScore}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
            Showing {studentPerformanceData.length} students
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Class-wise Attendance Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Class', 'Board', 'Total Students', 'Present', 'Absent', 'Late', 'Attendance %'].map((h) => (
                      <th key={h} className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceReportData.classWise.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                        <FiCalendar className="mx-auto text-3xl mb-3 text-slate-300" />
                        <p className="font-semibold">No attendance data found</p>
                      </td>
                    </tr>
                  ) : (
                    attendanceReportData.classWise.map((cls) => (
                      <tr key={cls.classId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{cls.className}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{cls.boardName}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center">{cls.totalStudents}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-center">{cls.present}</td>
                        <td className="px-6 py-4 text-sm font-bold text-rose-600 text-center">{cls.absent}</td>
                        <td className="px-6 py-4 text-sm font-bold text-amber-600 text-center">{cls.late}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${cls.percentage >= 75 ? 'bg-emerald-500' : cls.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${cls.percentage}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold ${cls.percentage >= 75 ? 'text-emerald-600' : cls.percentage >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {cls.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Student-wise Attendance Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['#', 'Name', 'GR No.', 'Class', 'Present', 'Absent', 'Late', 'Total', 'Attendance %'].map((h) => (
                      <th key={h} className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceReportData.studentWise.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                        <FiUsers className="mx-auto text-3xl mb-3 text-slate-300" />
                        <p className="font-semibold">No student data found</p>
                      </td>
                    </tr>
                  ) : (
                    attendanceReportData.studentWise.map((s, i) => (
                      <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{s.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{s.grNumber}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{s.className}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-center">{s.presentDays}</td>
                        <td className="px-4 py-3 text-sm font-bold text-rose-600 text-center">{s.absentDays}</td>
                        <td className="px-4 py-3 text-sm font-bold text-amber-600 text-center">{s.lateDays}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-center">{s.totalWorkingDays}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold ${s.attendancePercentage >= 75 ? 'text-emerald-600' : s.attendancePercentage >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {s.attendancePercentage}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teacher' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Teacher Activity Report</h3>
            <p className="text-sm text-slate-500 mt-1">{teacherActivityData.length} teachers found</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['#', 'Teacher', 'Employee ID', 'Assigned Classes', 'Assigned Subjects', 'Sessions Taken', 'Assignments', 'Notices', 'Total Activity'].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teacherActivityData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                      <FiUsers className="mx-auto text-3xl mb-3 text-slate-300" />
                      <p className="font-semibold">No teacher data found</p>
                    </td>
                  </tr>
                ) : (
                  teacherActivityData.map((t, i) => (
                    <tr key={t.teacherId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{t.teacherName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{t.employeeId}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{t.assignedClassNames.join(', ')}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{t.assignedSubjectNames.join(', ')}</td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600 text-center">{t.attendanceSessionsTaken}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-center">{t.assignmentsCreated}</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-600 text-center">{t.noticesPublished}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                          {t.totalActivity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiTrendingUp className="text-blue-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Attendance Trend</h3>
              </div>
              {attendanceTrends.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No data available</p>
              ) : (
                <div className="flex items-end gap-1 h-48">
                  {attendanceTrends.slice(-14).map((t) => (
                    <div key={t.date} className="flex-1 flex flex-col items-center justify-end h-full group">
                      <div className="relative w-full max-w-[32px] h-full rounded-t-lg bg-slate-50">
                        <div
                          className="absolute bottom-0 w-full rounded-t-lg bg-blue-500 transition-all duration-500 group-hover:bg-blue-600"
                          style={{ height: `${Math.max(4, t.percentage)}%` }}
                        >
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                            {t.percentage}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 mt-1">{t.dayLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiBook className="text-purple-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Student Distribution by Board</h3>
              </div>
              <div className="space-y-3">
                {boardDistribution.map((item) => {
                  const max = Math.max(...boardDistribution.map((d) => d.value));
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <span className="text-xs font-bold text-slate-500">{item.value} students</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiBarChart2 className="text-emerald-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Student Distribution by Class</h3>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {classDistribution.map((item) => {
                  const max = Math.max(...classDistribution.map((d) => d.value));
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <span className="text-xs font-bold text-slate-500">{item.value}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FiUsers className="text-amber-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Teacher Distribution by Subject</h3>
              </div>
              <div className="space-y-3">
                {teacherDistribution.map((item) => {
                  const max = Math.max(...teacherDistribution.map((d) => d.value));
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <span className="text-xs font-bold text-slate-500">{item.value} teachers</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <FiClipboard className="text-cyan-500" size={18} />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Assignment Completion Rate</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {assignmentCompletionData.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 p-4 text-center">
                    <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${item.color}/10`}>
                      <FiCheckCircle className={`text-xl ${item.color?.replace('bg-', 'text-')}`} />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function getExportData(): { rows: Record<string, unknown>[]; headers: string[] } {
    switch (activeTab) {
      case 'student':
        return {
          rows: studentPerformanceData.map((s) => ({
            Name: s.name, 'GR Number': s.grNumber, Class: s.className, Board: s.boardName,
            'Working Days': s.totalWorkingDays, Present: s.presentDays, Absent: s.absentDays, Late: s.lateDays,
            'Attendance %': s.attendancePercentage, 'Assignment Completion %': s.assignmentCompletion,
            'Overall Score': s.overallScore,
          })),
          headers: ['Name', 'GR Number', 'Class', 'Board', 'Working Days', 'Present', 'Absent', 'Late', 'Attendance %', 'Assignment Completion %', 'Overall Score'],
        };
      case 'attendance':
        return {
          rows: attendanceReportData.studentWise.map((s) => ({
            Name: s.name, 'GR Number': s.grNumber, Class: s.className, Present: s.presentDays,
            Absent: s.absentDays, Late: s.lateDays, Total: s.totalWorkingDays, 'Attendance %': s.attendancePercentage,
          })),
          headers: ['Name', 'GR Number', 'Class', 'Present', 'Absent', 'Late', 'Total', 'Attendance %'],
        };
      case 'teacher':
        return {
          rows: teacherActivityData.map((t) => ({
            Teacher: t.teacherName, 'Employee ID': t.employeeId, Classes: t.assignedClassNames.join(', '),
            Subjects: t.assignedSubjectNames.join(', '), 'Sessions Taken': t.attendanceSessionsTaken,
            Assignments: t.assignmentsCreated, Notices: t.noticesPublished, 'Total Activity': t.totalActivity,
          })),
          headers: ['Teacher', 'Employee ID', 'Classes', 'Subjects', 'Sessions Taken', 'Assignments', 'Notices', 'Total Activity'],
        };
      default:
        return { rows: [], headers: [] };
    }
  }
}
