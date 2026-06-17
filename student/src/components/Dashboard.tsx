import React from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  XCircle,
  Percent,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Clock3,
  BookOpen,
  User as UserIcon,
} from 'lucide-react';
import cn from 'clsx';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  User as UserType,
  AttendanceRecord,
  AttendanceSessionDoc,
  TimetableEntryDoc,
  DashboardSubjectProgress,
  DashboardTrendPoint,
  RecentAttendanceItem,
} from '../types';
import {
  getTimeTableForClass,
} from '../lib/firebaseService';

interface DashboardProps {
  user: UserType;
  attendanceRecords: AttendanceRecord[];
}

const StatCard = ({
  title,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  title: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn('p-3 rounded-xl', color)}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
    <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
    <div className="flex items-baseline gap-2 mt-1">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subValue && <span className="text-sm text-gray-400 font-normal">{subValue}</span>}
    </div>
  </motion.div>
);

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

const getAttendanceStatus = (status: unknown) => {
  if (typeof status !== 'string') return 'Absent';
  return status.toLowerCase() === 'present' ? 'Present' : 'Absent';
};

const getTodayName = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long' });

const formatDateTime = (value: unknown) => {
  const millis = getMillis(value);
  if (!millis) return 'Recently';

  return new Date(millis).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatSlot = (start: string, end: string) => `${start} – ${end}`;

const getWarningStatus = (percentage: number) => {
  if (percentage >= 75) return 'Safe';
  if (percentage >= 70) return 'Warning';
  return 'Critical';
};

const getWarningStyles = (status: 'Safe' | 'Warning' | 'Critical') => {
  if (status === 'Safe') {
    return {
      chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      ring: 'bg-emerald-500',
      label: 'Above 75%',
    };
  }

  if (status === 'Warning') {
    return {
      chip: 'bg-amber-50 text-amber-700 border-amber-200',
      ring: 'bg-amber-500',
      label: '70-74%',
    };
  }

  return {
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    ring: 'bg-rose-500',
    label: 'Below 70%',
  };
};

const getProgressColor = (percentage: number) => {
  if (percentage > 75) return 'bg-emerald-500';
  if (percentage >= 65) return 'bg-amber-500';
  return 'bg-rose-500';
};

const Dashboard: React.FC<DashboardProps> = ({ user, attendanceRecords }) => {
  const [subjectProgress, setSubjectProgress] = React.useState<DashboardSubjectProgress[]>([]);
  const [attendanceTrend, setAttendanceTrend] = React.useState<DashboardTrendPoint[]>([]);
  const [recentAttendance, setRecentAttendance] = React.useState<RecentAttendanceItem[]>([]);
  const [todayClasses, setTodayClasses] = React.useState<TimetableEntryDoc[]>([]);
  const [loadingDashboard, setLoadingDashboard] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      const classId = user.class_id || user.class || '';
      const batchId = user.batch_id || null;

      if (!classId) {
        if (mounted) {
          setSubjectProgress([]);
          setAttendanceTrend([]);
          setRecentAttendance([]);
          setTodayClasses([]);
          setLoadError('Class information is missing for this student.');
          setLoadingDashboard(false);
        }
        return;
      }

      if (mounted) {
        setLoadingDashboard(true);
        setLoadError('');
      }

      try {
        const [timetable] = await Promise.all([
          getTimeTableForClass(classId, batchId),
        ]);

        // Calculate progress from attendanceRecords prop
        const progressMap = new Map<string, DashboardSubjectProgress>();
        attendanceRecords.forEach((record) => {
          const subjectName = record.subject_name || record.subject || 'Unknown';
          const existing = progressMap.get(subjectName) || {
            subject: subjectName,
            totalLectures: 0,
            presentCount: 0,
          };

          existing.totalLectures += 1;
          if (record.status?.toLowerCase() === 'present') {
            existing.presentCount += 1;
          }

          progressMap.set(subjectName, existing);
        });

        const progressList = Array.from(progressMap.values()).sort(
          (left, right) => right.totalLectures - left.totalLectures || left.subject.localeCompare(right.subject)
        );

        // Sort records by date for recent and trend lists
        const sortedRecords = [...attendanceRecords].sort(
          (left, right) => getMillis(left.date) - getMillis(right.date)
        );

        const trend = sortedRecords.slice(-7).map((record) => {
          const status = record.status?.toLowerCase() === 'present' ? 'Present' : 'Absent';
          const label = record.date;
          return {
            name: new Date(record.date).toLocaleDateString(undefined, { weekday: 'short' }) || record.date,
            attendance: status === 'Present' ? 100 : 0,
            status,
            label,
          } as DashboardTrendPoint;
        });

        const recentList: RecentAttendanceItem[] = [...sortedRecords]
          .reverse()
          .slice(0, 5)
          .map((record) => {
            return {
              id: record.id,
              subject: record.subject_name || record.subject || 'Unknown',
              status: record.status?.toLowerCase() === 'present' ? 'Present' : 'Absent',
              timestamp: formatDateTime(record.date),
            };
          });

        const todayName = getTodayName();
        const todayList = timetable.filter((entry) => {
          const matchesDay = entry.day === todayName;
          const matchesBatch = !batchId || !entry.batch_id || entry.batch_id === batchId;
          return matchesDay && matchesBatch;
        });

        if (mounted) {
          setSubjectProgress(progressList);
          setAttendanceTrend(trend);
          setRecentAttendance(recentList);
          setTodayClasses(todayList);
          setLoadError('');
        }
      } catch (error) {
        console.error('Error loading student dashboard:', error);
        if (mounted) {
          setSubjectProgress([]);
          setAttendanceTrend([]);
          setRecentAttendance([]);
          setTodayClasses([]);
          setLoadError('Unable to load live dashboard data right now.');
        }
      } finally {
        if (mounted) {
          setLoadingDashboard(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [attendanceRecords, user.batch_id, user.class, user.class_id, user.id]);

  const totalLectures = subjectProgress.reduce((accumulator, current) => accumulator + current.totalLectures, 0);
  const presentCount = subjectProgress.reduce((accumulator, current) => accumulator + current.presentCount, 0);
  const percentage = totalLectures > 0 ? Math.round((presentCount / totalLectures) * 100) : 0;
  const warningStatus = getWarningStatus(percentage);
  const warningStyles = getWarningStyles(warningStatus);

  const todayClassesCount = todayClasses.length;
  const headerLabel = user.class_name || user.class || user.semester || 'this semester';

  const chartData = attendanceTrend.length
    ? attendanceTrend.map((point) => ({ name: point.name, attendance: point.attendance }))
    : [];

  const chartSubtitle = attendanceTrend.length ? 'Last 7 attendance sessions' : 'Recent attendance sessions will appear here';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back, {user.name}!</h1>
        <p className="text-gray-500 mt-1">Here&apos;s your attendance summary for {headerLabel}.</p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Presence"
          value={loadingDashboard ? '--' : presentCount}
          subValue={loadingDashboard ? undefined : `/ ${totalLectures} lectures`}
          icon={CheckCircle2}
          color="bg-emerald-500"
        />
        <StatCard
          title="Total Absence"
          value={loadingDashboard ? '--' : Math.max(totalLectures - presentCount, 0)}
          icon={XCircle}
          color="bg-rose-500"
        />
        <StatCard
          title="Attendance Rate"
          value={loadingDashboard ? '--' : `${percentage}%`}
          icon={Percent}
          color="bg-blue-500"
        />
        <StatCard
          title="Attendance Warning"
          value={warningStatus}
          subValue={warningStyles.label}
          icon={AlertTriangle}
          color={warningStatus === 'Safe' ? 'bg-emerald-500' : warningStatus === 'Warning' ? 'bg-amber-500' : 'bg-rose-500'}
        />
        <StatCard
          title="Today's Classes Count"
          value={loadingDashboard ? '--' : todayClassesCount}
          subValue={loadingDashboard ? undefined : 'Lectures Today'}
          icon={Calendar}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Attendance Overview</h2>
              <p className="text-sm text-gray-500">{chartSubtitle}</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              <TrendingUp className="h-4 w-4" />
              {warningStatus}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  dx={-10}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Attendance']}
                />
                <Area
                  type="monotone"
                  dataKey="attendance"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAttendance)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Subject Progress</h2>
          <div className="space-y-6">
            {subjectProgress.length > 0 ? (
              subjectProgress.slice(0, 4).map((subject, idx) => {
                const perc = subject.totalLectures > 0 ? (subject.presentCount / subject.totalLectures) * 100 : 0;
                return (
                  <div key={`${subject.subject}-${idx}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 truncate mr-4">{subject.subject}</span>
                      <span className="text-sm font-bold text-gray-900">{perc.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${perc}%` }}
                        transition={{ delay: 0.2 + idx * 0.1, duration: 0.8 }}
                        className={cn('h-full rounded-full', getProgressColor(perc))}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                Subject progress will appear after attendance sessions are available.
              </div>
            )}
          </div>
          <button className="w-full mt-8 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors duration-200">
            View All Subjects
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Today's Classes</h2>
              <p className="text-sm text-gray-500">Fetched from your class timetable</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              <BookOpen className="h-4 w-4" />
              {todayClassesCount} lectures
            </div>
          </div>

          <div className="space-y-3">
            {todayClasses.length > 0 ? (
              todayClasses.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                        <Clock3 className="h-4 w-4" />
                        {formatSlot(entry.start_time, entry.end_time)}
                      </div>
                      <h3 className="mt-2 text-base font-bold text-gray-900">{entry.subject_name || 'Unknown subject'}</h3>
                      <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        {entry.teacher_name || 'Teacher not available'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                No lectures scheduled for today.
              </div>
            )}
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Recent Attendance</h2>
              <p className="text-sm text-gray-500">Last 5 attendance entries with timestamps</p>
            </div>
          </div>

          <div className="space-y-3">
            {recentAttendance.length > 0 ? (
              recentAttendance.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{entry.subject}</h3>
                    <p className="mt-1 text-xs text-gray-500">{entry.timestamp}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      entry.status === 'Present'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    )}
                  >
                    {entry.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                Recent attendance entries will appear here once sessions are recorded.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
