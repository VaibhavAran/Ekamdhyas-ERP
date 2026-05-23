import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { fetchTeacherSchedule } from '../utils/substituteLectures';
import {
collection,
query,
where,
getDocs,
orderBy,
limit,
} from 'firebase/firestore';
import {
FiCalendar,
FiCheckSquare,
FiArchive,
FiClock,
FiUsers,
FiActivity,
FiChevronRight,
FiBell,
FiBook,
FiInbox,
FiZap,
} from 'react-icons/fi';

// ── Types ────────────────────────────────────────────────────────────────────

interface TimetableEntry {
id: string;
teacher_id: string;
day: string;        // e.g. "Monday"
start_time: string; // e.g. "10:00"
end_time: string;   // e.g. "11:00"
subject: string;
subject_name?: string;
class_name: string;
batch?: string;
is_break?: boolean;
is_substitute?: boolean;
original_timetable_id?: string;
substitute_override_id?: string;
}

interface AttendanceSession {
id: string;
teacher_id: string;
class_name: string;
subject: string;
date: string;       // "YYYY-MM-DD"
student_count?: number;
created_at?: any;
}

interface Notification {
id: string;
message: string;
created_at?: any;
type?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const todayName = () => DAYS[new Date().getDay()];

const todayISO = () => new Date().toISOString().split('T')[0];

/** Convert "HH:MM" to total minutes since midnight */
const toMinutes = (t: string) => {
const [h, m] = t.split(':').map(Number);
return h * 60 + m;
};

const nowMinutes = () => {
const n = new Date();
return n.getHours() * 60 + n.getMinutes();
};

const slotStatus = (start: string, end: string): 'upcoming' | 'ongoing' | 'completed' => {
const now = nowMinutes();
const s = toMinutes(start);
const e = toMinutes(end);
if (now < s) return 'upcoming';
if (now >= s && now < e) return 'ongoing';
return 'completed';
};

const formatTime = (t: string) => {
const [h, m] = t.split(':').map(Number);
const period = h >= 12 ? 'PM' : 'AM';
const hour = h % 12 || 12;
return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
};

const formatDate = (iso: string) => {
if (!iso) return '';
const [y, mo, d] = iso.split('-');
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
return `${d} ${months[Number(mo) - 1]} ${y}`;
};

// ── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: 'upcoming' | 'ongoing' | 'completed' }) => {
const map = {
upcoming:  { label: 'Upcoming',  cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
ongoing:   { label: 'Ongoing',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse' },
completed: { label: 'Completed', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};
const { label, cls } = map[status];
return (
<span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${cls}`}>
{label}
</span>
);
};

// ── Skeleton Loader ───────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
<div className={`bg-slate-800/50 rounded-xl animate-pulse ${className}`} />
);

// ── Main Component ────────────────────────────────────────────────────────────

const DashboardPage = () => {
const { currentUser, teacherProfile } = useAuth();

const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
const [recentActivity, setRecentActivity] = useState<AttendanceSession[]>([]);
const [notifications, setNotifications] = useState<Notification[]>([]);
const [todaySessions, setTodaySessions] = useState(0);

const [loadingTimetable, setLoadingTimetable] = useState(true);
const [loadingActivity, setLoadingActivity] = useState(true);
const [loadingNotifications, setLoadingNotifications] = useState(true);

const uid = currentUser?.uid;

// ── Fetch today's timetable ─────────────────────────────────────────────
useEffect(() => {
if (!uid) return;
const fetch = async () => {
setLoadingTimetable(true);
try {
const scheduleData = await fetchTeacherSchedule(db, uid);
const entries = scheduleData.scheduleEntries
  .map((item) => ({
    id: item.id,
    teacher_id: item.teacher_id ?? uid,
    day: item.day,
    start_time: item.start_time,
    end_time: item.end_time,
    subject: item.subject_name ?? '',
    subject_name: item.subject_name ?? '',
    class_name: item.class_name,
    batch: item.batch_name ?? undefined,
    is_break: item.is_break,
    is_substitute: item.is_substitute,
    original_timetable_id: item.original_timetable_id,
    substitute_override_id: item.substitute_override_id,
  } as TimetableEntry))
  .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
setTimetable(entries);
} catch (e) {
console.error('Timetable fetch error:', e);
} finally {
setLoadingTimetable(false);
}
};
fetch();
}, [uid]);

// ── Fetch recent attendance activity ────────────────────────────────────
useEffect(() => {
if (!uid) return;
const fetch = async () => {
setLoadingActivity(true);
try {
// Attempt with orderBy+limit; falls back if index missing
let sessions: AttendanceSession[] = [];
try {
const q = query(
collection(db, 'attendance_sessions'),
where('teacher_id', '==', uid),
orderBy('created_at', 'desc'),
limit(5)
);
const snap = await getDocs(q);
sessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceSession));
} catch {
// Fallback: no ordering
const q2 = query(
collection(db, 'attendance_sessions'),
where('teacher_id', '==', uid),
limit(10)
);
const snap2 = await getDocs(q2);
sessions = snap2.docs
.map(d => ({ id: d.id, ...d.data() } as AttendanceSession))
.slice(0, 5);
}

// Count today's sessions
const todayCount = sessions.filter(s => s.date === todayISO()).length;
setTodaySessions(todayCount);
setRecentActivity(sessions);
} catch (e) {
console.error('Activity fetch error:', e);
} finally {
setLoadingActivity(false);
}
};
fetch();
}, [uid]);

// ── Fetch notifications (admin → all teachers) ──────────────────────────
useEffect(() => {
const fetch = async () => {
setLoadingNotifications(true);
try {
let notifs: Notification[] = [];
try {
const q = query(
collection(db, 'notifications'),
orderBy('created_at', 'desc'),
limit(5)
);
const snap = await getDocs(q);
notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
} catch {
const q2 = query(collection(db, 'notifications'), limit(5));
const snap2 = await getDocs(q2);
notifs = snap2.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
}
setNotifications(notifs);
} catch (e) {
console.error('Notifications fetch error:', e);
} finally {
setLoadingNotifications(false);
}
};
fetch();
}, []);

// ── Computed stats ───────────────────────────────────────────────────────
const stats = useMemo(() => [
{
label: "Today's Classes",
value: loadingTimetable ? null : timetable.length,
icon: FiCalendar,
gradient: 'from-blue-500 to-indigo-600',
glow: 'shadow-blue-500/25',
},
{
label: 'Attendance Taken Today',
value: loadingActivity ? null : todaySessions,
icon: FiCheckSquare,
gradient: 'from-emerald-500 to-teal-600',
glow: 'shadow-emerald-500/25',
},
{
label: 'Remaining Today',
value: loadingTimetable || loadingActivity ? null : Math.max(0, timetable.length - todaySessions),
icon: FiActivity,
gradient: 'from-amber-500 to-orange-600',
glow: 'shadow-amber-500/25',
},
], [timetable, todaySessions, loadingTimetable, loadingActivity]);

const ongoingClass = useMemo(
() => timetable.find(e => slotStatus(e.start_time, e.end_time) === 'ongoing'),
[timetable]
);

// ────────────────────────────────────────────────────────────────────────
return (
<div className="space-y-8 pb-8">

{/* ── 1. Welcome Banner ─────────────────────────────────────────── */}
<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-7 shadow-2xl shadow-indigo-900/40">
{/* Decorative blobs */}
<div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
<div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

<div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
<div>
<p className="text-indigo-200 text-sm font-semibold uppercase tracking-widest mb-1">
Teacher Dashboard
</p>
<h1 className="text-3xl font-black text-white leading-tight">
Welcome back, {teacherProfile?.name?.split(' ')[0] ?? 'Teacher'} 👋
</h1>
<div className="mt-2 flex flex-wrap items-center gap-3">
{teacherProfile?.department_name && (
<span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-indigo-100 text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
<FiBook className="w-3.5 h-3.5" />
{teacherProfile.department_name}
</span>
)}
<span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-indigo-100 text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
<FiCalendar className="w-3.5 h-3.5" />
{todayName()}, {formatDate(todayISO())}
</span>
</div>
</div>

{/* Ongoing class pill */}
{ongoingClass && (
<div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4 min-w-[200px]">
<p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-1">🟢 Ongoing Now</p>
{ongoingClass.is_break ? (
<p className="text-amber-300 font-black text-base">☕ BREAK</p>
) : (
<>
<p className="text-indigo-200 text-sm font-medium">{ongoingClass.class_name}</p>
<p className="text-white font-black text-base">{ongoingClass.subject_name || ongoingClass.subject}</p>
{ongoingClass.is_substitute && (
<span className="mt-2 inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">
Substitute Lecture
</span>
)}
</>
)}
<p className="text-indigo-300/70 text-xs mt-1">{formatTime(ongoingClass.start_time)} – {formatTime(ongoingClass.end_time)}</p>
</div>
)}
</div>
</div>

{/* ── 2. Stats Cards ────────────────────────────────────────────── */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
{stats.map((s) => (
<div
key={s.label}
className={`relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl ${s.glow}`}
>
<div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-5`} />
<div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${s.gradient} shadow-lg mb-4`}>
<s.icon className="w-5 h-5 text-white" />
</div>
{s.value === null ? (
<Skeleton className="h-9 w-16 mb-1" />
) : (
<div className="text-4xl font-black text-white">{s.value}</div>
)}
<p className="text-slate-400 text-sm font-semibold mt-1">{s.label}</p>
</div>
))}
</div>

{/* ── 3. Today's Timetable ──────────────────────────────────────── */}
<section>
<div className="flex items-center justify-between mb-4">
<h2 className="text-xl font-black text-white flex items-center gap-2">
<FiClock className="text-blue-400" /> Today's Timetable
</h2>
<Link
to="/teacher/timetable"
className="text-sm text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
>
View all <FiChevronRight />
</Link>
</div>

{loadingTimetable ? (
<div className="space-y-3">
{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
</div>
) : timetable.length === 0 ? (
<div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500">
<FiInbox className="w-10 h-10 mb-3 text-slate-700" />
<p className="font-bold">No classes scheduled for today</p>
<p className="text-sm mt-1 text-slate-600">Enjoy your free day!</p>
</div>
) : (
<div className="space-y-3">
{timetable.map((entry) => {
const status = slotStatus(entry.start_time, entry.end_time);
return (
<div
key={entry.id}
className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
  status === 'ongoing'
    ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-900/10'
    : status === 'completed'
    ? 'bg-slate-900/40 border-slate-800/50 opacity-60'
    : 'bg-slate-900 border-slate-800'
}`}
>
{/* Time */}
<div className="shrink-0 text-center min-w-[80px]">
  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
    {formatTime(entry.start_time)}
  </p>
  <div className="my-0.5 h-px bg-slate-700 w-full" />
  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
    {formatTime(entry.end_time)}
  </p>
</div>

{/* Divider line */}
<div className={`self-stretch w-0.5 rounded-full ${
  status === 'ongoing' ? 'bg-emerald-500' :
  status === 'completed' ? 'bg-slate-700' : 'bg-blue-500'
}`} />

{/* Info */}
<div className="flex-1 min-w-0">
  {entry.is_break ? (
    <p className="font-black text-amber-400 text-sm">☕ BREAK</p>
  ) : (
    <>
      <p className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
        <FiUsers className="w-3 h-3" /> {entry.class_name}
      </p>
      <p className="font-black text-white text-sm truncate">
        {entry.subject_name || entry.subject}
      </p>
      {entry.is_substitute && (
        <span className="inline-flex mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
          Substitute Lecture
        </span>
      )}
      {entry.batch && (
        <span className="inline-flex mt-1 text-xs font-semibold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">
          {entry.batch}
        </span>
      )}
    </>
  )}
</div>

{/* Status + CTA */}
<div className="flex flex-col items-end gap-2 shrink-0">
  <StatusBadge status={status} />
  {status !== 'completed' && !entry.is_break && (
    <Link
      to={`/teacher/take-attendance?session_id=${entry.id}`}
      className="text-[10px] font-black uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors"
    >
      Take Attendance →
    </Link>
  )}
</div>
</div>
);
})}
</div>
)}
</section>

