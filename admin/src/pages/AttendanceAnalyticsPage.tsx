import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiFilter, FiDownload, FiUsers, FiBarChart2, FiAlertTriangle,
  FiSearch, FiCalendar, FiCheckCircle, FiXCircle, FiLoader,
  FiLayout, FiTrendingUp, FiBook, FiClock,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import type {
  Board, ClassModel, AcademicYear,
} from '../types/board';
import type {
  AttendanceFilterState,
  AttendanceRecord,
} from '../types/attendanceAnalytics';
import {
  fetchMetadata,
  fetchAttendanceInRange,
  computeDashboardStats,
  computeClassWiseAttendance,
  computeStudentReport,
  computeMonthlyTrends,
  computeDefaulters,
  computeDailyDetails,
  getMonthlyAverages,
} from '../services/attendanceAnalyticsService';

type Tab = 'dashboard' | 'classwise' | 'studentReport' | 'monthlyTrends' | 'defaulters' | 'dailyDetails';

interface StudentDoc {
  uid: string;
  name: string;
  roll_no: string;
  class_id: string;
  class_name: string;
  board_id: string;
  board_name: string;
  batch_id?: string;
  batch_name?: string;
  academic_year_id?: string;
  parentMobile?: string;
  grNumber?: string;
  status: string;
}

