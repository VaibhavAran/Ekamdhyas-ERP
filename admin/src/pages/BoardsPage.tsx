import { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiCheck,
  FiEye, FiUsers, FiAlertCircle, FiLoader,
} from 'react-icons/fi';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Board, Student } from '../types/board';

type BoardForm = {
  name: string;
  status: 'active' | 'inactive';
};

const emptyForm: BoardForm = { name: '', status: 'active' };

export function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewStudentsOpen, setIsViewStudentsOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [form, setForm] = useState<BoardForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [boardsSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, 'boards')),
        getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
      ]);

      setStudents(studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Student)));

      const boardsList = boardsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Board[];
      boardsList.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name);
      });
      setBoards(boardsList);
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getStudentCount = (boardId: string) => students.filter(s => s.board_id === boardId).length;

  const filteredBoards = useMemo(() => {
    return boards.filter(board =>
      board.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boards, searchTerm]);

  const boardStudents = useMemo(() => {
    if (!selectedBoard) return [];
    return students.filter(s => s.board_id === selectedBoard.id).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedBoard]);

  const openAdd = () => {
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (board: Board) => {
    setSelectedBoard(board);
    setForm({ name: board.name, status: board.status });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const duplicate = boards.find(
        b => b.name.toLowerCase() === form.name.toLowerCase() && b.id !== selectedBoard?.id
      );
      if (duplicate) {
        showToast('A board with this name already exists', 'error');
        setIsSubmitting(false);
        return;
      }

      if (selectedBoard) {
        await updateDoc(doc(db, 'boards', selectedBoard.id), {
          name: form.name,
          status: form.status,
        });

        const studentsToUpdate = students.filter(s => s.board_id === selectedBoard.id);
        if (studentsToUpdate.length > 0) {
          const batch = writeBatch(db);
          studentsToUpdate.forEach(s => batch.update(doc(db, 'students', s.uid), { board_name: form.name }));
          await batch.commit();
          setStudents(prev => prev.map(s => s.board_id === selectedBoard!.id ? { ...s, board_name: form.name } : s));
        }

        setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, name: form.name, status: form.status } : b));
        showToast('Board updated successfully!', 'success');
      } else {
        const newBoardData = { name: form.name, status: form.status, createdAt: serverTimestamp() };
        const docRef = await addDoc(collection(db, 'boards'), newBoardData);
        const newBoard: Board = { id: docRef.id, name: newBoardData.name, status: newBoardData.status };
        setBoards(prev => [...prev, newBoard]);
        showToast('Board added successfully!', 'success');
      }

      setIsModalOpen(false);
      setForm(emptyForm);
      setSelectedBoard(null);
      fetchData();
    } catch (error) {
      console.error('Error saving board:', error);
      showToast('Failed to save board', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (board: Board) => {
    const newStatus = board.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'boards', board.id), { status: newStatus });
      setBoards(prev => prev.map(b => b.id === board.id ? { ...b, status: newStatus } : b));
      showToast(`Board ${newStatus === 'active' ? 'activated' : 'deactivated'}!`, 'success');
    } catch (error) {
      console.error('Error toggling board status:', error);
      showToast('Failed to update board status', 'error');
    }
  };

  const handleDelete = async (board: Board) => {
    if (getStudentCount(board.id) > 0) {
      showToast('Cannot delete board with assigned students', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${board.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'boards', board.id));
      setBoards(prev => prev.filter(b => b.id !== board.id));
      showToast('Board deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting board:', error);
      showToast('Failed to delete board', 'error');
    }
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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Board Management</h1>
          <p className="mt-2 text-slate-500 font-medium">Manage academic boards (CBSE, ICSE, State Board, etc.)</p>
        </div>
        <button
          onClick={openAdd}
          className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <FiPlus className="text-lg transition-transform group-hover:rotate-90" />
          Add New Board
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="relative max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search boards..."
            className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
                  <th className="py-4 px-6 font-semibold text-gray-700">Board Name</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 text-center">Students</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 text-center">Status</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 w-32 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBoards.length > 0 ? (
                  filteredBoards.map((board) => (
                    <tr key={board.id} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-gray-900">{board.name}</td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                          <FiUsers size={14} className="text-gray-500" />
                          {getStudentCount(board.id)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${board.status === 'active'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${board.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                          {board.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setSelectedBoard(board); setIsViewStudentsOpen(true); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View Students"
                          ><FiEye size={16} /></button>
                          <button
                            onClick={() => openEdit(board)}
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit"
                          ><FiEdit2 size={16} /></button>
                          <button
                            onClick={() => handleDelete(board)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          ><FiTrash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-500">
                      {boards.length === 0 ? 'No boards found. Add one to get started.' : 'No boards match your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <h2 className="text-xl font-bold text-slate-900">{selectedBoard ? 'Edit Board' : 'Add New Board'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>

            {selectedBoard && (
              <div className="px-8 pt-5">
                <button
                  onClick={async () => { await handleToggleStatus(selectedBoard); setIsModalOpen(false); setSelectedBoard(null); }}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${selectedBoard.status === 'active'
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                >
                  {selectedBoard.status === 'active' ? <><FiAlertCircle size={16} /> Deactivate Board</> : <><FiCheck size={16} /> Activate Board</>}
                </button>
              </div>
            )}

            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Board Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  placeholder="e.g. CBSE, ICSE, State Board"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50">
                  {isSubmitting ? <FiLoader className="animate-spin text-lg" /> : selectedBoard ? 'Update Board' : 'Save Board'}
                </button>
              </div>

              {selectedBoard && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => { handleDelete(selectedBoard); setIsModalOpen(false); setSelectedBoard(null); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-bold hover:bg-red-100 transition-colors"
                  >
                    <FiTrash2 size={16} /> Delete Board
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* View Students Modal */}
      {isViewStudentsOpen && selectedBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => { setIsViewStudentsOpen(false); setSelectedBoard(null); }}></div>
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-2xl shadow-lg shadow-blue-600/20">
                  {selectedBoard.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedBoard.name}</h2>
                  <div className="text-slate-500 text-sm font-medium mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${selectedBoard.status === 'active' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {selectedBoard.status}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => { setIsViewStudentsOpen(false); setSelectedBoard(null); }} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors bg-white shadow-sm border border-slate-200">
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {boardStudents.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Roll No</th>
                        <th className="px-6 py-4">Student</th>
                        <th className="px-6 py-4">Class</th>
                        <th className="px-6 py-4">Division</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {boardStudents.map((student) => (
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
                              <div>
                                <div className="font-semibold text-slate-900">{student.name}</div>
                                <div className="text-slate-500 text-xs">{student.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 font-medium">{student.class_name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{student.batch_name || '-'}</td>
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
                  <p className="text-sm">Students will appear here when assigned to this board.</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-8 py-5 bg-slate-50/50 flex justify-end">
              <button onClick={() => { setIsViewStudentsOpen(false); setSelectedBoard(null); }} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-md">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
