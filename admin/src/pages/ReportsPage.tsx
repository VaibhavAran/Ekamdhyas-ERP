import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiPieChart, FiBarChart2, FiCalendar, FiDownload, FiUsers, 
  FiBookOpen, FiAlertCircle, FiLayout, FiTrendingUp, FiLoader
} from 'react-icons/fi';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';

interface Student {
  uid: string;
  name: string;
  class_id: string;
  class_name: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  subject: string;
  class: string;
  date: string;
  status: 'present' | 'absent';
}

interface ClassModel {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

export function ReportsPage() {
  // --- METADATA & DATA STATE ---
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- FILTERS ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const DEFAULTER_THRESHOLD = 75;

  // --- INITIAL FETCH ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [sSnap, cSnap, subSnap, aSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'subjects')),
          getDocs(collection(db, 'attendance'))
        ]);

        setStudents(sSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Student)));
        setClasses(cSnap.docs.map(d => ({ id: d.id, name: d.data().name } as ClassModel)));
        setSubjects(subSnap.docs.map(d => ({ id: d.id, name: d.data().name } as Subject)));
        setAttendanceRecords(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- FILTERED RECORDS ---
  const filteredRecords = useMemo(() => {
    if (!startDate || !endDate) return attendanceRecords;
    return attendanceRecords.filter(r => r.date >= startDate && r.date <= endDate);
  }, [attendanceRecords, startDate, endDate]);

  // --- AGGREGATION: OVERVIEW STATS ---
  const overviewStats = useMemo(() => {
    const totalStudents = students.length;
    const classesConducted = new Set(filteredRecords.map(r => `${r.date}_${r.subject}_${r.class}`)).size;
    const totalPresent = filteredRecords.filter(r => r.status === 'present').length;
    const overallPercentage = filteredRecords.length > 0 
      ? Math.round((totalPresent / filteredRecords.length) * 100) 
      : 0;

    // Defaulter calculation (based on all-time or filtered? usually all-time for "total defaulters" but let's stick to current context)
    const studentMap: Record<string, { present: number; total: number }> = {};
    filteredRecords.forEach(r => {
      if (!studentMap[r.student_id]) studentMap[r.student_id] = { present: 0, total: 0 };
      studentMap[r.student_id].total += 1;
      if (r.status === 'present') studentMap[r.student_id].present += 1;
    });

    const defaultersCount = Object.values(studentMap).filter(s => {
      const percentage = s.total > 0 ? (s.present / s.total) * 100 : 0;
      return percentage < DEFAULTER_THRESHOLD && s.total > 0;
    }).length;

    return { totalStudents, classesConducted, overallPercentage, defaultersCount };
  }, [filteredRecords, students]);

  // --- AGGREGATION: CLASS-WISE ---
  const classWiseReport = useMemo(() => {
    const data: Record<string, { present: number; total: number; studentIds: Set<string> }> = {};
    
    classes.forEach(c => {
      data[c.name] = { present: 0, total: 0, studentIds: new Set() };
    });

    filteredRecords.forEach(r => {
      if (data[r.class]) {
        data[r.class].total += 1;
        if (r.status === 'present') data[r.class].present += 1;
      }
    });

    // Match students to classes for "Total Students" count
    students.forEach(s => {
      if (data[s.class_name]) data[s.class_name].studentIds.add(s.uid);
    });

    return Object.entries(data).map(([name, stats]) => ({
      name,
      totalStudents: stats.studentIds.size,
      percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage);
  }, [filteredRecords, classes, students]);

  // --- AGGREGATION: SUBJECT-WISE ---
  const subjectWiseReport = useMemo(() => {
    const data: Record<string, { present: number; total: number }> = {};
    
    filteredRecords.forEach(r => {
      if (!data[r.subject]) data[r.subject] = { present: 0, total: 0 };
      data[r.subject].total += 1;
      if (r.status === 'present') data[r.subject].present += 1;
    });

    return Object.entries(data).map(([name, stats]) => ({
      name,
      percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage);
  }, [filteredRecords]);

  // --- AGGREGATION: DEFAULTER SUMMARY ---
  const defaulterSummary = useMemo(() => {
    // Map student -> percentage -> class
    const studentStats: Record<string, { present: number; total: number; class: string }> = {};
    filteredRecords.forEach(r => {
      if (!studentStats[r.student_id]) {
        const student = students.find(s => s.uid === r.student_id);
        studentStats[r.student_id] = { present: 0, total: 0, class: student?.class_name || 'Unknown' };
      }
      studentStats[r.student_id].total += 1;
      if (r.status === 'present') studentStats[r.student_id].present += 1;
    });

    const classDefaulters: Record<string, number> = {};
    Object.values(studentStats).forEach(s => {
      const percentage = s.total > 0 ? (s.present / s.total) * 100 : 0;
      if (percentage < DEFAULTER_THRESHOLD && s.total > 0) {
        classDefaulters[s.class] = (classDefaulters[s.class] || 0) + 1;
      }
    });

    return Object.entries(classDefaulters)
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords, students]);

  // --- AGGREGATION: TREND DATA ---
  const trendData = useMemo(() => {
    const data: Record<string, { present: number; total: number }> = {};
    
    filteredRecords.forEach(r => {
      if (!data[r.date]) data[r.date] = { present: 0, total: 0 };
      data[r.date].total += 1;
      if (r.status === 'present') data[r.date].present += 1;
    });

    return Object.entries(data).map(([date, stats]) => ({
      date,
      percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // --- EXPORT HELPERS ---
  const exportCSV = (data: any[], headers: string[], filename: string) => {
    const csvContent = [headers, ...data.map(row => Object.values(row))].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 space-y-8 animate-in fade-in duration-700">
      {/* Header & Date Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 text-white">
              <FiPieChart />
            </div>
            Reports & Analytics
          </h1>
          <p className="text-slate-500 mt-2 font-medium ml-16">Data-driven insights for academic performance</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-3">
             <FiCalendar className="text-slate-400" />
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" />
             <span className="text-slate-300 mx-2">to</span>
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" />
          </div>
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <FiLoader className="text-4xl animate-spin text-blue-600" />
          <p className="font-bold text-slate-500">Generating analytical reports...</p>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Students', value: overviewStats.totalStudents, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Classes Conducted', value: overviewStats.classesConducted, icon: FiLayout, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Overall Attendance', value: `${overviewStats.overallPercentage}%`, icon: FiTrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Critical Defaulters', value: overviewStats.defaultersCount, icon: FiAlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={28} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
                  <div className="text-3xl font-black text-slate-900 leading-none mt-1">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Attendance Trend Chart */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FiTrendingUp className="text-blue-600" /> Attendance Trend
              </h2>
              <span className="text-xs font-bold text-slate-400 uppercase">Daily performance</span>
            </div>
            
            {trendData.length === 0 ? (
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 font-medium italic">
                No data available for the selected range
              </div>
            ) : (
              <div className="h-64 flex items-end gap-2 px-2">
                {trendData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end">
                    <div className="w-full max-w-[40px] bg-slate-50 rounded-t-xl overflow-hidden relative flex-1 min-h-[20px]">
                      <div 
                        className={`absolute bottom-0 w-full rounded-t-xl transition-all duration-1000 ${d.percentage < 75 ? 'bg-rose-500' : 'bg-blue-500'}`}
                        style={{ height: `${d.percentage}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">
                          {d.percentage}%
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 rotate-45 origin-left mt-2 truncate w-full text-center">
                      {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Class-wise Report */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-800">Class-wise Analysis</h2>
                <button onClick={() => exportCSV(classWiseReport, ['Class Name', 'Total Students', 'Attendance %'], 'Class_Wise_Report')} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-colors">
                  <FiDownload />
                </button>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                  <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Class</th>
                      <th className="px-6 py-4">Students</th>
                      <th className="px-6 py-4">Average Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {classWiseReport.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                        <td className="px-6 py-4 font-bold text-slate-500">{c.totalStudents}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`font-black ${c.percentage < 75 ? 'text-rose-600' : 'text-emerald-600'}`}>{c.percentage}%</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                              <div className={`h-full rounded-full ${c.percentage < 75 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${c.percentage}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Subject-wise Report */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-800">Subject-wise Performance</h2>
                <button onClick={() => exportCSV(subjectWiseReport, ['Subject Name', 'Attendance %'], 'Subject_Wise_Report')} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-colors">
                  <FiDownload />
                </button>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                  <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Average Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {subjectWiseReport.length === 0 ? (
                      <tr><td colSpan={2} className="px-6 py-12 text-center text-slate-400 font-medium">No records found</td></tr>
                    ) : (
                      subjectWiseReport.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{s.name}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-black text-slate-700">{s.percentage}%</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${s.percentage}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Defaulter Summary */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FiAlertCircle className="text-rose-600" /> Defaulter Hotspots
                </h2>
                <span className="text-xs font-bold text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full">At Risk Classes</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {defaulterSummary.length === 0 ? (
                  <div className="col-span-2 py-12 text-center text-slate-400 font-medium border-2 border-dashed border-slate-50 rounded-2xl">Excellent! No classes have defaulters in this range.</div>
                ) : (
                  defaulterSummary.map((d, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-rose-900">{d.className}</div>
                        <div className="text-xs text-rose-600 font-bold uppercase mt-1">{d.count} Defaulters identified</div>
                      </div>
                      <div className="text-3xl font-black text-rose-300 opacity-50">#{i + 1}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Export Actions */}
            <div className="bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FiDownload className="text-blue-400" /> Export Hub
              </h2>
              <div className="space-y-3">
                <button 
                  onClick={() => exportCSV([overviewStats], ['Total Students', 'Classes Conducted', 'Overall %', 'Defaulters'], 'Overall_Summary')}
                  className="w-full bg-white/10 hover:bg-white/20 text-white text-left px-5 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-between group"
                >
                  Overall Analytics Report
                  <FiDownload className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button 
                  onClick={() => exportCSV(classWiseReport, ['Class', 'Students', 'Attendance %'], 'Class_Report')}
                  className="w-full bg-white/10 hover:bg-white/20 text-white text-left px-5 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-between group"
                >
                  Class-wise Performance
                  <FiDownload className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button 
                  onClick={() => exportCSV(subjectWiseReport, ['Subject', 'Attendance %'], 'Subject_Report')}
                  className="w-full bg-white/10 hover:bg-white/20 text-white text-left px-5 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-between group"
                >
                  Subject Effectiveness Data
                  <FiDownload className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button 
                  onClick={() => exportCSV(defaulterSummary, ['Class Name', 'Defaulter Count'], 'Defaulter_Summary')}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white text-left px-5 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-between group shadow-lg shadow-rose-900/40"
                >
                  Defaulter Master List
                  <FiDownload className="opacity-100" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center font-bold uppercase tracking-widest pt-4">Reports generated in CSV format</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}