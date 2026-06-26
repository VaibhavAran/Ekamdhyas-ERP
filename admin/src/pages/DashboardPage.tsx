import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AiOutlineTeam,
  AiOutlineUser,
  AiOutlineBook,
  AiOutlineAppstore,
  AiOutlineCalendar,
  AiOutlineSetting,
  AiOutlineBell,
  AiOutlineFileText,
  AiOutlineBarChart,
  AiOutlineSolution,
  AiOutlineCheckCircle,
} from 'react-icons/ai'
import {
  FiUsers, FiUser, FiBook, FiCalendar, FiCheckCircle, FiClock,
  FiAlertTriangle, FiLoader, FiClipboard, FiBell,
  FiArrowRight, FiActivity, FiBookOpen,
  FiTarget, FiZap,
} from 'react-icons/fi'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'

interface DashboardData {
  studentCount: number
  teacherCount: number
  classCount: number
  boardCount: number
  academicYearCount: number
  todayAttendancePct: number | null
  presentToday: number
  absentToday: number
  lateToday: number
  activeNotices: number
  activeAssignments: number
  weeklyAttendance: { day: string; present: number; absent: number; late: number }[]
  studentsByBoard: { name: string; count: number }[]
  studentsByClass: { name: string; count: number }[]
  studentsByDivision: { name: string; count: number }[]
  activeStudents: number
  inactiveStudents: number
  classTeachers: number
  subjectTeacherDist: { subject: string; count: number }[]
  recentNotices: { id: string; title: string; publishDate: string; status: string; category: string }[]
  recentAssignments: { id: string; title: string; dueDate: string; status: string; className: string }[]
  dueTodayCount: number
  pendingSubmissions: number
  activities: { text: string; time: number; type: string }[]
  upcomingEvents: { title: string; date: string; type: string }[]
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<DashboardData>({
    studentCount: 0, teacherCount: 0, classCount: 0, boardCount: 0, academicYearCount: 0,
    todayAttendancePct: null, presentToday: 0, absentToday: 0, lateToday: 0,
    activeNotices: 0, activeAssignments: 0,
    weeklyAttendance: [], studentsByBoard: [], studentsByClass: [], studentsByDivision: [],
    activeStudents: 0, inactiveStudents: 0, classTeachers: 0, subjectTeacherDist: [],
    recentNotices: [], recentAssignments: [], dueTodayCount: 0, pendingSubmissions: 0,
    activities: [], upcomingEvents: [],
  })

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const todayIso = new Date().toISOString().split('T')[0]

