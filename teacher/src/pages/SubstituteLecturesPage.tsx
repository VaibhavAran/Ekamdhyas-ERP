import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiBook, FiCalendar, FiCheckCircle, FiCheckSquare, FiClock, FiInbox, FiRefreshCw, FiUsers } from 'react-icons/fi';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  collectSubjectOptions,
  fetchTeacherSchedule,
  formatTime,
  isRequestAvailable,
  slotStatus,
  todayISO,
  type LectureOverride,
  type SubstituteRequest,
  type SubjectOption,
  type TeacherScheduleEntry,
  type TimetableEntry,
} from '../utils/substituteLectures';

const StatCard = ({ label, value, icon: Icon, gradient }: { label: string; value: string | number; icon: typeof FiCalendar; gradient: string }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10">
    <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${gradient} p-3 text-white shadow-lg`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="text-3xl font-black text-white">{value}</div>
    <p className="mt-1 text-sm font-semibold text-slate-400">{label}</p>
  </div>
);

const Badge = ({ children, tone }: { children: string; tone: 'emerald' | 'blue' | 'amber' | 'slate' | 'violet' }) => {
  const map = {
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    slate: 'border-slate-700 bg-slate-800/60 text-slate-300',
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  } as const;

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${map[tone]}`}>
      {children}
    </span>
  );
};

