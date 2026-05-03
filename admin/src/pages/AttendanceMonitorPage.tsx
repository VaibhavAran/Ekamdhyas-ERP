import React, { useState, useEffect } from 'react';
import { 
  FiMonitor, FiUsers, FiClock, FiBook, FiCheckCircle, FiAlertCircle, 
  FiActivity, FiUserCheck, FiUserX, FiSettings, FiLayout, FiUser
} from 'react-icons/fi';

interface SessionInfo {
  activeClass: string;
  subject: string;
  batch?: string;
  teacherName: string;
  status: 'Running' | 'Stopped';
}

interface DetectedStudent {
  id: string;
  name: string;
  rollNumber: string;
  timeDetected: string;
  status: 'Present';
}

export function AttendanceMonitorPage() {
  // --- INTEGRATION HOOKS (Ready for backend) ---
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>('No active session');
  const [systemLogs, setSystemLogs] = useState<{message: string; type: 'info' | 'warning' | 'error'}[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0
  });

  // Example of how integration would look (commented out)
  /*
  useEffect(() => {
    const unsubscribeSession = onSnapshot(doc(db, 'active_sessions', 'current'), (doc) => {
      if (doc.exists()) {
        setCurrentSession(doc.data() as SessionInfo);
        setSessionStatus('Attendance in progress');
      } else {
        setCurrentSession(null);
        setSessionStatus('No active session');
      }
    });

    const unsubscribeDetections = onSnapshot(collection(db, 'live_detections'), (snapshot) => {
      const newDetections = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DetectedStudent));
      setDetectedStudents(newDetections);
    });

    return () => {
      unsubscribeSession();
      unsubscribeDetections();
    };
  }, []);
  */

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
              <FiMonitor className="text-white" />
            </div>
            Attendance Monitor
          </h1>
          <p className="text-slate-500 mt-1 font-medium ml-12">Real-time surveillance & session tracking</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
            currentSession?.status === 'Running' 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'bg-slate-100 text-slate-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${currentSession?.status === 'Running' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            {currentSession?.status === 'Running' ? 'LIVE SESSION' : 'IDLE'}
          </div>
          <div className="px-4 py-2 text-sm font-semibold text-slate-600">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* 1. Session Info Panel (Top Section) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Current Class', value: currentSession?.activeClass || '--', icon: FiLayout, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Subject', value: currentSession?.subject || '--', icon: FiBook, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Batch', value: currentSession?.batch || 'N/A', icon: FiUsers, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Teacher', value: currentSession?.teacherName || '--', icon: FiUser, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Status', value: currentSession?.status || 'Stopped', icon: FiActivity, color: currentSession?.status === 'Running' ? 'text-emerald-600' : 'text-rose-600', bg: currentSession?.status === 'Running' ? 'bg-emerald-50' : 'bg-rose-50' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                <item.icon size={18} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
            </div>
            <div className="text-lg font-bold text-slate-900 truncate">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* 2. Live Attendance Feed (MAIN SECTION) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FiActivity className="text-blue-600" /> Live Feed
              </h2>
              <span className="text-xs font-bold px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-500">
                Auto-updating
              </span>
            </div>
            
            <div className="flex-1 p-6">
              {!currentSession ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-dashed border-slate-200">
                    <FiMonitor className="text-slate-200 text-3xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-700">Waiting for session...</h3>
                    <p className="text-slate-400 max-w-xs mx-auto">The live feed will automatically start once a teacher initiates a session.</p>
                  </div>
                </div>
              ) : detectedStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                  </div>
                  <p className="text-slate-500 font-medium">Scanning for faces...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {detectedStudents.map((student) => (
                    <div key={student.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all animate-in slide-in-from-bottom-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black text-lg">
                        {student.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{student.name}</div>
                        <div className="text-xs text-slate-500 font-medium">{student.rollNumber} • {student.timeDetected}</div>
                      </div>
                      <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        Present
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Detected Students Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FiUsers className="text-blue-600" /> Detection Logs
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Roll Number</th>
                    <th className="px-6 py-4">Detection Time</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {detectedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No students detected yet
                      </td>
                    </tr>
                  ) : (
                    detectedStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{student.name}</div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-600">
                          {student.rollNumber}
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium flex items-center gap-2">
                          <FiClock size={14} className="text-slate-300" /> {student.timeDetected}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">
                            <FiCheckCircle size={12} /> Present
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

        {/* Sidebar: Summary & Status */}
        <div className="space-y-8">
          {/* 3. Session Summary */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FiLayout className="text-blue-600" /> Session Summary
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <FiUsers className="text-slate-400" size={14} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                </div>
                <div className="text-2xl font-black text-slate-900">{stats.total}</div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <FiUserCheck className="text-emerald-500" size={14} />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">Present</span>
                </div>
                <div className="text-2xl font-black text-emerald-700">{stats.present}</div>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-2 mb-1">
                  <FiUserX className="text-rose-500" size={14} />
                  <span className="text-[10px] font-bold text-rose-500 uppercase">Absent</span>
                </div>
                <div className="text-2xl font-black text-rose-700">{stats.absent}</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-2 mb-1">
                  <FiActivity className="text-indigo-500" size={14} />
                  <span className="text-[10px] font-bold text-indigo-500 uppercase">Rate</span>
                </div>
                <div className="text-2xl font-black text-indigo-700">{stats.percentage}%</div>
              </div>
            </div>

            {/* Circular Progress (Visual Placeholder) */}
            <div className="relative pt-4 flex flex-col items-center">
               <div className="w-32 h-32 rounded-full border-[10px] border-slate-50 flex items-center justify-center relative">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="64" cy="64" r="54"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-blue-600"
                      strokeDasharray={`${stats.percentage * 3.4}, 340`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="text-2xl font-black text-slate-900">{stats.percentage}%</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Attendance</div>
                  </div>
               </div>
            </div>
          </div>

          {/* 5. System Status / Logs */}
          <div className="bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FiSettings className="text-blue-400" /> System Status
              </h2>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
            </div>
            
            <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto">
              {/* Status Indicator */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Session Status</span>
                  <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">{sessionStatus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Camera Feed</span>
                  <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Connected</span>
                </div>
              </div>

              {/* Console Logs */}
              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">System Logs</div>
                {systemLogs.length === 0 ? (
                  <div className="text-xs text-slate-500 font-mono italic">-- System running normally --</div>
                ) : (
                  systemLogs.map((log, i) => (
                    <div key={i} className={`flex items-start gap-2 text-xs font-mono p-2 rounded-lg ${
                      log.type === 'error' ? 'text-rose-400 bg-rose-400/10' : 
                      log.type === 'warning' ? 'text-amber-400 bg-amber-400/10' : 'text-blue-400 bg-blue-400/10'
                    }`}>
                      <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>[{new Date().toLocaleTimeString([], {hour12: false})}] {log.message}</span>
                    </div>
                  ))
                )}
                {/* Mocking some logs for visual demo when idle */}
                {!currentSession && (
                  <>
                    <div className="flex items-start gap-2 text-xs font-mono p-2 rounded-lg text-slate-400 bg-white/5 opacity-50">
                      <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>[--:--:--] System standby...</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs font-mono p-2 rounded-lg text-slate-400 bg-white/5 opacity-50">
                      <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>[--:--:--] Waiting for teacher to start session</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-white/5 text-center">
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em]">Image-Based Attendance ERP v2.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}