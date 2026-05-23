import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { fetchTeacherSchedule } from '../utils/substituteLectures';
import {
FiCalendar,
FiClock,
FiFilter,
FiCheckSquare,
FiUsers,
FiInbox,
FiCoffee,
} from 'react-icons/fi';

// ── Types ────────────────────────────────────────────────────────────────────

interface TimetableEntry {
id: string;
class_id: string;
class_name: string;
subject_id: string | null;
subject_name: string | null;
teacher_id: string | null;
teacher_name: string | null;
day: string;
start_time: string;
end_time: string;
is_break: boolean;
batch_id?: string | null;
batch_name?: string | null;
is_substitute?: boolean;
original_timetable_id?: string;
substitute_override_id?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Helpers ──────────────────────────────────────────────────────────────────

const todayName = () =>
['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
new Date().getDay()
];

/** Convert "HH:MM" → total minutes since midnight */
const toMinutes = (t: string) => {
const [h, m] = t.split(':').map(Number);
return h * 60 + m;
};

const nowMinutes = () => {
const n = new Date();
return n.getHours() * 60 + n.getMinutes();
};

const formatTo12Hour = (time24: string) => {
if (!time24) return '';
const [hStr, m] = time24.split(':');
const h24 = parseInt(hStr, 10);
const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
const ampm = h24 >= 12 ? 'PM' : 'AM';
return `${h12}:${m} ${ampm}`;
};

const slotStatus = (start: string, end: string): 'upcoming' | 'ongoing' | 'completed' => {
const now = nowMinutes();
const s = toMinutes(start);
const e = toMinutes(end);
if (now < s) return 'upcoming';
if (now >= s && now < e) return 'ongoing';
return 'completed';
};

// ── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
<div className={`bg-slate-800/50 rounded-xl animate-pulse ${className ?? ''}`} />
);

// ── Main Component ───────────────────────────────────────────────────────────

const TimetablePage = () => {
const { currentUser } = useAuth();
const uid = currentUser?.uid;

const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
const [loading, setLoading] = useState(true);
const [viewMode, setViewMode] = useState<'week' | 'today'>('week');

// ── Fetch all timetable entries for this teacher ───────────────────────
useEffect(() => {
if (!uid) return;
const fetchTimetable = async () => {
setLoading(true);
try {
const scheduleData = await fetchTeacherSchedule(db, uid);
const entries = scheduleData.scheduleEntries as TimetableEntry[];

// Also fetch break entries for all classes this teacher has lectures in
const classIds = [...new Set(entries.map(e => e.class_id))];
let breakEntries: TimetableEntry[] = [];

if (classIds.length > 0) {
// Firestore 'in' supports up to 30 values
const chunks = [];
for (let i = 0; i < classIds.length; i += 30) {
chunks.push(classIds.slice(i, i + 30));
}
for (const chunk of chunks) {
const bq = query(
collection(db, 'timetable'),
where('class_id', 'in', chunk),
where('is_break', '==', true)
);
const bSnap = await getDocs(bq);
breakEntries.push(
...bSnap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableEntry))
);
}
}

// Merge & deduplicate
const merged = [...entries];
breakEntries.forEach(be => {
if (!merged.find(e => e.id === be.id)) {
merged.push(be);
}
});

setTimetable(merged);
} catch (e) {
console.error('Timetable fetch error:', e);
} finally {
setLoading(false);
}
};
fetchTimetable();
}, [uid]);

// ── Derive dynamic time-slot columns from data ────────────────────────
const dynamicTimeSlots = useMemo(() => {
const slotKeys = new Set<string>();
timetable.forEach(t => {
if (t.start_time && t.end_time) {
slotKeys.add(`${t.start_time}|${t.end_time}`);
}
});
return Array.from(slotKeys)
.map(k => {
const [start, end] = k.split('|');
return { start, end };
})
.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}, [timetable]);

// ── Filter days based on view mode ────────────────────────────────────
const visibleDays = useMemo(() => {
if (viewMode === 'today') {
const t = todayName();
return DAYS.includes(t) ? [t] : [];
}
return DAYS;
}, [viewMode]);

