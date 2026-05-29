import { collection, getDocs, query, where, type DocumentData, type Firestore, type QueryDocumentSnapshot } from 'firebase/firestore';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export interface TimetableEntry {
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
}

export interface LectureOverride {
  id: string;
  date: string;
  original_timetable_id: string;
  class_id: string;
  class_name: string;
  start_time: string;
  end_time: string;
  replacement_teacher_id: string;
  replacement_teacher_name: string;
  replacement_subject_id: string;
  replacement_subject_name: string;
  status: 'active' | 'cancelled';
  type: 'teacher_substitute';
  request_id?: string;
  original_teacher_id?: string;
  original_teacher_name?: string;
  original_subject_id?: string;
  original_subject_name?: string;
  created_at?: unknown;
}

export interface SubstituteRequest {
  id: string;
  request_id?: string;
  date: string;
  original_timetable_id: string;
  class_id: string;
  class_name: string;
  start_time: string;
  end_time: string;
  original_teacher_id: string;
  original_teacher_name: string;
  original_subject_id: string;
  original_subject_name: string;
  status: 'open' | 'accepted' | 'cancelled';
  accepted_by?: string;
  accepted_at?: unknown;
  request_type?: 'unavailable_today' | 'request_substitute';
  created_at?: unknown;
}

export interface SubjectOption {
  id: string;
  name: string;
}

export interface TeacherScheduleEntry extends TimetableEntry {
  is_substitute?: boolean;
  original_timetable_id?: string;
  substitute_override_id?: string;
}

export const todayISO = () => new Date().toISOString().split('T')[0];

export const todayName = (dateValue = new Date()) => DAYS[dateValue.getDay()];

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const formatTime = (time: string) => {
  if (!time) return '';
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText} ${period}`;
};

export const slotStatus = (start: string, end: string) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (currentMinutes < startMinutes) return 'upcoming' as const;
  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return 'ongoing' as const;
  return 'completed' as const;
};

export const hasTimeConflict = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) => leftStart < rightEnd && leftEnd > rightStart;

export const mapOverrideToScheduleEntry = (override: LectureOverride): TeacherScheduleEntry => ({
  id: override.id,
  class_id: override.class_id,
  class_name: override.class_name,
  subject_id: override.replacement_subject_id,
  subject_name: override.replacement_subject_name,
  teacher_id: override.replacement_teacher_id,
  teacher_name: override.replacement_teacher_name,
  day: todayName(new Date(`${override.date}T00:00:00`)),
  start_time: override.start_time,
  end_time: override.end_time,
  is_break: false,
  is_substitute: true,
  original_timetable_id: override.original_timetable_id,
  substitute_override_id: override.id,
});

export const mergeTeacherSchedule = (
  timetableEntries: TimetableEntry[],
  activeOverrides: LectureOverride[],
  teacherId: string
): TeacherScheduleEntry[] => {
  const overriddenIds = new Set(activeOverrides.map((override) => override.original_timetable_id));
  const visibleLectures = timetableEntries
    .filter((entry) => !overriddenIds.has(entry.id))
    .map((entry) => ({ ...entry }));

  const substituteLectures = activeOverrides
    .filter((override) => override.replacement_teacher_id === teacherId)
    .map(mapOverrideToScheduleEntry);

  return [...visibleLectures, ...substituteLectures].sort(
    (left, right) => toMinutes(left.start_time) - toMinutes(right.start_time)
  );
};

export const collectSubjectOptions = (entries: TimetableEntry[]): SubjectOption[] => {
  const subjects = new Map<string, string>();

  entries.forEach((entry) => {
    if (entry.subject_id) {
      subjects.set(entry.subject_id, entry.subject_name ?? 'Unnamed subject');
    }
  });

  return Array.from(subjects.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const isRequestAvailable = (
  request: SubstituteRequest,
  scheduleEntries: TeacherScheduleEntry[]
) => !scheduleEntries.some((entry) => hasTimeConflict(entry.start_time, entry.end_time, request.start_time, request.end_time));

export const fetchTeacherSchedule = async (
  db: Firestore,
  teacherId: string,
  dateValue = todayISO(),
  options?: { includeAllTimetableDays?: boolean }
) => {
  const day = todayName(new Date(`${dateValue}T00:00:00`));

  const timetableQuery = options?.includeAllTimetableDays
    ? query(collection(db, 'timetable'), where('teacher_id', '==', teacherId))
    : query(
        collection(db, 'timetable'),
        where('teacher_id', '==', teacherId),
        where('day', '==', day)
      );

  const timetableSnapshot = await getDocs(timetableQuery);

  let overrideSnapshot = null;
  try {
    overrideSnapshot = await getDocs(
      query(
        collection(db, 'lecture_overrides'),
        where('date', '==', dateValue),
        where('status', '==', 'active'),
        where('type', '==', 'teacher_substitute')
      )
    );
  } catch (error) {
    console.error('Error fetching lecture overrides:', error);
  }

  const timetableEntries = timetableSnapshot.docs.map((item: QueryDocumentSnapshot<DocumentData, DocumentData>) => ({
    id: item.id,
    ...(item.data() as Omit<TimetableEntry, 'id'>),
  }));

  const activeOverrides = overrideSnapshot
    ? overrideSnapshot.docs.map((item: QueryDocumentSnapshot<DocumentData, DocumentData>) => ({
        id: item.id,
        ...(item.data() as Omit<LectureOverride, 'id'>),
      })) as LectureOverride[]
    : [];

  return {
    timetableEntries,
    activeOverrides,
    scheduleEntries: mergeTeacherSchedule(timetableEntries, activeOverrides, teacherId),
    subjectOptions: collectSubjectOptions(timetableEntries),
  };
};
