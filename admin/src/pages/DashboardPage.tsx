import { useState, useEffect } from 'react'
import {
  AiOutlineTeam,
  AiOutlineUser,
  AiOutlineBook,
  AiOutlineMonitor,
  AiOutlineAppstore,
} from 'react-icons/ai'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../firebase'

export function DashboardPage() {
  const [studentCount, setStudentCount] = useState<number | null>(null)
  const [facultyCount, setFacultyCount] = useState<number | null>(null)
  const [departmentCount, setDepartmentCount] = useState<number | null>(null)
  const [classCount, setClassCount] = useState<number | null>(null)

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

  const stats = [
    { label: 'Total Students', icon: AiOutlineTeam, color: 'text-blue-500', bg: 'bg-blue-100', value: studentCount },
    { label: 'Total Faculty', icon: AiOutlineUser, color: 'text-emerald-500', bg: 'bg-emerald-100', value: facultyCount },
    { label: 'Total Departments', icon: AiOutlineAppstore, color: 'text-amber-500', bg: 'bg-amber-100', value: departmentCount },
    { label: 'Total Classes', icon: AiOutlineBook, color: 'text-violet-500', bg: 'bg-violet-100', value: classCount },
    { label: 'Active Sessions', icon: AiOutlineMonitor, color: 'text-slate-700', bg: 'bg-slate-200', value: null },
  ]

  const weeklyAttendance = [
    { day: 'Mon', value: 0 },
    { day: 'Tue', value: 0 },
    { day: 'Wed', value: 0 },
    { day: 'Thu', value: 0 },
    { day: 'Fri', value: 0 },
    { day: 'Sat', value: 0 },
  ]

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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Live Attendance</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              No active session
            </span>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">No active attendance session</p>
            <p className="mt-2 text-sm text-slate-400">
              Live class details will appear here once a teacher starts attendance.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Alerts</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              <p className="font-semibold">No alerts right now</p>
              <p className="mt-1 text-xs text-slate-400">System issues and low attendance alerts will appear here.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Weekly Attendance Trend</h2>
            <span className="text-sm font-semibold text-slate-500">Last 6 days</span>
          </div>
          <div className="mt-8 grid grid-cols-6 items-end gap-2 sm:gap-6 h-48">
            {weeklyAttendance.map((day) => (
              <div key={day.day} className="flex h-full flex-col items-center justify-end gap-2 group">
                <div className="relative w-full max-w-[48px] flex-1 rounded-t-xl bg-slate-50">
                  <div
                    className="absolute bottom-0 w-full rounded-t-xl bg-blue-500 transition-all duration-500 group-hover:bg-blue-600"
                    style={{ height: `${day.value}%` }}
                  >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {day.value}%
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-500">{day.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-5 space-y-3">
            <a
              href="/students"
              className="block rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Add Student
            </a>
            <a
              href="/faculty"
              className="block rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Add Faculty
            </a>
            <a
              href="/reports"
              className="block rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View Reports
            </a>
            <a
              href="/attendance-monitor"
              className="block rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Attendance Monitor
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <span className="text-sm text-slate-400">Today</span>
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">No activity recorded yet</p>
            <p className="mt-2 text-sm text-slate-400">Attendance updates and system events will appear here.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Attendance Snapshot</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-semibold text-slate-500">Snapshot data unavailable</p>
              <p className="mt-2 text-sm text-slate-400">Attendance comparisons will populate once data sync completes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}