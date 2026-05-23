
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen } from 'react-icons/fi';

const LoginPage = () => {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const navigate = useNavigate();

const handleLogin = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
setError('');

try {
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const user = userCredential.user;

// Check role
const docRef = doc(db, 'faculty', user.uid);
const docSnap = await getDoc(docRef);

if (docSnap.exists()) {
const data = docSnap.data();
if (data.role === 'teacher') {
navigate('/teacher/dashboard');
} else {
// Force sign out if not a teacher
await auth.signOut();
setError('Unauthorized access: User is not a teacher.');
}
} else {
await auth.signOut();
setError('Unauthorized access: Teacher profile not found.');
}
} catch (err: any) {
console.error(err);
setError('Invalid credentials or authentication failure.');
} finally {
setLoading(false);
}
};

return (
<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
<div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
<div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

<div className="w-full max-w-md backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10">
<div className="flex flex-col items-center mb-8">
<div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20 text-white mb-4">
<FiBookOpen className="w-8 h-8" />
</div>
<h1 className="text-2xl font-extrabold text-white text-center">Teacher Panel</h1>
<p className="text-sm text-slate-400 mt-1">Sign in to your account</p>
</div>

{error && (
<div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl mb-6 text-center">
{error}
</div>
)}

<form onSubmit={handleLogin} className="space-y-5">
<div>
<label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
<input
  type="email"
  required
  className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-500 outline-none transition-all"
  placeholder="teacher@example.com"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
</div>

<div>
<label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
<input
  type="password"
  required
  className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-500 outline-none transition-all"
  placeholder="••••••••"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
</div>

<button
type="submit"
disabled={loading}
className={`w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
>
{loading ? (
  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
) : (
  'Login'
)}
</button>
</form>
</div>
</div>
);
};

export default LoginPage;