        const [
          studentSnap, teacherSnap, classSnap, boardSnap, yearSnap,
          attendanceSnap, sessionSnap, noticeSnap, assignmentSnap,
          recentStudentSnap, recentTeacherSnap, recentSessionSnap,
          recentNoticeSnap, recentAssignmentSnap,
        ] = await Promise.all([
          getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
          getDocs(collection(db, 'teachers')),
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'boards')),
          getDocs(collection(db, 'academic_years')),
          getDocs(query(collection(db, 'attendance'), where('date', '==', todayIso))),
          getDocs(query(collection(db, 'attendance_sessions'), where('date', '==', todayIso))),
          getDocs(collection(db, 'notices')),
          getDocs(collection(db, 'assignments')),
          getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
          getDocs(collection(db, 'teachers')),
          getDocs(query(collection(db, 'attendance_sessions'))),
          getDocs(collection(db, 'notices')),
          getDocs(collection(db, 'assignments')),
        ])

        const students = studentSnap.docs.map(d => d.data())
        const teachers = teacherSnap.docs.map(d => d.data())
        const classes = classSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const boards = boardSnap.docs.map(d => d.data())
        const years = yearSnap.docs.map(d => d.data())
        const attendance = attendanceSnap.docs.map(d => d.data())
        const notices = noticeSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const assignments = assignmentSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        const presentToday = attendance.filter(a => a.status === 'present').length
        const absentToday = attendance.filter(a => a.status === 'absent').length
        const lateToday = attendance.filter(a => a.status === 'late').length
        const totalToday = presentToday + absentToday + lateToday
        const todayPct = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : null

        const activeStudents = students.filter(s => s.status === 'Active').length
        const inactiveStudents = students.length - activeStudents

        const boardMap = new Map<string, number>()
        students.forEach(s => { if (s.board_name) boardMap.set(s.board_name, (boardMap.get(s.board_name) || 0) + 1) })
        const studentsByBoard = Array.from(boardMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

        const classMap = new Map<string, number>()
        students.forEach(s => { if (s.class_name) classMap.set(s.class_name, (classMap.get(s.class_name) || 0) + 1) })
        const studentsByClass = Array.from(classMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

        const divisionMap = new Map<string, number>()
        classes.forEach((c: any) => { if (c.division) divisionMap.set(c.division, (divisionMap.get(c.division) || 0) + 1) })
        const studentsByDivision = Array.from(divisionMap.entries()).map(([name, count]) => ({ name, count }))

        const classTeachers = teachers.filter((t: any) => t.assignedClassNames && t.assignedClassNames.length > 0).length

        const subjectMap = new Map<string, number>()
        teachers.forEach((t: any) => {
          (t.assignedSubjectNames || []).forEach((sub: string) => {
            subjectMap.set(sub, (subjectMap.get(sub) || 0) + 1)
          })
        })
        const subjectTeacherDist = Array.from(subjectMap.entries()).map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count)

        const activeNotices = notices.filter((n: any) => n.status === 'published').length
        const activeAssignments = assignments.filter((a: any) => a.status === 'active').length
        const dueTodayCount = assignments.filter((a: any) => a.dueDate === todayIso && a.status !== 'completed').length

        const recentNotices = recentNoticeSnap.docs.map(d => {
          const data = d.data()
          return { id: d.id, title: data.title || '', publishDate: data.publishDate || '', status: data.status || '', category: data.category || '' }
        }).sort((a, b) => {
          const aTime = a.publishDate ? new Date(a.publishDate).getTime() : 0
          const bTime = b.publishDate ? new Date(b.publishDate).getTime() : 0
          return bTime - aTime
        }).slice(0, 5)
        const recentAssignments = recentAssignmentSnap.docs.map(d => {
          const data = d.data()
          return { id: d.id, title: data.title || '', dueDate: data.dueDate || '', status: data.status || '', className: data.className || '' }
        }).sort((a, b) => {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0
          return bTime - aTime
        }).slice(0, 5)

        const isoDate = (d: Date) => d.toISOString().split('T')[0]
        const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short' })
        const days = Array.from({ length: 6 }).map((_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (5 - i))
          return { iso: isoDate(d), label: dayLabel(d) }
        })
        const attPromises = days.map(d => getDocs(query(collection(db, 'attendance'), where('date', '==', d.iso))))
        const attSnaps = await Promise.all(attPromises)
        const weeklyAttendance = days.map((d, idx) => {
          const docs = attSnaps[idx].docs.map(dd => dd.data())
          return {
            day: d.label.slice(0, 3),
            present: docs.filter(a => a.status === 'present').length,
            absent: docs.filter(a => a.status === 'absent').length,
            late: docs.filter(a => a.status === 'late').length,
          }
        })

        const activities: { text: string; time: number; type: string }[] = []
        recentStudentSnap.docs.forEach(d => {
          const ddata = d.data()
          const ts = ddata.created_at?.toDate ? ddata.created_at.toDate().getTime() : 0
          const name = [ddata.firstName, ddata.lastName].filter(Boolean).join(' ') || 'Unnamed'
          activities.push({ text: `Student added: ${name}`, time: ts, type: 'student' })
        })
        recentTeacherSnap.docs.forEach(d => {
          const ddata = d.data()
          const ts = ddata.createdAt?.toDate ? ddata.createdAt.toDate().getTime() : 0
          const name = ddata.personalDetails ? [ddata.personalDetails.firstName, ddata.personalDetails.lastName].filter(Boolean).join(' ') : 'A teacher'
          activities.push({ text: `Teacher added: ${name}`, time: ts, type: 'teacher' })
        })
        recentSessionSnap.docs.forEach(d => {
          const ddata = d.data()
          const ts = ddata.completed_at?.toDate ? ddata.completed_at.toDate().getTime() : 0
          activities.push({ text: `Attendance marked by ${ddata.teacher_name || 'teacher'}`, time: ts, type: 'attendance' })
        })
        recentNoticeSnap.docs.forEach(d => {
          const ddata = d.data()
          const ts = ddata.createdAt?.toDate ? ddata.createdAt.toDate().getTime() : 0
          activities.push({ text: `Notice published: ${ddata.title || 'Untitled'}`, time: ts, type: 'notice' })
        })
        recentAssignmentSnap.docs.forEach(d => {
          const ddata = d.data()
          const ts = ddata.createdAt?.toDate ? ddata.createdAt.toDate().getTime() : 0
          activities.push({ text: `Assignment created: ${ddata.title || 'Untitled'}`, time: ts, type: 'assignment' })
        })
        activities.sort((a, b) => b.time - a.time)

        const upcomingEvents = [
          { title: 'Parent-Teacher Meeting', date: '2026-07-15', type: 'Meeting' },
          { title: 'Annual Sports Day', date: '2026-08-20', type: 'Event' },
          { title: 'Mid-Term Examinations', date: '2026-09-01', type: 'Exam' },
          { title: 'Science Exhibition', date: '2026-09-15', type: 'Event' },
          { title: 'Independence Day Celebration', date: '2026-08-15', type: 'Holiday' },
        ]

        setData({
          studentCount: students.length, teacherCount: teachers.length,
          classCount: classes.length, boardCount: boards.length, academicYearCount: years.length,
          todayAttendancePct: todayPct, presentToday, absentToday, lateToday,
          activeNotices, activeAssignments, weeklyAttendance,
          studentsByBoard, studentsByClass, studentsByDivision,
          activeStudents, inactiveStudents, classTeachers, subjectTeacherDist,
          recentNotices, recentAssignments, dueTodayCount, pendingSubmissions: 0,
          activities, upcomingEvents,
        })
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  const overviewCards = [
    { label: 'Total Students', value: data.studentCount, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'All enrolled students' },
    { label: 'Total Teachers', value: data.teacherCount, icon: FiUser, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Active teaching staff' },
    { label: 'Total Classes', value: data.classCount, icon: FiBook, color: 'text-purple-600', bg: 'bg-purple-50', desc: 'Across all boards' },
    { label: 'Total Boards', value: data.boardCount, icon: FiBookOpen, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Academic boards' },
    { label: 'Academic Years', value: data.academicYearCount, icon: FiCalendar, color: 'text-cyan-600', bg: 'bg-cyan-50', desc: 'Configured years' },
    { label: "Today's Attendance", value: data.todayAttendancePct !== null ? `${data.todayAttendancePct}%` : '--', icon: FiTarget, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: `${data.presentToday} present today` },
    { label: 'Active Notices', value: data.activeNotices, icon: FiBell, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Published notices' },
    { label: 'Active Assignments', value: data.activeAssignments, icon: FiClipboard, color: 'text-teal-600', bg: 'bg-teal-50', desc: 'Pending completion' },
  ]

  const quickActions = [
    { label: 'Add Student', icon: FiUsers, path: '/students', color: 'from-blue-500 to-blue-600' },
    { label: 'Add Teacher', icon: FiUser, path: '/teachers', color: 'from-emerald-500 to-emerald-600' },
    { label: 'Create Class', icon: FiBook, path: '/classes-branches', color: 'from-purple-500 to-purple-600' },
    { label: 'Create Notice', icon: FiBell, path: '/notices', color: 'from-rose-500 to-rose-600' },
    { label: 'Create Assignment', icon: FiClipboard, path: '/assignments', color: 'from-teal-500 to-teal-600' },
    { label: 'Mark Attendance', icon: FiCheckCircle, path: '/attendance-analytics', color: 'from-indigo-500 to-indigo-600' },
  ]

  const maxWeekly = useMemo(() => {
    const vals = data.weeklyAttendance.map(d => d.present + d.absent + d.late)
    return Math.max(...vals, 1)
  }, [data.weeklyAttendance])

  const maxBoard = useMemo(() => Math.max(...data.studentsByBoard.map(b => b.count), 1), [data.studentsByBoard])
  const maxClass = useMemo(() => Math.max(...data.studentsByClass.map(c => c.count), 1), [data.studentsByClass])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiLoader className="animate-spin text-4xl text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 font-medium text-sm">Welcome back! Here's your school overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="mt-1 text-xs text-slate-400">{card.desc}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}>
                <card.icon className={`text-xl ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Weekly Attendance Trend</h2>
            <span className="text-xs font-semibold text-slate-500">Last 6 days</span>
          </div>
          <div className="grid grid-cols-6 items-end gap-2 sm:gap-4 h-44">
            {data.weeklyAttendance.length === 0 ? (
              <div className="col-span-6 text-center text-sm text-slate-400 py-8">No attendance data</div>
            ) : (
              data.weeklyAttendance.map((day) => {
                const total = day.present + day.absent + day.late
                const pct = total > 0 ? Math.round((day.present / total) * 100) : 0
                return (
                  <div key={day.day} className="flex h-full flex-col items-center justify-end gap-1 group">
                    <div className="relative w-full max-w-[48px] flex-1 rounded-t-lg bg-slate-50">
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-500 group-hover:from-emerald-600 group-hover:to-emerald-500"
                        style={{ height: `${Math.min(100, Math.max(4, (total / maxWeekly) * 100))}%` }}
                      >
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{day.day}</span>
                  </div>
                )
              })
            )}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Present</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Absent</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Late</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Today's Summary</h2>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-100">Attendance Rate</p>
              <p className="mt-1 text-3xl font-bold">{data.todayAttendancePct !== null ? `${data.todayAttendancePct}%` : '--'}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-400/30">
                <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${data.todayAttendancePct || 0}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <FiCheckCircle className="mx-auto text-emerald-500 mb-1" size={18} />
                <p className="text-lg font-bold text-emerald-700">{data.presentToday}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase">Present</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3 text-center">
                <FiAlertTriangle className="mx-auto text-rose-500 mb-1" size={18} />
                <p className="text-lg font-bold text-rose-700">{data.absentToday}</p>
                <p className="text-[10px] font-bold text-rose-500 uppercase">Absent</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <FiClock className="mx-auto text-amber-500 mb-1" size={18} />
                <p className="text-lg font-bold text-amber-700">{data.lateToday}</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase">Late</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Students by Board</h3>
            <FiBookOpen className="text-slate-400" size={16} />
          </div>
          <div className="space-y-3">
            {data.studentsByBoard.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No data</p>
            ) : (
              data.studentsByBoard.map(b => (
                <div key={b.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{b.name}</span>
                    <span className="text-xs font-bold text-slate-500">{b.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${(b.count / maxBoard) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Students by Class</h3>
            <FiBook className="text-slate-400" size={16} />
          </div>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {data.studentsByClass.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No data</p>
            ) : (
              data.studentsByClass.slice(0, 10).map(c => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{c.name}</span>
                    <span className="text-xs font-bold text-slate-500">{c.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${(c.count / maxClass) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Student Status</h3>
            <FiUsers className="text-slate-400" size={16} />
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Active Students</p>
              <p className="mt-1 text-3xl font-bold">{data.activeStudents}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{data.activeStudents}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase">Active</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{data.inactiveStudents}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Inactive</p>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-bold text-blue-700">Divisions</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.studentsByDivision.map(d => (
                  <span key={d.name} className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    {d.name} ({d.count})
                  </span>
                ))}
                {data.studentsByDivision.length === 0 && <span className="text-xs text-blue-400">No divisions</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Teacher Overview</h3>
            <FiUser className="text-slate-400" size={16} />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-lg font-bold text-emerald-700">{data.teacherCount}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase">Total</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-lg font-bold text-blue-700">{data.classTeachers}</p>
                <p className="text-[10px] font-bold text-blue-500 uppercase">Class Teachers</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject Distribution</p>
              <div className="space-y-2 max-h-[160px] overflow-y-auto">
                {data.subjectTeacherDist.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No data</p>
                ) : (
                  data.subjectTeacherDist.map(s => (
                    <div key={s.subject} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 truncate">{s.subject}</span>
                      <span className="font-bold text-slate-900 ml-2">{s.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Recent Notices</h3>
            <button onClick={() => navigate('/notices')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              View All <FiArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {data.recentNotices.length === 0 ? (
              <div className="text-center py-6">
                <FiBell className="mx-auto text-slate-300 mb-2" size={24} />
                <p className="text-xs text-slate-400">No notices yet</p>
              </div>
            ) : (
              data.recentNotices.map(n => (
                <div key={n.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                  <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${
                    n.status === 'published' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <FiBell size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500">
                      {n.publishDate ? new Date(n.publishDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}
                      {' '}&middot;{' '}
                      <span className={`font-semibold ${n.status === 'published' ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {n.status}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Assignment Overview</h3>
            <button onClick={() => navigate('/assignments')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              View All <FiArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-teal-50 p-3 text-center">
                <p className="text-lg font-bold text-teal-700">{data.activeAssignments}</p>
                <p className="text-[10px] font-bold text-teal-500 uppercase">Active</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="text-lg font-bold text-amber-700">{data.dueTodayCount}</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase">Due Today</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3 text-center">
                <p className="text-lg font-bold text-rose-700">{data.pendingSubmissions}</p>
                <p className="text-[10px] font-bold text-rose-500 uppercase">Pending</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recent Assignments</p>
              {data.recentAssignments.length === 0 ? (
                <div className="text-center py-4">
                  <FiClipboard className="mx-auto text-slate-300 mb-2" size={20} />
                  <p className="text-xs text-slate-400">No assignments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.recentAssignments.slice(0, 4).map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-700 truncate">{a.title}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        a.status === 'active' ? 'bg-teal-100 text-teal-700' :
                        a.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        a.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Activities</h2>
            <span className="text-xs text-slate-400">Latest updates</span>
          </div>
          <div>
            {data.activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <FiActivity className="mx-auto text-slate-300 mb-2" size={24} />
                <p className="text-sm font-semibold text-slate-500">No activity recorded yet</p>
                <p className="mt-1 text-xs text-slate-400">System events will appear here</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {data.activities.slice(0, 8).map((act, i) => {
                  const typeColors: Record<string, string> = {
                    student: 'bg-blue-100 text-blue-600',
                    teacher: 'bg-emerald-100 text-emerald-600',
                    attendance: 'bg-indigo-100 text-indigo-600',
                    notice: 'bg-rose-100 text-rose-600',
                    assignment: 'bg-teal-100 text-teal-600',
                  }
                  const typeIcons: Record<string, React.ElementType> = {
                    student: FiUsers, teacher: FiUser, attendance: FiCheckCircle,
                    notice: FiBell, assignment: FiClipboard,
                  }
                  const Icon = typeIcons[act.type] || FiActivity
                  return (
                    <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeColors[act.type] || 'bg-slate-100 text-slate-500'}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{act.text}</p>
                        <p className="text-xs text-slate-500">{new Date(act.time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Upcoming Events</h2>
            <FiCalendar className="text-slate-400" size={16} />
          </div>
          <div className="space-y-3">
            {data.upcomingEvents.map((evt, i) => {
              const typeColors: Record<string, string> = {
                Meeting: 'bg-blue-100 text-blue-700',
                Event: 'bg-purple-100 text-purple-700',
                Exam: 'bg-rose-100 text-rose-700',
                Holiday: 'bg-emerald-100 text-emerald-700',
              }
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase leading-none">
                      {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold text-slate-900 leading-none">
                      {new Date(evt.date).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{evt.title}</p>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${typeColors[evt.type] || 'bg-slate-100 text-slate-600'}`}>
                      {evt.type}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Quick Actions</h2>
          <FiZap className="text-slate-400" size={16} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`group flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br ${action.color} p-4 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95`}
            >
              <action.icon size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
