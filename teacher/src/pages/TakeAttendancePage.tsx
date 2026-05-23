import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
FiAlertCircle,
FiCamera,
FiCheckCircle,
FiChevronLeft,
FiChevronRight,
FiEdit3,
FiLock,
FiLoader,
FiPauseCircle,
FiPlayCircle,
FiUsers,
} from 'react-icons/fi';
import {
collection,
addDoc,
doc,
getDoc,
getDocs,
query,
serverTimestamp,
setDoc,
where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
fetchTeacherSchedule,
formatTime,
todayISO,
toMinutes,
} from '../utils/substituteLectures';

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
type?: string;
}

interface Student {
uid: string;
name: string;
roll_no: string;
class_id: string;
class_name: string;
batch_id?: string | null;
batch_name?: string | null;
}

interface AttendanceRecord {
id: string;
student_id: string;
status: 'present' | 'absent';
attendance_method: 'image' | 'manual';
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
student_name?: string;
roll_no?: string;
created_at?: unknown;
updated_at?: unknown;
}

interface DetectedStudent {
student_id?: string;
student_name?: string;
roll_no?: string;
detected_at?: string;
}

type Mode = 'image' | 'manual';
type AttendanceStatus = 'present' | 'absent';
type SlotStatus = 'Upcoming' | 'Ongoing' | 'Completed';

const nowMinutes = () => {
const current = new Date();
return current.getHours() * 60 + current.getMinutes();
};

const getStatus = (start: string, end: string): SlotStatus => {
const current = nowMinutes();
const startMinutes = toMinutes(start);
const endMinutes = toMinutes(end);

if (current < startMinutes) return 'Upcoming';
if (current >= startMinutes && current < endMinutes) return 'Ongoing';
return 'Completed';
};

const sessionStatusStyles: Record<SlotStatus, string> = {
Upcoming: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
Ongoing: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
Completed: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

const TakeAttendancePage = () => {
const { currentUser, teacherProfile, loading: authLoading } = useAuth();
const navigate = useNavigate();
const [searchParams] = useSearchParams();
const teacherUid = currentUser?.uid;

const [sessions, setSessions] = useState<TimetableEntry[]>([]);
const [selectedSessionId, setSelectedSessionId] = useState('');
const [students, setStudents] = useState<Student[]>([]);
const [manualStatus, setManualStatus] = useState<Record<string, AttendanceStatus>>({});
const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([]);
const [mode, setMode] = useState<Mode>('image');
const [cameraRunning, setCameraRunning] = useState(false);
const [cameraReady, setCameraReady] = useState(false);
const [capturedImage, setCapturedImage] = useState('');
const [captureNotice, setCaptureNotice] = useState('');
const [cameraFullScreen, setCameraFullScreen] = useState(false);
const [activeAttendanceSessionId, setActiveAttendanceSessionId] = useState('');
const [imageAssistedUsed, setImageAssistedUsed] = useState(false);

const [loadingSessions, setLoadingSessions] = useState(true);
const [loadingStudents, setLoadingStudents] = useState(false);
const [sessionCompleted, setSessionCompleted] = useState(false);
const [editAttendanceEnabled, setEditAttendanceEnabled] = useState(false);
const [error, setError] = useState('');
const [notice, setNotice] = useState('');
const [sessionNotice, setSessionNotice] = useState('');

const autoProcessedRef = useRef<Set<string>>(new Set());
const videoRef = useRef<HTMLVideoElement | null>(null);
const canvasRef = useRef<HTMLCanvasElement | null>(null);
const mediaStreamRef = useRef<MediaStream | null>(null);

const pauseCameraStream = () => {
mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
mediaStreamRef.current = null;

if (videoRef.current) {
videoRef.current.srcObject = null;
}

setCameraReady(false);
setCameraRunning(false);
};

const stopCameraStream = () => {
pauseCameraStream();
setCameraFullScreen(false);
setCapturedImage('');
setCaptureNotice('');
};

useEffect(() => () => stopCameraStream(), []);

useEffect(() => {
if (!cameraRunning || !mediaStreamRef.current || !videoRef.current) return;

const videoElement = videoRef.current;
videoElement.srcObject = mediaStreamRef.current;
void videoElement.play().catch((playError) => {
console.error('Unable to start video playback:', playError);
});
}, [cameraRunning, cameraFullScreen]);

useEffect(() => {
const fetchSessions = async () => {
if (!teacherUid) return;

setLoadingSessions(true);
setError('');

try {
const scheduleData = await fetchTeacherSchedule(db, teacherUid, todayISO());
const entries = scheduleData.scheduleEntries
  .filter((item) => !item.is_break)
  .sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time));

setSessions(entries);

const requestedSessionId = searchParams.get('session_id') ?? searchParams.get('override_id') ?? '';
if (requestedSessionId && entries.some((item) => item.id === requestedSessionId)) {
  setSelectedSessionId(requestedSessionId);
} else {
  const currentSession = entries.find(
    (item) => nowMinutes() >= toMinutes(item.start_time) && nowMinutes() < toMinutes(item.end_time)
  );
  const nextSession = entries.find((item) => nowMinutes() < toMinutes(item.start_time));
  setSelectedSessionId((currentSession ?? nextSession ?? entries[0])?.id ?? '');
}
} catch (sessionError) {
console.error('Error fetching sessions:', sessionError);
setError('Unable to load your sessions for today.');
} finally {
setLoadingSessions(false);
}
};

fetchSessions();
}, [teacherUid, searchParams]);

