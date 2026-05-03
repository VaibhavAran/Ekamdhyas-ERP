import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiFilter
} from 'react-icons/fi';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// --- Types ---
type Subject = {
  id: string;
  name: string;
  code: string;
  department_id: string;
  department_name: string;
};

type Department = {
  id: string;
  name: string;
};

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  
  // Forms state
  const [formData, setFormData] = useState({ name: '', code: '', department_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Data ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Departments
      const deptSnapshot = await getDocs(collection(db, 'departments'));
      const deptList = deptSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Department[];
      setDepartments(deptList);

      // Fetch Subjects
      const subjSnapshot = await getDocs(collection(db, 'subjects'));
      const subjList = subjSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];
      setSubjects(subjList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Helpers ---
  const resetForm = () => {
    setFormData({ name: '', code: '', department_id: '' });
    setSelectedSubject(null);
  };

  // --- Handlers ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedDept = departments.find(d => d.id === formData.department_id);
      
      const newSubjectData = {
        name: formData.name,
        code: formData.code,
        department_id: formData.department_id,
        department_name: selectedDept?.name || '',
        created_at: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'subjects'), newSubjectData);
      
      setSubjects([...subjects, { id: docRef.id, ...newSubjectData } as Subject]);
      
      setIsAddModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error adding subject:", error);
      alert("Failed to add subject. See console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (subject: Subject) => {
    setSelectedSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code,
      department_id: subject.department_id
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    
    setIsSubmitting(true);
    try {
      const selectedDept = departments.find(d => d.id === formData.department_id);
      
      const updateData = {
        name: formData.name,
        code: formData.code,
        department_id: formData.department_id,
        department_name: selectedDept?.name || ''
      };

      await updateDoc(doc(db, 'subjects', selectedSubject.id), updateData);
      
      setSubjects(subjects.map(subj => 
        subj.id === selectedSubject.id 
          ? { ...subj, ...updateData } 
          : subj
      ));
      
      setIsEditModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error updating subject:", error);
      alert("Failed to update subject.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;
    
    try {
      await deleteDoc(doc(db, 'subjects', id));
      setSubjects(subjects.filter(subj => subj.id !== id));
    } catch (error) {
      console.error("Error deleting subject:", error);
      alert("Failed to delete subject.");
    }
  };

  // --- Derived Data ---
  const filteredSubjects = useMemo(() => {
    return subjects.filter(subject => {
      const matchesSearch = subject.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            subject.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = filterDepartmentId ? subject.department_id === filterDepartmentId : true;
      return matchesSearch && matchesDept;
    });
  }, [subjects, searchTerm, filterDepartmentId]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Subjects Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage subjects and their department assignments.</p>
        </div>
        
        <button 
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
        >
          <FiPlus className="mr-2" /> Add Subject
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
              placeholder="Search subjects by name or code..."
              className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiFilter className="text-gray-400" />
            </div>
            <select
              className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none bg-white"
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
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
                  <th className="py-4 px-6 font-semibold text-gray-700">Subject Name</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Code</th>
                  <th className="py-4 px-6 font-semibold text-gray-700">Department</th>
                  <th className="py-4 px-6 font-semibold text-gray-700 w-24 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.length > 0 ? (
                  filteredSubjects.map((subject) => (
                    <tr key={subject.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-800">{subject.name}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          {subject.code}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {subject.department_name}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center space-x-3">
                          <button 
                            onClick={() => handleEditClick(subject)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(subject.id)}
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
                    <td colSpan={4} className="py-12 text-center text-gray-500">
                      {subjects.length === 0 ? "No subjects found. Add one to get started." : "No subjects match your filters."}
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
              <h2 className="text-xl font-bold text-gray-800">Add New Subject</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Data Structures"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. CS101"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.department_id}
                    onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                  >
                    <option value="" disabled>Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
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
                  {isSubmitting ? 'Saving...' : 'Save Subject'}
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
              <h2 className="text-xl font-bold text-gray-800">Edit Subject</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={formData.department_id}
                    onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                  >
                    <option value="" disabled>Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
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
                  {isSubmitting ? 'Updating...' : 'Update Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}