import { useState, useEffect, useMemo } from 'react';
import { 
  FiFilter, FiDownload, FiUsers, FiBarChart2, FiAlertTriangle, 
  FiSearch, FiCalendar, FiLayout, FiCheckCircle, FiXCircle,
  FiLoader
} from 'react-icons/fi';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';

interface Student {
  uid: string;
  name: string;
  roll_no: string;
  class_id: string;
  class_name: string;
  batch_id?: string;
  batch_name?: string;
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

interface Batch {
  id: string;
  class_id: string;
  batch_name: string;
}

// AggregatedStudent type removed (not used in this admin page)

export function AttendanceRecordsPage() {
  // --- METADATA STATE ---
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  // --- FILTER STATE ---
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // --- DATA STATE ---
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredSessionIds, setFilteredSessionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDefaultersOnly, setShowDefaultersOnly] = useState(false);

  const DEFAULTER_THRESHOLD = 75;

  // --- INITIAL FETCH (Metadata) ---
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [sSnap, cSnap, subSnap, bSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'subjects')),
          getDocs(collection(db, 'batches'))
        ]);

        setStudents(sSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Student)));
        setClasses(cSnap.docs.map(d => ({ id: d.id, name: d.data().name } as ClassModel)));
        setSubjects(subSnap.docs.map(d => ({ id: d.id, name: d.data().name } as Subject)));
        setBatches(bSnap.docs.map(d => ({ id: d.id, class_id: d.data().class_id, batch_name: d.data().batch_name } as Batch)));
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    };
    fetchMetadata();
  }, []);

  // --- FETCH ATTENDANCE DATA ---
  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      try {
        // Step 1: Query attendance_sessions with applied filters
        let sessQuery = query(collection(db, 'attendance_sessions'));

        if (filterClass) {
          sessQuery = query(sessQuery, where('class_id', '==', filterClass));
        }
        if (filterSubject) {
          sessQuery = query(sessQuery, where('subject_id', '==', filterSubject));
        }
        if (filterBatch) {
          sessQuery = query(sessQuery, where('batch_id', '==', filterBatch));
        }
        if (startDate) {
          sessQuery = query(sessQuery, where('date', '>=', startDate));
        }
        if (endDate) {
          sessQuery = query(sessQuery, where('date', '<=', endDate));
        }

        const sessSnap = await getDocs(sessQuery);
        const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sessionIds = sessions.map((s: any) => s.id);
        setFilteredSessionIds(sessionIds);

        // Step 2: Fetch attendance for these sessions. Use 'in' queries in chunks of 10.
        let attendanceDocs: any[] = [];
        if (sessionIds.length === 0) {
          // No matching sessions => empty attendance
          setAttendanceRecords([]);
          setIsLoading(false);
          return;
        }

        const chunkSize = 10;
        for (let i = 0; i < sessionIds.length; i += chunkSize) {
          const chunk = sessionIds.slice(i, i + chunkSize);
          const aQ = query(collection(db, 'attendance'), where('attendance_session_id', 'in', chunk));
          const snap = await getDocs(aQ);
          attendanceDocs = attendanceDocs.concat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }

        // Optionally apply batch filter to ensure student batch matches
        const filtered = attendanceDocs.filter((rec: any) => {
          if (filterBatch) {
            const student = students.find(s => s.uid === rec.student_id);
            if (!student || student.batch_id !== filterBatch) return false;
          }
          return true;
        });

        setAttendanceRecords(filtered as AttendanceRecord[]);
      } catch (err) {
        console.error("Error fetching attendance:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [filterClass, filterSubject, filterBatch, startDate, endDate, classes, students]);

  const aggregatedData = useMemo(() => {
    const targetStudents = filterClass 
      ? students.filter(s => s.class_id === filterClass)
      : students;

    return targetStudents.map(s => {
      const studentRecords = attendanceRecords.filter(r => r.student_id === s.uid);
      const studentTotalSessions = studentRecords.length;
      const presentCount = studentRecords.filter(r => r.status === 'present').length;
      const absentCount = studentRecords.filter(r => r.status === 'absent').length;
      const percentage = studentTotalSessions > 0 ? Math.round((presentCount / studentTotalSessions) * 100) : 0;
      return {
        id: s.uid,
        name: s.name,
        rollNumber: s.roll_no,
        className: s.class_name,
        totalClasses: studentTotalSessions,
        present: presentCount,
        absent: absentCount,
        percentage,
        isDefaulter: percentage < DEFAULTER_THRESHOLD && studentTotalSessions > 0
      };
    }).filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDefaulter = showDefaultersOnly ? s.isDefaulter : true;
      return matchesSearch && matchesDefaulter;
    });
  }, [attendanceRecords, students, filterClass, searchTerm, showDefaultersOnly]);

  const summaryStats = useMemo(() => {
    const targetStudents = filterClass 
      ? students.filter(s => s.class_id === filterClass)
      : students;

    let totalPresent = 0;
    let totalAbsent = 0;

    targetStudents.forEach(s => {
      const studentRecords = attendanceRecords.filter(r => r.student_id === s.uid);
      totalPresent += studentRecords.filter(r => r.status === 'present').length;
      totalAbsent += studentRecords.filter(r => r.status === 'absent').length;
    });

    const totalActiveRecords = totalPresent + totalAbsent;
    const overallPercentage = totalActiveRecords > 0 
      ? Math.round((totalPresent / totalActiveRecords) * 100) 
      : 0;

    return {
      totalStudents: targetStudents.length,
      totalSessions: filteredSessionIds.length,
      present: totalPresent,
      absent: totalAbsent,
      percentage: overallPercentage
    };
  }, [attendanceRecords, students, filterClass, filteredSessionIds]);

  // --- EXPORT LOGIC ---
  const exportDefaulterList = () => {
    const defaulters = aggregatedData.filter(s => s.isDefaulter);
    if (defaulters.length === 0) {
      alert("No defaulters found to export!");
      return;
    }

    const headers = ['Student Name', 'Roll Number', 'Class', 'Attendance %', 'Status'];
    const rows = defaulters.map(s => [
      s.name,
      s.rollNumber,
      s.className,
      `${s.percentage}%`,
      'Defaulter'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Defaulter_List_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200 text-white">
              <FiBarChart2 />
            </div>
            Attendance Analytics
          </h1>
          <p className="text-slate-500 mt-2 font-medium ml-16">Review records, track performance, and manage defaulters</p>
        </div>
        
        <button 
          onClick={exportDefaulterList}
          className="flex items-center gap-2 bg-white border-2 border-rose-100 text-rose-600 px-6 py-3 rounded-2xl font-bold shadow-sm hover:bg-rose-50 hover:border-rose-200 transition-all active:scale-95"
        >
          <FiDownload /> Export Defaulter List
        </button>
      </div>

      {/* 1. Filters Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <FiFilter className="text-indigo-600" /> Advanced Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class</label>
            <select 
              value={filterClass} 
              onChange={e => setFilterClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
            <select 
              value={filterSubject} 
              onChange={e => setFilterSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch</label>
            <select 
              value={filterBatch} 
              onChange={e => setFilterBatch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Batches</option>
              {batches.filter(b => !filterClass || b.class_id === filterClass).map(b => (
                <option key={b.id} value={b.id}>{b.batch_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
              <span className="text-slate-400">to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button 
              onClick={() => {
                setFilterClass(''); setFilterSubject(''); setFilterBatch('');
                setStartDate(''); setEndDate(''); setSearchTerm('');
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* 2. Attendance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Students', value: summaryStats.totalStudents, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Sessions', value: summaryStats.totalSessions, icon: FiCalendar, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Present Count', value: summaryStats.present, icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Absent Count', value: summaryStats.absent, icon: FiXCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Overall %', value: `${summaryStats.percentage}%`, icon: FiBarChart2, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
              <div className="text-2xl font-black text-slate-900">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: Table and Defaulters */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 w-fit">
            <button 
              onClick={() => setShowDefaultersOnly(false)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${!showDefaultersOnly ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              All Students
            </button>
            <button 
              onClick={() => setShowDefaultersOnly(true)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${showDefaultersOnly ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FiAlertTriangle /> Defaulters
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or roll..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-12 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
            />
          </div>
        </div>

        {/* 3. Student-wise Attendance Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <FiLoader className="text-4xl animate-spin text-indigo-600 mb-4" />
              <p className="font-bold">Analyzing attendance data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5">Student Details</th>
                    <th className="px-8 py-5">Class</th>
                    <th className="px-8 py-5 text-center">Total Sessions</th>
                    <th className="px-8 py-5 text-center text-emerald-600">Present</th>
                    <th className="px-8 py-5 text-center text-rose-600">Absent</th>
                    <th className="px-8 py-5 text-center">Attendance %</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {aggregatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <FiLayout size={48} className="text-slate-200" />
                          <div className="text-slate-400 font-bold">No attendance found for selected filters</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    aggregatedData.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${student.isDefaulter ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.name}</div>
                              <div className="text-xs text-slate-500 font-bold font-mono uppercase tracking-tighter">{student.rollNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-bold text-slate-600 text-sm">{student.className}</td>
                        <td className="px-8 py-5 text-center font-black text-slate-700">{student.totalClasses}</td>
                        <td className="px-8 py-5 text-center font-black text-emerald-600">{student.present}</td>
                        <td className="px-8 py-5 text-center font-black text-rose-600">{student.absent}</td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-lg font-black ${student.isDefaulter ? 'text-rose-600' : 'text-slate-900'}`}>
                              {student.percentage}%
                            </span>
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${student.isDefaulter ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${student.percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                            student.isDefaulter 
                              ? 'bg-rose-100 text-rose-600 animate-pulse' 
                              : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {student.isDefaulter ? <><FiAlertTriangle /> Defaulter</> : <><FiCheckCircle /> Normal</>}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 5. Defaulter Summary Indicator */}
      {showDefaultersOnly && aggregatedData.length > 0 && (
        <div className="bg-rose-600 rounded-3xl p-8 text-white shadow-xl shadow-rose-200 animate-in slide-in-from-bottom-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                <FiAlertTriangle size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Critical Defaulter List</h2>
                <p className="text-rose-100 font-medium">Found {aggregatedData.length} students below the {DEFAULTER_THRESHOLD}% attendance threshold.</p>
              </div>
            </div>
            <button 
              onClick={exportDefaulterList}
              className="bg-white text-rose-600 px-8 py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition-transform"
            >
              Export Records
            </button>
          </div>
        </div>
      )}
    </div>
  );
}