const selectedSession = useMemo(
() => sessions.find((item) => item.id === selectedSessionId) ?? null,
[sessions, selectedSessionId]
);

const sessionKey = useMemo(() => {
if (!selectedSession) return '';
return `${selectedSession.id}_${todayISO()}`;
}, [selectedSession]);

const attendanceStarted = useMemo(
() => (mode === 'image' ? cameraRunning || detectedStudents.length > 0 : true),
[cameraRunning, detectedStudents.length, mode]
);

const canEditAttendance = !sessionCompleted || editAttendanceEnabled;

useEffect(() => {
const fetchSessionState = async () => {
if (!selectedSession || !teacherUid || !sessionKey) {
setStudents([]);
setManualStatus({});
setDetectedStudents([]);
setSessionCompleted(false);
setEditAttendanceEnabled(false);
setImageAssistedUsed(false);
return;
}

setLoadingStudents(true);
setSessionNotice('');
setNotice('');
setError('');

try {
const sessionQuery = query(
collection(db, 'attendance_sessions'),
where('teacher_id', '==', teacherUid),
where('session_id', '==', selectedSession.id),
where('class_id', '==', selectedSession.class_id),
where('subject_id', '==', selectedSession.subject_id ?? ''),
where('batch_id', '==', selectedSession.batch_id ?? ''),
where('date', '==', todayISO()),
where('start_time', '==', selectedSession.start_time),
where('end_time', '==', selectedSession.end_time)
);
const sessionSnapshot = await getDocs(sessionQuery);
const legacySessionDoc = await getDoc(doc(db, 'attendance_sessions', sessionKey));
const resolvedSessionDoc = sessionSnapshot.docs[0] ?? (legacySessionDoc.exists() ? legacySessionDoc : null);
const resolvedSessionId = resolvedSessionDoc?.id ?? sessionKey;

setActiveAttendanceSessionId(resolvedSessionId);

const resolvedSessionData = resolvedSessionDoc?.data();
const completed = resolvedSessionData?.status === 'completed';
setSessionCompleted(Boolean(completed));
setEditAttendanceEnabled(false);

const studentQuery = selectedSession.batch_id
? query(
collection(db, 'students'),
where('class_id', '==', selectedSession.class_id),
where('batch_id', '==', selectedSession.batch_id)
)
: query(collection(db, 'students'), where('class_id', '==', selectedSession.class_id));
const studentSnapshot = await getDocs(studentQuery);
const fetchedStudents = studentSnapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as Student));
setStudents(fetchedStudents);

const attendanceQuery = query(collection(db, 'attendance'), where('attendance_session_id', '==', resolvedSessionId));
let attendanceSnapshot = await getDocs(attendanceQuery);

if (attendanceSnapshot.empty) {
const legacyConstraints = [
where('teacher_id', '==', teacherUid),
where('class_id', '==', selectedSession.class_id),
where('subject_id', '==', selectedSession.subject_id ?? ''),
where('batch_id', '==', selectedSession.batch_id ?? ''),
where('date', '==', todayISO()),
where('session_time', '==', `${selectedSession.start_time}-${selectedSession.end_time}`),
];

attendanceSnapshot = await getDocs(query(collection(db, 'attendance'), ...legacyConstraints));
}

const records = attendanceSnapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<AttendanceRecord, 'id'>) }));
setImageAssistedUsed(Boolean(resolvedSessionData?.attendance_method === 'image-assisted'));

