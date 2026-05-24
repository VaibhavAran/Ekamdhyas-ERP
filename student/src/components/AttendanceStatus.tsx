import React from 'react';
import { motion } from 'motion/react';
import {
  Calendar as CalendarIcon,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Percent,
  History,
  TrendingUp,
} from 'lucide-react';
import type { AttendanceRecord } from '../types';

type DateRangeFilter = '7' | '30' | '90' | 'all';

interface AttendanceStatusProps {
  attendanceRecords: AttendanceRecord[];
}

const formatDisplayDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || 'Date unavailable';

  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatSlotTime = (record: AttendanceRecord) => {
  if (record.slot_time) return record.slot_time;
  if (record.start_time && record.end_time) return `${record.start_time} - ${record.end_time}`;
  return 'Time unavailable';
};

const normalizeStatus = (status: unknown) => {
  const value = typeof status === 'string' ? status.toLowerCase() : '';
  if (value === 'present') return 'Present';
  if (value === 'late') return 'Late';
  return 'Absent';
};

const getStatusStyles = (status: string) => {
  if (status === 'Present') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Late') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
};

const getProgressColor = (percentage: number) => {
  if (percentage > 75) return 'bg-emerald-500';
  if (percentage >= 65) return 'bg-amber-500';
  return 'bg-rose-500';
};

const getWarningState = (percentage: number) => {
  if (percentage >= 75) {
    return {
      label: 'Attendance Safe',
      description: 'You are above the required threshold.',
      tone: 'safe',
    };
  }

  if (percentage >= 70) {
    return {
      label: 'Warning: Attendance close to shortage',
      description: 'Keep attending regularly to stay above the threshold.',
      tone: 'warning',
    };
  }

  return {
    label: 'Critical: Attendance below required threshold',
    description: 'Your attendance needs immediate attention.',
    tone: 'critical',
  };
};

const AttendanceStatus: React.FC<AttendanceStatusProps> = ({ attendanceRecords }) => {
  const [dateRange, setDateRange] = React.useState<DateRangeFilter>('30');

  const filteredRecords = React.useMemo(() => {
    const now = new Date();
    const rangeDays = dateRange === 'all' ? null : Number(dateRange);

    return attendanceRecords
      .filter((record) => {
        if (!record.date || rangeDays === null) return true;
        const parsed = new Date(record.date);
        if (Number.isNaN(parsed.getTime())) return true;

        const diffDays = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= rangeDays;
      })
      .sort((left, right) => {
        const leftDate = new Date(left.date || 0).getTime();
        const rightDate = new Date(right.date || 0).getTime();
        return rightDate - leftDate;
      });
  }, [attendanceRecords, dateRange]);

  const uniqueSubjects = React.useMemo(() => {
    const seen = new Map<string, AttendanceRecord[]>();

    filteredRecords.forEach((record) => {
      const subjectName = record.subject_name || record.subject || 'Unknown';
      const existing = seen.get(subjectName) || [];
      existing.push(record);
      seen.set(subjectName, existing);
    });

    return Array.from(seen.entries()).map(([subject, records]) => {
      const present = records.filter((item) => normalizeStatus(item.status) === 'Present').length;
      const total = records.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        subject,
        present,
        total,
        percentage,
      };
    });
  }, [filteredRecords]);

  const totalLectures = filteredRecords.length;
  const presentCount = filteredRecords.filter((record) => normalizeStatus(record.status) === 'Present').length;
  const absentCount = filteredRecords.filter((record) => normalizeStatus(record.status) === 'Absent').length;
  const overallPercentage = totalLectures > 0 ? Math.round((presentCount / totalLectures) * 100) : 0;
  const warningState = getWarningState(overallPercentage);

  const summaryCards = [
    {
      label: 'Overall Attendance %',
      value: `${overallPercentage}%`,
      icon: Percent,
      tone: 'bg-blue-500',
    },
    {
      label: 'Present Count',
      value: `${presentCount} Present`,
      icon: CheckCircle2,
      tone: 'bg-emerald-500',
    },
    {
      label: 'Absent Count',
      value: `${absentCount} Absent`,
      icon: XCircle,
      tone: 'bg-rose-500',
    },
    {
      label: 'Total Lectures',
      value: `${totalLectures} Lectures`,
      icon: CalendarIcon,
      tone: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Record</h1>
        <p className="text-gray-500 mt-1">Detailed view of your daily and subject-wise attendance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{card.label}</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`rounded-xl p-3 text-white ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Recent History</h2>
                <p className="text-sm text-gray-500 mt-1">Live attendance records from Firestore</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={dateRange}
                  onChange={(event) => setDateRange(event.target.value as DateRangeFilter)}
                  className="text-xs font-medium bg-gray-50 border-none rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Slot Time</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record, index) => {
                      const status = normalizeStatus(record.status);
                      return (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="hover:bg-gray-50/50 transition-colors duration-200"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 rounded-lg">
                                <CalendarIcon className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-900">{formatDisplayDate(record.date)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gray-50 rounded-lg">
                                <BookOpen className="h-4 w-4 text-gray-500" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-gray-700">{record.subject_name || record.subject || 'Subject unavailable'}</span>
                                {record.attendance_session_id ? (
                                  <p className="text-xs text-gray-400 mt-0.5">Session #{record.attendance_session_id}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span>{formatSlotTime(record)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyles(status)}`}>
                              {status === 'Present' ? <CheckCircle2 className="h-3.5 w-3.5" /> : status === 'Late' ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              {status}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium italic">
                        No attendance records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Subject Wise</h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <History className="h-4 w-4" />
                All subjects
              </div>
            </div>
            <div className="space-y-4">
              {uniqueSubjects.length > 0 ? (
                uniqueSubjects.map((subject) => (
                  <div key={subject.subject} className="p-4 rounded-xl bg-gray-50/50 border border-transparent hover:border-gray-100 transition-all duration-200">
                    <div className="flex justify-between items-start mb-3 gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{subject.subject}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{subject.present} / {subject.total} lectures</p>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-xs font-bold ${subject.percentage > 75 ? 'bg-emerald-100 text-emerald-700' : subject.percentage >= 65 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {subject.percentage}%
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressColor(subject.percentage)}`}
                        style={{ width: `${subject.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-500 font-medium text-lg">No attendance records available</p>
                </div>
              )}
            </div>
          </div>

          <div className={`p-6 rounded-2xl shadow-lg relative overflow-hidden ${warningState.tone === 'safe' ? 'bg-emerald-600' : warningState.tone === 'warning' ? 'bg-amber-600' : 'bg-rose-600'}`}>
            <div className="relative z-10">
              <h3 className="text-white font-bold text-lg mb-2">Attendance Warning</h3>
              <p className="text-white/90 text-sm mb-2">{warningState.label}</p>
              <p className="text-white/80 text-sm">{warningState.description}</p>
            </div>
            <AlertTriangle className="absolute -bottom-4 -right-4 h-24 w-24 text-white/15 group-hover:scale-110 transition-transform duration-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceStatus;