export function AttendanceAnalyticsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  const [filters, setFilters] = useState<AttendanceFilterState>({
    academicYear: '',
    board: '',
    class: '',
    division: '',
    date: new Date().toISOString().split('T')[0],
    month: new Date().toISOString().slice(0, 7),
  });
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [defaulterThreshold, setDefaulterThreshold] = useState(75);
  const [selectedClassDetail, setSelectedClassDetail] = useState<string | null>(null);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const meta = await fetchMetadata();
        setBoards(meta.boards);
        setClasses(meta.classes);
        setAcademicYears(meta.academicYears);
        setStudents(meta.students);
        const active = meta.academicYears.find((y) => y.isActive);
        if (active) setFilters((f) => ({ ...f, academicYear: active.id }));
      } catch (err) {
        console.error('Error loading metadata:', err);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    loadMeta();
  }, []);

  const getDateRange = useCallback(() => {
    if (filters.month) {
      const [y, m] = filters.month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return {
        start: `${filters.month}-01`,
        end: `${filters.month}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    if (filters.date) return { start: filters.date, end: filters.date };
    return {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    };
  }, [filters.month, filters.date]);

  useEffect(() => {
    if (isLoadingMeta) return;
    const loadAttendance = async () => {
      setIsLoading(true);
      try {
        const range = getDateRange();
        const classFilter = filters.class || undefined;
        const { records: fetched } = await fetchAttendanceInRange(range.start, range.end, classFilter);
        setRecords(fetched);
      } catch (err) {
        console.error('Error loading attendance:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAttendance();
  }, [isLoadingMeta, filters.month, filters.date, filters.class, getDateRange]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filters.academicYear && s.academic_year_id !== filters.academicYear) return false;
      if (filters.board && s.board_id !== filters.board) return false;
      if (filters.class && s.class_id !== filters.class) return false;
      return true;
    });
  }, [students, filters.academicYear, filters.board, filters.class]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (filters.board && c.board_id !== filters.board) return false;
      return true;
    });
  }, [classes, filters.board]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const student = students.find((s) => s.uid === r.student_id);
      if (!student) return false;
      if (filters.board && student.board_id !== filters.board) return false;
      if (filters.class && student.class_id !== filters.class) return false;
      return true;
    });
  }, [records, students, filters.board, filters.class]);

  const stats = useMemo(() => computeDashboardStats(filteredRecords), [filteredRecords]);
  const classWiseData = useMemo(
    () => computeClassWiseAttendance(filteredRecords, filteredClasses, filteredStudents),
    [filteredRecords, filteredClasses, filteredStudents]
  );
  const studentReportData = useMemo(
    () => computeStudentReport(filteredRecords, filteredStudents, searchTerm),
    [filteredRecords, filteredStudents, searchTerm]
  );
  const monthlyTrends = useMemo(
    () => computeMonthlyTrends(records, filters.month),
    [records, filters.month]
  );
  const monthlyAvg = useMemo(() => getMonthlyAverages(monthlyTrends), [monthlyTrends]);
  const defaultersData = useMemo(
    () => computeDefaulters(filteredRecords, filteredStudents, defaulterThreshold, filters.board, filters.class),
    [filteredRecords, filteredStudents, defaulterThreshold, filters.board, filters.class]
  );
  const dailyDetailsData = useMemo(
    () => computeDailyDetails(filteredRecords, filteredStudents, filters.date),
    [filteredRecords, filteredStudents, filters.date]
  );

  const dailyPresentCount = useMemo(
    () => dailyDetailsData.filter((d) => d.status === 'present').length,
    [dailyDetailsData]
  );
  const dailyAbsentCount = useMemo(
    () => dailyDetailsData.filter((d) => d.status === 'absent').length,
    [dailyDetailsData]
  );
  const dailyLateCount = useMemo(
    () => dailyDetailsData.filter((d) => d.status === 'late').length,
    [dailyDetailsData]
  );

  const divisions = useMemo(() => {
    const divs = new Set<string>();
    filteredClasses.forEach((c) => { if (c.division) divs.add(c.division); });
    return Array.from(divs).sort();
  }, [filteredClasses]);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: FiBarChart2 },
    { key: 'classwise', label: 'Class-wise', icon: FiBook },
    { key: 'studentReport', label: 'Student Report', icon: FiUsers },
    { key: 'monthlyTrends', label: 'Monthly Trends', icon: FiTrendingUp },
    { key: 'defaulters', label: 'Defaulters', icon: FiAlertTriangle },
    { key: 'dailyDetails', label: 'Daily Details', icon: FiCalendar },
  ];

  const handleExportExcel = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExportPDF = (title: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const doc = printWindow.document;
    doc.write(`
      <html><head><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 20px; margin-bottom: 10px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background: #fafafa; }
      </style></head><body>
      <h1>${title}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
    `);
    const activeTabData: Record<Tab, () => any[]> = {
      dashboard: () => [],
      classwise: () => classWiseData.map((c) => ({
        Board: c.boardName, Class: c.className, Division: c.division,
        'Total Students': c.totalStudents, Present: c.present, Absent: c.absent, 'Attendance %': c.percentage,
      })),
      studentReport: () => studentReportData.map((s) => ({
        Name: s.name, 'GR Number': s.grNumber, Class: s.className, Board: s.boardName,
        'Working Days': s.totalWorkingDays, Present: s.presentDays, Absent: s.absentDays, '%': s.percentage,
      })),
      monthlyTrends: () => monthlyTrends.map((d) => ({
        Date: d.date, Day: d.dayLabel, Present: d.present, Absent: d.absent, Late: d.late, Total: d.total,
      })),
      defaulters: () => defaultersData.map((s) => ({
        Name: s.name, Class: s.className, Board: s.boardName, 'Attendance %': s.percentage,
        Present: s.presentDays, 'Total Days': s.totalWorkingDays, 'Parent Mobile': s.parentMobile,
      })),
      dailyDetails: () => dailyDetailsData.map((s) => ({
        Name: s.name, 'GR Number': s.grNumber, Class: s.className, Board: s.boardName, Status: s.status,
      })),
    };
    const rows = activeTabData[activeTab]();
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      doc.write('<table><thead><tr>');
      headers.forEach((h) => doc.write(`<th>${h}</th>`));
      doc.write('</tr></thead><tbody>');
      rows.forEach((row: any) => {
        doc.write('<tr>');
        headers.forEach((h) => doc.write(`<td>${row[h] ?? ''}</td>`));
        doc.write('</tr>');
      });
      doc.write('</tbody></table>');
    }
    doc.write('</body></html>');
    doc.close();
    printWindow.print();
  };

  if (isLoadingMeta) {
    return (
      <div className="flex items-center justify-center h-96">
        <FiLoader className="animate-spin text-4xl text-blue-600" />
      </div>
    );
  }

  const boardOptions = boards.filter((b) => b.status === 'active');
  const classOptions = filteredClasses.filter((c) => c.status === 'active');

  const statCards = [
    { label: "Today's Attendance", value: `${stats.todayPercentage}%`, icon: FiCalendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Present', value: stats.totalPresent, icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Absent', value: stats.totalAbsent, icon: FiXCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Total Late', value: stats.totalLate, icon: FiClock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Overall Rate', value: `${stats.overallRate}%`, icon: FiBarChart2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Attendance Analytics</h1>
          <p className="mt-1 text-slate-500 font-medium">Monitor, analyze, and report attendance across the school.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExportPDF(`Attendance_Report_${filters.date || filters.month}`)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FiDownload className="text-sm" /> Export PDF
          </button>
          <button
            onClick={() => {
              const exportData: Record<Tab, () => { filename: string; data: any[] }> = {
                dashboard: () => ({ filename: 'dashboard', data: [] }),
                classwise: () => ({
                  filename: 'class_attendance',
                  data: classWiseData.map((c) => ({ Board: c.boardName, Class: c.className, Division: c.division, 'Total Students': c.totalStudents, Present: c.present, Absent: c.absent, 'Attendance %': c.percentage })),
                }),
                studentReport: () => ({
                  filename: 'student_attendance',
                  data: studentReportData.map((s) => ({ Name: s.name, 'GR Number': s.grNumber, Class: s.className, Board: s.boardName, 'Working Days': s.totalWorkingDays, Present: s.presentDays, Absent: s.absentDays, 'Attendance %': s.percentage })),
                }),
                monthlyTrends: () => ({
                  filename: 'monthly_attendance',
                  data: monthlyTrends.map((d) => ({ Date: d.date, Day: d.dayLabel, Present: d.present, Absent: d.absent, Late: d.late, Total: d.total })),
                }),
                defaulters: () => ({
                  filename: 'defaulter_students',
                  data: defaultersData.map((s) => ({ Name: s.name, Class: s.className, Board: s.boardName, 'Attendance %': s.percentage, Present: s.presentDays, 'Total Days': s.totalWorkingDays, 'Parent Mobile': s.parentMobile })),
                }),
                dailyDetails: () => ({
                  filename: 'daily_attendance',
                  data: dailyDetailsData.map((s) => ({ Name: s.name, 'GR Number': s.grNumber, Class: s.className, Board: s.boardName, Status: s.status })),
                }),
              };
              const { filename, data } = exportData[activeTab]();
              if (data.length > 0) handleExportExcel(data, filename);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <FiDownload className="text-sm" /> Export Excel
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
              {boardOptions.map((b) => (
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
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.division ? ` - ${c.division}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Division</label>
            <select
              value={filters.division}
              onChange={(e) => setFilters({ ...filters, division: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Divisions</option>
              {divisions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">Month</label>
            <input
              type="month"
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setFilters({ academicYear: '', board: '', class: '', division: '', date: new Date().toISOString().split('T')[0], month: new Date().toISOString().slice(0, 7) })}
            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.bg} ${s.color}`}>
              <s.icon size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
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
            <tab.icon className="text-sm" />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center">
          <FiLoader className="animate-spin text-3xl text-blue-600 mb-3" />
          <p className="font-semibold text-slate-500">Loading attendance data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Today's Attendance Breakdown</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Present', value: stats.totalPresent, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
                      { label: 'Absent', value: stats.totalAbsent, color: 'bg-rose-500', textColor: 'text-rose-600' },
                      { label: 'Late', value: stats.totalLate, color: 'bg-amber-500', textColor: 'text-amber-600' },
                    ].map((item) => {
                      const total = stats.totalPresent + stats.totalAbsent + stats.totalLate;
                      const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-slate-600">{item.label}</span>
                            <span className={`text-sm font-bold ${item.textColor}`}>{item.value} ({pct}%)</span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Class-wise Overview</h3>
                  <div className="space-y-3">
                    {classWiseData.slice(0, 8).map((cls) => (
                      <div key={cls.classId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div>
                          <span className="font-semibold text-slate-900 text-sm">{cls.className}</span>
                          {cls.division && <span className="text-slate-400 text-sm ml-1">({cls.division})</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{cls.totalStudents} students</span>
                          <span className={`text-sm font-bold ${cls.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {cls.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'classwise' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Board', 'Class', 'Division', 'Students', 'Present', 'Absent', 'Late', 'Attendance %', 'Details'].map((h) => (
                        <th key={h} className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classWiseData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                          <FiLayout className="mx-auto text-3xl mb-3 text-slate-300" />
                          <p className="font-semibold">No class data found</p>
                        </td>
                      </tr>
                    ) : (
                      classWiseData.map((cls) => (
                        <tr key={cls.classId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-semibold text-slate-700">{cls.boardName}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{cls.className}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{cls.division || '-'}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">{cls.totalStudents}</td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-center">{cls.present}</td>
                          <td className="px-6 py-4 text-sm font-bold text-rose-600 text-center">{cls.absent}</td>
                          <td className="px-6 py-4 text-sm font-bold text-amber-600 text-center">{cls.late}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${cls.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${cls.percentage}%` }} />
                              </div>
                              <span className={`text-sm font-bold ${cls.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>{cls.percentage}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setSelectedClassDetail(cls.classId === selectedClassDetail ? null : cls.classId)}
                              className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                            >
                              {selectedClassDetail === cls.classId ? 'Close' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {selectedClassDetail && (
                <div className="border-t border-slate-200 bg-slate-50 p-6">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Students in Class - {classWiseData.find((c) => c.classId === selectedClassDetail)?.className}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">Student</th>
                          <th className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">GR Number</th>
                          <th className="py-2 px-3 text-xs font-bold text-slate-500 uppercase text-center">Present</th>
                          <th className="py-2 px-3 text-xs font-bold text-slate-500 uppercase text-center">Absent</th>
                          <th className="py-2 px-3 text-xs font-bold text-slate-500 uppercase text-center">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentReportData
                          .filter((s) => {
                            const cls = classWiseData.find((c) => c.classId === selectedClassDetail);
                            return cls && s.className === cls.className;
                          })
                          .map((s) => (
                            <tr key={s.studentId} className="hover:bg-white">
                              <td className="py-2 px-3 font-semibold text-slate-900">{s.name}</td>
                              <td className="py-2 px-3 text-slate-600 font-mono text-xs">{s.grNumber}</td>
                              <td className="py-2 px-3 text-center text-emerald-600 font-bold">{s.presentDays}</td>
                              <td className="py-2 px-3 text-center text-rose-600 font-bold">{s.absentDays}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`font-bold ${s.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>{s.percentage}%</span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'studentReport' && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or GR number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Student', 'GR Number', 'Class', 'Board', 'Working Days', 'Present', 'Absent', 'Late', 'Attendance %', 'Parent Mobile'].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentReportData.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-5 py-16 text-center text-slate-400">
                            <FiUsers className="mx-auto text-3xl mb-3 text-slate-300" />
                            <p className="font-semibold">No students found</p>
                          </td>
                        </tr>
                      ) : (
                        studentReportData.map((s) => (
                          <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                            </td>
                            <td className="px-5 py-3.5 text-xs font-mono text-slate-600">{s.grNumber}</td>
                            <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">{s.className}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-600">{s.boardName}</td>
                            <td className="px-5 py-3.5 text-sm font-semibold text-slate-700 text-center">{s.totalWorkingDays}</td>
                            <td className="px-5 py-3.5 text-sm font-bold text-emerald-600 text-center">{s.presentDays}</td>
                            <td className="px-5 py-3.5 text-sm font-bold text-rose-600 text-center">{s.absentDays}</td>
                            <td className="px-5 py-3.5 text-sm font-bold text-amber-600 text-center">{s.lateDays}</td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={`text-sm font-bold ${s.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>{s.percentage}%</span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-slate-600">{s.parentMobile || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'monthlyTrends' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Daily Avg Present', value: monthlyAvg.dailyAvgPresent, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Daily Avg Absent', value: monthlyAvg.dailyAvgAbsent, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Weekly Avg Present', value: monthlyAvg.weeklyAvgPresent, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Monthly Avg %', value: `${monthlyAvg.monthlyAvg}%`, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                ].map((s, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Daily Attendance - {filters.month}</h3>
                <div className="flex items-end gap-1 h-64">
                  {monthlyTrends.map((day) => {
                    const maxVal = Math.max(...monthlyTrends.map((d) => d.total), 1);
                    const presentH = (day.present / maxVal) * 100;
                    const absentH = (day.absent / maxVal) * 100;
                    const lateH = (day.late / maxVal) * 100;
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          P:{day.present} A:{day.absent} L:{day.late}
                        </div>
                        <div className="w-full flex flex-col justify-end" style={{ height: '200px' }}>
                          {day.late > 0 && <div className="w-full bg-amber-400 rounded-t-sm" style={{ height: `${lateH}%` }} />}
                          {day.absent > 0 && <div className="w-full bg-rose-400" style={{ height: `${absentH}%` }} />}
                          {day.present > 0 && <div className="w-full bg-emerald-400 rounded-b-sm" style={{ height: `${presentH}%` }} />}
                        </div>
                        <span className="text-[9px] text-slate-400 font-semibold">{day.dayLabel}</span>
                        <span className="text-[8px] text-slate-300">{day.date.split('-')[2]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400" /><span className="text-xs text-slate-500 font-semibold">Present</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-rose-400" /><span className="text-xs text-slate-500 font-semibold">Absent</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-400" /><span className="text-xs text-slate-500 font-semibold">Late</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'defaulters' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-700">Threshold:</label>
                  <select
                    value={defaulterThreshold}
                    onChange={(e) => setDefaulterThreshold(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {[50, 60, 65, 70, 75, 80, 85, 90].map((v) => (
                      <option key={v} value={v}>{v}%</option>
                    ))}
                  </select>
                </div>
                <span className="text-sm text-slate-500 font-semibold">{defaultersData.length} students below {defaulterThreshold}% attendance</span>
              </div>
              {defaultersData.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
                  <FiAlertTriangle className="text-rose-500 text-xl" />
                  <p className="text-sm font-semibold text-rose-700">{defaultersData.length} students are below the {defaulterThreshold}% attendance threshold.</p>
                </div>
              )}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Student', 'Board', 'Class', 'Division', 'Present', 'Total Days', 'Attendance %', 'Parent Mobile'].map((h) => (
                          <th key={h} className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {defaultersData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                            <FiCheckCircle className="mx-auto text-3xl mb-3 text-emerald-300" />
                            <p className="font-semibold">No defaulters found</p>
                          </td>
                        </tr>
                      ) : (
                        defaultersData.map((s) => (
                          <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{s.name}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{s.boardName}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-700">{s.className}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{s.division || '-'}</td>
                            <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-center">{s.presentDays}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">{s.totalWorkingDays}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                                {s.percentage}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{s.parentMobile || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dailyDetails' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-700">Date:</label>
                  <input
                    type="date"
                    value={filters.date}
                    onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    <FiCheckCircle className="text-xs" /> Present: {dailyPresentCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                    <FiXCircle className="text-xs" /> Absent: {dailyAbsentCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    <FiClock className="text-xs" /> Late: {dailyLateCount}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Student', 'GR Number', 'Class', 'Board', 'Status'].map((h) => (
                          <th key={h} className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyDetailsData.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                            <FiCalendar className="mx-auto text-3xl mb-3 text-slate-300" />
                            <p className="font-semibold">No attendance records for this date</p>
                          </td>
                        </tr>
                      ) : (
                        dailyDetailsData.map((s) => (
                          <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{s.name}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-600">{s.grNumber}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-700">{s.className}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{s.boardName}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                                s.status === 'present'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : s.status === 'late'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700'
                              }`}>
                                {s.status === 'present' && <FiCheckCircle className="text-xs" />}
                                {s.status === 'absent' && <FiXCircle className="text-xs" />}
                                {s.status === 'late' && <FiClock className="text-xs" />}
                                {s.status}
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
        </>
      )}
    </div>
  );
}
