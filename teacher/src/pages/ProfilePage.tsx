import { useEffect, useState } from 'react';
import { FiCalendar, FiLoader, FiMail, FiShield, FiUser } from 'react-icons/fi';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface FacultyProfile {
name?: string;
email?: string;
role?: string;
department_name?: string;
status?: string;
created_at?: { toDate?: () => Date } | Date | null;
}

const formatDate = (value?: FacultyProfile['created_at']) => {
if (!value) return 'Not available';
if (value instanceof Date) {
return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
return value.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
return 'Not available';
};

const ProfilePage = () => {
const { currentUser, loading: authLoading } = useAuth();
const teacherUid = currentUser?.uid;

const [profile, setProfile] = useState<FacultyProfile | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

useEffect(() => {
const fetchProfile = async () => {
if (!teacherUid) return;

setLoading(true);
setError('');

try {
const snapshot = await getDoc(doc(db, 'faculty', teacherUid));
setProfile(snapshot.exists() ? (snapshot.data() as FacultyProfile) : null);
} catch (profileError) {
console.error('Failed to load teacher profile:', profileError);
setError('Unable to load profile information right now.');
} finally {
setLoading(false);
}
};

fetchProfile();
}, [teacherUid]);

if (authLoading || loading) {
return (
<div className="flex min-h-[70vh] items-center justify-center text-slate-200">
<div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
<FiLoader className="animate-spin" />
<span className="text-sm font-medium">Loading profile...</span>
</div>
</div>
);
}

if (error || !profile) {
return (
<div className="space-y-6 pb-8 text-slate-100">
<div className="space-y-2">
<h1 className="text-3xl font-black tracking-tight text-white">Profile</h1>
<p className="text-sm text-slate-400">Read-only faculty information managed by Admin.</p>
</div>

<section className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-slate-400">
<p className="text-base font-semibold text-slate-200">Profile information unavailable</p>
<p className="mt-2 text-sm">Please contact the admin panel if your faculty profile is missing.</p>
</section>
</div>
);
}

return (
<div className="space-y-6 pb-8 text-slate-100">
<div className="space-y-2">
<h1 className="text-3xl font-black tracking-tight text-white">Profile</h1>
<p className="text-sm text-slate-400">Read-only faculty information managed by Admin.</p>
</div>

<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
<div className="space-y-3">
<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
  <FiUser /> Teacher
</div>
<h2 className="text-2xl font-black text-white">{profile.name ?? 'Profile information unavailable'}</h2>
<p className="text-sm text-slate-400">{profile.department_name ?? 'Department not assigned'}</p>
</div>

<div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
<div className="flex items-center gap-2 text-slate-200">
  <FiShield className="text-blue-400" /> Role: Teacher
</div>
<div className="mt-2 text-xs text-slate-500">Read-only profile</div>
</div>
</div>
</section>

<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
<h3 className="text-lg font-bold text-white">Profile Information</h3>
<div className="mt-4 grid gap-4 md:grid-cols-2">
<ProfileField label="Full Name" value={profile.name} />
<ProfileField label="Email" value={profile.email} icon={<FiMail />} />
<ProfileField label="Department" value={profile.department_name} />
<ProfileField label="Role" value={profile.role ?? 'Teacher'} />
<ProfileField label="Status" value={profile.status} />
<ProfileField label="Created Date" value={formatDate(profile.created_at)} icon={<FiCalendar />} />
</div>
</section>
</div>
);
};

const ProfileField = ({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) => (
<div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
{icon ? <span className="text-slate-500">{icon}</span> : null}
<span>{label}</span>
</div>
<p className="mt-2 text-sm font-semibold text-white">{value || 'Profile information unavailable'}</p>
</div>
);

export default ProfilePage;
