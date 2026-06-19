import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiCheck 
} from 'react-icons/fi';
import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

// --- Types ---
type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export function AcademicYearsPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
  
  // Forms state
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', isActive: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Data ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'academic_years'));
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AcademicYear[];
      
      // Sort: Active first, then by startDate descending
      list.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.startDate.localeCompare(a.startDate);
      });

      setAcademicYears(list);
    } catch (error) {
      console.error("Error fetching academic years:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Helpers ---
  const resetForm = () => {
    setFormData({ name: '', startDate: '', endDate: '', isActive: false });
    setSelectedYear(null);
  };

  // --- Activate Handler ---
  const handleActivate = async (id: string) => {
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      
      academicYears.forEach((year) => {
        const yearRef = doc(db, 'academic_years', year.id);
        if (year.id === id) {
          batch.update(yearRef, { isActive: true });
        } else if (year.isActive) {
          batch.update(yearRef, { isActive: false });
        }
      });

      await batch.commit();
      
      setAcademicYears(prev => 
        prev.map(year => ({
          ...year,
          isActive: year.id === id
        }))
      );
    } catch (error) {
      console.error("Error activating academic year:", error);
      alert("Failed to activate academic year.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // If the new one is set to active, we must deactivate all others
      const batch = writeBatch(db);
      const newYearData = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: formData.isActive || academicYears.length === 0, // auto-activate if first one
        created_at: serverTimestamp()
      };

      // Create new doc reference
      const newDocRef = doc(collection(db, 'academic_years'));
      batch.set(newDocRef, newYearData);

      if (newYearData.isActive) {
        academicYears.forEach((year) => {
          if (year.isActive) {
            batch.update(doc(db, 'academic_years', year.id), { isActive: false });
          }
        });
      }

      await batch.commit();

      const createdYear: AcademicYear = {
        id: newDocRef.id,
        name: newYearData.name,
        startDate: newYearData.startDate,
        endDate: newYearData.endDate,
        isActive: newYearData.isActive
      };

      // Update state
      let updatedList = [...academicYears];
      if (createdYear.isActive) {
        updatedList = updatedList.map(y => ({ ...y, isActive: false }));
      }
      updatedList.push(createdYear);
      
      // Sort updated list
      updatedList.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.startDate.localeCompare(a.startDate);
      });

      setAcademicYears(updatedList);
      setIsAddModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error adding academic year:", error);
      alert("Failed to add academic year.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (year: AcademicYear) => {
    setSelectedYear(year);
    setFormData({
      name: year.name,
      startDate: year.startDate,
      endDate: year.endDate,
      isActive: year.isActive
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYear) return;
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const updateData = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: formData.isActive
      };

      batch.update(doc(db, 'academic_years', selectedYear.id), updateData);

      // If active changes to true, deactivate all others
      if (updateData.isActive && !selectedYear.isActive) {
        academicYears.forEach((year) => {
          if (year.id !== selectedYear.id && year.isActive) {
            batch.update(doc(db, 'academic_years', year.id), { isActive: false });
          }
        });
      }

      await batch.commit();
      
      let updatedList = academicYears.map(year => 
        year.id === selectedYear.id 
          ? { ...year, ...updateData } 
          : (updateData.isActive ? { ...year, isActive: false } : year)
      );

      // Sort
      updatedList.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.startDate.localeCompare(a.startDate);
      });

      setAcademicYears(updatedList);
      setIsEditModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error updating academic year:", error);
      alert("Failed to update academic year.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (year: AcademicYear) => {
    if (year.isActive) {
      alert("You cannot delete the active academic year. Please activate another one first.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the academic year "${year.name}"?`)) return;
    
    try {
      await deleteDoc(doc(db, 'academic_years', year.id));
      setAcademicYears(academicYears.filter(y => y.id !== year.id));
    } catch (error) {
      console.error("Error deleting academic year:", error);
      alert("Failed to delete academic year.");
    }
  };

  // --- Filtered Data ---
  const filteredYears = useMemo(() => {
    return academicYears.filter(year => 
      year.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [academicYears, searchTerm]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Academic Year Management</h1>
          <p className="text-gray-500 text-sm mt-1">Configure academic years. Note that only one year can be active at a time.</p>
        </div>
        
        <button 
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors sm:w-auto"
        >
          <FiPlus className="mr-2" /> Add Academic Year
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search academic years..."
              className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

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
                  <th className="py-4 px-6 font-semibold text-gray-700">Start Date</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">End Date</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Status</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 w-48 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredYears.length > 0 ? (
                  filteredYears.map((year) => (
                    <tr key={year.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-800">
                        {year.name}
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {year.startDate}
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {year.endDate}
                      </td>
                      <td className="py-4 px-6">
                        {year.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <FiCheck className="mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center space-x-3">
                          {!year.isActive && (
                            <button
                              onClick={() => handleActivate(year.id)}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded transition-colors"
                              title="Activate Year"
                            >
                              Activate
                            </button>
                          )}
                          <button 
                            onClick={() => handleEditClick(year)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(year)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      {academicYears.length === 0 ? "No academic years found. Add one to get started." : "No academic years match your filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800">Add Academic Year</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. 2025 - 2026"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Set as Active Academic Year
                  </label>
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
                  {isSubmitting ? 'Saving...' : 'Save Academic Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800">Edit Academic Year</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActiveEdit"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={formData.isActive}
                    disabled={selectedYear?.isActive} // Cannot deactivate from here, must activate another instead
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <label htmlFor="isActiveEdit" className="ml-2 block text-sm text-gray-900">
                    Set as Active Academic Year {selectedYear?.isActive && <span className="text-xs text-gray-400">(Already active)</span>}
                  </label>
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
                  {isSubmitting ? 'Updating...' : 'Update Academic Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