// ── Lookup helper: find entries for a given day + slot ────────────────
const getEntries = (day: string, slot: { start: string; end: string }) =>
timetable.filter(
t =>
t.day === day &&
t.start_time === slot.start &&
t.end_time === slot.end
);

// ── Stats ─────────────────────────────────────────────────────────────
const stats = useMemo(() => {
const today = todayName();
const todayEntries = timetable.filter(t => t.day === today && !t.is_break);
const totalWeekly = timetable.filter(t => !t.is_break).length;
const uniqueSubjects = new Set(timetable.filter(t => !t.is_break).map(t => t.subject_name)).size;
return {
todayClasses: todayEntries.length,
weeklyClasses: totalWeekly,
uniqueSubjects,
};
}, [timetable]);

// ────────────────────────────────────────────────────────────────────────
return (
<div className="space-y-8 pb-8">

{/* ── Header ──────────────────────────────────────────────────── */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h1 className="text-3xl font-black text-white flex items-center gap-3">
<div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
<FiCalendar className="w-6 h-6 text-white" />
</div>
My Timetable
</h1>
<p className="text-slate-400 text-sm mt-1 ml-14">
Your personalized weekly schedule
</p>
</div>

{/* View Mode Toggle */}
<div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit">
<button
onClick={() => setViewMode('week')}
className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
viewMode === 'week'
? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
: 'text-slate-400 hover:text-white hover:bg-slate-800'
}`}
>
<FiCalendar className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
Full Week
</button>
<button
onClick={() => setViewMode('today')}
className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
viewMode === 'today'
? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
: 'text-slate-400 hover:text-white hover:bg-slate-800'
}`}
>
<FiClock className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
Today Only
</button>
</div>
</div>