const existingStatusMap = records.reduce<Record<string, AttendanceStatus>>((accumulator, record) => {
accumulator[record.student_id] = record.status;
return accumulator;
}, {});

setManualStatus(
fetchedStudents.reduce<Record<string, AttendanceStatus>>((accumulator, student) => {
accumulator[student.uid] = existingStatusMap[student.uid] ?? 'absent';
return accumulator;
}, {})
);

setDetectedStudents([]);
autoProcessedRef.current = new Set();
} catch (sessionStateError) {
console.error('Error loading attendance state:', sessionStateError);
setError('Unable to load attendance data for this session.');
} finally {
setLoadingStudents(false);
}
};

fetchSessionState();
}, [selectedSession, teacherUid, sessionKey]);

const saveAttendanceRecord = async (
student: Student,
status: AttendanceStatus,
attendanceMethod: Mode,
resolvedSessionId = activeAttendanceSessionId || sessionKey
) => {
if (!selectedSession || !teacherUid || !teacherProfile || !resolvedSessionId) return;

const sessionTime = `${selectedSession.start_time}-${selectedSession.end_time}`;
const attendanceQuery = query(
collection(db, 'attendance'),
where('attendance_session_id', '==', resolvedSessionId),
where('student_id', '==', student.uid)
);
let attendanceSnapshot = await getDocs(attendanceQuery);

if (attendanceSnapshot.empty) {
const legacyQuery = query(
collection(db, 'attendance'),
where('teacher_id', '==', teacherUid),
where('student_id', '==', student.uid),
where('class_id', '==', selectedSession.class_id),
where('subject_id', '==', selectedSession.subject_id ?? ''),
where('batch_id', '==', selectedSession.batch_id ?? ''),
where('date', '==', todayISO()),
where('session_time', '==', sessionTime)
);
attendanceSnapshot = await getDocs(legacyQuery);
}

const existingDoc = attendanceSnapshot.docs[0] ?? null;
const attendanceRef = existingDoc?.ref ?? doc(db, 'attendance', `${resolvedSessionId}_${student.uid}`);
const existingData = existingDoc ? (existingDoc.data() as AttendanceRecord) : null;

if (existingData && existingData.status === status && existingData.attendance_method === attendanceMethod) {
return;
}

await setDoc(
attendanceRef,
{
student_id: student.uid,
student_name: student.name,
roll_no: student.roll_no,
attendance_session_id: resolvedSessionId,
teacher_id: teacherUid,
teacher_name: teacherProfile.name,
class_id: selectedSession.class_id,
class_name: selectedSession.class_name,
subject_id: selectedSession.subject_id ?? '',
subject_name: selectedSession.subject_name ?? '',
batch_id: selectedSession.batch_id ?? '',
batch_name: selectedSession.batch_name ?? '',
type: selectedSession.is_substitute ? 'teacher_substitute' : 'regular',
original_timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
date: todayISO(),
session_time: sessionTime,
time: new Date().toTimeString().slice(0, 5),
status,
attendance_method: attendanceMethod,
updated_at: serverTimestamp(),
created_at: existingData?.created_at ?? serverTimestamp(),
},
{ merge: true }
);
};

useEffect(() => {
const syncDetectedStudents = async () => {
if (!selectedSession || mode !== 'image' || detectedStudents.length === 0 || sessionCompleted) return;

for (const detectedStudent of detectedStudents) {
const student = students.find(
(item) =>
item.uid === detectedStudent.student_id ||
item.roll_no === detectedStudent.roll_no ||
item.name === detectedStudent.student_name
);

if (!student) continue;

const processedKey = `${activeAttendanceSessionId}_${student.uid}_present_image`;
if (autoProcessedRef.current.has(processedKey)) continue;
autoProcessedRef.current.add(processedKey);

setImageAssistedUsed(true);
setManualStatus((current) => ({ ...current, [student.uid]: 'present' }));
}
};

syncDetectedStudents();
}, [detectedStudents, mode, selectedSession, sessionCompleted, students, activeAttendanceSessionId]);

