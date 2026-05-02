import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, 
  FiUser, FiMail, FiBriefcase, FiX, FiCheck, FiAlertCircle, 
  FiClock, FiBook, FiUsers, FiCopy, FiLoader, FiLock
} from 'react-icons/fi';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, firebaseConfig } from '../firebase';

// --- Types ---
type Faculty = {
  id: string;
  name: string;
  email: string;
  department_id: string;
  department_name: string;
  status: 'active' | 'inactive';
  role: 'teacher';
};

type Department = {
  id: string;
  name: string;
};

type TimetableEntry = {
  id: string;
  class: string;
  subject: string;
  teacher_id: string;
  time: string;
};

export function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  
  // Forms state
  const [formData, setFormData] = useState({ name: '', email: '', password: '', department_id: '', department_name: '', status: 'active' as 'active' | 'inactive' });
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // --- Helpers ---
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };



  // --- Fetch Data ---
  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'faculty'));
        const facultyData: Faculty[] = [];
        querySnapshot.forEach((doc) => {
          facultyData.push({ id: doc.id, ...doc.data() } as Faculty);
        });
        setFaculty(facultyData);
      } catch (error) {
        console.error('Error fetching faculty:', error);
        showToast('Failed to load faculty data', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    const fetchDepartments = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'departments'));
        const deptData: Department[] = [];
        querySnapshot.forEach((doc) => {
          deptData.push({ id: doc.id, ...doc.data() } as Department);
        });
        setDepartments(deptData);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };

    fetchFaculty();
    fetchDepartments();
  }, []);

  const fetchTimetableForFaculty = async (teacherId: string) => {
    try {
      const q = query(collection(db, 'timetable'), where('teacher_id', '==', teacherId));
      const querySnapshot = await getDocs(q);
      const timetableData: TimetableEntry[] = [];
      querySnapshot.forEach((doc) => {
        timetableData.push({ id: doc.id, ...doc.data() } as TimetableEntry);
      });
      setTimetable(timetableData);
    } catch (error) {
      console.error('Error fetching timetable:', error);
      showToast('Failed to load timetable', 'error');
    }
  };

  // --- Actions ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Step 1: Create user in Firebase Auth
      // Use the password manually entered by the admin
      const newPassword = formData.password; 
      
      // Create a secondary Firebase app instance specifically for user creation
      // This prevents the admin from being automatically logged out when the new user is created.
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, newPassword);
      const uid = userCredential.user.uid;

      // Sign out of the secondary app and clean up
      await secondaryAuth.signOut();

      // Step 2 & 3: Store faculty data in Firestore using Auth UID (Running as the Admin)
      const facultyData = {
        name: formData.name,
        email: formData.email,
        department_id: formData.department_id,
        department_name: formData.department_name,
        status: formData.status,
        role: 'teacher' as const,
        created_at: serverTimestamp()
      };
      
      await setDoc(doc(db, 'faculty', uid), facultyData);

      const newFaculty: Faculty = {
        id: uid,
        ...facultyData,
      } as Faculty;
      
      setFaculty([...faculty, newFaculty]);
      setCreatedPassword(newPassword);
      showToast('Faculty created successfully!', 'success');
      // Intentionally not closing modal to show password
    } catch (error) {
      console.error('Error adding faculty:', error);
      showToast(error instanceof Error ? error.message : 'Error creating faculty account', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setIsSubmitting(true);
    try {
      const facultyRef = doc(db, 'faculty', selectedFaculty.id);
      await updateDoc(facultyRef, {
        name: formData.name,
        department_id: formData.department_id,
        department_name: formData.department_name,
        status: formData.status,
      });
      
      const updatedList = faculty.map((f) =>
        f.id === selectedFaculty.id
          ? { ...f, name: formData.name, department_id: formData.department_id, department_name: formData.department_name, status: formData.status }
          : f
      );
      setFaculty(updatedList);
      setIsEditModalOpen(false);
      showToast('Faculty updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating faculty:', error);
      showToast('Failed to update faculty', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this faculty member? (Only removes Firestore record)')) {
      try {
        await deleteDoc(doc(db, 'faculty', id));
        setFaculty(faculty.filter((f) => f.id !== id));
        showToast('Faculty deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting faculty:', error);
        showToast('Failed to delete faculty', 'error');
      }
    }
  };

  const openAdd = () => {
    setFormData({ name: '', email: '', password: '', department_id: '', department_name: '', status: 'active' });
    setCreatedPassword(null);
    setIsAddModalOpen(true);
  };

  const openEdit = (f: Faculty) => {
    setSelectedFaculty(f);
    setFormData({ name: f.name, email: f.email, password: '', department_id: f.department_id, department_name: f.department_name, status: f.status });
    setIsEditModalOpen(true);
  };

  const openView = (f: Faculty) => {
    setSelectedFaculty(f);
    fetchTimetableForFaculty(f.id);
    setIsViewModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  // --- Filtering ---
  const filteredFaculty = useMemo(() => {
    return faculty.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.department_name && f.department_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [faculty, searchTerm]);

  const assignedSchedule = selectedFaculty 
      ? timetable.filter(t => t.teacher_id === selectedFaculty.id) 
      : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900/95 backdrop-blur-sm px-6 py-4 text-white shadow-2xl animate-in slide-in-from-top-5">
          {toast.type === 'success' ? <FiCheck className="text-emerald-400 text-xl" /> : <FiAlertCircle className="text-red-400 text-xl" />}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Faculty Directory</h1>
          <p className="mt-2 text-slate-500 font-medium">Manage teacher accounts and access credentials</p>
        </div>
        <button
          onClick={openAdd}
          className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <FiPlus className="text-lg transition-transform group-hover:rotate-90" />
          Add New Faculty
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
        <input 
          type="text" 
          placeholder="Search by name, email, or department..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 font-medium"
        />
      </div>

      {/* Faculty List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <FiLoader className="text-4xl animate-spin text-blue-600 mb-4" />
            <p className="font-medium">Loading faculty directory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="px-8 py-5">Faculty Member</th>
                  <th className="px-8 py-5">Department</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFaculty.map((f) => (
                  <tr key={f.id} className="group transition-colors hover:bg-blue-50/50">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-base">{f.name}</div>
                          <div className="text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <FiMail className="text-xs" />
                            {f.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-700 font-medium bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
                        <FiBriefcase className="text-slate-400" />
                          {f.department_name}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                          f.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${f.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openView(f)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Details">
                          <FiEye className="text-lg" />
                        </button>
                        <button onClick={() => openEdit(f)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit">
                          <FiEdit2 className="text-lg" />
                        </button>
                        <button onClick={() => handleDelete(f.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                          <FiTrash2 className="text-lg" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFaculty.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-16 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                        <FiUsers className="text-2xl text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-semibold mb-1">No faculty found</p>
                      <p className="text-slate-500 text-sm">We couldn't find anyone matching your search criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- ADD MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => !createdPassword && setIsAddModalOpen(false)}></div>
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <h2 className="text-xl font-bold text-slate-900">Add New Faculty</h2>
              {!createdPassword && (
                <button onClick={() => setIsAddModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <FiX className="text-xl" />
                </button>
              )}
            </div>
            
            <div className="p-8">
              {createdPassword ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <FiCheck className="text-3xl text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="mb-2 text-xl font-bold text-slate-900">Account Created!</h3>
                    <p className="text-sm text-slate-500">Please securely copy these credentials. For security reasons, the password <span className="font-bold text-red-500">cannot be viewed again</span>.</p>
                  </div>
                  
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</div>
                        <div className="mt-1 font-medium text-slate-900">{formData.email}</div>
                      </div>
                      <button onClick={() => copyToClipboard(formData.email)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <FiCopy className="text-lg" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4 bg-amber-50/50">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Temporary Password</div>
                        <div className="mt-1 font-mono font-bold text-amber-900 tracking-wider text-lg">{createdPassword}</div>
                      </div>
                      <button onClick={() => copyToClipboard(createdPassword)} className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors">
                        <FiCopy className="text-lg" />
                      </button>
                    </div>
                  </div>
                  
                  <button onClick={() => {
                    setIsAddModalOpen(false);
                    setCreatedPassword(null);
                      setFormData({ name: '', email: '', password: '', department_id: '', department_name: '', status: 'active' });
                  }} className="w-full rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold text-white transition-colors hover:bg-slate-800">
                    Done & Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="e.g. Dr. Sarah Jenkins" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email Address</label>
                    <div className="relative">
                      <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="sarah.jenkins@college.edu" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1">
                      <FiAlertCircle /> Use a strong password for better security.
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Set Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input required type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="••••••••" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Department</label>
                    <div className="relative">
                      <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select required value={formData.department_id} onChange={e => {
                          const dept = departments.find(d => d.id === e.target.value);
                          setFormData({ ...formData, department_id: e.target.value, department_name: dept?.name || '' });
                        }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none">
                          <option value="" disabled>Select Department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                    </div>
                  </div>
                  
                  <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed">
                      {isSubmitting ? <FiLoader className="animate-spin text-lg" /> : 'Create Account'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {isEditModalOpen && selectedFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <h2 className="text-xl font-bold text-slate-900">Edit Faculty Profile</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            
            <div className="p-8">
              <form onSubmit={handleEditSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Email Address <span className="text-slate-400 font-normal">(Cannot be changed)</span></label>
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input disabled type="email" value={formData.email} className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 pl-11 pr-4 text-sm font-medium text-slate-500 cursor-not-allowed opacity-70" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Department</label>
                  <div className="relative">
                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select required value={formData.department_id} onChange={e => {
                        const dept = departments.find(d => d.id === e.target.value);
                        setFormData({ ...formData, department_id: e.target.value, department_name: dept?.name || '' });
                      }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none">
                        <option value="" disabled>Select Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setFormData({...formData, status: 'active'})} className={`py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${formData.status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      <div className={`w-2 h-2 rounded-full ${formData.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      Active
                    </button>
                    <button type="button" onClick={() => setFormData({...formData, status: 'inactive'})} className={`py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${formData.status === 'inactive' ? 'bg-slate-100 border-slate-300 text-slate-700 ring-2 ring-slate-500/20' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      <div className={`w-2 h-2 rounded-full ${formData.status === 'inactive' ? 'bg-slate-500' : 'bg-slate-300'}`}></div>
                      Inactive
                    </button>
                  </div>
                </div>
                
                <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed">
                    {isSubmitting ? <FiLoader className="animate-spin text-lg" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW MODAL (DETAILS + TIMETABLE) --- */}
      {isViewModalOpen && selectedFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-2xl shadow-lg shadow-blue-600/20">
                  {selectedFaculty.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedFaculty.name}</h2>
                  <div className="text-slate-500 text-sm font-medium mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1.5"><FiBriefcase className="text-slate-400" /> {selectedFaculty.department_name}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${selectedFaculty.status === 'active' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {selectedFaculty.status}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors bg-white shadow-sm border border-slate-200">
                <FiX className="text-xl" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Contact Info */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Information</h3>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <FiMail />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</div>
                    <div className="mt-0.5 font-medium text-slate-900">{selectedFaculty.email}</div>
                  </div>
                </div>
              </div>

              {/* Assigned Schedule */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assigned Schedule</h3>
                  <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    Read Only
                  </div>
                </div>
                
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Class</th>
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4 text-right">Time Slot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignedSchedule.map(slot => (
                        <tr key={slot.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                              <FiUsers className="text-slate-400" />
                              {slot.class}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 font-medium text-slate-700">
                              <FiBook className="text-blue-500" />
                              {slot.subject}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-2 font-mono font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                              <FiClock className="text-slate-400" />
                              {slot.time}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {assignedSchedule.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 mb-3">
                              <FiClock className="text-xl text-slate-400" />
                            </div>
                            <p className="text-slate-900 font-semibold mb-1">No Schedule Assigned</p>
                            <p className="text-slate-500 text-sm">Teaching assignments are managed via the Timetable module.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-100 px-8 py-5 bg-slate-50/50 flex justify-end">
              <button onClick={() => setIsViewModalOpen(false)} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-md">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}