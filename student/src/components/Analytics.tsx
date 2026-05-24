import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import type { AttendanceRecord } from '../types';

interface AnalyticsProps {
  attendanceRecords: AttendanceRecord[];
}

const Analytics: React.FC<AnalyticsProps> = ({ attendanceRecords }) => {
  // Derive per-subject attendance from records
  const subjects = Array.from(new Set(attendanceRecords.map(r => r.subject || 'Unknown')));
  const attendanceSource = subjects.map(sub => {
    const subjectRecords = attendanceRecords.filter(r => (r.subject || 'Unknown') === sub);
    const present = subjectRecords.filter(r => r.status === 'Present' || r.status === 'present').length;
    return { subject: sub, totalLectures: subjectRecords.length, presentCount: present };
  });

  const totalLectures = attendanceSource.reduce((acc, curr) => acc + curr.totalLectures, 0);
  const presentCount = attendanceSource.reduce((acc, curr) => acc + curr.presentCount, 0);
  const absentCount = totalLectures - presentCount;

  const pieData = [
    { name: 'Present', value: presentCount, color: '#10b981' },
    { name: 'Absent', value: absentCount, color: '#ef4444' },
  ];

  const barData = attendanceSource.map(s => ({ name: s.subject, Present: s.presentCount, Absent: s.totalLectures - s.presentCount }));

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Analytics</h1>
        <p className="text-gray-500 mt-1">Deep dive into your attendance patterns and performance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-8">Overall Attendance Overview</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
                <text
                  x="50%"
                  y="45%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-900 font-bold text-2xl"
                >
                  {totalLectures > 0 ? ((presentCount / totalLectures) * 100).toFixed(1) : '0.0'}%
                </text>
                <text
                  x="50%"
                  y="55%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-400 text-sm"
                >
                  Present
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-green-50 border border-green-100">
              <p className="text-xs text-green-600 font-medium uppercase tracking-wider mb-1">Total Present</p>
              <p className="text-2xl font-bold text-green-700">{presentCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-red-600 font-medium uppercase tracking-wider mb-1">Total Absent</p>
              <p className="text-2xl font-bold text-red-700">{absentCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-8">Subject-wise Comparison</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend verticalAlign="top" align="right" height={36}/>
                <Bar dataKey="Present" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="Absent" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-6 text-sm text-gray-500 italic">
            * Comparison of lectures attended vs missed for each subject.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
