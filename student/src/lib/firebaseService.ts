import { collection, doc, getDoc, getDocs, query, setDoc, where, addDoc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import type { User, AttendanceRecord, NotificationItem, AttendanceSessionDoc, TimetableEntryDoc, LectureOverrideDoc, StudentTimetableEntry, StudentTimetableView } from '../types';

const getMillis = (value: unknown) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
};

const formatTimestamp = (value: unknown) => {
  const millis = getMillis(value);
  if (!millis) return 'Recently';
  return new Date(millis).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const normalizeStatus = (status: unknown) => {
  if (typeof status !== 'string') return 'absent';
  return status.toLowerCase() === 'present' ? 'present' : 'absent';
};

const getStatusLabel = (status: unknown) => (normalizeStatus(status) === 'present' ? 'Present' : 'Absent');

const toSubjectName = (entry: { subject_name?: string | null; subject_id?: string | null }, subjectMap: Map<string, string>) => {
  if (entry.subject_name) return entry.subject_name;
  if (entry.subject_id && subjectMap.has(entry.subject_id)) return subjectMap.get(entry.subject_id) || 'Unknown';
  return 'Unknown';
};

const todayISO = () => new Date().toISOString().split('T')[0];

const todayName = (dateValue = new Date()) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateValue.getDay()];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatTime = (time: string) => {
  if (!time) return '';
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText} ${period}`;
};

const formatRange = (start: string, end: string) => `${formatTime(start)} - ${formatTime(end)}`;

const sameDay = (a?: string, b?: string | null) => Boolean(a && b && a === b);

const mergeStudentTimetable = (
  timetableEntries: TimetableEntryDoc[],
  overrides: LectureOverrideDoc[],
  subjectMap: Map<string, string>
) => {
  const overrideMap = new Map<string, LectureOverrideDoc>();
  overrides.forEach((override) => overrideMap.set(override.original_timetable_id, override));

  return timetableEntries
    .map((entry) => {
      const override = overrideMap.get(entry.id);
      const subjectName = override?.replacement_subject_name || toSubjectName(entry, subjectMap);
      const teacherName = override?.replacement_teacher_name || entry.teacher_name || 'Teacher unavailable';

      return {
        id: override?.id || entry.id,
        day: entry.day,
        start_time: override?.start_time || entry.start_time,
        end_time: override?.end_time || entry.end_time,
        subject_name: entry.is_break ? 'BREAK' : subjectName,
        teacher_name: entry.is_break ? '' : teacherName,
        room: entry.class_name || entry.batch_name || '',
        is_break: Boolean(entry.is_break),
        is_substitute: Boolean(override),
        original_timetable_id: override?.original_timetable_id,
        substitute_badge: override ? 'Substitute Lecture' : '',
      } as StudentTimetableEntry;
    })
    .sort((left, right) => {
      const dayCompare = left.day.localeCompare(right.day);
      if (dayCompare !== 0) return dayCompare;
      return toMinutes(left.start_time) - toMinutes(right.start_time);
    });
};

export const registerWithEmail = async (email: string, password: string) => {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    console.error('Error registering with Firebase Auth:', error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    console.error('Error signing in with Firebase Auth:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out from Firebase Auth:', error);
    throw error;
  }
};

export const saveUser = async (user: User) => {
  try {
    const userRef = doc(db, 'students', user.id);
    await setDoc(userRef, { ...user, updatedAt: Timestamp.now() }, { merge: true });
    return userRef.id;
  } catch (error) {
    console.error('Error saving user to Firestore:', error);
    throw error;
  }
};

export const getNotificationsForStudent = async (studentId: string) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const byRole = query(notificationsRef, where('role', '==', 'student'));
    const byTarget = query(notificationsRef, where('target_student_id', '==', studentId));

    const [snapRole, snapTarget] = await Promise.all([getDocs(byRole), getDocs(byTarget)]);
    const hits: any[] = [];
    snapRole.forEach(d => hits.push({ id: d.id, ...(d.data() as any) }));
    snapTarget.forEach(d => hits.push({ id: d.id, ...(d.data() as any) }));

    // Deduplicate by id
    const map: Record<string, any> = {};
    hits.forEach(h => { map[h.id] = h; });
    return Object.values(map).map((notification: any) => ({
      id: notification.id,
      sender: notification.sender || notification.created_by || 'System',
      role: notification.role === 'teacher' ? 'teacher' : 'admin',
      title: notification.title || 'Notification',
      message: notification.message || '',
      timestamp: formatTimestamp(notification.created_at || notification.timestamp),
      isRead: Array.isArray(notification.read_by) ? notification.read_by.includes(studentId) : Boolean(notification.isRead),
      category: notification.category || 'academic',
    } as NotificationItem));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const getTimeTableForClass = async (classId: string, batchId?: string | null): Promise<TimetableEntryDoc[]> => {
  try {
    const ttRef = collection(db, 'timetable');
    const q = query(ttRef, where('class_id', '==', classId));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) } as TimetableEntryDoc))
      .filter(entry => !batchId || !entry.batch_id || entry.batch_id === batchId)
      .sort((left, right) => {
        const dayCompare = (left.day || '').localeCompare(right.day || '');
        if (dayCompare !== 0) return dayCompare;
        return left.start_time.localeCompare(right.start_time);
      });
  } catch (error) {
    console.error('Error fetching timetable:', error);
    return [];
  }
};

export const getStudentTimetable = async (
  classId: string,
  batchId?: string | null,
  dateValue = todayISO()
): Promise<StudentTimetableView> => {
  try {
    const [timetableSnap, overrideSnap, subjectSnap] = await Promise.all([
      getDocs(query(collection(db, 'timetable'), where('class_id', '==', classId))),
      getDocs(query(collection(db, 'lecture_overrides'), where('date', '==', dateValue), where('status', '==', 'active'), where('type', '==', 'teacher_substitute'))),
      getDocs(collection(db, 'subjects')),
    ]);

    const subjectMap = new Map<string, string>();
    subjectSnap.docs.forEach((item) => {
      const data = item.data() as any;
      subjectMap.set(item.id, data.name || data.subject_name || '');
    });

    const timetableEntries = timetableSnap.docs
      .map((item) => ({ id: item.id, ...(item.data() as any) } as TimetableEntryDoc))
      .filter((entry) => !batchId || !entry.batch_id || entry.batch_id === batchId);

    const overrides = overrideSnap.docs
      .map((item) => ({ id: item.id, ...(item.data() as any) } as LectureOverrideDoc))
      .filter((override) => override.class_id === classId && (!batchId || sameDay(override.date, dateValue)));

    const timetable = mergeStudentTimetable(timetableEntries, overrides, subjectMap);
    const slots = Array.from(new Set(timetable.map((entry) => `${entry.start_time}|${entry.end_time}`)))
      .map((slot) => {
        const [start, end] = slot.split('|');
        return `${start}|${end}`;
      })
      .sort((left, right) => {
        const [leftStart] = left.split('|');
        const [rightStart] = right.split('|');
        return toMinutes(leftStart) - toMinutes(rightStart);
      });

    const today = todayName(new Date(`${dateValue}T00:00:00`));
    const todayClasses = timetable.filter((entry) => entry.day === today);

    return { timetable, todayClasses, slots, todayName: today };
  } catch (error) {
    console.error('Error fetching student timetable:', error);
    return { timetable: [], todayClasses: [], slots: [], todayName: todayName() };
  }
};

export const getSubjects = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'subjects'));
    return snapshot.docs.map((item) => ({ id: item.id, name: item.data().name || item.data().subject_name || '' }));
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return [];
  }
};

export const getAttendanceSessionsForStudent = async (classId: string, batchId?: string | null): Promise<AttendanceSessionDoc[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'attendance_sessions'), where('class_id', '==', classId)));
    return snapshot.docs
      .map((item) => ({ id: item.id, ...(item.data() as any) } as AttendanceSessionDoc))
      .filter((entry) => !batchId || !entry.batch_id || entry.batch_id === batchId)
      .sort((left, right) => getMillis(right.date || right.completed_at || right.created_at) - getMillis(left.date || left.completed_at || left.created_at));
  } catch (error) {
    console.error('Error fetching attendance sessions:', error);
    return [];
  }
};

export const getAttendanceDocsForStudent = async (studentId: string) => {
  try {
    const attendanceRef = collection(db, 'attendance');
    const [snapByStudent, snapByUser] = await Promise.all([
      getDocs(query(attendanceRef, where('student_id', '==', studentId))),
      getDocs(query(attendanceRef, where('userId', '==', studentId))),
    ]);

    const map: Record<string, any> = {};
    [...snapByStudent.docs, ...snapByUser.docs].forEach((item) => {
      map[item.id] = {
        id: item.id,
        ...item.data(),
        status: getStatusLabel(item.data().status),
      };
    });

    return Object.values(map);
  } catch (error) {
    console.error('Error fetching attendance docs:', error);
    return [];
  }
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('email', '==', email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const userDoc = snapshot.docs[0];
    const data = userDoc.data() as any;
    return {
      id: userDoc.id,
      name: data.name || '',
      email: data.email || '',
      role: data.role || 'student',
      rollNumber: data.roll_no || data.rollNumber || '',
      department: data.department_name || data.department || '',
      class: data.class_name || data.class || '',
      semester: data.semester || '',
      academicYear: data.academicYear || '',
      // include raw fields for downstream usage
      roll_no: data.roll_no,
      department_id: data.department_id,
      department_name: data.department_name,
      class_id: data.class_id,
      class_name: data.class_name,
      batch_id: data.batch_id,
      batch_name: data.batch_name,
      status: data.status,
    } as unknown as User;
  } catch (error) {
    console.error('Error fetching user from Firestore:', error);
    return null;
  }
};

export const getUserById = async (id: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'students', id);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as any;
    return {
      id: snapshot.id,
      name: data.name || '',
      email: data.email || '',
      role: data.role || 'student',
      rollNumber: data.roll_no || data.rollNumber || '',
      department: data.department_name || data.department || '',
      class: data.class_name || data.class || '',
      semester: data.semester || '',
      academicYear: data.academicYear || '',
      roll_no: data.roll_no,
      department_id: data.department_id,
      department_name: data.department_name,
      class_id: data.class_id,
      class_name: data.class_name,
      batch_id: data.batch_id,
      batch_name: data.batch_name,
      status: data.status,
    } as unknown as User;
  } catch (error) {
    console.error('Error fetching user by id from Firestore:', error);
    return null;
  }
};

export const addAttendanceRecord = async (
  userId: string,
  attendance: Omit<AttendanceRecord, 'id'>
) => {
  try {
    const attendanceRef = collection(db, 'attendance');
    const docRef = await addDoc(attendanceRef, {
      userId,
      ...attendance,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving attendance record to Firestore:', error);
    throw error;
  }
};

export const getAttendanceRecords = async (userId: string): Promise<AttendanceRecord[]> => {
  try {
    const attendanceRef = collection(db, 'attendance');
    const q1 = query(attendanceRef, where('userId', '==', userId));
    const q2 = query(attendanceRef, where('student_id', '==', userId));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const map: Record<string, any> = {};
    snap1.forEach(d => map[d.id] = { id: d.id, ...(d.data() as any) });
    snap2.forEach(d => map[d.id] = { id: d.id, ...(d.data() as any) });

    const records = Object.values(map) as any[];
    const sessionIds = Array.from(new Set(records.map((record) => record.attendance_session_id || record.session_id || record.sessionId).filter(Boolean)));
    const sessionsMap: Record<string, any> = {};
    const subjectIds = new Set<string>();

    if (sessionIds.length > 0) {
      const sessionSnaps = await Promise.all(sessionIds.map((sessionId) => getDoc(doc(db, 'attendance_sessions', sessionId))));
      sessionSnaps.forEach((sessionSnap) => {
        if (!sessionSnap.exists()) return;
        const sessionData = sessionSnap.data() as any;
        sessionsMap[sessionSnap.id] = sessionData;
        if (sessionData.subject_id) subjectIds.add(sessionData.subject_id);
      });
    }

    const subjectsMap: Record<string, string> = {};
    if (subjectIds.size > 0) {
      const subjectSnaps = await Promise.all(Array.from(subjectIds).map((subjectId) => getDoc(doc(db, 'subjects', subjectId))));
      subjectSnaps.forEach((subjectSnap) => {
        if (!subjectSnap.exists()) return;
        const subjectData = subjectSnap.data() as any;
        subjectsMap[subjectSnap.id] = subjectData.name || subjectData.subject_name || '';
      });
    }

    return records.map((record) => {
      const sessionId = record.attendance_session_id || record.session_id || record.sessionId;
      const session = sessionId ? sessionsMap[sessionId] : null;
      const subjectName = session?.subject_name || (session?.subject_id ? subjectsMap[session.subject_id] : '') || record.subject || 'Unknown';
      const startTime = session?.start_time || record.start_time || '';
      const endTime = session?.end_time || record.end_time || '';

      return {
        id: record.id,
        date: record.date || session?.date || record.created_at || '',
        subject: subjectName,
        subject_name: subjectName,
        attendance_session_id: sessionId,
        start_time: startTime,
        end_time: endTime,
        slot_time: startTime && endTime ? `${startTime} - ${endTime}` : record.slot_time || '',
        class_id: record.class_id || session?.class_id,
        batch_id: record.batch_id || session?.batch_id,
        status: record.status,
      } as AttendanceRecord;
    });
  } catch (error) {
    console.error('Error fetching attendance records from Firestore:', error);
    return [];
  }
};
