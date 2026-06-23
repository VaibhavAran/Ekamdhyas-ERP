import { useState, useEffect, useMemo } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  query, where
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiCheck, FiEye,
  FiAlertCircle, FiUsers, FiBook, FiAward, FiUser,
} from 'react-icons/fi';
import type { ClassModel, Board } from '../types/board';

interface Faculty {
  id: string;
  name: string;
}

interface Student {
  uid: string;
  name: string;
  roll_no: string;
  email: string;
  class_id: string;
  class_name: string;
  division?: string;
  status: 'active' | 'inactive';
}

type ClassForm = {
  id: string;
  name: string;
  board_id: string;
  board_name: string;
  division: string;
  class_teacher_id: string;
  class_teacher_name: string;
  capacity: string;
  status: 'active' | 'inactive';
};

const emptyForm: ClassForm = {
  id: '',
  name: '',
  board_id: '',
  board_name: '',
  division: '',
  class_teacher_id: '',
  class_teacher_name: '',
  capacity: '',
  status: 'active',
};

export function DepartmentsClassesPage() {
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBoard, setFilterBoard] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassModel | null>(null);
  const [form, setForm] = useState<ClassForm>(emptyForm);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [classSnap, boardSnap, facultySnap, studentSnap] = await Promise.all([
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'boards')),
        getDocs(collection(db, 'faculty')),
        getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
      ]);

      const boardsList = boardSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Board[];
      setBoards(boardsList);

      setFaculty(facultySnap.docs.map(d => ({ id: d.id, name: d.data().name } as Faculty)));

      const studentsList = studentSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Student));
      setStudents(studentsList);

      const classesData = classSnap.docs.map(d => {
        const data = d.data();
        const boardId = data.board_id || '';
        const teacherId = data.class_teacher_id || '';
        return {
          id: d.id,
          name: data.name || '',
          board_id: boardId,
          board_name: data.board_name || boardsList.find(b => b.id === boardId)?.name || '',
          division: data.division || '',
          class_teacher_id: teacherId,
          class_teacher_name: data.class_teacher_name || facultySnap.docs.find(f => f.id === teacherId)?.data().name || '',
          capacity: data.capacity || 0,
          status: data.status || 'active',
          created_at: data.created_at,
        } as ClassModel;
      });

      setClasses(classesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Failed to load data.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStudentCount = (classId: string) => {
    return students.filter(s => s.class_id === classId).length;
  };

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.class_teacher_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBoard = filterBoard ? c.board_id === filterBoard : true;
      return matchSearch && matchBoard;
    });
  }, [classes, searchTerm, filterBoard]);

  const getBoardName = (id: string) => boards.find(b => b.id === id)?.name || 'Unknown';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.board_id) return;
    try {
      const boardName = boards.find(b => b.id === form.board_id)?.name || form.board_name;
      const teacherName = faculty.find(f => f.id === form.class_teacher_id)?.name || form.class_teacher_name;
      const capacityNum = form.capacity ? parseInt(form.capacity, 10) : 0;

      const payload = {
        name: form.name,
        board_id: form.board_id,
        board_name: boardName,
        division: form.division,
        class_teacher_id: form.class_teacher_id,
        class_teacher_name: teacherName,
        capacity: capacityNum,
        status: form.status,
      };

      if (form.id) {
        await updateDoc(doc(db, 'classes', form.id), payload);
        showToast('Class updated', 'success');
      } else {
        await addDoc(collection(db, 'classes'), { ...payload, created_at: serverTimestamp() });
        showToast('Class added', 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error saving class', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (getStudentCount(id) > 0) {
      showToast('Cannot delete class with assigned students', 'error');
      return;
    }
    if (!window.confirm("Are you sure you want to delete this class?")) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
      showToast('Class deleted', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error deleting class', 'error');
    }
  };

  const openAdd = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c: ClassModel) => {
    setForm({
      id: c.id,
      name: c.name,
      board_id: c.board_id,
      board_name: c.board_name,
      division: c.division || '',
      class_teacher_id: c.class_teacher_id || '',
      class_teacher_name: c.class_teacher_name || '',
      capacity: c.capacity ? String(c.capacity) : '',
      status: c.status,
    });
    setShowModal(true);
  };

  const openView = (c: ClassModel) => {
    setSelectedClass(c);
    setShowViewModal(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900/95 backdrop-blur-sm px-6 py-4 text-white shadow-2xl animate-in slide-in-from-top-5">
          {toast.type === 'success' ? <FiCheck className="text-emerald-400 text-xl" /> : <FiAlertCircle className="text-red-400 text-xl" />}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Class Management</h1>
          <p className="mt-2 text-slate-500 font-medium">Manage classes organized by Board</p>
        </div>
        <button
          onClick={openAdd}
          className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <FiPlus className="text-lg transition-transform group-hover:rotate-90" />
          Add New Class
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by class name or teacher..."
              className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-56">
            <select
              value={filterBoard}
              onChange={(e) => setFilterBoard(e.target.value)}
              className="w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">All Boards</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-4 px-6 font-semibold text-gray-700">Board</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Class Name</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Division</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Class Teacher</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 text-center">Capacity</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 text-center">Students</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 text-center">Status</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.length > 0 ? (
                  filteredClasses.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-indigo-50 w-fit px-3 py-1.5 rounded-lg border border-indigo-100">
                          <FiAward className="text-indigo-400" />
                          {c.board_name || getBoardName(c.board_id)}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-gray-900">{c.name}</td>
                      <td className="py-4 px-6 text-gray-600">
                        {c.division ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            {c.division}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {c.class_teacher_name ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold text-xs">
                              {c.class_teacher_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-700 font-medium">{c.class_teacher_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not assigned</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-700">
                          {c.capacity || <span className="text-gray-400">-</span>}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                          <FiUsers size={14} className="text-gray-500" />
                          {getStudentCount(c.id)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === 'active'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                          {c.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openView(c)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View Students"
                          ><FiEye size={16} /></button>
                          <button
                            onClick={() => openEdit(c)}
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit"
                          ><FiEdit2 size={16} /></button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          ><FiTrash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      {classes.length === 0
                        ? 'No classes found. Add one to get started.'
                        : 'No classes match your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur flex items-center justify-between border-b border-slate-100 px-8 py-6 rounded-t-3xl">
              <h2 className="text-xl font-bold text-slate-900">{form.id ? 'Edit Class' : 'Add New Class'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Board <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FiAward className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    required
                    value={form.board_id}
                    onChange={(e) => {
                      const board = boards.find(b => b.id === e.target.value);
                      setForm({ ...form, board_id: e.target.value, board_name: board?.name || '' });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none"
                  >
                    <option value="" disabled>Select Board</option>
                    {boards.filter(b => b.status === 'active').map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Class Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FiBook className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    placeholder="e.g. Class 10, Grade 5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Division</label>
                  <input
                    type="text"
                    value={form.division}
                    onChange={(e) => setForm({ ...form, division: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    placeholder="e.g. A, B"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Capacity</label>
                  <input
                    type="number"
                    min="0"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    placeholder="e.g. 60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Class Teacher</label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={form.class_teacher_id}
                    onChange={(e) => {
                      const teacher = faculty.find(f => f.id === e.target.value);
                      setForm({ ...form, class_teacher_id: e.target.value, class_teacher_name: teacher?.name || '' });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 appearance-none"
                  >
                    <option value="">Select Class Teacher</option>
                    {faculty.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'active' })}
                    className={`py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${form.status === 'active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${form.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'inactive' })}
                    className={`py-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${form.status === 'inactive'
                        ? 'bg-slate-100 border-slate-300 text-slate-700 ring-2 ring-slate-500/20'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${form.status === 'inactive' ? 'bg-slate-500' : 'bg-slate-300'}`}></div>
                    Inactive
                  </button>
                </div>
              </div>

              <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                  {form.id ? 'Update Class' : 'Save Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Students Modal */}
      {showViewModal && selectedClass && (
        <ViewStudentsModal
          classModel={selectedClass}
          students={students.filter(s => s.class_id === selectedClass.id)}
          onClose={() => { setShowViewModal(false); setSelectedClass(null); }}
        />
      )}
    </div>
  );
}

function ViewStudentsModal({ classModel, students, onClose }: { classModel: ClassModel; students: Student[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-2xl shadow-lg shadow-blue-600/20">
              {classModel.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {classModel.name} {classModel.division && `- ${classModel.division}`}
              </h2>
              <div className="text-slate-500 text-sm font-medium mt-1">
                <span className="flex items-center gap-1.5"><FiAward className="text-slate-400" /> {classModel.board_name}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors bg-white shadow-sm border border-slate-200">
            <FiX className="text-xl" />
          </button>
        </div>

        <div className="px-8 py-5 border-b bg-slate-50/50 grid grid-cols-2 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Class Teacher</div>
            <p className="font-semibold text-slate-900">{classModel.class_teacher_name || 'Not assigned'}</p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Capacity</div>
            <p className="font-semibold text-slate-900">{classModel.capacity || 'Not set'}</p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Students Enrolled</div>
            <p className="font-semibold text-slate-900">{students.length}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {students.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Roll No</th>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <tr key={student.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                          {student.roll_no}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{student.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${student.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                <FiUsers className="text-2xl text-slate-400" />
              </div>
              <p className="text-slate-900 font-semibold mb-1">No students assigned yet</p>
              <p className="text-sm">Students will appear here when assigned to this class.</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-8 py-5 bg-slate-50/50 flex justify-end">
          <button onClick={onClose} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-md">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
