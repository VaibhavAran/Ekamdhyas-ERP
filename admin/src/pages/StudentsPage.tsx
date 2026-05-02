import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, 
  FiUser, FiMail, FiBriefcase, FiX, FiCheck, FiAlertCircle, 
  FiClock, FiBook, FiUsers, FiCopy, FiLoader,
  FiCheckCircle, FiXCircle
} from 'react-icons/fi';
import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

interface Student {
  uid: string;
  name: string;
  roll_no: string;
  email: string;
  class_id: string;
  class_name: string;
  department_id: string;
  department_name: string;
  role: string;
  face_registered: boolean;
  status: 'active' | 'inactive';
  created_at: unknown;
}

interface Department {
  id: string;
  name: string;
}

interface ClassModel {
  id: string;
  name: string;
  department_id: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  subject: string;
  class: string;
  date: string;
  status: 'present' | 'absent';
  time: unknown;
}

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allClasses, setAllClasses] = useState<ClassModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // View Details extra state
  const [studentAttendance, setStudentAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    roll_no: '',
    email: '',
    class_id: '',
    class_name: '',
    department_id: '',
    department_name: '',
    status: 'active' as 'active' | 'inactive'
  });
  
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // --- Helpers ---
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'students'), where('role', '==', 'student'));
      const querySnapshot = await getDocs(q);
      const studentsData: Student[] = [];
      querySnapshot.forEach((docSnap) => {
        studentsData.push({ uid: docSnap.id, ...docSnap.data() } as Student);
      });
      setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching students:", error);
      showToast('Failed to load students data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    
    // Fetch departments and classes
    const fetchMetadata = async () => {
      try {
        const dSnap = await getDocs(collection(db, 'departments'));
        setDepartments(dSnap.docs.map(d => ({ id: d.id, name: d.data().name })));

        const cSnap = await getDocs(collection(db, 'classes'));
        setAllClasses(cSnap.docs.map(c => ({ 
          id: c.id, 
          name: c.data().name,
          department_id: c.data().department_id
        })));
      } catch (err) {
        console.error("Error fetching metadata", err);
      }
    };
    fetchMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAttendance = async (studentId: string) => {
    setLoadingAttendance(true);
    try {
      const q = query(collection(db, 'attendance'), where('student_id', '==', studentId));
      const snapshot = await getDocs(q);
      const records: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        records.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
      });
      setStudentAttendance(records);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newPassword = "student@123";
      
      // Step 1: Create user in Firebase Auth using a secondary app
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, newPassword);
      const uid = userCredential.user.uid;

      await secondaryAuth.signOut();

      // Step 2 & 3: Save to Firestore
      const studentData = {
        name: formData.name,
        roll_no: formData.roll_no,
        email: formData.email,
        class_id: formData.class_id,
        class_name: formData.class_name,
        department_id: formData.department_id,
        department_name: formData.department_name,
        role: 'student',
        face_registered: false,
        status: formData.status,
        created_at: serverTimestamp()
      };
      
      await setDoc(doc(db, 'students', uid), studentData);

      const newStudent: Student = { uid, ...studentData } as Student;
      setStudents([...students, newStudent]);
      
      setCreatedPassword(newPassword);
      showToast('Student account created successfully!', 'success');
    } catch (error: unknown) {
      console.error("Error adding student:", error);
      showToast((error as Error).message || 'Error creating student account', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsSubmitting(true);
    try {
      const targetDoc = doc(db, 'students', selectedStudent.uid);
      await updateDoc(targetDoc, {
        name: formData.name,
        roll_no: formData.roll_no,
        class_id: formData.class_id,
        class_name: formData.class_name,
        department_id: formData.department_id,
        department_name: formData.department_name,
        status: formData.status
      });
      
      const updatedList = students.map((s) =>
        s.uid === selectedStudent.uid
          ? { ...s, name: formData.name, roll_no: formData.roll_no, class_id: formData.class_id, class_name: formData.class_name, department_id: formData.department_id, department_name: formData.department_name, status: formData.status }
          : s
      );
      setStudents(updatedList);
      setIsEditModalOpen(false);
      showToast('Student updated successfully!', 'success');
    } catch (error: unknown) {
      console.error("Error updating student:", error);
      showToast('Failed to update student', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('Are you sure you want to delete this student (This only deletes Firestore document)?')) {
      try {
        await deleteDoc(doc(db, 'students', uid));
        setStudents(students.filter((s) => s.uid !== uid));
        showToast('Student deleted successfully!', 'success');
      } catch (error: any) {
        console.error("Error deleting student:", error);
        showToast('Failed to delete student', 'error');
      }
    }
  };

  const markFaceRegistered = async (uid: string) => {
    if (!window.confirm("Mark as face registered?")) return;
    try {
      await updateDoc(doc(db, 'students', uid), {
        face_registered: true
      });
      
      setStudents(students.map(s => s.uid === uid ? { ...s, face_registered: true } : s));
      
      if (selectedStudent && selectedStudent.uid === uid) {
        setSelectedStudent({ ...selectedStudent, face_registered: true });
      }
      showToast('Face status updated!', 'success');
    } catch (err: any) {
      showToast("Error updating face status", 'error');
    }
  };

  const openView = (student: Student) => {
    setSelectedStudent(student);
    fetchAttendance(student.uid);
    setIsViewModalOpen(true);
  };

  const openEdit = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name,
      roll_no: student.roll_no,
      email: student.email,
      class_id: student.class_id,
      class_name: student.class_name,
      department_id: student.department_id,
      department_name: student.department_name,
      status: student.status
    });
    setIsEditModalOpen(true);
  };

  const openAdd = () => {
    setFormData({ name: '', roll_no: '', email: '', class_id: '', class_name: '', department_id: '', department_name: '', status: 'active' });
    setCreatedPassword(null);
    setIsAddModalOpen(true);
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            student.roll_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            student.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = filterClass ? student.class_name === filterClass : true;
      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, filterClass]);

  const uniqueClasses = Array.from(new Set(students.map(s => s.class_name)));

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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Student Directory</h1>
          <p className="mt-2 text-slate-500 font-medium">Manage student accounts and attendance metrics</p>
        </div>
        <button
          onClick={openAdd}
          className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <FiPlus className="text-lg transition-transform group-hover:rotate-90" />
          Add New Student
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
          <input 
            type="text" 
            placeholder="Search by name, roll no, or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 font-medium"
          />
        </div>
        <div className="w-full sm:w-64">
          <select 
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 px-4 text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium appearance-none cursor-pointer"
          >
            <option value="">All Classes</option>
            {uniqueClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <FiLoader className="text-4xl animate-spin text-blue-600 mb-4" />
            <p className="font-medium">Loading student directory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="px-8 py-5">Student Info</th>
                  <th className="px-8 py-5">Roll No</th>
                  <th className="px-8 py-5">Class/Dept</th>
                  <th className="px-8 py-5">Face Data</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.uid} className="group transition-colors hover:bg-blue-50/50">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-base">{s.name}</div>
                          <div className="text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <FiMail className="text-xs" />
                            {s.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-mono font-medium text-slate-700 bg-slate-50 px-3 py-1 rounded inline-block border border-slate-200">{s.roll_no}</div>
                    </td>
                    <td className="px-8 py-5">
                        <div className="font-bold text-slate-800">{s.class_name}</div>
                        <div className="text-slate-500 text-xs font-medium uppercase mt-1">{s.department_name}</div>
                    </td>
                    <td className="px-8 py-5">
                      {s.face_registered ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                          <FiCheckCircle className="text-emerald-500" />
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200">
                          <FiXCircle className="text-red-500" />
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                          s.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openView(s)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Profile">
                          <FiEye className="text-lg" />
                        </button>
                        <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit">
                          <FiEdit2 className="text-lg" />
                        </button>
                        <button onClick={() => handleDelete(s.uid)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                          <FiTrash2 className="text-lg" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                        <FiUsers className="text-2xl text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-semibold mb-1">No students found</p>
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
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <h2 className="text-xl font-bold text-slate-900">Add New Student</h2>
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
                      <button type="button" onClick={() => copyToClipboard(formData.email)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <FiCopy className="text-lg" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Roll No</div>
                        <div className="mt-1 font-medium text-slate-900">{formData.roll_no}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4 bg-amber-50/50">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Password</div>
                        <div className="mt-1 font-mono font-bold text-amber-900 tracking-wider text-lg">{createdPassword}</div>
                      </div>
                      <button type="button" onClick={() => copyToClipboard(createdPassword)} className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors">
                        <FiCopy className="text-lg" />
                      </button>
                    </div>
                  </div>
                  
                  <button onClick={() => {
                    setIsAddModalOpen(false);
                    setCreatedPassword(null);
                  }} className="w-full rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold text-white transition-colors hover:bg-slate-800">
                    Done & Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="e.g. John Doe" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Roll Number</label>
                      <input required type="text" value={formData.roll_no} onChange={e => setFormData({ ...formData, roll_no: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="e.g. 23CS101" />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Department</label>
                        <select required value={formData.department_id} onChange={e => {
                          const dept = departments.find(d => d.id === e.target.value);
                          setFormData({ ...formData, department_id: e.target.value, department_name: dept?.name || '', class_id: '', class_name: '' }); 
                        }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none">
                          <option value="" disabled>Select Dept</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Class</label>
                        <select required value={formData.class_id} onChange={e => {
                          const c = allClasses.find(cls => cls.id === e.target.value);
                          setFormData({ ...formData, class_id: e.target.value, class_name: c?.name || '' });
                        }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none pointer-events-auto" disabled={!formData.department_id}>
                          <option value="" disabled>Select Class</option>
                          {allClasses.filter(c => c.department_id === formData.department_id).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email Address</label>
                    <div className="relative">
                      <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="student@college.edu" />
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
      {isEditModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <h2 className="text-xl font-bold text-slate-900">Edit Student Profile</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            
            <div className="p-8 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Roll Number</label>
                      <input required type="text" value={formData.roll_no} onChange={e => setFormData({ ...formData, roll_no: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Department</label>
                        <select required value={formData.department_id} onChange={e => {
                          const dept = departments.find(d => d.id === e.target.value);
                          setFormData({ ...formData, department_id: e.target.value, department_name: dept?.name || '', class_id: '', class_name: '' }); 
                        }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none">
                          <option value="" disabled>Select Dept</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Class</label>
                        <select required value={formData.class_id} onChange={e => {
                          const c = allClasses.find(cls => cls.id === e.target.value);
                          setFormData({ ...formData, class_id: e.target.value, class_name: c?.name || '' });
                        }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none pointer-events-auto" disabled={!formData.department_id}>
                          <option value="" disabled>Select Class</option>
                          {allClasses.filter(c => c.department_id === formData.department_id).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
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

      {/* --- VIEW MODAL --- */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900">Student Area</h2>
              <button onClick={() => setIsViewModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8">
              
              {/* Profile Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                 <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-inner">
                    <span className="text-3xl font-bold">{selectedStudent.name.charAt(0).toUpperCase()}</span>
                 </div>
                 <div className="flex-1">
                    <h3 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                       <span className="flex items-center gap-1.5 text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-md text-sm">
                          <FiBriefcase /> {selectedStudent.roll_no}
                       </span>
                       <span className="flex items-center gap-1.5 text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-md text-sm">
                          <FiBook /> {selectedStudent.class_name}
                       </span>
                       <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                          selectedStudent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedStudent.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {selectedStudent.status}
                        </span>
                    </div>
                 </div>
                 <div>
                    {selectedStudent.face_registered ? (
                      <div className="flex flex-col items-center bg-emerald-50 border border-emerald-100 px-5 py-3 rounded-xl">
                         <FiCheckCircle className="text-emerald-500 text-2xl mb-1" />
                         <span className="text-emerald-700 font-bold text-sm uppercase">Face Registered</span>
                      </div>
                    ) : (
                      <button onClick={() => markFaceRegistered(selectedStudent.uid)} className="flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 px-5 py-3 rounded-xl transition-all group cursor-pointer w-full">
                         <FiPlus className="text-slate-400 group-hover:text-blue-500 text-xl mb-1" />
                         <span className="text-slate-600 group-hover:text-blue-700 font-bold text-sm">Register Face Data</span>
                      </button>
                    )}
                 </div>
              </div>

              {/* Attendance Dashboard */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                   <FiClock className="text-blue-500" /> Attendance Overview
                </h3>
                
                {loadingAttendance ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    <FiLoader className="text-3xl animate-spin text-blue-600 mb-3" />
                     <p className="font-medium">Loading attendance data...</p>
                  </div>
                ) : (
                  <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {(() => {
                      const total = studentAttendance.length;
                      const present = studentAttendance.filter(a => a.status === 'present').length;
                      const absent = total - present;
                      const percent = total > 0 ? Math.round((present / total) * 100) : 0;
                      return (
                        <>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
                            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Total Classes</span>
                            <span className="text-3xl font-black text-slate-800">{total}</span>
                          </div>
                          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center shadow-sm shadow-emerald-100/50">
                            <span className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Present</span>
                            <span className="text-3xl font-black text-emerald-700">{present}</span>
                          </div>
                          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex flex-col items-center justify-center text-center shadow-sm shadow-red-100/50">
                            <span className="text-red-500 font-bold text-xs uppercase tracking-wider mb-1">Absent</span>
                            <span className="text-3xl font-black text-red-700">{absent}</span>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center shadow-sm shadow-blue-100/50">
                            <span className="text-blue-500 font-bold text-xs uppercase tracking-wider mb-1">Attendance Rate</span>
                            <span className="text-3xl font-black text-blue-700">{percent}%</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {studentAttendance.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                         <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-bold border-b border-slate-200">
                           <tr>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Subject</th>
                              <th className="px-6 py-4 text-right">Status</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {studentAttendance.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(record => (
                              <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                 <td className="px-6 py-4 font-medium text-slate-700">{record.date}</td>
                                 <td className="px-6 py-4">
                                     <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded text-slate-600 font-medium">
                                        <FiBook className="text-slate-400" /> {record.subject}
                                     </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${record.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                      {record.status}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 font-medium">
                       No attendance records found yet.
                    </div>
                  )}
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

