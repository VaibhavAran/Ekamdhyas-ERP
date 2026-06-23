import { useState, useEffect } from 'react'
import {
  AiOutlineTeam,
  AiOutlineUser,
  AiOutlineBook,
  AiOutlineAppstore,
} from 'react-icons/ai'
import { collection, getCountFromServer } from 'firebase/firestore'
import { getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'

export function DashboardPage() {
  const [studentCount, setStudentCount] = useState<number | null>(null)
  const [facultyCount, setFacultyCount] = useState<number | null>(null)
  const [classCount, setClassCount] = useState<number | null>(null)
  const [departmentCount, setDepartmentCount] = useState<number | null>(null)
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState<{ day: string; value: number }[]>([])
  const [recentActivities, setRecentActivities] = useState<{ text: string; time: number }[]>([])
  const [presentToday, setPresentToday] = useState<number | null>(null)
  const [absentToday, setAbsentToday] = useState<number | null>(null)
  const [completionPercent, setCompletionPercent] = useState<number | null>(null)

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const studentsSnap = await getCountFromServer(collection(db, 'students'))
        setStudentCount(studentsSnap.data().count)
        
        const facultySnap = await getCountFromServer(collection(db, 'faculty'))
        setFacultyCount(facultySnap.data().count)

        const deptSnap = await getCountFromServer(collection(db, 'departments'))
        setDepartmentCount(deptSnap.data().count)

        const classSnap = await getCountFromServer(collection(db, 'classes'))
        setClassCount(classSnap.data().count)
        // Additional data fetching will be added here
      } catch (error) {
        console.error("Error fetching dashboard counts:", error)
        // If collections don't exist yet, we can gracefully default to 0
        if (studentCount === null) setStudentCount(0)
        if (facultyCount === null) setFacultyCount(0)
        if (departmentCount === null) setDepartmentCount(0)
        if (classCount === null) setClassCount(0)
      }
    }
    fetchCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  useEffect(() => {
    const isoDate = (d: Date) => d.toISOString().split('T')[0]
    const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short' })

    const fetchDashboard = async () => {
      try {
        // Counts in parallel
        const [studentsSnap, facultySnap, deptSnap, classSnap] = await Promise.all([
          getCountFromServer(collection(db, 'students')),
          getCountFromServer(collection(db, 'faculty')),
          getCountFromServer(collection(db, 'departments')),
          getCountFromServer(collection(db, 'classes')),
        ])

        setStudentCount(studentsSnap.data().count)
        setFacultyCount(facultySnap.data().count)
        setDepartmentCount(deptSnap.data().count)
        setClassCount(classSnap.data().count)

        // Weekly attendance — last 6 days to match UI columns (Mon..Sat)
        const days = Array.from({ length: 6 }).map((_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (5 - i)) // 5..0 to make left->right chronological
          return { iso: isoDate(d), label: dayLabel(d) }
        })

        const attendancePromises = days.map(d => getDocs(query(collection(db, 'attendance'), where('date', '==', d.iso))))
        const attendanceSnaps = await Promise.all(attendancePromises)
        const weekly = days.map((d, idx) => ({ day: d.label.slice(0,3), value: attendanceSnaps[idx].size }))
        setWeeklyAttendanceData(weekly)

        // Today's attendance snapshot
        const todayIso = isoDate(new Date())
        const todaySnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', todayIso)))
        const present = todaySnap.docs.filter(d => d.data().status === 'present').length
        const absent = todaySnap.docs.filter(d => d.data().status === 'absent').length
        setPresentToday(present)
        setAbsentToday(absent)
        const total = present + absent
        setCompletionPercent(total > 0 ? Math.round((present / total) * 100) : null)

        // (Today's active classes removed)

        // Recent activity from students, faculty, timetable, attendance_sessions
        const [studSnap, facSnap, sessSnap, ttSnapRecent] = await Promise.all([
          getDocs(query(collection(db, 'students'), orderBy('created_at', 'desc'), limit(5))),
          getDocs(query(collection(db, 'faculty'), orderBy('created_at', 'desc'), limit(5))),
          getDocs(query(collection(db, 'attendance_sessions'), orderBy('completed_at', 'desc'), limit(5))),
          getDocs(query(collection(db, 'timetable'), orderBy('created_at', 'desc'), limit(5))),
        ])

        const activities: { text: string; time: number }[] = []

        studSnap.docs.forEach(d => {
          const data = d.data() as any
          const ts = (data.created_at && data.created_at.toDate) ? data.created_at.toDate().getTime() : Date.now()
          activities.push({ text: `New student added: ${data.name || 'Unnamed'}`, time: ts })
        })

        facSnap.docs.forEach(d => {
          const data = d.data() as any
          const ts = (data.created_at && data.created_at.toDate) ? data.created_at.toDate().getTime() : Date.now()
          activities.push({ text: `New faculty added: ${data.name || 'Unnamed'}`, time: ts })
        })

        sessSnap.docs.forEach(d => {
          const data = d.data() as any
          const actor = data.teacher_name || 'A teacher'
          const ts = (data.completed_at && data.completed_at.toDate) ? data.completed_at.toDate().getTime() : Date.now()
          activities.push({ text: `${actor} completed attendance`, time: ts })
        })

        ttSnapRecent.docs.forEach(d => {
          const data = d.data() as any
          const ts = (data.created_at && data.created_at.toDate) ? data.created_at.toDate().getTime() : Date.now()
          activities.push({ text: `Timetable updated: ${data.class_name || 'Class'}`, time: ts })
        })

        activities.sort((a, b) => b.time - a.time)
        setRecentActivities(activities.slice(0, 5))
      } catch (err) {
        console.error('Error loading dashboard data', err)
        // fallbacks
        setStudentCount(prev => prev ?? 0)
        setFacultyCount(prev => prev ?? 0)
        setDepartmentCount(prev => prev ?? 0)
        setClassCount(prev => prev ?? 0)
        setWeeklyAttendanceData([])
        setRecentActivities([])
        setPresentToday(null)
        setAbsentToday(null)
        setCompletionPercent(null)
      }
    }

    void fetchDashboard()
  }, [])

  const stats = [
    { label: 'Total Students', icon: AiOutlineTeam, color: 'text-blue-500', bg: 'bg-blue-100', value: studentCount },
    { label: 'Total Faculty', icon: AiOutlineUser, color: 'text-emerald-500', bg: 'bg-emerald-100', value: facultyCount },
    { label: 'Total Departments', icon: AiOutlineAppstore, color: 'text-amber-500', bg: 'bg-amber-100', value: departmentCount },
    { label: 'Total Classes', icon: AiOutlineBook, color: 'text-violet-500', bg: 'bg-violet-100', value: classCount },
  ]

  // weeklyAttendanceData is loaded from Firestore

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">{stat.label}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${stat.bg}`}>
                  <Icon className={`text-lg ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4 text-2xl font-bold text-slate-900">
                {stat.value !== null ? stat.value : <span className="text-slate-300">--</span>}
              </div>
              <p className="text-sm text-slate-400">
                {stat.value !== null ? 'Live from database' : 'Awaiting data feed'}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Weekly Attendance Trend</h2>
            <span className="text-sm font-semibold text-slate-500">Last 6 days</span>
          </div>
          <div className="mt-8 grid grid-cols-6 items-end gap-2 sm:gap-6 h-48">
            {weeklyAttendanceData.length === 0 ? (
              <div className="col-span-6 text-center text-sm text-slate-400">No attendance data available</div>
            ) : (
              weeklyAttendanceData.map((day) => (
                <div key={day.day} className="flex h-full flex-col items-center justify-end gap-2 group">
                  <div className="relative w-full max-w-[48px] flex-1 rounded-t-xl bg-slate-50">
                    <div
                      className="absolute bottom-0 w-full rounded-t-xl bg-blue-500 transition-all duration-500 group-hover:bg-blue-600"
                      style={{ height: `${Math.min(100, Math.max(4, (day.value || 0) / 1))}%` }}
                    >
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {day.value}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{day.day}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <span className="text-sm text-slate-400">Today</span>
          </div>
          <div className="mt-5">
            {recentActivities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm font-semibold text-slate-500">No activity recorded yet</p>
                <p className="mt-2 text-sm text-slate-400">Attendance updates and system events will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {recentActivities.map((act, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{act.text}</div>
                      <div className="text-xs text-slate-500">{new Date(act.time).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Attendance Snapshot</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="text-sm text-slate-500">Present</div>
              <div className="text-2xl font-bold text-slate-900">{presentToday ?? '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="text-sm text-slate-500">Absent</div>
              <div className="text-2xl font-bold text-slate-900">{absentToday ?? '—'}</div>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="text-sm text-slate-500">Completion</div>
              <div className="text-2xl font-bold text-slate-900">{completionPercent !== null ? `${completionPercent}%` : '—'}</div>
            </div>
            {/* Today's Active Classes removed */}
          </div>
        </div>
      </div>
    </div>
  )
}