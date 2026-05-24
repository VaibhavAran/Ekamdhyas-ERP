import React from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  MapPin,
  User as UserIcon,
  Calendar,
  BadgeCheck,
} from 'lucide-react';
import type { User as UserType, StudentTimetableEntry, StudentTimetableView } from '../types';
import { getStudentTimetable } from '../lib/firebaseService';

interface TimeTableProps {
  user?: UserType | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const formatDisplayTime = (value: string) => {
  if (!value) return '';
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText} ${period}`;
};

const slotKey = (start: string, end: string) => `${start}|${end}`;

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const getCurrentDay = () => new Date().toLocaleDateString(undefined, { weekday: 'long' });

const getNowMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const isCurrentSlot = (start: string, end: string) => {
  const now = getNowMinutes();
  return now >= toMinutes(start) && now < toMinutes(end);
};

const getCellStyles = (entry?: StudentTimetableEntry, isTodayRow?: boolean, isNow?: boolean) => {
  if (!entry) {
    return 'border border-dashed border-gray-100 bg-white/60 text-gray-300';
  }

  if (entry.is_break) {
    return 'border border-amber-100 bg-amber-50 text-amber-700';
  }

  if (entry.is_substitute) {
    return 'border border-violet-100 bg-violet-50 text-violet-700';
  }

  if (isNow) {
    return 'border border-blue-200 bg-blue-50 text-blue-700 shadow-sm';
  }

  if (isTodayRow) {
    return 'border border-blue-100 bg-blue-50/40 text-gray-800';
  }

  return 'border border-gray-100 bg-white text-gray-800';
};

const TimeTable: React.FC<TimeTableProps> = ({ user }) => {
  const [view, setView] = React.useState<StudentTimetableView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let mounted = true;

    const loadTimetable = async () => {
      if (!user) {
        if (mounted) {
          setView(null);
          setLoading(false);
          setError('Timetable unavailable');
        }
        return;
      }

      const classId = user.class_id || '';
      const batchId = user.batch_id || null;

      if (!classId) {
        if (mounted) {
          setView(null);
          setLoading(false);
          setError('Timetable unavailable');
        }
        return;
      }

      if (mounted) {
        setLoading(true);
        setError('');
      }

      try {
        const data = await getStudentTimetable(classId, batchId);
        if (mounted) {
          setView(data);
        }
      } catch (fetchError) {
        console.error('Error loading timetable', fetchError);
        if (mounted) {
          setView(null);
          setError('Timetable unavailable');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadTimetable();

    return () => {
      mounted = false;
    };
  }, [user]);

  const currentDay = view?.todayName || getCurrentDay();
  const slots = view?.slots ?? [];
  const timetable = view?.timetable ?? [];
  const todayClasses = view?.todayClasses ?? [];
  const timeSlotLabels = slots.map((entry) => {
    const [start, end] = entry.split('|');
    return { key: entry, label: `${formatDisplayTime(start)} - ${formatDisplayTime(end)}` };
  });

  const findEntryForCell = (day: string, slot: string) => {
    const [start, end] = slot.split('|');
    return timetable.find((entry) => entry.day === day && entry.start_time === start && entry.end_time === end);
  };

  const nowSlotKey = React.useMemo(() => {
    const todayEntries = timetable.filter((entry) => entry.day === currentDay);
    const active = todayEntries.find((entry) => isCurrentSlot(entry.start_time, entry.end_time));
    return active ? slotKey(active.start_time, active.end_time) : '';
  }, [currentDay, timetable]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Time Table</h1>
          <p className="text-gray-500 mt-1">Weekly timetable for your class and batch.</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Today's Classes</h2>
            <p className="text-sm text-gray-500 mt-1">Live lectures for {currentDay}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
            <Calendar className="h-4 w-4" />
            {todayClasses.length} lectures
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : todayClasses.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {todayClasses
              .slice()
              .sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time))
              .map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-2xl border p-4 ${entry.is_break ? 'border-amber-100 bg-amber-50' : entry.is_substitute ? 'border-violet-100 bg-violet-50' : 'border-gray-100 bg-gray-50/70'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                      <Clock className="h-4 w-4" />
                      {formatDisplayTime(entry.start_time)} - {formatDisplayTime(entry.end_time)}
                    </div>
                    {entry.is_substitute ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
                        Substitute Lecture
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-gray-900">
                    {entry.subject_name || 'Lecture'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    {entry.is_break ? 'Break' : entry.teacher_name || 'Teacher unavailable'}
                  </p>
                  {entry.room ? (
                    <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {entry.room}
                    </p>
                  ) : null}
                </div>
              ))}
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-gray-500">
            No lectures scheduled today.
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Weekly Timetable</h2>
            <p className="text-sm text-gray-500 mt-1">Horizontal timetable with days and time slots</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <BadgeCheck className="h-4 w-4 text-blue-500" />
            Read only
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-gray-500">
            {error}
          </div>
        ) : loading ? (
          <div className="grid gap-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : slots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-white px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100">
                    Day
                  </th>
                  {timeSlotLabels.map((slot) => (
                    <th key={slot.key} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 whitespace-nowrap">
                      {slot.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => {
                  const isToday = day === currentDay;
                  return (
                    <tr key={day}>
                      <td
                        className={`sticky left-0 z-10 px-4 py-4 align-top border-b border-gray-100 whitespace-nowrap ${isToday ? 'bg-blue-50/70' : 'bg-white'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isToday ? 'bg-blue-600' : 'bg-gray-300'}`} />
                          <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                            {day}
                          </span>
                          {isToday ? (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                              Today
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {slots.map((slot) => {
                        const entry = findEntryForCell(day, slot);
                        const [start, end] = slot.split('|');
                        const activeNow = isToday && nowSlotKey === slot;
                        const cellStyles = getCellStyles(entry, isToday, activeNow);

                        return (
                          <td key={`${day}-${slot}`} className="align-top border-b border-gray-100 px-2 py-3">
                            <div className={`relative min-h-28 rounded-2xl p-3 transition-all ${cellStyles}`}>
                              {entry ? (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                                      <Clock className="h-3.5 w-3.5" />
                                      {formatDisplayTime(start)} - {formatDisplayTime(end)}
                                    </div>
                                    {activeNow ? (
                                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                                        Now
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 space-y-1">
                                    <h3 className={`text-sm font-bold ${entry.is_break ? 'text-amber-700' : entry.is_substitute ? 'text-violet-700' : 'text-gray-900'}`}>
                                      {entry.subject_name}
                                    </h3>
                                    {!entry.is_break ? (
                                      <>
                                        <p className="text-xs text-gray-500">{entry.teacher_name || 'Teacher unavailable'}</p>
                                        {entry.room ? <p className="text-xs text-gray-500">{entry.room}</p> : null}
                                      </>
                                    ) : (
                                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Break</p>
                                    )}
                                  </div>
                                  {entry.is_substitute ? (
                                    <div className="mt-3 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
                                      Substitute Lecture
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="flex h-full min-h-28 items-center justify-center text-center text-xs text-gray-300">
                                  No lecture
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
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center text-gray-500">
            Timetable unavailable
          </div>
        )}
      </section>
    </div>
  );
};

export default TimeTable;