{/* ── 4. Quick Actions ──────────────────────────────────────────── */}
<section>
<h2 className="text-xl font-black text-white flex items-center gap-2 mb-4">
<FiZap className="text-amber-400" /> Quick Actions
</h2>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
{[
{
label: 'View Timetable',
desc: 'See your full weekly schedule',
to: '/teacher/timetable',
icon: FiCalendar,
gradient: 'from-blue-600 to-indigo-700',
glow: 'hover:shadow-blue-500/20',
},
{
label: 'Take Attendance',
desc: 'Start an attendance session',
to: '/teacher/take-attendance',
icon: FiCheckSquare,
gradient: 'from-emerald-600 to-teal-700',
glow: 'hover:shadow-emerald-500/20',
},
{
label: 'Attendance Records',
desc: 'Review past sessions',
to: '/teacher/attendance-records',
icon: FiArchive,
gradient: 'from-purple-600 to-violet-700',
glow: 'hover:shadow-purple-500/20',
},
].map((action) => (
<Link
key={action.to}
to={action.to}
className={`group relative overflow-hidden flex items-center gap-4 rounded-2xl bg-slate-900 border border-slate-800 p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${action.glow} hover:border-slate-700`}
>
<div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg`}>
<action.icon className="w-5 h-5 text-white" />
</div>
<div className="flex-1">
<p className="font-black text-white text-sm">{action.label}</p>
<p className="text-slate-500 text-xs mt-0.5">{action.desc}</p>
</div>
<FiChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
</Link>
))}
</div>
</section>

{/* ── 5 & 6. Bottom Row: Recent Activity + Notifications ─────────── */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

{/* Recent Attendance Activity */}
<section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
<h2 className="font-black text-white flex items-center gap-2">
<FiActivity className="text-emerald-400" /> Recent Activity
</h2>
<Link
to="/teacher/attendance-records"
className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
>
View all <FiChevronRight />
</Link>
</div>

{loadingActivity ? (
<div className="p-6 space-y-3">
{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
</div>
) : recentActivity.length === 0 ? (
<div className="flex flex-col items-center justify-center py-14 px-6 text-slate-600">
<FiInbox className="w-10 h-10 mb-3 text-slate-700" />
<p className="font-bold">No attendance sessions yet</p>
</div>
) : (
<ul className="divide-y divide-slate-800">
{recentActivity.map((s) => (
<li key={s.id} className="px-6 py-4 hover:bg-slate-800/30 transition-colors">
<div className="flex items-center justify-between gap-3">
  <div>
    <p className="font-bold text-white text-sm">
      {s.subject}
      <span className="ml-2 text-xs font-semibold text-slate-500">·</span>
      <span className="ml-2 text-xs font-semibold text-slate-400">{s.class_name}</span>
    </p>
    <p className="text-xs text-slate-500 mt-0.5">{formatDate(s.date)}</p>
  </div>
  {s.student_count != null && (
    <span className="shrink-0 flex items-center gap-1 text-xs font-black text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
      <FiUsers className="w-3 h-3" /> {s.student_count}
    </span>
  )}
</div>
</li>
))}
</ul>
)}
</section>

{/* Notifications */}
<section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
<h2 className="font-black text-white flex items-center gap-2">
<FiBell className="text-blue-400" /> Notifications
</h2>
<Link
to="/teacher/notifications"
className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
>
View all <FiChevronRight />
</Link>
</div>

{loadingNotifications ? (
<div className="p-6 space-y-3">
{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
</div>
) : notifications.length === 0 ? (
<div className="flex flex-col items-center justify-center py-14 px-6 text-slate-600">
<FiBell className="w-10 h-10 mb-3 text-slate-700" />
<p className="font-bold">No notifications</p>
</div>
) : (
<ul className="divide-y divide-slate-800">
{notifications.map((n, i) => (
<li key={n.id} className="px-6 py-4 hover:bg-slate-800/30 transition-colors flex items-start gap-3">
<div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${i === 0 ? 'bg-blue-400' : 'bg-slate-600'}`} />
<div>
  <p className="text-sm text-slate-200 font-semibold leading-snug">{n.message}</p>
  {n.created_at?.toDate && (
    <p className="text-xs text-slate-500 mt-0.5">
      {formatDate(n.created_at.toDate().toISOString().split('T')[0])}
    </p>
  )}
</div>
</li>
))}
</ul>
)}
</section>
</div>

</div>
);
};

export default DashboardPage;
