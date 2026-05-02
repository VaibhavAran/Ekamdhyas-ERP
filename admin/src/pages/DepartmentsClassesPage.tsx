import { useState, useEffect } from 'react';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  AiOutlinePlus, AiOutlineEdit, AiOutlineDelete, AiOutlineClose 
} from 'react-icons/ai';

// Types
interface Department {
  id: string;
  name: string;
  created_at?: unknown;
}

interface ClassModel {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
  created_at?: unknown;
}

export function DepartmentsClassesPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'classes'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  
  // Forms
  const [deptForm, setDeptForm] = useState({ id: '', name: '' });
  const [classForm, setClassForm] = useState({ id: '', name: '', department_id: '' });

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Departments
      const deptSnap = await getDocs(collection(db, 'departments'));
      const deptsData = deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
      setDepartments(deptsData);

      // Fetch Classes
      const classesSnap = await getDocs(collection(db, 'classes'));
      const classesData = classesSnap.docs.map(c => ({ id: c.id, ...c.data() } as ClassModel));
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

  // Compute total classes for a department
  const getClassesCount = (deptId: string) => {
    return classes.filter(c => c.department_id === deptId).length;
  };

  // ----- Department Handlers -----
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name) return;
    try {
      if (deptForm.id) {
        // Edit
        await updateDoc(doc(db, 'departments', deptForm.id), {
          name: deptForm.name
        });
        showToast('Department updated', 'success');
      } else {
        // Add
        await addDoc(collection(db, 'departments'), {
          name: deptForm.name,
          created_at: serverTimestamp()
        });
        showToast('Department added', 'success');
      }
      setShowDeptModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error saving department', 'error');
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (getClassesCount(id) > 0) {
      showToast('Cannot delete department with assigned classes', 'error');
      return;
    }
    if (!window.confirm("Are you sure you want to delete this department?")) return;
    try {
      await deleteDoc(doc(db, 'departments', id));
      showToast('Department deleted', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error deleting department', 'error');
    }
  };

  // ----- Class Handlers -----
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name || !classForm.department_id) return;
    try {
      const deptName = departments.find(d => d.id === classForm.department_id)?.name || '';
      
      if (classForm.id) {
        // Edit
        await updateDoc(doc(db, 'classes', classForm.id), {
          name: classForm.name,
          department_id: classForm.department_id,
          department_name: deptName
        });
        showToast('Class updated', 'success');
      } else {
        // Add
        await addDoc(collection(db, 'classes'), {
          name: classForm.name,
          department_id: classForm.department_id,
          department_name: deptName,
          created_at: serverTimestamp()
        });
        showToast('Class added', 'success');
      }
      setShowClassModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error saving class', 'error');
    }
  };

  const handleDeleteClass = async (id: string) => {
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

  return (
    <div className="page-container p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Departments & Classes</h1>
          <p className="text-gray-500 text-sm mt-1">Manage academic organization structure</p>
        </div>
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 p-4 rounded bg-white shadow-lg border-l-4 z-50 transition-all ${
          toast.type === 'success' ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('departments')}
          className={`py-2 px-4 focus:outline-none ${activeTab === 'departments' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Departments
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`py-2 px-4 focus:outline-none ${activeTab === 'classes' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Classes
        </button>
      </div>

      {/* Render Department Tab */}
      {activeTab === 'departments' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">All Departments</h2>
            <button 
              onClick={() => { setDeptForm({ id: '', name: '' }); setShowDeptModal(true); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center shadow-sm hover:bg-indigo-700"
            >
              <AiOutlinePlus className="mr-2" /> Add Department
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Classes</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Loading...</td></tr>
                ) : departments.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No departments found</td></tr>
                ) : departments.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{d.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {getClassesCount(d.id)} Classes
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => { setDeptForm({ id: d.id, name: d.name }); setShowDeptModal(true); }}
                        className="text-indigo-600 hover:text-indigo-900 mx-2"
                        title="Edit"
                      ><AiOutlineEdit size={18} /></button>
                      <button 
                        onClick={() => handleDeleteDept(d.id)}
                        className="text-red-600 hover:text-red-900 mx-2"
                        title="Delete"
                      ><AiOutlineDelete size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Render Classes Tab */}
      {activeTab === 'classes' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">All Classes</h2>
            <button 
              onClick={() => { 
                if (departments.length === 0) {
                  showToast('Please create a department first', 'error');
                  return;
                }
                setClassForm({ id: '', name: '', department_id: '' }); 
                setShowClassModal(true); 
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center shadow-sm hover:bg-indigo-700"
            >
              <AiOutlinePlus className="mr-2" /> Add Class
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Loading...</td></tr>
                ) : classes.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No classes found</td></tr>
                ) : classes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{c.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.department_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => { setClassForm({ id: c.id, name: c.name, department_id: c.department_id }); setShowClassModal(true); }}
                        className="text-indigo-600 hover:text-indigo-900 mx-2"
                        title="Edit"
                      ><AiOutlineEdit size={18} /></button>
                      <button 
                        onClick={() => handleDeleteClass(c.id)}
                        className="text-red-600 hover:text-red-900 mx-2"
                        title="Delete"
                      ><AiOutlineDelete size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Dept Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">{deptForm.id ? 'Edit Department' : 'Add Department'}</h2>
              <button onClick={() => setShowDeptModal(false)} className="text-gray-400 hover:text-gray-600">
                <AiOutlineClose size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveDept} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowDeptModal(false)} className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">{classForm.id ? 'Edit Class' : 'Add Class'}</h2>
              <button onClick={() => setShowClassModal(false)} className="text-gray-400 hover:text-gray-600">
                <AiOutlineClose size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="e.g. CSE-A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                <select
                  required
                  value={classForm.department_id}
                  onChange={(e) => setClassForm({ ...classForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowClassModal(false)} className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}