import React, { useState, useEffect } from 'react';
import { 
  FiUser, FiLock, FiPlus, FiUsers, FiShield, 
  FiCheckCircle, FiAlertCircle, FiLoader 
} from 'react-icons/fi';
import { 
  collection, query, getDocs, addDoc, 
  serverTimestamp, orderBy, where 
} from 'firebase/firestore';
import { db } from '../firebase';

interface ControllerUser {
  uid: string;
  username: string;
  role: string;
  created_at: any;
}

export function SettingsPage() {
  const [currentUserData, setCurrentUserData] = useState<ControllerUser | null>(null);
  const [controllers, setControllers] = useState<ControllerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  // Add Controller State
  const [addFormData, setAddFormData] = useState({
    username: '',
    password: ''
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- FETCH DATA ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Current Controller Profile using username from localStorage
      const savedUsername = localStorage.getItem('controller-username');
      if (savedUsername) {
        const q = query(collection(db, 'controllers'), where('username', '==', savedUsername.toLowerCase()));
        const controllerSnap = await getDocs(q);
        if (!controllerSnap.empty) {
          const doc = controllerSnap.docs[0];
          setCurrentUserData({ uid: doc.id, ...doc.data() } as ControllerUser);
        }
      }

      // 2. Fetch All Controllers
      const qAll = query(collection(db, 'controllers'), orderBy('created_at', 'desc'));
      const snap = await getDocs(qAll);
      setControllers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as ControllerUser)));
    } catch (err) {
      console.error("Error fetching settings data:", err);
      showToast("Failed to load settings data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- HANDLERS ---

  const handleAddController = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    const cleanUsername = addFormData.username.trim().toLowerCase();
    
    if (!cleanUsername || !addFormData.password) {
      showToast("Please fill all fields", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Check if username already exists
      const q = query(collection(db, 'controllers'), where('username', '==', cleanUsername));
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        showToast("Username already exists", "error");
        setIsSubmitting(false);
        return;
      }

      const newControllerData = {
        username: cleanUsername,
        password: addFormData.password,
        role: 'controller',
        created_at: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'controllers'), newControllerData);
      
      setControllers(prev => [{ uid: docRef.id, ...newControllerData, created_at: new Date() } as ControllerUser, ...prev]);
      setAddFormData({ username: '', password: '' });
      showToast("New controller added successfully", "success");
    } catch (err: any) {
      console.error("Add controller error:", err);
      showToast("Failed to add controller", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiLoader className="animate-spin text-indigo-600 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 space-y-8 animate-in fade-in duration-700">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-6 py-4 text-white shadow-2xl animate-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.type === 'success' ? <FiCheckCircle size={20} /> : <FiAlertCircle size={20} />}
          <p className="font-bold text-sm">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200 text-white">
              <FiShield />
            </div>
            Settings & Security
          </h1>
          <p className="text-slate-500 mt-2 font-medium ml-0 sm:ml-16 text-sm">Manage school controllers</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Controller Profile */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FiUser className="text-blue-600" /> Current Session
              </h2>
            </div>

            <div className="p-8">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner">
                  <FiUser size={48} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 lowercase">{currentUserData?.username || localStorage.getItem('controller-username')}</h3>
                  <p className="text-slate-400 font-medium text-[10px] uppercase tracking-widest mt-1">Active Controller</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl">
            <h4 className="text-blue-800 font-bold text-sm flex items-center gap-2 mb-2">
              <FiShield /> Security Note
            </h4>
            <p className="text-blue-600 text-xs font-medium leading-relaxed">
              Controller accounts are username-based. Ensure you keep your password secure.
            </p>
          </div>
        </div>

        {/* Right Column: Controller Management */}
        <div className="lg:col-span-2 space-y-8">
          {/* Add Controller Form */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FiPlus className="text-indigo-600" /> Create New Controller
              </h2>
            </div>
            <form onSubmit={handleAddController} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Login Username</label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. controller_jane"
                    value={addFormData.username}
                    onChange={e => setAddFormData({...addFormData, username: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Password</label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required
                    type="password" 
                    placeholder="Create secure password"
                    value={addFormData.password}
                    onChange={e => setAddFormData({...addFormData, password: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <button 
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <FiLoader className="animate-spin" /> : <FiPlus />} Create Controller
              </button>
            </form>
          </div>

          {/* Controller List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FiUsers className="text-indigo-600" /> Controller Directory
              </h2>
              <span className="text-xs font-bold text-slate-400">{controllers.length} Total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5">Controller Username</th>
                    <th className="px-8 py-5">System Role</th>
                    <th className="px-8 py-5 text-right">Added On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {controllers.map((controller) => (
                    <tr key={controller.uid} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                            {controller.username.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-900 lowercase">{controller.username}</span>
                          {controller.username === localStorage.getItem('controller-username') && (
                            <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase ml-2">You</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          <FiShield size={10} /> {controller.role}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right text-slate-400 text-xs font-bold">
                        {controller.created_at?.toDate ? controller.created_at.toDate().toLocaleDateString() : 'Just now'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}