import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiEdit3,
  FiLock,
  FiLoader,
  FiUsers,
} from "react-icons/fi";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { fetchTeacherSchedule, formatTime, todayISO, toMinutes } from "../utils/substituteLectures";

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

type AttendanceStatus = "present" | "absent";
type AttendanceMethod = "manual";

const nowMinutes = () => {
  const current = new Date();
  return current.getHours() * 60 + current.getMinutes();
};

const sessionIdFor = (session: TimetableEntry) => `${session.id}_${todayISO()}`;

const TakeAttendancePage = () => {
  const { currentUser, teacherProfile, loading: authLoading } = useAuth();
  const teacherUid = currentUser?.uid;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<TimetableEntry[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [manualStatus, setManualStatus] = useState<Record<string, AttendanceStatus>>({});
  
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [editAttendanceEnabled, setEditAttendanceEnabled] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");

  const selectedSession = useMemo(
    () => sessions.find((item) => item.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const sessionKey = useMemo(() => {
    if (!selectedSession) return "";
    return sessionIdFor(selectedSession);
  }, [selectedSession]);

  const canEditAttendance = !sessionCompleted || editAttendanceEnabled;

  useEffect(() => {
    const fetchSessions = async () => {
      if (!teacherUid) return;
      setLoadingSessions(true);
      setError("");

      try {
        const scheduleData = await fetchTeacherSchedule(db, teacherUid, todayISO());
        const entries = scheduleData.scheduleEntries
          .filter((item) => !item.is_break)
          .sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time));

        setSessions(entries);

        const requestedSessionId = searchParams.get("session_id") ?? searchParams.get("override_id") ?? "";
        if (requestedSessionId && entries.some((item) => item.id === requestedSessionId)) {
          setSelectedSessionId(requestedSessionId);
        } else {
          const currentSession = entries.find((item) => nowMinutes() >= toMinutes(item.start_time) && nowMinutes() < toMinutes(item.end_time));
          const nextSession = entries.find((item) => nowMinutes() < toMinutes(item.start_time));
          setSelectedSessionId((currentSession ?? nextSession ?? entries[0])?.id ?? "");
        }
      } catch (sessionError) {
        console.error("Error fetching sessions:", sessionError);
        setError("Unable to load your sessions for today.");
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [teacherUid, searchParams]);

  useEffect(() => {
    const fetchSessionState = async () => {
      if (!selectedSession || !teacherUid || !sessionKey) {
        setStudents([]);
        setManualStatus({});
        setSessionCompleted(false);
        setEditAttendanceEnabled(false);
        return;
      }

      setLoadingStudents(true);
      setSessionNotice("");
      setNotice("");
      setError("");

      try {
        const sessionDoc = await getDoc(doc(db, "attendance_sessions", sessionKey));
        const sessionData = sessionDoc.exists() ? sessionDoc.data() : null;
        setSessionCompleted(sessionData?.status === "completed");
        setEditAttendanceEnabled(false);

        const studentQuery = selectedSession.batch_id
          ? query(collection(db, "students"), where("class_id", "==", selectedSession.class_id), where("batch_id", "==", selectedSession.batch_id))
          : query(collection(db, "students"), where("class_id", "==", selectedSession.class_id));
        const studentSnapshot = await getDocs(studentQuery);
        const fetchedStudents = studentSnapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as Student);
        setStudents(fetchedStudents);

        const attendanceSnapshot = await getDocs(
          query(collection(db, "attendance"), where("attendance_session_id", "==", sessionKey)),
        );
        const existingStatusMap = attendanceSnapshot.docs.reduce<Record<string, AttendanceStatus>>((acc, item) => {
          const data = item.data() as { student_id?: string; status?: AttendanceStatus };
          if (data.student_id) acc[data.student_id] = data.status ?? "absent";
          return acc;
        }, {});

        setManualStatus(
          fetchedStudents.reduce<Record<string, AttendanceStatus>>((acc, student) => {
            acc[student.uid] = existingStatusMap[student.uid] ?? "absent";
            return acc;
          }, {}),
        );
      } catch (sessionStateError) {
        console.error("Error loading attendance state:", sessionStateError);
        setError("Unable to load attendance data for this session.");
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchSessionState();
  }, [selectedSession, teacherUid, sessionKey]);

  const saveAttendanceRecord = async (student: Student, status: AttendanceStatus, attendanceMethod: AttendanceMethod) => {
    if (!selectedSession || !teacherUid || !teacherProfile || !sessionKey) return;

    await setDoc(
      doc(db, "attendance", `${sessionKey}_${student.uid}`),
      {
        student_id: student.uid,
        student_name: student.name,
        roll_no: student.roll_no,
        attendance_session_id: sessionKey,
        teacher_id: teacherUid,
        teacher_name: teacherProfile.name,
        class_id: selectedSession.class_id,
        class_name: selectedSession.class_name,
        subject_id: selectedSession.subject_id ?? "",
        subject_name: selectedSession.subject_name ?? "",
        batch_id: selectedSession.batch_id ?? "",
        batch_name: selectedSession.batch_name ?? "",
        type: selectedSession.is_substitute ? "teacher_substitute" : "regular",
        original_timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
        date: todayISO(),
        session_time: `${selectedSession.start_time}-${selectedSession.end_time}`,
        time: new Date().toTimeString().slice(0, 5),
        status,
        attendance_method: attendanceMethod,
        verified_by_teacher: true,
        updated_at: serverTimestamp(),
        created_at: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const updateManualStatus = async (student: Student, nextStatus: AttendanceStatus) => {
    if (!canEditAttendance) return;
    setManualStatus((current) => ({ ...current, [student.uid]: nextStatus }));
  };

  const completeAttendance = async () => {
    if (savingAttendance) return;

    if (!selectedSession) {
      setError("Please select a session before saving attendance.");
      return;
    }

    if (!teacherUid || !teacherProfile) {
      setError("Teacher profile not loaded. Please re-login and try again.");
      return;
    }

    if (students.length === 0) {
      setError("No students found for this session. Cannot save attendance.");
      return;
    }

    const attendanceMethod: AttendanceMethod = "manual";
    try {
      setSavingAttendance(true);
      setError("");
      for (const student of students) {
        const status = manualStatus[student.uid] ?? "absent";
        await saveAttendanceRecord(student, status, attendanceMethod);
      }

      await setDoc(
        doc(db, "attendance_sessions", sessionKey),
        {
          id: selectedSession.id,
          teacher_id: teacherUid,
          teacher_name: teacherProfile.name,
          class_id: selectedSession.class_id,
          class_name: selectedSession.class_name,
          subject_id: selectedSession.subject_id ?? "",
          subject_name: selectedSession.subject_name ?? "",
          batch_id: selectedSession.batch_id ?? "",
          batch_name: selectedSession.batch_name ?? "",
          date: todayISO(),
          start_time: selectedSession.start_time,
          end_time: selectedSession.end_time,
          status: "completed",
          attendance_method: attendanceMethod,
          completed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          type: selectedSession.is_substitute ? "teacher_substitute" : "regular",
          original_timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
        },
        { merge: true },
      );

      setSessionCompleted(true);
      setEditAttendanceEnabled(false);
      setNotice("Attendance successfully saved.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (saveError) {
      console.error("Failed to save attendance:", saveError);
      setError("Failed to save attendance. Please try again.");
    } finally {
      setSavingAttendance(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4 text-indigo-600">
          <FiLoader className="animate-spin text-5xl" />
          <p className="font-bold tracking-widest uppercase">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!teacherUid) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center text-slate-500">
        <FiLock className="mb-4 text-5xl opacity-20" />
        <h2 className="mb-2 text-xl font-bold text-slate-700">Authentication Required</h2>
        <p>Please log in to access the attendance portal.</p>
        <button onClick={() => navigate("/login")} className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white transition-all hover:bg-indigo-700 active:scale-95">
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-500 pb-20">
      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <button onClick={() => navigate(-1)} className="group mb-2 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
            <FiChevronLeft className="transition-transform group-hover:-translate-x-1" /> Back
          </button>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Take Attendance</h1>
        </div>
      </div>

      {(error || notice || sessionNotice) && (
        <div className="mb-8 space-y-4">
          {error && (
            <div className="flex items-start gap-4 rounded-2xl bg-rose-50 p-5 text-rose-700 border border-rose-100 shadow-sm animate-in slide-in-from-top-4">
              <FiAlertCircle className="mt-1 flex-shrink-0 text-xl" />
              <div>
                <h3 className="font-bold">Attention Required</h3>
                <p className="mt-1 text-sm font-medium opacity-90">{error}</p>
              </div>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-4 rounded-2xl bg-emerald-50 p-5 text-emerald-700 border border-emerald-100 shadow-sm animate-in slide-in-from-top-4">
              <FiCheckCircle className="mt-1 flex-shrink-0 text-xl" />
              <div>
                <h3 className="font-bold">Success</h3>
                <p className="mt-1 text-sm font-medium opacity-90">{notice}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {loadingSessions ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white py-24 text-slate-400 shadow-sm">
          <FiLoader className="mb-4 animate-spin text-4xl text-indigo-600" />
          <p className="font-bold uppercase tracking-widest">Loading Today's Sessions</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white py-24 text-center text-slate-500 shadow-sm px-6">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
            <FiUsers className="text-4xl text-slate-300" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-800">No Sessions Found</h3>
          <p className="max-w-md font-medium">You don't have any classes scheduled for today. Take a break or check tomorrow's timetable.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="mb-4 block text-sm font-black uppercase tracking-widest text-slate-400">Select Current Session</label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => {
                const isActive = session.id === selectedSessionId;
                const status = sessionCompleted && isActive ? "completed" : "pending";
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`flex flex-col items-start rounded-2xl border-2 p-5 text-left transition-all ${isActive ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100" : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    <div className="mb-3 flex w-full items-start justify-between">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider ${isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {formatTime(session.start_time)}
                      </span>
                      {status === "completed" && isActive && <FiCheckCircle className="text-emerald-500 text-lg" />}
                    </div>
                    <div className={`font-bold ${isActive ? "text-indigo-900" : "text-slate-800"} mb-1`}>{session.class_name}</div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <span className="truncate">{session.subject_name || "N/A"}</span>
                      {session.batch_name && (
                        <span className="flex-shrink-0 rounded bg-slate-200/50 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">Batch {session.batch_name}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedSession && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900">{selectedSession.class_name}</h2>
                    {selectedSession.batch_name && <span className="rounded-lg bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-700 border border-indigo-200 shadow-sm shadow-indigo-100">Batch {selectedSession.batch_name}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> {selectedSession.subject_name}</span>
                    <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> {formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {sessionCompleted && !editAttendanceEnabled ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-1.5 border border-slate-200">
                      <span className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600"><FiLock /> Locked</span>
                      <button onClick={() => setEditAttendanceEnabled(true)} className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-600 shadow-sm border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                        <FiEdit3 /> Edit
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={completeAttendance}
                      disabled={savingAttendance || students.length === 0}
                      className="group flex w-full md:w-auto items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {savingAttendance ? <FiLoader className="animate-spin text-xl" /> : <FiCheckCircle className="text-xl transition-transform group-hover:scale-110" />}
                      {savingAttendance ? "Saving..." : sessionCompleted ? "Update Attendance" : "Submit Attendance"}
                    </button>
                  )}
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                  <FiLoader className="mb-4 animate-spin text-4xl text-indigo-600" />
                  <p className="font-bold uppercase tracking-widest">Loading Class Roster</p>
                </div>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200">
                    <FiUsers className="text-2xl text-slate-300" />
                  </div>
                  <p className="font-bold">No students registered in this class.</p>
                </div>
              ) : (
                <div className="mt-8">
                  <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <FiUsers className="text-indigo-600" /> Class Roster
                      <span className="ml-2 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-600">{students.length} Total</span>
                    </div>
                    {canEditAttendance && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          const allPresent = students.reduce((acc, s) => ({ ...acc, [s.uid]: "present" }), {});
                          setManualStatus(allPresent);
                        }} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors">Mark All Present</button>
                        <button onClick={() => {
                          const allAbsent = students.reduce((acc, s) => ({ ...acc, [s.uid]: "absent" }), {});
                          setManualStatus(allAbsent);
                        }} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm border border-slate-200 hover:border-rose-300 hover:text-rose-700 transition-colors">Mark All Absent</button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {students.map((student) => {
                      const isPresent = manualStatus[student.uid] === "present";
                      const statusColor = isPresent ? "bg-emerald-500" : "bg-rose-500";
                      const borderColor = isPresent ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white";

                      return (
                        <div
                          key={student.uid}
                          onClick={() => canEditAttendance && updateManualStatus(student, isPresent ? "absent" : "present")}
                          className={`group flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${canEditAttendance ? "cursor-pointer hover:border-indigo-300 hover:shadow-md" : "opacity-90"} ${borderColor}`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm transition-colors ${statusColor}`}>
                              {student.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{student.name}</div>
                              <div className="truncate text-xs font-bold font-mono text-slate-500">{student.roll_no}</div>
                            </div>
                          </div>
                          
                          <div className="flex shrink-0 items-center gap-2">
                            {canEditAttendance ? (
                              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-inner">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateManualStatus(student, "present"); }}
                                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${isPresent ? "bg-white text-emerald-600 shadow-sm border border-slate-200/50 scale-105" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                  P
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateManualStatus(student, "absent"); }}
                                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${!isPresent ? "bg-white text-rose-600 shadow-sm border border-slate-200/50 scale-105" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                  A
                                </button>
                              </div>
                            ) : (
                              <span className={`rounded-lg px-3 py-1 text-xs font-black uppercase tracking-wider ${isPresent ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                {isPresent ? "Present" : "Absent"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TakeAttendancePage;