const updateManualStatus = async (student: Student, nextStatus: AttendanceStatus) => {
if (!canEditAttendance) return;

setManualStatus((current) => ({ ...current, [student.uid]: nextStatus }));
};

const completeAttendance = async () => {
if (!selectedSession || !teacherUid || !teacherProfile) return;

const resolvedSessionId = activeAttendanceSessionId || sessionKey;
if (!resolvedSessionId) return;

const sessionAttendanceMethod: 'manual' | 'image-assisted' = imageAssistedUsed ? 'image-assisted' : 'manual';

try {
for (const student of students) {
const status = manualStatus[student.uid] ?? 'absent';
await saveAttendanceRecord(student, status, mode, resolvedSessionId);
}

await setDoc(
doc(db, 'attendance_sessions', resolvedSessionId),
{
session_id: selectedSession.id,
timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
teacher_id: teacherUid,
teacher_name: teacherProfile.name,
class_id: selectedSession.class_id,
class_name: selectedSession.class_name,
subject_id: selectedSession.subject_id ?? '',
subject_name: selectedSession.subject_name ?? '',
batch_id: selectedSession.batch_id ?? '',
batch_name: selectedSession.batch_name ?? '',
type: selectedSession.is_substitute ? 'teacher_substitute' : 'regular',
original_timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
date: todayISO(),
start_time: selectedSession.start_time,
end_time: selectedSession.end_time,
attendance_method: sessionAttendanceMethod,
status: 'completed',
completed_at: serverTimestamp(),
updated_at: serverTimestamp(),
},
{ merge: true }
);

setSessionCompleted(true);
setEditAttendanceEnabled(false);
setCameraRunning(false);
setSessionNotice('Attendance completed');
} catch (completeError) {
console.error('Error completing attendance:', completeError);
setError('Unable to complete attendance right now.');
}
};

const selectEditAttendance = () => {
setEditAttendanceEnabled(true);
setMode('manual');
setNotice('');
setSessionNotice('');
};

const startCamera = async () => {
if (sessionCompleted && !editAttendanceEnabled) return;

try {
setImageAssistedUsed(true);
setCaptureNotice('');
setCapturedImage('');
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
mediaStreamRef.current = stream;

setCameraRunning(true);
setCameraReady(true);
setCameraFullScreen(true);
} catch (cameraError) {
console.error('Unable to start camera:', cameraError);
setError('Unable to access the camera. Please allow webcam permission.');
setCameraRunning(false);
setCameraReady(false);
}
};

const saveCapturedImage = async (imageData: string) => {
if (!selectedSession || !teacherUid || !teacherProfile) return;

await addDoc(collection(db, 'attendance_images'), {
teacher_id: teacherUid,
teacher_name: teacherProfile.name,
class_id: selectedSession.class_id,
class_name: selectedSession.class_name,
subject_id: selectedSession.subject_id ?? '',
subject_name: selectedSession.subject_name ?? '',
batch_id: selectedSession.batch_id ?? '',
batch_name: selectedSession.batch_name ?? '',
type: selectedSession.is_substitute ? 'teacher_substitute' : 'regular',
original_timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
date: todayISO(),
time: new Date().toTimeString().slice(0, 5),
captured_image: imageData,
attendance_method: 'image',
created_at: serverTimestamp(),
});
};

const captureImage = async () => {
if (!cameraReady || !videoRef.current || !canvasRef.current || !selectedSession) return;

const video = videoRef.current;
const canvas = canvasRef.current;
const context = canvas.getContext('2d');

if (!context) return;

canvas.width = video.videoWidth || 1280;
canvas.height = video.videoHeight || 720;
context.drawImage(video, 0, 0, canvas.width, canvas.height);

const imageData = canvas.toDataURL('image/jpeg', 0.9);
setCapturedImage(imageData);
pauseCameraStream();
setImageAssistedUsed(true);
setCaptureNotice('Image captured successfully. Save it, then verify the detected students in the table below.');
};

