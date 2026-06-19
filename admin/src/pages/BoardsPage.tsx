import React, { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiSearch, FiTrash2, FiX, FiCheck,
  FiEye, FiUsers, FiAlertCircle,
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
import type { Board, AcademicYear, Student } from '../types/board';

export function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewStudentsOpen, setIsViewStudentsOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);

  // Forms state
  const [formData, setFormData] = useState({ name: '', academicYearId: '', status: 'active' as 'active' | 'inactive' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Toast ---
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Fetch Data ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [boardsSnap, yearsSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, 'boards')),
        getDocs(collection(db, 'academic_years')),
        getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
      ]);

      const yearsList = yearsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AcademicYear[];
      yearsList.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.startDate.localeCompare(a.startDate);
      });
      setAcademicYears(yearsList);

      const studentsList = studentsSnap.docs.map(d => ({
        uid: d.id,
        ...d.data(),
      })) as Student[];
      setStudents(studentsList);

      const boardsList = boardsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as Board[];
      boardsList.sort((a, b) => {
        const yearA = yearsList.find(y => y.id === a.academicYearId);
        const yearB = yearsList.find(y => y.id === b.academicYearId);
        const yearNameA = yearA?.name || '';
        const yearNameB = yearB?.name || '';
        if (yearNameA !== yearNameB) return yearNameB.localeCompare(yearNameA);
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

  useEffect(() => {
    fetchData();
  }, []);

  // --- Helpers ---
  const resetForm = () => {
    setFormData({ name: '', academicYearId: '', status: 'active' });
    setSelectedBoard(null);
  };

  const getStudentCount = (boardId: string) => {
    return students.filter(s => s.board_id === boardId).length;
  };

  const getYearName = (yearId: string) => {
    return academicYears.find(y => y.id === yearId)?.name || 'Unknown';
  };

  // --- Handlers ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Check duplicate name within same academic year
      const duplicate = boards.find(
        b => b.name.toLowerCase() === formData.name.toLowerCase() && b.academicYearId === formData.academicYearId
      );
      if (duplicate) {
        showToast('A board with this name already exists in the selected academic year', 'error');
        setIsSubmitting(false);
        return;
      }

      const newBoardData = {
        name: formData.name,
        status: formData.status,
        academicYearId: formData.academicYearId,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'boards'), newBoardData);
      const newBoard: Board = {
        id: docRef.id,
        name: newBoardData.name,
        status: newBoardData.status,
        academicYearId: newBoardData.academicYearId,
      };

      let updatedList = [...boards, newBoard];
      updatedList.sort((a, b) => {
        const yearA = academicYears.find(y => y.id === a.academicYearId);
        const yearB = academicYears.find(y => y.id === b.academicYearId);
        const yearNameA = yearA?.name || '';
        const yearNameB = yearB?.name || '';
        if (yearNameA !== yearNameB) return yearNameB.localeCompare(yearNameA);
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name);
      });

      setBoards(updatedList);
      setIsAddModalOpen(false);
      resetForm();
      showToast('Board added successfully!', 'success');
    } catch (error) {
      console.error('Error adding board:', error);
      showToast('Failed to add board', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (board: Board) => {
    setSelectedBoard(board);
    setFormData({
      name: board.name,
      academicYearId: board.academicYearId,
      status: board.status,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard) return;
    setIsSubmitting(true);
    try {
      // Check duplicate name within same academic year (excluding current)
      const duplicate = boards.find(
        b => b.id !== selectedBoard.id &&
          b.name.toLowerCase() === formData.name.toLowerCase() &&
          b.academicYearId === formData.academicYearId
      );
      if (duplicate) {
        showToast('A board with this name already exists in the selected academic year', 'error');
        setIsSubmitting(false);
        return;
      }

      await updateDoc(doc(db, 'boards', selectedBoard.id), {
        name: formData.name,
        academicYearId: formData.academicYearId,
        status: formData.status,
      });

      // Also update board_name on students assigned to this board
      const studentsToUpdate = students.filter(s => s.board_id === selectedBoard.id);
      if (studentsToUpdate.length > 0) {
        const batch = writeBatch(db);
        studentsToUpdate.forEach(s => {
          batch.update(doc(db, 'students', s.uid), {
            board_name: formData.name,
          });
        });
        await batch.commit();
      }

      let updatedList = boards.map(b =>
        b.id === selectedBoard.id
          ? { ...b, name: formData.name, academicYearId: formData.academicYearId, status: formData.status }
          : b
      );
      updatedList.sort((a, b) => {
        const yearA = academicYears.find(y => y.id === a.academicYearId);
        const yearB = academicYears.find(y => y.id === b.academicYearId);
        const yearNameA = yearA?.name || '';
        const yearNameB = yearB?.name || '';
        if (yearNameA !== yearNameB) return yearNameB.localeCompare(yearNameA);
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name);
      });

      setBoards(updatedList);

      // Update students state too
      if (studentsToUpdate.length > 0) {
        setStudents(prev =>
          prev.map(s =>
            s.board_id === selectedBoard!.id ? { ...s, board_name: formData.name } : s
          )
        );
      }

      setIsEditModalOpen(false);
      resetForm();
      showToast('Board updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating board:', error);
      showToast('Failed to update board', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (board: Board) => {
    const newStatus = board.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'boards', board.id), { status: newStatus });
      setBoards(prev =>
        prev.map(b => (b.id === board.id ? { ...b, status: newStatus } : b))
      );
      showToast(`Board ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`, 'success');
    } catch (error) {
      console.error('Error toggling board status:', error);
      showToast('Failed to update board status', 'error');
    }
  };

  const handleDelete = async (board: Board) => {
    const studentCount = getStudentCount(board.id);
    if (studentCount > 0) {
      showToast('Cannot delete board with assigned students. Remove students first.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the board "${board.name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'boards', board.id));
      setBoards(prev => prev.filter(b => b.id !== board.id));
      showToast('Board deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting board:', error);
      showToast('Failed to delete board', 'error');
    }
  };

  const handleViewStudents = (board: Board) => {
    setSelectedBoard(board);
    setIsViewStudentsOpen(true);
  };

  // --- Filtered Data ---
  const filteredBoards = useMemo(() => {
    return boards.filter(board => {
      const matchesSearch = board.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesYear = filterYear ? board.academicYearId === filterYear : true;
      return matchesSearch && matchesYear;
    });
  }, [boards, searchTerm, filterYear]);

  // Students for the selected board in View Students modal
  const boardStudents = useMemo(() => {
    if (!selectedBoard) return [];
    return students
      .filter(s => s.board_id === selectedBoard.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedBoard]);

  return (
    <div className="p-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900/95 backdrop-blur-sm px-6 py-4 text-white shadow-2xl">
          {toast.type === 'success' ? (
            <FiCheck className="text-emerald-400 text-xl" />
          ) : (
            <FiAlertCircle className="text-red-400 text-xl" />
          )}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Board Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage academic boards within each academic year.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setFormData(prev => ({
              ...prev,
              academicYearId: academicYears.find(y => y.isActive)?.id || '',
            }));
            setIsAddModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors sm:w-auto"
        >
          <FiPlus className="mr-2" /> Add Board
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search boards..."
              className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-64">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name} {year.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Boards Table */}
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
                  <th className="py-4 px-6 font-semibold text-gray-700">Academic Year</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Board Name</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Status</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 text-center">Total Students</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBoards.length > 0 ? (
                  filteredBoards.map((board) => (
                    <tr
                      key={board.id}
                      onClick={() => handleEditClick(board)}
                      className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 text-gray-600 font-medium">
                        {getYearName(board.academicYearId)}
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-800">
                        {board.name}
                      </td>
                      <td className="py-4 px-6">
                        {board.status === 'active' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <FiCheck className="mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                          <FiUsers size={14} className="text-gray-500" />
                          {getStudentCount(board.id)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewStudents(board); }}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <FiEye size={16} /> View Students
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      {boards.length === 0
                        ? 'No boards found. Add one to get started.'
                        : 'No boards match your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ADD MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800">Add Board</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Year *
                  </label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    value={formData.academicYearId}
                    onChange={(e) =>
                      setFormData({ ...formData, academicYearId: e.target.value })
                    }
                  >
                    <option value="" disabled>
                      Select Academic Year
                    </option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name} {year.isActive ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Board Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. CBSE, ICSE, State Board"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'active' })}
                      className={`py-2 rounded-lg border font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        formData.status === 'active'
                          ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500/20'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          formData.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      ></div>
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'inactive' })}
                      className={`py-2 rounded-lg border font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        formData.status === 'inactive'
                          ? 'bg-gray-100 border-gray-300 text-gray-700 ring-2 ring-gray-500/20'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          formData.status === 'inactive' ? 'bg-gray-500' : 'bg-gray-300'
                        }`}
                      ></div>
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {isEditModalOpen && selectedBoard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800">Edit Board</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="mb-5">
              <button
                onClick={async () => {
                  await handleToggleStatus(selectedBoard);
                  setIsEditModalOpen(false);
                }}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  selectedBoard.status === 'active'
                    ? 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                {selectedBoard.status === 'active' ? (
                  <><FiAlertCircle size={16} /> Deactivate Board</>
                ) : (
                  <><FiCheck size={16} /> Activate Board</>
                )}
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Year *
                  </label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    value={formData.academicYearId}
                    onChange={(e) =>
                      setFormData({ ...formData, academicYearId: e.target.value })
                    }
                  >
                    <option value="" disabled>
                      Select Academic Year
                    </option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name} {year.isActive ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Board Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'active' })}
                      className={`py-2 rounded-lg border font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        formData.status === 'active'
                          ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500/20'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          formData.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      ></div>
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'inactive' })}
                      className={`py-2 rounded-lg border font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        formData.status === 'inactive'
                          ? 'bg-gray-100 border-gray-300 text-gray-700 ring-2 ring-gray-500/20'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          formData.status === 'inactive' ? 'bg-gray-500' : 'bg-gray-300'
                        }`}
                      ></div>
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Update Board'}
                </button>
              </div>

              {/* Delete Button */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(selectedBoard);
                    setIsEditModalOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  <FiTrash2 size={16} /> Delete Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VIEW STUDENTS MODAL --- */}
      {isViewStudentsOpen && selectedBoard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Students in {selectedBoard.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {getYearName(selectedBoard.academicYearId)} &middot;{' '}
                  {boardStudents.length} student{boardStudents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsViewStudentsOpen(false);
                  setSelectedBoard(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="overflow-y-auto p-8">
              {boardStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Student ID</th>
                        <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Name</th>
                        <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Class</th>
                        <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Division</th>
                        <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boardStudents.map((student) => (
                        <tr
                          key={student.uid}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                              {student.roll_no}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 text-sm">{student.name}</div>
                                <div className="text-gray-500 text-xs">{student.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 font-medium">
                            {student.class_name}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {student.batch_name || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                                student.status === 'active'
                                  ? 'bg-green-100 text-green-800 border border-green-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  student.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                              ></span>
                              {student.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <FiUsers className="mx-auto text-4xl mb-4 text-gray-300" />
                  <p className="font-medium">No students assigned to this board yet.</p>
                  <p className="text-sm mt-1">
                    Students will appear here when assigned to this board.
                  </p>
                </div>
              )}
            </div>

            <div className="px-8 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => {
                  setIsViewStudentsOpen(false);
                  setSelectedBoard(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
