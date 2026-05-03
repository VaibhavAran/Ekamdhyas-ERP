import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiAlertCircle } from 'react-icons/fi';

// --- Types ---
type ClassModel = { id: string; name: string };
type Subject = { id: string; name: string };
type Faculty = { id: string; name: string };
type TimetableEntry = {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  day: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  batch_id?: string | null;
  batch_name?: string | null;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_OPTIONS = Array.from({ length: 24 * 4 }).map((_, i) => {
  const h24 = Math.floor(i / 4);
  const h12 = h24 === 0 ? 12 : (h24 > 12 ? h24 - 12 : h24);
  const m = ((i % 4) * 15).toString().padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return {
    value: `${h24.toString().padStart(2, '0')}:${m}`,
    label: `${h12}:${m} ${ampm}`
  };
});

export function TimetablePage() {
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<{id: string, class_id: string, batch_name: string}[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    subject_id: '',
    teacher_id: '',
    day: '',
    start_time: '',
    end_time: '',
    is_break: false,
    batch_id: '',
    batch_name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // --- Fetch Base Data ---
  useEffect(() => {
    const fetchBaseData = async () => {
      setIsPageLoading(true);
      try {
        const [clsSnap, subSnap, facSnap, batchSnap] = await Promise.all([
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'subjects')),
          getDocs(query(collection(db, 'faculty'), where('role', '==', 'teacher'))),
          getDocs(collection(db, 'batches'))
        ]);

        const clsList = clsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setClasses(clsList);
        setSubjects(subSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
        setFaculty(facSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
        setBatches(batchSnap.docs.map(d => ({ id: d.id, class_id: d.data().class_id, batch_name: d.data().batch_name })));
        
        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].id);
        }
      } catch (error) {
        console.error('Error fetching base data', error);
      } finally {
        setIsPageLoading(false);
      }
    };
    fetchBaseData();
  }, []);

  // --- Fetch Timetable for Selected Class ---
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchTimetable = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, 'timetable'), where('class_id', '==', selectedClassId));
        const snap = await getDocs(q);
        setTimetable(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry)));
      } catch (error) {
        console.error('Error fetching timetable', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimetable();
  }, [selectedClassId]);

  // --- Dynamic Time Slots ---
  const dynamicTimeSlots = useMemo(() => {
    const slotsMap = new Map<string, { start: string; end: string }>();
    timetable.forEach(t => {
      const key = `${t.start_time}-${t.end_time}`;
      if (!slotsMap.has(key)) {
        slotsMap.set(key, { start: t.start_time, end: t.end_time });
      }
    });
    
    return Array.from(slotsMap.values()).sort((a, b) => {
      if (a.start < b.start) return -1;
      if (a.start > b.start) return 1;
      return 0;
    });
  }, [timetable]);

  const formatTo12Hour = (time24: string) => {
    if (!time24) return '';
    const [hStr, m] = time24.split(':');
    const h24 = parseInt(hStr, 10);
    const h12 = h24 === 0 ? 12 : (h24 > 12 ? h24 - 12 : h24);
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    return `${h12}:${m} ${ampm}`;
  };

  // --- Handlers ---
  const handleAddEntry = () => {
    if (!selectedClassId) return;
    setEditingEntry(null);
    setFormData({
      subject_id: '',
      teacher_id: '',
      day: DAYS[0],
      start_time: '',
      end_time: '',
      is_break: false,
      batch_id: '',
      batch_name: ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleCellClick = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setFormData({
      subject_id: entry.subject_id || '',
      teacher_id: entry.teacher_id || '',
      day: entry.day,
      start_time: entry.start_time,
      end_time: entry.end_time,
      is_break: entry.is_break,
      batch_id: entry.batch_id || '',
      batch_name: entry.batch_name || ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const validateConflict = async (): Promise<string | null> => {
    // Break has no conflicts for teachers or subjects
    if (formData.is_break) return null;

    if (!formData.teacher_id) return "Please select a teacher.";
    if (!formData.subject_id) return "Please select a subject.";

    // Check if teacher is already assigned to ANOTHER class at this exactly time and day
    const qTeacher = query(collection(db, 'timetable'), 
      where('day', '==', formData.day),
      where('start_time', '==', formData.start_time),
      where('end_time', '==', formData.end_time),
      where('teacher_id', '==', formData.teacher_id)
    );
    const teacherSnap = await getDocs(qTeacher);
    const conflicts = teacherSnap.docs.filter(d => d.id !== editingEntry?.id);
    
    if (conflicts.length > 0) {
      const conflictClass = conflicts[0].data().class_name;
      return `Teacher is already assigned to class '${conflictClass}' at this time.`;
    }

    // Check if the current class already has an entry at this same time and day
    const classConflicts = timetable.filter(
      t => 
        t.day === formData.day && 
        t.start_time === formData.start_time && 
        t.end_time === formData.end_time && 
        t.id !== editingEntry?.id
    );
    if (classConflicts.length > 0) {
      return `This class already has an entry at this time.`;
    }

    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const conflictError = await validateConflict();
      if (conflictError) {
        setErrorMsg(conflictError);
        setIsSubmitting(false);
        return;
      }

      const classObj = classes.find(c => c.id === selectedClassId);
      const subjectObj = formData.is_break ? null : subjects.find(s => s.id === formData.subject_id);
      const teacherObj = formData.is_break ? null : faculty.find(f => f.id === formData.teacher_id);

      const entryData = {
        class_id: selectedClassId,
        class_name: classObj?.name || '',
        subject_id: subjectObj ? subjectObj.id : null,
        subject_name: subjectObj ? subjectObj.name : null,
        teacher_id: teacherObj ? teacherObj.id : null,
        teacher_name: teacherObj ? teacherObj.name : null,
        day: formData.day,
        start_time: formData.start_time,
        end_time: formData.end_time,
        is_break: formData.is_break,
        batch_id: formData.batch_id || null,
        batch_name: formData.batch_name || null,
      };

      if (editingEntry) {
        await updateDoc(doc(db, 'timetable', editingEntry.id), entryData);
        setTimetable(timetable.map(t => t.id === editingEntry.id ? { id: t.id, ...entryData } : t));
      } else {
        const entryDataWithTime = { ...entryData, created_at: serverTimestamp() };
        const newDocResult = await addDoc(collection(db, 'timetable'), entryDataWithTime);
        setTimetable([...timetable, { id: newDocResult.id, ...entryData }]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving timetable entry:', error);
      setErrorMsg('Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry) return;
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'timetable', editingEntry.id));
      setTimetable(timetable.filter(t => t.id !== editingEntry.id));
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error deleting entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Timetable Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage schedules for classes and validate teacher conflicts.</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-2 flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700 pl-2">Select Class:</label>
            <select
              className="border-gray-300 rounded-md py-1.5 pl-3 pr-8 text-sm focus:ring-blue-500 focus:border-blue-500"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {classes.length === 0 ? <option value="">No classes available</option> : null}
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={handleAddEntry}
            disabled={!selectedClassId}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiPlus size={18} />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (!selectedClassId ? (
          <div className="p-12 text-center text-gray-500">Please select or create a class to view its timetable.</div>
        ) : dynamicTimeSlots.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No timetable entries found for this class. Click "Add Entry" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr>
                  <th className="py-4 px-4 bg-gray-50 border-b border-r border-gray-200 font-semibold text-gray-700 w-32 left-0 sticky z-10">Day / Time</th>
                  {dynamicTimeSlots.map((slot, i) => (
                    <th key={i} className={`py-4 px-2 border-b border-r border-gray-200 font-semibold bg-gray-50 text-gray-700 min-w-[140px]`}>
                      <div className="text-sm">{formatTo12Hour(slot.start)} - {formatTo12Hour(slot.end)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td className="py-4 px-4 border-b border-r border-gray-200 bg-gray-50 font-medium text-gray-800 sticky left-0 z-10">
                      {day}
                    </td>
                    {dynamicTimeSlots.map((slot, i) => {
                      const entry = timetable.find(t => t.day === day && t.start_time === slot.start && t.end_time === slot.end);
                      
                      return (
                        <td 
                          key={i} 
                          title={entry ? "Click to edit" : ""}
                          onClick={() => entry ? handleCellClick(entry) : undefined}
                          className={`
                            border-b border-r border-gray-200 h-24 p-2 transition-colors relative group
                            ${entry ? 'cursor-pointer hover:bg-gray-50/50' : 'bg-gray-50/20'}
                            ${entry && entry.is_break ? 'bg-orange-50/80 hover:bg-orange-100' : ''}
                            ${entry && !entry.is_break ? 'bg-green-50/30 hover:bg-green-100/50' : ''}
                          `}
                        >
                          {entry && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                              <FiEdit2 size={14} />
                            </div>
                          )}
                          
                          {entry ? (
                            entry.is_break ? (
                              <div className="flex flex-col items-center justify-center h-full">
                                <span className="font-bold text-orange-600 tracking-widest text-sm">BREAK</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full space-y-1">
                                <span className="font-semibold text-gray-800 text-sm line-clamp-2 leading-snug">
                                  {entry.subject_name}
                                  {entry.batch_name && <span className="text-blue-600 ml-1">({entry.batch_name})</span>}
                                </span>
                                <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">{entry.teacher_name}</span>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-300 text-sm">
                              -
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800">
                {editingEntry ? 'Edit Schedule' : 'Assign Schedule'}
              </h2>
              <button disabled={isSubmitting} onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            
            {errorMsg && (
              <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-start text-sm">
                <FiAlertCircle className="mt-0.5 mr-2 flex-shrink-0" size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
            
            <form onSubmit={handleSave}>
              {!editingEntry ? (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Day *</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={formData.day}
                      onChange={(e) => setFormData({...formData, day: e.target.value})}
                    >
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Time *</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={formData.start_time}
                      onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    >
                      <option value="" disabled>Select</option>
                      {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End Time *</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={formData.end_time}
                      onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    >
                      <option value="" disabled>Select</option>
                      {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Day</label>
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-800">{formData.day}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Time Slot</label>
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-800">
                      {formatTo12Hour(formData.start_time)} - {formatTo12Hour(formData.end_time)}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="flex items-center space-x-2 cursor-pointer bg-orange-50 text-orange-800 p-3 rounded-lg border border-orange-200">
                  <input 
                    type="checkbox" 
                    className="rounded text-orange-600 focus:ring-orange-500"
                    checked={formData.is_break}
                    onChange={(e) => setFormData({...formData, is_break: e.target.checked})}
                  />
                  <span className="font-semibold text-sm">Mark this slot as Break</span>
                </label>
              </div>

              {!formData.is_break && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={formData.subject_id}
                      onChange={(e) => setFormData({...formData, subject_id: e.target.value})}
                    >
                      <option value="" disabled>Select a subject</option>
                      {subjects.map((subj) => (
                        <option key={subj.id} value={subj.id}>{subj.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={formData.teacher_id}
                      onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                    >
                      <option value="" disabled>Select a teacher</option>
                      {faculty.map((fac) => (
                        <option key={fac.id} value={fac.id}>{fac.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch (Optional for Lab)</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={formData.batch_id}
                      onChange={(e) => {
                        const b = batches.find(batch => batch.id === e.target.value);
                        setFormData({...formData, batch_id: e.target.value, batch_name: b?.batch_name || ''});
                      }}
                    >
                      <option value="">Full Class Session</option>
                      {batches.filter(b => b.class_id === selectedClassId).map((b) => (
                        <option key={b.id} value={b.id}>{b.batch_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-between items-center">
                {editingEntry ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <FiTrash2 className="mr-1.5" /> Clear Slot
                  </button>
                ) : <div></div>}
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}