const saveCurrentCapture = async () => {
if (!capturedImage) return;

try {
await saveCapturedImage(capturedImage);
setCaptureNotice('Image saved successfully. Waiting for recognition pipeline.');
stopCameraStream();
setCapturedImage('');
setCameraFullScreen(false);
} catch (captureError) {
console.error('Failed to save captured image:', captureError);
setError('Unable to save captured image right now.');
}
};

if (authLoading || loadingSessions) {
return (
<div className="min-h-[70vh] flex items-center justify-center text-slate-200">
<div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
<FiLoader className="animate-spin" />
<span className="text-sm font-medium">Loading today's sessions...</span>
</div>
</div>
);
}

if (selectedSession && sessionCompleted && !editAttendanceEnabled) {
return (
<div className="space-y-6 pb-8 text-slate-100">
<div className="space-y-2">
<h1 className="text-3xl font-black tracking-tight text-white">Take Attendance</h1>
<p className="text-sm text-slate-400">Attendance is locked for completed sessions.</p>
</div>

<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<div>
<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
<FiCheckCircle /> Attendance Completed
</div>
<p className="mt-4 text-sm text-slate-400">Session:</p>
<p className="text-lg font-bold text-white">
{selectedSession.class_name} • {selectedSession.subject_name ?? 'Subject not set'} • {selectedSession.batch_name ?? 'Full Class'}
</p>
<p className="mt-2 text-sm text-slate-300">
{formatTime(selectedSession.start_time)} – {formatTime(selectedSession.end_time)}
</p>
<p className="mt-4 text-sm text-slate-400">Attendance has been completed for this session.</p>
</div>

<div className="flex flex-wrap gap-2">
<button
type="button"
onClick={() => selectEditAttendance()}
className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
>
<FiEdit3 /> Edit Attendance
</button>
<button
type="button"
onClick={() => navigate('/teacher/attendance-records')}
className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-200"
>
View Attendance
</button>
</div>
</div>
</section>
</div>
);
}

