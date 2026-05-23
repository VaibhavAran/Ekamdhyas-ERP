import { useEffect, useMemo, useState } from 'react';
import { FiBell, FiCheckCircle, FiClock, FiLoader } from 'react-icons/fi';
import {
arrayUnion,
collection,
doc,
getDocs,
orderBy,
query,
updateDoc,
where,
type DocumentData,
type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface TeacherNotification {
id: string;
title: string;
message: string;
created_at?: { toDate?: () => Date } | Date | null;
created_by?: string;
role_target?: 'teacher' | 'all';
read_by?: string[];
}

type NotificationTab = 'all' | 'unread';

const toDateValue = (value?: TeacherNotification['created_at']) => {
if (!value) return null;
if (value instanceof Date) return value;
if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
return value.toDate();
}
return null;
};

const formatDateTime = (value?: TeacherNotification['created_at']) => {
const date = toDateValue(value);
if (!date) return 'Date not available';

return `${date.toLocaleDateString(undefined, {
day: 'numeric',
month: 'short',
year: 'numeric',
})} • ${date.toLocaleTimeString(undefined, {
hour: 'numeric',
minute: '2-digit',
})}`;
};

const NotificationsPage = () => {
const { currentUser, loading: authLoading } = useAuth();
const teacherUid = currentUser?.uid;

const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [activeTab, setActiveTab] = useState<NotificationTab>('all');
const [updatingId, setUpdatingId] = useState('');

const unreadCount = useMemo(
() => notifications.filter((notification) => !(notification.read_by ?? []).includes(teacherUid ?? '')).length,
[notifications, teacherUid]
);

const filteredNotifications = useMemo(() => {
return notifications.filter((notification) => {
const isRead = (notification.read_by ?? []).includes(teacherUid ?? '');
if (activeTab === 'unread') return !isRead;
return true;
});
}, [activeTab, notifications, teacherUid]);

useEffect(() => {
const fetchNotifications = async () => {
if (!teacherUid) return;

setLoading(true);
setError('');

try {
let snap;
try {
snap = await getDocs(
query(
collection(db, 'notifications'),
where('role_target', 'in', ['teacher', 'all']),
orderBy('created_at', 'desc')
)
);
} catch {
snap = await getDocs(collection(db, 'notifications'));
}

const items = snap.docs
.map((item: QueryDocumentSnapshot<DocumentData, DocumentData>) => ({ id: item.id, ...item.data() } as TeacherNotification))
.filter((notification) => notification.role_target === 'teacher' || notification.role_target === 'all')
.sort((left, right) => {
const leftTime = toDateValue(left.created_at)?.getTime() ?? 0;
const rightTime = toDateValue(right.created_at)?.getTime() ?? 0;
return rightTime - leftTime;
});

setNotifications(items);
} catch (notificationError) {
console.error('Failed to load notifications:', notificationError);
setError('Unable to load notifications right now.');
} finally {
setLoading(false);
}
};

fetchNotifications();
}, [teacherUid]);

const markAsRead = async (notificationId: string) => {
if (!teacherUid) return;

setUpdatingId(notificationId);
setError('');

try {
await updateDoc(doc(db, 'notifications', notificationId), {
read_by: arrayUnion(teacherUid),
});

setNotifications((current) =>
current.map((notification) =>
notification.id === notificationId
? { ...notification, read_by: Array.from(new Set([...(notification.read_by ?? []), teacherUid])) }
: notification
)
);
} catch (markError) {
console.error('Failed to mark notification as read:', markError);
setError('Unable to mark notification as read.');
} finally {
setUpdatingId('');
}
};

if (authLoading || loading) {
return (
<div className="flex min-h-[70vh] items-center justify-center text-slate-200">
<div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
<FiLoader className="animate-spin" />
<span className="text-sm font-medium">Loading notifications...</span>
</div>
</div>
);
}

return (
<div className="space-y-6 pb-8 text-slate-100">
<div className="space-y-2">
<h1 className="text-3xl font-black tracking-tight text-white">Notifications</h1>
<p className="text-sm text-slate-400">Admin notices for teachers only.</p>
</div>

{error ? (
<div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
<FiBell className="shrink-0" />
<span>{error}</span>
</div>
) : null}

<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
<div className="flex flex-wrap items-center gap-3">
{(['all', 'unread'] as const).map((tab) => {
const active = activeTab === tab;
const label = tab === 'all' ? 'All' : `Unread (${unreadCount})`;

return (
<button
key={tab}
type="button"
onClick={() => setActiveTab(tab)}
className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
active
? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
: 'border-slate-700 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
}`}
>
{label}
</button>
);
})}
<div className="ml-auto rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300">
Unread: {unreadCount}
</div>
</div>
</section>

<section className="space-y-3">
{filteredNotifications.length === 0 ? (
<div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-14 text-center text-slate-400">
<p className="text-base font-semibold text-slate-200">No notifications available</p>
</div>
) : (
filteredNotifications.map((notification) => {
const isRead = (notification.read_by ?? []).includes(teacherUid ?? '');

return (
<article
key={notification.id}
className={`rounded-3xl border p-5 shadow-lg shadow-black/10 transition ${
isRead ? 'border-slate-800 bg-slate-900/70' : 'border-blue-500/20 bg-blue-500/10'
}`}
>
<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
<div className="space-y-3">
<div className="flex flex-wrap items-center gap-2">
  <h2 className="text-lg font-bold text-white">{notification.title}</h2>
  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isRead ? 'border-slate-700 bg-slate-950/60 text-slate-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'}`}>
    {isRead ? 'Read' : 'Unread'}
  </span>
</div>
<p className="max-w-3xl text-sm leading-6 text-slate-300">{notification.message}</p>
<div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
  <span className="inline-flex items-center gap-2">
    <FiClock className="text-slate-500" /> {formatDateTime(notification.created_at)}
  </span>
  <span>Sent by Admin</span>
</div>
</div>

<div className="flex items-center gap-2 md:shrink-0">
{!isRead ? (
  <button
    type="button"
    onClick={() => void markAsRead(notification.id)}
    disabled={updatingId === notification.id}
    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
  >
    <FiCheckCircle /> {updatingId === notification.id ? 'Saving...' : 'Mark as Read'}
  </button>
) : (
  <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-300">
    <FiCheckCircle /> Marked as Read
  </span>
)}
</div>
</div>
</article>
);
})
)}
</section>
</div>
);
};

export default NotificationsPage;
