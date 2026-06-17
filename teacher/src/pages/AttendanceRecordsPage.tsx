import { useEffect, useMemo, useState } from 'react';
import {
FiAlertCircle,
FiCheckCircle,
FiFilter,
FiLoader,
} from 'react-icons/fi';
import {
collection,
doc,
getDocs,
query,
serverTimestamp,
setDoc,
where,
type DocumentData,
type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

type AttendanceStatus = 'present' | 'absent';
type AttendanceMethod = 'manual';

interface AttendanceSessionRecord {
id: string;
teacher_id: string;
teacher_name?: string;
session_id?: string;
class_id: string;
class_name: string;
subject_id?: string;
subject_name?: string;
batch_id?: string;
batch_name?: string;
date?: string;
start_time: string;
end_time: string;
status?: string;
attendance_method?: AttendanceMethod;
duplicate_count?: number;
completed_at?: unknown;
updated_at?: unknown;
type?: string;
original_timetable_id?: string;
}

interface TeacherStudent {
uid: string;
name: string;
roll_no: string;
class_id: string;
class_name?: string;
batch_id?: string | null;
batch_name?: string | null;
}

interface AttendanceRecord {
id: string;
student_id: string;
student_name?: string;
roll_no?: string;
attendance_session_id?: string;
teacher_id?: string;
teacher_name?: string;
class_id?: string;
class_name?: string;
subject_id?: string;
subject_name?: string;
batch_id?: string;
batch_name?: string;
date?: string;
session_time?: string;
status: AttendanceStatus;
attendance_method: AttendanceMethod;
created_at?: unknown;
updated_at?: unknown;
}

interface AttendanceRow {
id: string;
student_id: string;
student_name: string;
roll_no: string;
status: AttendanceStatus;
attendance_method: AttendanceMethod;
attendance_session_id: string;
recordId?: string;
}

const formatDate = (value?: string) => {
if (!value) return 'Date not set';
const parsed = new Date(value);
if (Number.isNaN(parsed.getTime())) return value;
return parsed.toLocaleDateString(undefined, {
weekday: 'short',
year: 'numeric',
month: 'short',
day: 'numeric',
});
};

const formatTime = (time: string) => {
const [hourText, minuteText] = time.split(':');
const hour = Number(hourText);
const period = hour >= 12 ? 'PM' : 'AM';
const displayHour = hour % 12 || 12;
return `${displayHour}:${minuteText} ${period}`;
};

const normalizeAttendanceDocs = (docs: QueryDocumentSnapshot<DocumentData, DocumentData>[]) =>
docs.map((item) => ({ id: item.id, ...(item.data() as Omit<AttendanceRecord, 'id'>) }));

const buildSessionSignature = (session: AttendanceSessionRecord) =>
[
session.session_id ?? session.id,
session.class_id,
session.subject_id ?? '',
session.batch_id ?? '',
session.date ?? '',
session.start_time,
session.end_time,
].join('|');

const AttendanceRecordsPage = () => {
const { currentUser, teacherProfile, loading: authLoading } = useAuth();
const teacherUid = currentUser?.uid;

const [sessions, setSessions] = useState<AttendanceSessionRecord[]>([]);
const [loadingSessions, setLoadingSessions] = useState(true);
const [loadingDetails, setLoadingDetails] = useState(false);
const [error, setError] = useState('');
const [notice, setNotice] = useState('');

const [classFilter, setClassFilter] = useState('all');
const [subjectFilter, setSubjectFilter] = useState('all');
const [batchFilter, setBatchFilter] = useState('all');
const [dateFilter, setDateFilter] = useState('');
const [sessionTimeFilter, setSessionTimeFilter] = useState('');

const [selectedSessionId, setSelectedSessionId] = useState('');
const [selectedRows, setSelectedRows] = useState<AttendanceRow[]>([]);
const [updatingStudentId, setUpdatingStudentId] = useState('');

const selectedSession = useMemo(
() => sessions.find((session) => session.id === selectedSessionId) ?? null,
[sessions, selectedSessionId]
);

const uniqueClasses = useMemo(
() => Array.from(new Map(sessions.map((session) => [session.class_id, session.class_name])).entries()),
[sessions]
);

const uniqueSubjects = useMemo(() => {
const entries = sessions
.filter((session) => session.subject_id)
.map((session) => [session.subject_id as string, session.subject_name ?? 'Unnamed subject'] as const);
return Array.from(new Map(entries).entries());
}, [sessions]);

const uniqueBatches = useMemo(() => {
const entries = sessions
.filter((session) => session.batch_id)
.map((session) => [session.batch_id as string, session.batch_name ?? 'Batch not named'] as const);
return Array.from(new Map(entries).entries());
}, [sessions]);

const uniqueDates = useMemo(() => {
return Array.from(new Set(sessions.map((session) => session.date).filter((date): date is string => Boolean(date))));
}, [sessions]);

const uniqueSessionTimes = useMemo(() => {
const entries = sessions
.filter((session) => (dateFilter ? session.date === dateFilter : true))
.map((session) => [
`${session.start_time}-${session.end_time}`,
`${formatTime(session.start_time)} - ${formatTime(session.end_time)}`,
] as const);

return Array.from(new Map(entries).entries());
}, [dateFilter, sessions]);

const filteredSessions = useMemo(() => {
return sessions.filter((session) => {
if (classFilter !== 'all' && session.class_id !== classFilter) return false;
if (subjectFilter !== 'all' && (session.subject_id ?? '') !== subjectFilter) return false;
if (batchFilter !== 'all' && (session.batch_id ?? '') !== batchFilter) return false;
if (dateFilter && (session.date ?? '') !== dateFilter) return false;
if (sessionTimeFilter && `${session.start_time}-${session.end_time}` !== sessionTimeFilter) return false;
return true;
});
}, [batchFilter, classFilter, dateFilter, sessionTimeFilter, sessions, subjectFilter]);

useEffect(() => {
if (filteredSessions.length === 0) {
if (selectedSessionId) {
setSelectedSessionId('');
setSelectedRows([]);
}
return;
}

if (!filteredSessions.some((session) => session.id === selectedSessionId)) {
setSelectedSessionId(filteredSessions[0].id);
}
}, [filteredSessions, selectedSessionId]);

const loadSessions = async () => {
if (!teacherUid) return;

setLoadingSessions(true);
setError('');

try {
const snapshot = await getDocs(
query(collection(db, 'attendance_sessions'), where('teacher_id', '==', teacherUid), where('status', '==', 'completed'))
);

const grouped = new Map<
string,
AttendanceSessionRecord & { duplicate_count: number }
>();

snapshot.docs.forEach((item) => {
const session = { id: item.id, ...item.data() } as AttendanceSessionRecord;
const signature = buildSessionSignature(session);
const existing = grouped.get(signature);

if (existing) {
existing.duplicate_count += 1;
return;
}

grouped.set(signature, {
...session,
duplicate_count: 1,
});
});

const records = Array.from(grouped.values());

records.sort((left, right) => {
const leftDate = `${left.date ?? ''} ${left.start_time ?? ''}`;
const rightDate = `${right.date ?? ''} ${right.start_time ?? ''}`;
return rightDate.localeCompare(leftDate);
});

setSessions(records);
setSelectedSessionId((current) => current || records[0]?.id || '');
} catch (sessionError) {
console.error('Failed to load attendance sessions:', sessionError);
setError('Unable to load attendance records right now.');
} finally {
setLoadingSessions(false);
}
};

useEffect(() => {
void loadSessions();
}, [teacherUid]);

const loadSessionDetails = async (sessionId: string) => {
if (!teacherUid) return;

const session = sessions.find((item) => item.id === sessionId);
if (!session) return;

setLoadingDetails(true);
setError('');
setNotice('');

try {
const attendanceSnapshot = await getDocs(
query(
collection(db, 'attendance'),
where('teacher_id', '==', teacherUid),
where('class_id', '==', session.class_id),
where('subject_id', '==', session.subject_id ?? ''),
where('batch_id', '==', session.batch_id ?? ''),
where('date', '==', session.date ?? ''),
where('session_time', '==', `${session.start_time}-${session.end_time}`)
)
);

const attendanceRecords = normalizeAttendanceDocs(attendanceSnapshot.docs);

const studentQuery = session.batch_id
? query(
collection(db, 'students'),
where('class_id', '==', session.class_id),
where('batch_id', '==', session.batch_id)
)
: query(collection(db, 'students'), where('class_id', '==', session.class_id));

const studentSnapshot = await getDocs(studentQuery);
const roster = studentSnapshot.docs.map((item) => ({ uid: item.id, ...(item.data() as Omit<TeacherStudent, 'uid'>) }));

const attendanceMap = new Map(attendanceRecords.map((record) => [record.student_id, record]));
const mergedRows = roster.map<AttendanceRow>((student) => {
const matchedRecord = attendanceMap.get(student.uid);
return {
id: `${session.id}_${student.uid}`,
student_id: student.uid,
student_name: student.name,
roll_no: student.roll_no,
status: matchedRecord?.status ?? 'absent',
attendance_method: matchedRecord?.attendance_method ?? 'manual',
attendance_session_id: session.id,
recordId: matchedRecord?.id,
};
});

const extraRows = attendanceRecords
.filter((record) => !roster.some((student) => student.uid === record.student_id))
.map<AttendanceRow>((record) => ({
id: `${session.id}_${record.student_id}`,
student_id: record.student_id,
student_name: record.student_name ?? 'Unknown student',
roll_no: record.roll_no ?? '—',
status: record.status,
attendance_method: record.attendance_method,
attendance_session_id: session.id,
recordId: record.id,
}));

setSelectedRows([...mergedRows, ...extraRows]);
setSelectedSessionId(sessionId);
} catch (detailsError) {
console.error('Failed to load attendance details:', detailsError);
setError('Unable to open attendance details.');
} finally {
setLoadingDetails(false);
}
};

useEffect(() => {
if (!selectedSessionId || sessions.length === 0) return;
void loadSessionDetails(selectedSessionId);
}, [selectedSessionId, sessions]);

const upsertAttendance = async (row: AttendanceRow, nextStatus: AttendanceStatus) => {
if (!selectedSession || !teacherUid || !teacherProfile) return;

setUpdatingStudentId(row.student_id);
setError('');

try {
const sessionTime = `${selectedSession.start_time}-${selectedSession.end_time}`;
const attendanceQuery = query(
collection(db, 'attendance'),
where('attendance_session_id', '==', selectedSession.id),
where('student_id', '==', row.student_id)
);

let attendanceSnapshot = await getDocs(attendanceQuery);

if (attendanceSnapshot.empty) {
const legacyQuery = query(
collection(db, 'attendance'),
where('teacher_id', '==', teacherUid),
where('student_id', '==', row.student_id),
where('class_id', '==', selectedSession.class_id),
where('subject_id', '==', selectedSession.subject_id ?? ''),
where('batch_id', '==', selectedSession.batch_id ?? ''),
where('date', '==', selectedSession.date ?? ''),
where('session_time', '==', sessionTime)
);
attendanceSnapshot = await getDocs(legacyQuery);
}

const existingDoc = attendanceSnapshot.docs[0] ?? null;
const attendanceRef = existingDoc?.ref ?? doc(db, 'attendance', `${selectedSession.id}_${row.student_id}`);
const createdAt = existingDoc?.data()?.created_at ?? serverTimestamp();

await setDoc(
attendanceRef,
{
student_id: row.student_id,
student_name: row.student_name,
roll_no: row.roll_no,
attendance_session_id: selectedSession.id,
teacher_id: teacherUid,
teacher_name: teacherProfile.name,
class_id: selectedSession.class_id,
class_name: selectedSession.class_name,
subject_id: selectedSession.subject_id ?? '',
subject_name: selectedSession.subject_name ?? '',
batch_id: selectedSession.batch_id ?? '',
batch_name: selectedSession.batch_name ?? '',
date: selectedSession.date ?? '',
session_time: sessionTime,
status: nextStatus,
attendance_method: row.attendance_method,
created_at: createdAt,
updated_at: serverTimestamp(),
},
{ merge: true }
);

setSelectedRows((current) =>
current.map((item) =>
item.student_id === row.student_id
? { ...item, status: nextStatus, attendance_method: row.attendance_method, recordId: existingDoc?.id ?? item.recordId }
: item
)
);

setNotice(`Updated ${row.student_name}'s attendance automatically.`);
} catch (saveError) {
console.error('Failed to update attendance record:', saveError);
setError('Unable to update attendance right now.');
} finally {
setUpdatingStudentId('');
}
};

const selectedSessionLabel = selectedSession
? `${selectedSession.class_name} • ${selectedSession.subject_name ?? 'Subject not set'} • ${selectedSession.batch_name ?? 'Full Class'}`
: 'Select a session to view details';

if (authLoading || loadingSessions) {
return (
<div className="flex min-h-[70vh] items-center justify-center text-slate-200">
<div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
<FiLoader className="animate-spin" />
<span className="text-sm font-medium">Loading attendance records...</span>
</div>
</div>
);
}

return (
<div className="space-y-6 pb-8 text-slate-100">
<div className="space-y-2">
<h1 className="text-3xl font-black tracking-tight text-white">Attendance Records</h1>
<p className="text-sm text-slate-400">Review only your own completed sessions and edit attendance inline.</p>
</div>

{error ? (
<div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
<FiAlertCircle className="shrink-0" />
<span>{error}</span>
</div>
) : null}

{notice ? (
<div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
<FiCheckCircle className="shrink-0" />
<span>{notice}</span>
</div>
) : null}

<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
<div className="flex items-center gap-3">
<div className="rounded-2xl bg-blue-500/10 p-3 text-blue-400">
<FiFilter />
</div>
<div>
<h2 className="text-lg font-bold text-white">Filters</h2>
<p className="text-sm text-slate-400">Narrow completed sessions by class, subject, batch, or date.</p>
</div>
</div>

<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
<FilterSelect label="Class" allLabel="All Classes" value={classFilter} onChange={setClassFilter} options={uniqueClasses.map(([value, label]) => ({ value, label }))} />
<FilterSelect label="Subject" allLabel="All Subjects" value={subjectFilter} onChange={setSubjectFilter} options={uniqueSubjects.map(([value, label]) => ({ value, label }))} />
<FilterSelect label="Batch" allLabel="All Batches" value={batchFilter} onChange={setBatchFilter} options={uniqueBatches.map(([value, label]) => ({ value, label }))} />
<FilterSelect
label="Date"
allLabel="All Dates"
value={dateFilter}
onChange={(value) => {
  setDateFilter(value);
  setSessionTimeFilter('');
}}
options={uniqueDates.map((date) => ({ value: date, label: formatDate(date) }))}
/>
<FilterSelect
label="Slot Time"
allLabel="All Slots"
value={sessionTimeFilter}
onChange={setSessionTimeFilter}
options={uniqueSessionTimes.map(([value, label]) => ({ value, label }))}
/>
</div>
</section>

{selectedSession ? (
<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
<div>
<h2 className="text-lg font-bold text-white">Attendance Details</h2>
<p className="mt-1 text-sm text-slate-400">{selectedSessionLabel}</p>
<div className="mt-3">
<span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-100">
✍️ Manual Attendance
</span>
{selectedSession.type === 'teacher_substitute' ? (
<span className="ml-2 inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
Substitute Lecture
</span>
) : null}
</div>
</div>
<div className="flex flex-wrap gap-2">
<span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
{selectedSession.date ? formatDate(selectedSession.date) : 'Date not set'}
</span>
<span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
{formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}
</span>
<span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
{selectedRows.length} student{selectedRows.length === 1 ? '' : 's'}
</span>
</div>
</div>

{loadingDetails ? (
<div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-5 text-sm text-slate-400">
<FiLoader className="animate-spin" /> Loading attendance details...
</div>
) : selectedRows.length === 0 ? (
<div className="mt-5 rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-14 text-center text-slate-400">
No attendance records found for this session.
</div>
) : (
<div className="mt-5 overflow-hidden rounded-3xl border border-slate-800">
<div className="grid grid-cols-[1.6fr_0.8fr_1fr] gap-0 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
<span>Student</span>
<span>Roll No</span>
<span>Status</span>
</div>
<div className="divide-y divide-slate-800 bg-slate-950/50">
{selectedRows.map((row) => (
<div key={row.id} className="grid grid-cols-[1.6fr_0.8fr_1fr] items-center gap-0 px-4 py-4 text-sm">
  <div>
    <p className="font-semibold text-white">{row.student_name}</p>
  </div>
  <div className="text-slate-300">{row.roll_no}</div>
  <div className="flex items-center justify-end gap-2">
    <StatusToggle
      value={row.status}
      disabled={updatingStudentId === row.student_id}
      onChange={(nextStatus) => void upsertAttendance(row, nextStatus)}
    />
  </div>
</div>
))}
</div>
</div>
)}
</section>
) : (
<section className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-slate-400">
<p className="text-base font-semibold text-slate-200">No attendance records found</p>
<p className="mt-2 text-sm">Adjust the filters to load a completed session.</p>
</section>
)}
</div>
);
};

const FilterSelect = ({
label,
allLabel,
value,
onChange,
options,
}: {
label: string;
allLabel: string;
value: string;
onChange: (value: string) => void;
options: Array<{ value: string; label: string }>;
}) => (
<div>
<label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</label>
<select
value={value}
onChange={(event) => onChange(event.target.value)}
className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-500/40"
>
<option value="all">{allLabel}</option>
{options.map((option) => (
<option key={option.value} value={option.value}>
{option.label}
</option>
))}
</select>
</div>
);

const StatusToggle = ({
value,
disabled,
onChange,
}: {
value: AttendanceStatus;
disabled: boolean;
onChange: (value: AttendanceStatus) => void;
}) => (
<div className="inline-flex rounded-2xl border border-slate-800 bg-slate-900/80 p-1">
<button
type="button"
disabled={disabled}
onClick={() => onChange('present')}
className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
value === 'present' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
}`}
>
Present
</button>
<button
type="button"
disabled={disabled}
onClick={() => onChange('absent')}
className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
value === 'absent' ? 'bg-rose-500/15 text-rose-300' : 'text-slate-400 hover:text-slate-200'
}`}
>
Absent
</button>
</div>
);

export default AttendanceRecordsPage;