const SubstituteLecturesPage = () => {
  const { currentUser, teacherProfile, loading: authLoading } = useAuth();
  const teacherUid = currentUser?.uid;
  const navigate = useNavigate();

  const [schedule, setSchedule] = useState<TeacherScheduleEntry[]>([]);
  const [openRequests, setOpenRequests] = useState<SubstituteRequest[]>([]);
  const [acceptedLectures, setAcceptedLectures] = useState<LectureOverride[]>([]);
  const [myRequests, setMyRequests] = useState<SubstituteRequest[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<TeacherScheduleEntry | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SubstituteRequest | null>(null);
  const [requestType, setRequestType] = useState<'unavailable_today' | 'request_substitute'>('request_substitute');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myRequestLookup = useMemo(
    () => new Map(myRequests.map((request) => [request.original_timetable_id, request])),
    [myRequests]
  );

  const loadData = async () => {
    if (!teacherUid) return;

    setLoading(true);
    setError('');

    try {
      const [scheduleData, allTimetableSnapshot, requestsSnapshot] = await Promise.all([
        fetchTeacherSchedule(db, teacherUid, todayISO()),
        getDocs(query(collection(db, 'timetable'), where('teacher_id', '==', teacherUid))),
        getDocs(query(collection(db, 'substitute_requests'), where('date', '==', todayISO()))),
      ]);

      const allRequests = requestsSnapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<SubstituteRequest, 'id'>) }));
      const availableRequests = allRequests.filter((request) => request.status === 'open' && request.original_teacher_id !== teacherUid && isRequestAvailable(request, scheduleData.scheduleEntries));
      const ownedRequests = allRequests.filter((request) => request.original_teacher_id === teacherUid && request.status === 'open');

      const allAssignedEntries = allTimetableSnapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<TimetableEntry, 'id'>) }));

      setSchedule(scheduleData.scheduleEntries);
      setSubjectOptions(collectSubjectOptions(allAssignedEntries));
      setOpenRequests(availableRequests);
      setMyRequests(ownedRequests);
      setAcceptedLectures(scheduleData.activeOverrides.filter((item) => item.replacement_teacher_id === teacherUid));
    } catch (loadError) {
      console.error('Failed to load substitute lectures:', loadError);
      setError('Unable to load substitute lecture data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [teacherUid]);

  const requestCount = openRequests.length;
  const acceptedCount = acceptedLectures.length;
  const myLectureCount = schedule.filter((entry) => !entry.is_substitute).length;
  const myOpenRequestCount = myRequests.length;

  const openRequestModal = (lecture: TeacherScheduleEntry, type: 'unavailable_today' | 'request_substitute') => {
    setSelectedLecture(lecture);
    setRequestType(type);
    setRequestModalOpen(true);
    setNotice('');
    setError('');
  };

  const submitRequest = async () => {
    if (!teacherUid || !teacherProfile || !selectedLecture) return;

    setSubmitting(true);
    setError('');
    try {
      const requestRef = doc(collection(db, 'substitute_requests'));
      await setDoc(requestRef, {
        request_id: requestRef.id,
        date: todayISO(),
        original_timetable_id: selectedLecture.id,
        class_id: selectedLecture.class_id,
        class_name: selectedLecture.class_name,
        start_time: selectedLecture.start_time,
        end_time: selectedLecture.end_time,
        original_teacher_id: teacherUid,
        original_teacher_name: teacherProfile.name,
        original_subject_id: selectedLecture.subject_id ?? '',
        original_subject_name: selectedLecture.subject_name ?? '',
        status: 'open',
        request_type: requestType,
        created_at: serverTimestamp(),
      });

      setNotice('Substitute request created.');
      setRequestModalOpen(false);
      setSelectedLecture(null);
      await loadData();
    } catch (requestError) {
      console.error('Failed to create substitute request:', requestError);
      setError('Unable to create the request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAcceptModal = (request: SubstituteRequest) => {
    setSelectedRequest(request);
    setSelectedSubjectId(subjectOptions[0]?.id ?? '');
    setAcceptModalOpen(true);
    setNotice('');
    setError('');
  };

  const acceptLecture = async () => {
    if (!teacherUid || !teacherProfile || !selectedRequest || !selectedSubjectId) return;

    const chosenSubject = subjectOptions.find((subject) => subject.id === selectedSubjectId);
    if (!chosenSubject) return;

    setSubmitting(true);
    setError('');
    try {
      const overrideRef = doc(collection(db, 'lecture_overrides'));
      await setDoc(overrideRef, {
        date: selectedRequest.date,
        original_timetable_id: selectedRequest.original_timetable_id,
        class_id: selectedRequest.class_id,
        class_name: selectedRequest.class_name,
        start_time: selectedRequest.start_time,
        end_time: selectedRequest.end_time,
        replacement_teacher_id: teacherUid,
        replacement_teacher_name: teacherProfile.name,
        replacement_subject_id: chosenSubject.id,
        replacement_subject_name: chosenSubject.name,
        status: 'active',
        type: 'teacher_substitute',
        request_id: selectedRequest.id,
        original_teacher_id: selectedRequest.original_teacher_id,
        original_teacher_name: selectedRequest.original_teacher_name,
        original_subject_id: selectedRequest.original_subject_id,
        original_subject_name: selectedRequest.original_subject_name,
        created_at: serverTimestamp(),
      });

      await updateDoc(doc(db, 'substitute_requests', selectedRequest.id), {
        status: 'accepted',
        accepted_by: teacherUid,
        accepted_at: serverTimestamp(),
      });

      setNotice('Lecture accepted successfully.');
      setAcceptModalOpen(false);
      setSelectedRequest(null);
      setSelectedSubjectId('');
      await loadData();
    } catch (acceptError) {
      console.error('Failed to accept substitute lecture:', acceptError);
      setError('Unable to accept the lecture right now.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-slate-200">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
          <FiRefreshCw className="animate-spin" />
          <span className="text-sm font-medium">Loading substitute lectures...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 text-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
            <FiCalendar className="h-3.5 w-3.5" /> Substitute Lectures
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Manage substitute lectures</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Create absence requests for your own lectures or accept open substitute slots that fit your free time.
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
        >
          <FiRefreshCw className="h-4 w-4" /> Refresh
        </button>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My lectures today" value={myLectureCount} icon={FiCalendar} gradient="from-blue-600 to-indigo-600" />
        <StatCard label="Open substitute lectures" value={requestCount} icon={FiInbox} gradient="from-emerald-600 to-teal-600" />
        <StatCard label="Accepted lectures" value={acceptedCount} icon={FiCheckSquare} gradient="from-violet-600 to-fuchsia-600" />
        <StatCard label="My open requests" value={myOpenRequestCount} icon={FiClock} gradient="from-amber-600 to-orange-600" />
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-400">
            <FiBook />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">My Today&apos;s Lectures</h2>
            <p className="text-sm text-slate-400">Mark a lecture unavailable or request a substitute for it.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {schedule.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-14 text-center text-slate-400 lg:col-span-2">
              <FiInbox className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="font-semibold">No lectures assigned for today.</p>
            </div>
          ) : (
            schedule.map((lecture) => {
              const currentStatus = slotStatus(lecture.start_time, lecture.end_time);
              const openRequest = myRequestLookup.get(lecture.id);

              return (
                <div
                  key={lecture.id}
                  className={`rounded-3xl border p-5 transition-all ${lecture.is_substitute ? 'border-violet-500/20 bg-violet-500/5' : currentStatus === 'ongoing' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
                        <FiUsers className="h-3.5 w-3.5" /> {lecture.class_name}
                      </p>
                      <h3 className="mt-2 text-lg font-black text-white">{lecture.subject_name ?? 'Subject not set'}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatTime(lecture.start_time)} - {formatTime(lecture.end_time)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {lecture.is_substitute ? <Badge tone="violet">Substitute Lecture</Badge> : <Badge tone={currentStatus === 'ongoing' ? 'emerald' : 'slate'}>{currentStatus}</Badge>}
                      {openRequest ? <Badge tone="amber">Request Open</Badge> : null}
                    </div>
                  </div>

                  {!lecture.is_substitute ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => openRequestModal(lecture, 'unavailable_today')}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                      >
                        Unavailable Today
                      </button>
                      <button
                        onClick={() => openRequestModal(lecture, 'request_substitute')}
                        className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
                      >
                        Request Substitute
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => navigate(`/teacher/take-attendance?session_id=${lecture.id}`)}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                      >
                        Take Attendance
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-400">
              <FiInbox />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Available Substitute Lectures</h2>
              <p className="text-sm text-slate-400">Open requests that do not conflict with your current schedule.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {openRequests.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-12 text-center text-slate-400">
                <FiInbox className="mx-auto mb-3 h-10 w-10 text-slate-700" />
                <p className="font-semibold">No open substitute lectures right now.</p>
              </div>
            ) : (
              openRequests.map((request) => (
                <div key={request.id} className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{request.class_name}</p>
                      <h3 className="mt-2 text-lg font-black text-white">{formatTime(request.start_time)} - {formatTime(request.end_time)}</h3>
                      <p className="mt-1 text-sm text-slate-400">{request.original_teacher_name} is unavailable</p>
                      <p className="mt-1 text-sm text-slate-500">Original subject: {request.original_subject_name || 'Not set'}</p>
                    </div>
                    <Badge tone="blue">Open</Badge>
                  </div>

                  <button
                    onClick={() => openAcceptModal(request)}
                    className="mt-4 inline-flex items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                  >
                    Take Lecture
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-400">
              <FiCheckSquare />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Accepted Lectures</h2>
              <p className="text-sm text-slate-400">Your substitute assignments for today.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {acceptedLectures.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-12 text-center text-slate-400">
                <FiInbox className="mx-auto mb-3 h-10 w-10 text-slate-700" />
                <p className="font-semibold">No accepted substitute lectures yet.</p>
              </div>
            ) : (
              acceptedLectures.map((lecture) => (
                <div key={lecture.id} className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{lecture.class_name}</p>
                      <h3 className="mt-2 text-lg font-black text-white">{lecture.replacement_subject_name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{formatTime(lecture.start_time)} - {formatTime(lecture.end_time)}</p>
                      <p className="mt-1 text-sm text-slate-500">Original teacher: {lecture.original_teacher_name}</p>
                    </div>
                    <Badge tone="violet">Substitute Lecture</Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={`/teacher/take-attendance?session_id=${lecture.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                    >
                      Take Attendance
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {requestModalOpen && selectedLecture ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/40">
            <h3 className="text-xl font-black text-white">Create substitute request</h3>
            <p className="mt-1 text-sm text-slate-400">
              {requestType === 'unavailable_today' ? 'Mark this lecture unavailable today.' : 'Request a substitute for this lecture.'}
            </p>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{selectedLecture.class_name}</p>
              <p className="mt-1">{selectedLecture.subject_name ?? 'Subject not set'}</p>
              <p className="mt-1 text-slate-500">{formatTime(selectedLecture.start_time)} - {formatTime(selectedLecture.end_time)}</p>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200">
              <FiAlertCircle className="shrink-0" />
              <span>The request will be visible to teachers who are free at this time.</span>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRequestModalOpen(false);
                  setSelectedLecture(null);
                }}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitRequest()}
                disabled={submitting}
                className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving...' : 'Save Request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {acceptModalOpen && selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/40">
            <h3 className="text-xl font-black text-white">Accept substitute lecture</h3>
            <p className="mt-1 text-sm text-slate-400">Choose one of your assigned subjects for this lecture.</p>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{selectedRequest.class_name}</p>
              <p className="mt-1">{selectedRequest.original_teacher_name} is unavailable</p>
              <p className="mt-1 text-slate-500">{formatTime(selectedRequest.start_time)} - {formatTime(selectedRequest.end_time)}</p>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-300">Select subject</label>
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-blue-500"
            >
              <option value="">Select your subject</option>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>

            {subjectOptions.length === 0 ? (
              <p className="mt-3 text-sm text-amber-300">No assigned subjects were found for your timetable.</p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setAcceptModalOpen(false);
                  setSelectedRequest(null);
                  setSelectedSubjectId('');
                }}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => void acceptLecture()}
                disabled={submitting || !selectedSubjectId}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Accepting...' : 'Accept Lecture'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SubstituteLecturesPage;