{/* ── Quick Stats ─────────────────────────────────────────────── */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
{[
{
label: "Today's Classes",
value: stats.todayClasses,
icon: FiClock,
gradient: 'from-emerald-500 to-teal-600',
},
{
label: 'Weekly Classes',
value: stats.weeklyClasses,
icon: FiCalendar,
gradient: 'from-blue-500 to-indigo-600',
},
{
label: 'Subjects',
value: stats.uniqueSubjects,
icon: FiFilter,
gradient: 'from-purple-500 to-violet-600',
},
].map(s => (
<div
key={s.label}
className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-5 flex items-center gap-4"
>
<div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-5`} />
<div className={`p-3 rounded-xl bg-gradient-to-br ${s.gradient} shadow-lg shrink-0`}>
<s.icon className="w-5 h-5 text-white" />
</div>
<div>
{loading ? (
<Skeleton className="h-8 w-10 mb-1" />
) : (
<div className="text-3xl font-black text-white">{s.value}</div>
)}
<p className="text-slate-400 text-xs font-semibold">{s.label}</p>
</div>
</div>
))}
</div>

{/* ── Timetable Grid ──────────────────────────────────────────── */}
{loading ? (
<div className="space-y-3">
{[1, 2, 3, 4].map(i => (
<Skeleton key={i} className="h-24 w-full" />
))}
</div>
) : dynamicTimeSlots.length === 0 ? (
<div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500">
<FiInbox className="w-12 h-12 mb-4 text-slate-700" />
<p className="font-bold text-lg">No timetable entries found</p>
<p className="text-sm mt-1 text-slate-600">
Your schedule hasn't been assigned yet. Please contact your admin.
</p>
</div>
) : (
<div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
<div className="overflow-x-auto">
<table className="w-full border-collapse min-w-[700px]">

{/* ── Sticky Header ─────────────────────────────────── */}
<thead className="sticky top-0 z-20">
<tr>
<th className="py-4 px-4 bg-slate-900 border-b border-r border-slate-800 text-left min-w-[120px] sticky left-0 z-30">
<span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
Day / Time
</span>
</th>
{dynamicTimeSlots.map((slot, i) => {
const isBreakSlot = timetable.some(
t => t.is_break && t.start_time === slot.start && t.end_time === slot.end
);
return (
<th
key={i}
className={`py-4 px-3 border-b border-r border-slate-800 text-center min-w-[150px] ${
  isBreakSlot ? 'bg-amber-500/5' : 'bg-slate-900'
}`}
>
<div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
  {formatTo12Hour(slot.start)}
</div>
<div className="text-[9px] text-slate-600 font-semibold mt-0.5">to</div>
<div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
  {formatTo12Hour(slot.end)}
</div>
</th>
);
})}
</tr>
</thead>

{/* ── Body ──────────────────────────────────────────── */}
<tbody>
{visibleDays.map(day => {
const isToday = day === todayName();

return (
<tr key={day}>
{/* Day label */}
<td
className={`py-4 px-4 border-b border-r border-slate-800 font-bold text-sm sticky left-0 z-10 ${
  isToday
    ? 'bg-blue-500/10 text-blue-400'
    : 'bg-slate-900/90 text-slate-300'
}`}
>
<div className="flex items-center gap-2">
  {isToday && (
    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
  )}
  <span>{day}</span>
</div>
{isToday && (
  <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest mt-0.5 block">
    Today
  </span>
)}
</td>

{/* Slot cells */}
{dynamicTimeSlots.map((slot, slotIdx) => {
const entries = getEntries(day, slot);
const hasBreak = entries.some(e => e.is_break);
const lectures = entries.filter(e => !e.is_break);
const isEmpty = entries.length === 0;

// Determine if any lecture in this cell is ongoing (only for today)
const isActive =
  isToday && slotStatus(slot.start, slot.end) === 'ongoing';
const isCompleted =
  isToday && slotStatus(slot.start, slot.end) === 'completed';

return (
  <td
    key={slotIdx}
    className={`border-b border-r border-slate-800 p-2 align-top transition-colors ${
      hasBreak
        ? 'bg-amber-500/5'
        : isActive
        ? 'bg-emerald-500/5'
        : isCompleted
        ? 'opacity-50'
        : isEmpty
        ? 'bg-slate-950/30'
        : ''
    }`}
  >
    <div className="flex flex-col gap-1.5 min-h-[90px] justify-center">
      {hasBreak ? (
        /* ── Break Cell ─────────────────── */
        <div className="flex flex-col items-center justify-center py-3">
          <FiCoffee className="w-5 h-5 text-amber-500 mb-1" />
          <span className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em]">
            Break
          </span>
        </div>
      ) : lectures.length > 0 ? (
        /* ── Lecture Cell(s) ────────────── */
        lectures.map(entry => (
          <div
            key={entry.id}
            className={`rounded-xl p-3 border transition-all ${
              isActive
                ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-900/10'
                : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
            }`}
          >
            {/* Class name — medium emphasis */}
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
              <FiUsers className="w-3 h-3" />
              {entry.class_name}
            </p>

            {/* Subject name — bold/prominent */}
            <p className="text-sm font-black text-white leading-snug">
              {entry.subject_name || '—'}
            </p>

            {entry.is_substitute && (
              <span className="inline-flex mt-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                Substitute Lecture
              </span>
            )}

            {/* Batch badge */}
            {entry.batch_name && (
              <span className="inline-flex mt-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">
                {entry.batch_name}
              </span>
            )}

            {/* Take Attendance CTA — only for ongoing lectures today */}
            {isActive && (
              <Link
                to={`/teacher/take-attendance?session_id=${entry.id}&class_id=${entry.class_id}&subject_id=${entry.subject_id || ''}${entry.batch_id ? `&batch_id=${entry.batch_id}` : ''}`}
                className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 transition-all"
              >
                <FiCheckSquare className="w-3 h-3" />
                Take Attendance
              </Link>
            )}
          </div>
        ))
      ) : (
        /* ── Free Slot ──────────────────── */
        <div className="flex items-center justify-center h-full">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
            Free
          </span>
        </div>
      )}
    </div>
  </td>
);
})}
</tr>
);
})}
</tbody>
</table>
</div>
</div>
)}

{/* ── Legend ───────────────────────────────────────────────────── */}
{!loading && dynamicTimeSlots.length > 0 && (
<div className="flex flex-wrap items-center gap-5 text-xs text-slate-500 font-semibold px-1">
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
Ongoing (Today)
</div>
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded bg-amber-500/10 border border-amber-500/20" />
Break
</div>
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded bg-slate-800/50 border border-slate-700/50" />
Lecture
</div>
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded bg-slate-950/30 border border-slate-800" />
Free
</div>
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
Today
</div>
</div>
)}
</div>
);
};

export default TimetablePage;
