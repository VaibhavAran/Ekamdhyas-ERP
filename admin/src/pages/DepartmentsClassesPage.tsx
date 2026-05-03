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

interface Batch {
  id: string;
  class_id: string;
  class_name: string;
  batch_name: string;
  roll_start: number;
  roll_end: number;
}

export function DepartmentsClassesPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'classes' | 'batches'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  
  // Forms
  const [deptForm, setDeptForm] = useState({ id: '', name: '' });
  const [classForm, setClassForm] = useState({ id: '', name: '', department_id: '' });
  const [batchForm, setBatchForm] = useState({ id: '', class_id: '', batch_name: '', roll_start: '', roll_end: '' });

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

      // Fetch Batches
      const batchesSnap = await getDocs(collection(db, 'batches'));
      const batchesData = batchesSnap.docs.map(b => ({ id: b.id, ...b.data() } as Batch));
      setBatches(batchesData);
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

  // ----- Batch Handlers -----
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.class_id || !batchForm.batch_name) return;
    try {
      const className = classes.find(c => c.id === batchForm.class_id)?.name || '';
      const rollStart = parseInt(batchForm.roll_start) || 0;
      const rollEnd = parseInt(batchForm.roll_end) || 0;
      
      if (batchForm.id) {
        // Edit
        await updateDoc(doc(db, 'batches', batchForm.id), {
          class_id: batchForm.class_id,
          class_name: className,
          batch_name: batchForm.batch_name,
          roll_start: rollStart,
          roll_end: rollEnd
        });
        showToast('Batch updated', 'success');
      } else {
        // Add
        await addDoc(collection(db, 'batches'), {
          class_id: batchForm.class_id,
          class_name: className,
          batch_name: batchForm.batch_name,
          roll_start: rollStart,
          roll_end: rollEnd,
          created_at: serverTimestamp()
        });
        showToast('Batch added', 'success');
      }
      setShowBatchModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error saving batch', 'error');
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this batch?")) return;
    try {
      await deleteDoc(doc(db, 'batches', id));
      showToast('Batch deleted', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error deleting batch', 'error');
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
        <button
          onClick={() => setActiveTab('batches')}
          className={`py-2 px-4 focus:outline-none ${activeTab === 'batches' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Batches
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

      {/* Render Batches Tab */}
      {activeTab === 'batches' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">All Batches</h2>
            <button 
              onClick={() => { 
                if (classes.length === 0) {
                  showToast('Please create a class first', 'error');
                  return;
                }
                setBatchForm({ id: '', class_id: '', batch_name: '', roll_start: '', roll_end: '' }); 
                setShowBatchModal(true); 
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center shadow-sm hover:bg-indigo-700"
            >
              <AiOutlinePlus className="mr-2" /> Add Batch
            </button>
          </div>

          <div className="space-y-6">
            {classes.filter(c => batches.some(b => b.class_id === c.id)).length === 0 && !isLoading && (
               <div className="bg-white rounded-lg shadow p-8 text-center border border-dashed border-gray-200">
                  <p className="text-gray-500">No batches have been assigned to any classes yet.</p>
               </div>
            )}

            {classes.filter(c => batches.some(b => b.class_id === c.id)).map(cls => (
              <div key={cls.id} className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                <div className="bg-slate-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-indigo-900">{cls.name} <span className="text-xs text-slate-400 font-normal ml-2">({cls.department_name})</span></h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {batches.filter(b => b.class_id === cls.id).length} Batches
                  </span>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Batch Name</th>
                      <th className="px-6 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Roll Range</th>
                      <th className="px-6 py-2 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {batches.filter(b => b.class_id === cls.id).map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold">{b.batch_name}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">{b.roll_start} - {b.roll_end}</span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => { setBatchForm({ id: b.id, class_id: b.class_id, batch_name: b.batch_name, roll_start: b.roll_start.toString(), roll_end: b.roll_end.toString() }); setShowBatchModal(true); }}
                            className="text-indigo-600 hover:text-indigo-900 mx-2"
                            title="Edit"
                          ><AiOutlineEdit size={18} /></button>
                          <button 
                            onClick={() => handleDeleteBatch(b.id)}
                            className="text-red-600 hover:text-red-900 mx-2"
                            title="Delete"
                          ><AiOutlineDelete size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Floating Batches (without valid class mapping, if any) */}
            {batches.filter(b => !classes.some(c => c.id === b.class_id)).length > 0 && (
               <div className="bg-amber-50 rounded-lg shadow overflow-hidden border border-amber-200">
                  <div className="bg-amber-100 px-6 py-3 border-b border-amber-200">
                    <h3 className="font-bold text-amber-900">Unassigned Batches</h3>
                  </div>
                  <table className="min-w-full divide-y divide-amber-200">
                     {/* ... same table structure ... */}
                     <tbody className="bg-white divide-y divide-amber-50">
                        {batches.filter(b => !classes.some(c => c.id === b.class_id)).map(b => (
                           <tr key={b.id}>
                              <td className="px-6 py-3 text-sm font-semibold">{b.batch_name}</td>
                              <td className="px-6 py-3 text-sm text-slate-500">{b.roll_start} - {b.roll_end}</td>
                              <td className="px-6 py-3 text-right">
                                 <button onClick={() => handleDeleteBatch(b.id)} className="text-red-600"><AiOutlineDelete size={18} /></button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
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

      {/* Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">{batchForm.id ? 'Edit Batch' : 'Add Batch'}</h2>
              <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-gray-600">
                <AiOutlineClose size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveBatch} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class <span className="text-red-500">*</span></label>
                <select
                  required
                  value={batchForm.class_id}
                  onChange={(e) => setBatchForm({ ...batchForm, class_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                >
                  <option value="" disabled>Select Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.department_name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Name <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={batchForm.batch_name}
                  onChange={(e) => setBatchForm({ ...batchForm, batch_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="e.g. Batch 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Start <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="number"
                    value={batchForm.roll_start}
                    onChange={(e) => setBatchForm({ ...batchForm, roll_start: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    placeholder="e.g. 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll End <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="number"
                    value={batchForm.roll_end}
                    onChange={(e) => setBatchForm({ ...batchForm, roll_end: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}