return (
<div className="space-y-6 pb-8 text-slate-100">
<div className="space-y-2">
<h1 className="text-3xl font-black tracking-tight text-white">Take Attendance</h1>
<p className="text-sm text-slate-400">Select a session first, then complete attendance with automatic saving.</p>
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

{sessionNotice ? (
<div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
<FiAlertCircle className="shrink-0" />
<span>{sessionNotice}</span>
</div>
) : null}

{!selectedSession ? (
<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
No assigned sessions found for today.
</div>
) : null}

{selectedSession ? (
<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-black/20">
<div className="flex flex-wrap items-center justify-between gap-3">
<div>
<p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Selected session</p>
<div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
<span>{selectedSession.class_name}</span>
<span className="text-slate-500">•</span>
<span>{selectedSession.subject_name ?? 'Subject not set'}</span>
<span className="text-slate-500">•</span>
<span>{selectedSession.batch_name ?? 'Full Class'}</span>
{selectedSession.type === 'teacher_substitute' ? (
<span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
Substitute Lecture
</span>
) : null}
</div>
<p className="mt-1 text-sm text-slate-400">
{formatTime(selectedSession.start_time)} – {formatTime(selectedSession.end_time)}
</p>
</div>

<div className="flex flex-wrap items-center gap-2">
{sessionCompleted ? (
<span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
<FiLock /> Attendance Completed
</span>
) : null}
<button
type="button"
className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200"
onClick={() => setSelectedSessionId('')}
>
Change session
<FiChevronRight className="rotate-180" />
</button>
</div>
</div>
</section>
) : null}

{!selectedSession ? (
<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
{sessions.map((session) => {
const status = getStatus(session.start_time, session.end_time);
return (
<button
key={session.id}
type="button"
onClick={() => setSelectedSessionId(session.id)}
className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-left transition hover:border-slate-700 hover:bg-slate-900"
>
<div className="flex items-start justify-between gap-3">
<div>
  <p className="text-sm font-bold text-white">{session.class_name}</p>
  <p className="mt-1 text-sm text-slate-300">{session.subject_name ?? 'Subject not set'}</p>
  <p className="mt-1 text-xs text-slate-500">{session.batch_name ?? 'Full Class'}</p>
  {session.type === 'teacher_substitute' ? (
    <p className="mt-2 inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
      Substitute Lecture
    </p>
  ) : null}
</div>
<span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${sessionStatusStyles[status]}`}>
  {status}
</span>
</div>
<div className="mt-4 flex items-center justify-between text-xs text-slate-400">
<span>
  {formatTime(session.start_time)} – {formatTime(session.end_time)}
</span>
<span className="inline-flex items-center gap-1">
  Select Session <FiChevronRight />
</span>
</div>
</button>
);
})}
</section>
) : null}

{selectedSession ? (
<section className="space-y-4">
<div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
<span className="font-semibold text-white">Session:</span>{' '}
{selectedSession.class_name} • {selectedSession.subject_name ?? 'Subject not set'} • {selectedSession.batch_name ?? 'Full Class'}
<span className="mx-2 text-slate-600">|</span>
{formatTime(selectedSession.start_time)} – {formatTime(selectedSession.end_time)}
</div>

<div className="flex flex-wrap gap-2">
<TabButton active={mode === 'image'} onClick={() => setMode('image')} icon={FiCamera} label="Image-Assisted Attendance" />
<TabButton active={mode === 'manual'} onClick={() => setMode('manual')} icon={FiUsers} label="Manual Attendance" />
</div>

{sessionCompleted && !editAttendanceEnabled ? (
<div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
<FiLock className="text-emerald-300" />
<span>Attendance is completed for this session. Use Edit Attendance to make corrections.</span>
<button
type="button"
onClick={selectEditAttendance}
className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
>
<FiEdit3 /> Edit Attendance
</button>
</div>
) : null}

{mode === 'image' ? (
<div className="space-y-4">
<ImageMode
detectedStudents={detectedStudents}
selectedSession={selectedSession}
teacherUid={teacherUid}
cameraRunning={cameraRunning}
cameraReady={cameraReady}
videoRef={videoRef}
canvasRef={canvasRef}
startCamera={startCamera}
stopCamera={stopCameraStream}
captureImage={captureImage}
locked={sessionCompleted && !editAttendanceEnabled}
attendanceStarted={attendanceStarted}
capturedImage={capturedImage}
captureNotice={captureNotice}
cameraFullScreen={cameraFullScreen}
setCameraFullScreen={setCameraFullScreen}
saveCurrentCapture={saveCurrentCapture}
/>
<ManualMode
loadingStudents={loadingStudents}
selectedSession={selectedSession}
students={students}
manualStatus={manualStatus}
onToggleStatus={updateManualStatus}
locked={sessionCompleted && !editAttendanceEnabled}
/>
</div>
) : (
<ManualMode
loadingStudents={loadingStudents}
selectedSession={selectedSession}
students={students}
manualStatus={manualStatus}
onToggleStatus={updateManualStatus}
locked={sessionCompleted && !editAttendanceEnabled}
/>
)}

{!sessionCompleted ? (
<div className="flex justify-end">
<button
type="button"
onClick={completeAttendance}
className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20"
>
<FiCheckCircle /> Save Attendance
</button>
</div>
) : null}
</section>
) : null}
</div>
);
};

const TabButton = ({
active,
onClick,
icon: Icon,
label,
}: {
active: boolean;
onClick: () => void;
icon: React.ComponentType<{ className?: string }>;
label: string;
}) => (
<button
type="button"
onClick={onClick}
className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
active
? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
: 'border-slate-700 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
}`}
>
<Icon />
{label}
</button>
);

const ImageMode = ({
detectedStudents,
selectedSession,
teacherUid,
cameraRunning,
cameraReady,
videoRef,
canvasRef,
startCamera,
stopCamera,
captureImage,
locked,
attendanceStarted,
capturedImage,
captureNotice,
cameraFullScreen,
setCameraFullScreen,
saveCurrentCapture,
}: {
detectedStudents: DetectedStudent[];
selectedSession: TimetableEntry;
teacherUid?: string;
cameraRunning: boolean;
cameraReady: boolean;
videoRef: React.RefObject<HTMLVideoElement | null>;
canvasRef: React.RefObject<HTMLCanvasElement | null>;
startCamera: () => Promise<void>;
stopCamera: () => void;
captureImage: () => Promise<void>;
locked: boolean;
attendanceStarted: boolean;
capturedImage: string;
captureNotice: string;
cameraFullScreen: boolean;
setCameraFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
saveCurrentCapture: () => Promise<void>;
}) => {
const cameraStatus = locked ? 'Attendance Completed' : cameraRunning ? 'Camera open' : 'Waiting for model...';

return (
<>
{cameraFullScreen ? (
<div className="fixed inset-0 z-50 bg-slate-950 text-slate-100">
<div className="flex h-full flex-col gap-4 p-4 sm:p-6 lg:p-8">
<div className="flex flex-wrap items-center justify-between gap-3">
<button
type="button"
onClick={() => {
stopCamera();
setCameraFullScreen(false);
}}
className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200"
>
<FiChevronLeft /> Exit Camera
</button>
<div className="text-sm text-slate-300">
<span className="font-semibold text-white">Session:</span> {selectedSession.class_name} • {selectedSession.subject_name ?? 'Subject not set'}
</div>
</div>

<div className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
{capturedImage ? (
<img
src={capturedImage}
alt="Captured attendance"
className="h-[calc(100vh-260px)] min-h-[420px] w-full rounded-2xl border border-slate-800 bg-black object-contain"
/>
) : cameraRunning ? (
<video
ref={videoRef}
className="h-[calc(100vh-260px)] min-h-[420px] w-full rounded-2xl border border-slate-800 bg-black object-cover"
autoPlay
playsInline
muted
/>
) : (
<div className="flex h-[calc(100vh-260px)] min-h-[420px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80 text-slate-500">
<div className="text-center">
<FiCamera className="mx-auto text-3xl" />
<p className="mt-3 text-sm">Camera is ready</p>
</div>
</div>
)}
</div>

<canvas ref={canvasRef} className="hidden" />

<div className="flex flex-wrap gap-3">
{!capturedImage ? (
<>
<button
type="button"
onClick={captureImage}
disabled={locked || !cameraReady}
className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
>
<FiCamera /> Capture Image
</button>
<button
type="button"
onClick={stopCamera}
disabled={locked}
className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
>
<FiPauseCircle /> Stop Camera
</button>
</>
) : (
<>
<button
type="button"
onClick={() => {
  void startCamera();
}}
disabled={locked}
className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
>
Retake Image
</button>
<button
type="button"
onClick={saveCurrentCapture}
disabled={locked}
className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
>
Save Image
</button>
</>
)}
</div>

{captureNotice ? (
<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
{captureNotice}
</div>
) : null}

{locked ? (
<div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
Session completed. Use Edit Attendance to make corrections.
</div>
) : null}
</div>
</div>
) : null}

{!cameraFullScreen ? (
<div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
<div className="flex items-center justify-between gap-3">
<div>
<h3 className="text-lg font-bold text-white">Image-Assisted Attendance</h3>
<p className="mt-1 text-sm text-slate-400">Capture the classroom image, then let the model prefill the manual table.</p>
</div>
<span className={`rounded-full border px-3 py-1 text-xs font-semibold ${locked ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : cameraRunning ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-950/60 text-slate-300'}`}>
{cameraStatus}
</span>
</div>

<div className="mt-4 rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 p-6">
{capturedImage ? (
<div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-slate-400">
<div className="text-center">
<FiCamera className="mx-auto text-3xl" />
<p className="mt-3 text-sm">Captured image preview</p>
</div>
</div>
) : cameraRunning ? (
<div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-slate-400">
<div className="text-center">
<FiCamera className="mx-auto text-3xl" />
<p className="mt-3 text-sm">Camera running in full-screen mode</p>
</div>
</div>
) : (
<div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-500">
<div className="text-center">
<FiCamera className="mx-auto text-3xl" />
<p className="mt-3 text-sm">Camera preview area</p>
</div>
</div>
)}

<div className="mt-4 flex flex-wrap gap-3">
{!cameraRunning ? (
<button
type="button"
onClick={startCamera}
disabled={locked}
className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
>
<FiPlayCircle /> Start Camera
</button>
) : (
<>
<button
type="button"
onClick={captureImage}
disabled={locked || !cameraReady}
className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
>
<FiCamera /> Capture Image
</button>
<button
type="button"
onClick={stopCamera}
disabled={locked}
className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
>
<FiPauseCircle /> Stop Camera
</button>
</>
)}
</div>

{!cameraRunning ? (
<p className="mt-3 text-sm text-slate-400">Start the camera to open the webcam preview.</p>
) : null}
<p className="mt-3 text-sm text-slate-400">
{locked
? 'Session is completed. Use Edit Attendance to adjust records manually.'
: 'Capture an image to prefill the manual table, then verify and save once.'}
</p>
</div>
</div>

<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
<h3 className="text-lg font-bold text-white">Live Detected Students</h3>
<p className="mt-1 text-sm text-slate-400">Detected faces are saved automatically. Duplicate detections are ignored.</p>

<div className="mt-4 space-y-3">
{detectedStudents.length === 0 ? (
<EmptyState text="Waiting for students from the future Python service..." />
) : (
detectedStudents.map((student, index) => (
<div key={`${student.roll_no ?? 'student'}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
<div className="flex items-start justify-between gap-3">
<div>
  <p className="text-sm font-bold text-white">✓ {student.student_name ?? 'Unknown student'}</p>
  <p className="mt-1 text-xs text-slate-400">{student.roll_no ?? 'Roll number pending'}</p>
</div>
<span className="text-xs text-slate-500">{student.detected_at ?? '--:--'}</span>
</div>
</div>
))
)}
</div>

<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
Teacher UID: <span className="text-slate-200">{teacherUid ?? 'Not available'}</span>
</div>
<div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
Selected session: <span className="text-slate-200">{selectedSession.class_name}</span>
<span className="mx-2 text-slate-600">•</span>
<span className="text-slate-200">{attendanceStarted ? 'Attendance started' : 'Not started'}</span>
</div>
{captureNotice ? (
<div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
{captureNotice}
</div>
) : null}
</div>
</div>
) : null}
</>
);
};

const ManualMode = ({
loadingStudents,
selectedSession,
students,
manualStatus,
onToggleStatus,
locked,
}: {
loadingStudents: boolean;
selectedSession: TimetableEntry;
students: Student[];
manualStatus: Record<string, AttendanceStatus>;
onToggleStatus: (student: Student, nextStatus: AttendanceStatus) => void;
locked: boolean;
}) => {
return (
<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
<div className="flex items-center justify-between gap-3">
<div>
<h3 className="text-lg font-bold text-white">Manual Attendance</h3>
<p className="mt-1 text-sm text-slate-400">
{selectedSession.batch_id ? 'Batch students only.' : 'Full class students only.'} Changes stay local until Save Attendance.
</p>
</div>
<span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
{locked ? 'Locked' : 'Editable'}
</span>
</div>

{loadingStudents ? (
<div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-5 text-sm text-slate-400">
<FiLoader className="animate-spin" /> Loading students...
</div>
) : students.length === 0 ? (
<div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-sm text-slate-400">
No students found for this session.
</div>
) : (
<div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
<div className="grid grid-cols-[1.6fr_1fr_auto] gap-0 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
<span>Student Name</span>
<span>Roll Number</span>
<span>Status</span>
</div>
<div className="divide-y divide-slate-800 bg-slate-950/50">
{students.map((student) => {
const status = manualStatus[student.uid] ?? 'absent';
return (
<div key={student.uid} className="grid grid-cols-[1.6fr_1fr_auto] items-center gap-0 px-4 py-3 text-sm">
<div>
  <p className="font-semibold text-white">{student.name}</p>
</div>
<div className="text-slate-300">{student.roll_no}</div>
<button
  type="button"
  disabled={locked}
  onClick={() => onToggleStatus(student, status === 'present' ? 'absent' : 'present')}
  className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
    status === 'present'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      : 'border-slate-700 bg-slate-950/60 text-slate-300'
  }`}
>
  {status === 'present' ? 'Present' : 'Absent'}
</button>
</div>
);
})}
</div>
</div>
)}
{locked ? (
<div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
<FiLock /> Attendance is completed. Use Edit Attendance to change records.
</div>
) : null}
</div>
);
};

const EmptyState = ({ text }: { text: string }) => (
<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
{text}
</div>
);

export default TakeAttendancePage;