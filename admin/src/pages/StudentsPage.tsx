import { useEffect, useMemo, useState } from 'react';
import { FiClock, FiEdit2, FiEye, FiLoader, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUpload } from 'react-icons/fi';
import * as XLSX from 'xlsx';

import type { StudentForm, StudentRow, ImportRow } from '../types/student';
import { EMPTY_STUDENT_FORM, REQUIRED_IMPORT_FIELDS, ALL_STUDENT_STATUSES } from '../types/student';
import type { AcademicYear, Board, ClassModel } from '../types/board';
import {
  fullName,
  fetchAllStudentData,
  buildRecordsByStudent,
  buildStudentRows,
  createStudent,
  updateStudent,
  deleteStudent,
  promoteStudents,
  markStudentPassedOut,
  importValidStudents,
  resolveGender,
  resolveAcademicYear,
  resolveBoard,
  resolveClass,
} from '../services/studentService';
import {
  StudentAvatar,
  StudentStatusBadge,
  StudentStatsPanel,
  StudentFormModal,
  StudentProfileModal,
  StudentHistoryModal,
  StudentImportModal,
  StudentPromotionModal,
  Toast,
  Select,
} from '../components/student';

const normalize = (value: unknown) => String(value ?? '').trim();

export function StudentsPage() {
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [academicRecords, setAcademicRecords] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterBoard, setFilterBoard] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [activeModal, setActiveModal] = useState<'add' | 'edit' | 'view' | 'history' | 'import' | 'promotion' | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [form, setForm] = useState<StudentForm>(EMPTY_STUDENT_FORM);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [promotion, setPromotion] = useState({ fromYearId: '', toYearId: '', boardId: '', classId: '', targetClassId: '' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllStudentData();
      setAllStudents(data.students);
      setAcademicRecords(data.academicRecords);
      setAcademicYears(data.academicYears);
      setBoards(data.boards);
      setClasses(data.classes);
    } catch (error) {
      console.error(error);
      showToast('Failed to load student management data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const activeYear = academicYears.find((y) => y.isActive);
    if (activeYear && !filterYear) {
      setFilterYear(activeYear.id);
      setPromotion((prev) => ({ ...prev, fromYearId: activeYear.id }));
    }
  }, [academicYears, filterYear]);

  const recordsByStudent = useMemo(() => buildRecordsByStudent(academicRecords), [academicRecords]);
  const activeYear = academicYears.find((y) => y.isActive);

  const rows = useMemo<StudentRow[]>(
    () => buildStudentRows(allStudents, recordsByStudent, filterYear),
    [allStudents, recordsByStudent, filterYear]
  );

  const filteredRows = useMemo(() =>
    rows.filter((student) => {
      const record = student.currentRecord;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        student.studentId?.toLowerCase().includes(term) ||
        student.grNumber?.toLowerCase().includes(term) ||
        fullName(student).toLowerCase().includes(term) ||
        student.parentMobile?.toLowerCase().includes(term);

      const matchesYear = !filterYear || student.records.some(
        (r) => r.academicYearId === filterYear && (r.status === 'Active' || r.status === 'Passed Out')
      );
      const matchesBoard = !filterBoard || (record?.boardId === filterBoard && record?.academicYearId === filterYear);
      const matchesClass = !filterClass || (record?.classId === filterClass && record?.academicYearId === filterYear);

      return (
        matchesSearch &&
        matchesYear &&
        matchesBoard &&
        matchesClass &&
        (!filterStatus || student.status === filterStatus)
      );
    }),
    [rows, searchTerm, filterYear, filterBoard, filterClass, filterStatus]
  );

  const stats = useMemo(() => {
    const byBoard = new Map<string, number>();
    const byClass = new Map<string, number>();
    const byYear = new Map<string, number>();
    rows.forEach((student) => {
      const record = student.currentRecord;
      if (!record) return;
      byBoard.set(record.boardName, (byBoard.get(record.boardName) || 0) + 1);
      byClass.set(record.className, (byClass.get(record.className) || 0) + 1);
      byYear.set(record.academicYearName, (byYear.get(record.academicYearName) || 0) + 1);
    });
    return {
      total: allStudents.length,
      active: allStudents.filter((s: any) => s.status === 'Active').length,
      promoted: allStudents.filter((s: any) => s.status === 'Promoted').length,
      byBoard: Array.from(byBoard.entries()),
      byClass: Array.from(byClass.entries()),
      byYear: Array.from(byYear.entries()),
    };
  }, [rows, allStudents]);

  const filteredBoards = boards.filter((b) => b.status === 'active');
  const filteredClassesForForm = classes.filter(
    (c) =>
      c.status === 'active' &&
      (!form.boardId || c.board_id === form.boardId)
  );
  const promotionClasses = classes.filter(
    (c) =>
      c.status === 'active' &&
      (!promotion.boardId || c.board_id === promotion.boardId)
  );
  const promotionStudents = useMemo(() => {
    if (!promotion.fromYearId || !promotion.boardId || !promotion.classId) return [];
    return rows.filter((s) =>
      s.status !== 'Passed Out' && s.status !== 'Transferred' &&
      s.records.some(
        (r) =>
          r.academicYearId === promotion.fromYearId &&
          r.boardId === promotion.boardId &&
          r.classId === promotion.classId &&
          r.status === 'Active'
      )
    );
  }, [rows, promotion.fromYearId, promotion.boardId, promotion.classId]);

  const pendingPromotionCount = useMemo(() => {
    if (!activeYear) return 0;
    const activeYearIndex = academicYears.findIndex((y) => y.id === activeYear.id);
    const prevYear = academicYears[activeYearIndex + 1];
    if (!prevYear) return 0;
    return rows.filter((s) =>
      s.records.some(
        (r) =>
          r.academicYearId === prevYear.id &&
          r.status === 'Active'
      ) && !s.records.some(
        (r) =>
          r.academicYearId === activeYear.id &&
          r.status === 'Active'
      ) && s.status !== 'Passed Out'
    ).length;
  }, [rows, academicYears, activeYear]);

  const openAdd = () => {
    setForm({ ...EMPTY_STUDENT_FORM, academicYearId: activeYear?.id || '' });
    setSelectedStudent(null);
    setActiveModal('add');
  };

  const openEdit = (student: StudentRow) => {
    const record = student.currentRecord;
    setSelectedStudent(student);
    setForm({
      grNumber: student.grNumber || '',
      firstName: student.firstName || '',
      middleName: student.middleName || '',
      lastName: student.lastName || '',
      gender: student.gender || '',
      dateOfBirth: student.dateOfBirth || '',
      bloodGroup: student.bloodGroup || '',
      aadhaarNumber: student.aadhaarNumber || '',
      photoUrl: student.photoUrl || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      parentMobile: student.parentMobile || '',
      parentAlternateMobile: student.parentAlternateMobile || '',
      parentEmail: student.parentEmail || '',
      occupation: student.occupation || '',
      address: student.address || '',
      city: student.city || '',
      state: student.state || '',
      pincode: student.pincode || '',
      status: student.status || 'Active',
      academicYearId: record?.academicYearId || activeYear?.id || '',
      boardId: record?.boardId || '',
      classId: record?.classId || '',
      division: record?.division || '',
      rollNumber: record?.rollNumber || '',
      admissionDate: record?.admissionDate || new Date().toISOString().slice(0, 10),
      academicStatus: record?.status || 'Active',
      remarks: record?.remarks || '',
    });
    setActiveModal('edit');
  };

  const saveStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (activeModal === 'edit' && selectedStudent) {
        await updateStudent(selectedStudent, form);
        showToast('Student updated successfully.', 'success');
      } else {
        await createStudent(form, allStudents);
        showToast('Student created with academic record.', 'success');
      }
      setActiveModal(null);
      fetchData();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Failed to save student.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (student: StudentRow) => {
    if (!window.confirm(`Delete ${fullName(student)}? Academic history will also be removed.`)) return;
    try {
      await deleteStudent(student);
      showToast('Student deleted.', 'success');
      fetchData();
    } catch (error) {
      console.error(error);
      showToast('Failed to delete student.', 'error');
    }
  };

  const parseImportFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rowsData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    const existingGr = new Set(allStudents.map((s: any) => s.grNumber?.toLowerCase()));
    const fileGr = new Set<string>();

    const activeYear = academicYears.find((y) => y.isActive);

    const parsed: ImportRow[] = rowsData.map((row, index) => {
      const rawBoardName = normalize(row.boardName || row['Board Name'] || row.board || row.Board);
      const rawClassName = normalize(row.className || row['Class Name'] || row.class || row.Class);
      const rawYearName = normalize(row.academicYearName || row['Academic Year Name'] || row['Academic Year'] || row.year || row.Year);

      let boardId = normalize(row.boardId || row['Board ID']);
      let classId = normalize(row.classId || row['Class ID']);
      let academicYearId = normalize(row.academicYearId || row['Academic Year ID']);

      if (academicYearId && !academicYears.some((y) => y.id === academicYearId)) {
        const matched = resolveAcademicYear(academicYearId, academicYears);
        academicYearId = matched ? matched.id : academicYearId;
      }
      if (!academicYearId && rawYearName) {
        const matched = resolveAcademicYear(rawYearName, academicYears);
        if (matched) academicYearId = matched.id;
      }
      if (!academicYearId && activeYear) {
        academicYearId = activeYear.id;
      }

      if (boardId && !boards.some((b) => b.id === boardId)) {
        const matched = resolveBoard(boardId, boards);
        boardId = matched ? matched.id : boardId;
      }
      if (!boardId && rawBoardName) {
        const matched = resolveBoard(rawBoardName, boards);
        if (matched) boardId = matched.id;
      }

      if (classId && !classes.some((c) => c.id === classId)) {
        const filtered = classes.filter((c) => !boardId || c.board_id === boardId);
        const matched = resolveClass(classId, filtered);
        classId = matched ? matched.id : classId;
      }
      if (!classId && rawClassName) {
        const filtered = classes.filter((c) => !boardId || c.board_id === boardId);
        const matched = resolveClass(rawClassName, filtered);
        if (matched) classId = matched.id;
      }

      const rawGender = normalize(row.gender || row.Gender);
      const gender = rawGender ? resolveGender(rawGender) : '';

      const item: ImportRow = {
        rowNumber: index + 2,
        grNumber: normalize(row.grNumber || row.GRNumber || row['GR Number'] || row['Admission Number']),
        firstName: normalize(row.firstName || row['First Name']),
        middleName: normalize(row.middleName || row['Middle Name']),
        lastName: normalize(row.lastName || row['Last Name']),
        gender,
        dateOfBirth: normalize(row.dateOfBirth || row.DOB || row['Date of Birth']),
        bloodGroup: normalize(row.bloodGroup || row['Blood Group']),
        aadhaarNumber: normalize(row.aadhaarNumber || row.Aadhaar),
        fatherName: normalize(row.fatherName || row['Father Name']),
        motherName: normalize(row.motherName || row['Mother Name']),
        parentMobile: normalize(row.parentMobile || row['Parent Mobile']),
        parentAlternateMobile: normalize(row.parentAlternateMobile || row['Alternate Mobile']),
        parentEmail: normalize(row.parentEmail || row['Parent Email']),
        occupation: normalize(row.occupation || row.Occupation),
        address: normalize(row.address || row.Address),
        city: normalize(row.city || row.City),
        state: normalize(row.state || row.State),
        pincode: normalize(row.pincode || row.Pincode),
        academicYearId,
        boardId,
        classId,
        division: normalize(row.division || row.Division),
        rollNumber: normalize(row.rollNumber || row['Roll Number']),
        admissionDate:
          normalize(row.admissionDate || row['Admission Date']) || new Date().toISOString().slice(0, 10),
        remarks: normalize(row.remarks || row.Remarks),
        status: 'Active',
        academicStatus: 'Active',
        errors: [],
      };

      REQUIRED_IMPORT_FIELDS.forEach((field) => {
        if (!item[field]) item.errors.push(`Missing ${field}`);
      });
      const grKey = String(item.grNumber || '').toLowerCase();
      if (grKey && existingGr.has(grKey)) item.errors.push('Duplicate GR number already exists');
      if (grKey && fileGr.has(grKey)) item.errors.push('Duplicate GR number in file');
      if (grKey) fileGr.add(grKey);
      if (!item.boardId && rawBoardName) item.errors.push(`Board "${rawBoardName}" not found in system`);
      if (!item.classId && rawClassName) item.errors.push(`Class "${rawClassName}" not found in system`);
      if (item.boardId && !boards.some((b) => b.id === item.boardId)) item.errors.push(`Board "${boardId}" not found in system`);
      if (item.classId && !classes.some((c) => c.id === item.classId)) item.errors.push(`Class "${classId}" not found in system`);
      if (!item.academicYearId) item.errors.push('Academic Year not found');
      return item;
    });
    setImportRows(parsed);
  };

  const handleImportValid = async () => {
    const validRows = importRows.filter((row) => row.errors.length === 0) as StudentForm[];
    if (!validRows.length) {
      showToast('No valid rows to import.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await importValidStudents(validRows);
      showToast(`${validRows.length} students imported successfully.`, 'success');
      setActiveModal(null);
      setImportRows([]);
      fetchData();
    } catch (error: any) {
      console.error('Import error:', error);
      showToast(error.message || 'Import failed. Check console for details.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'grNumber', 'firstName', 'middleName', 'lastName', 'gender', 'dateOfBirth',
      'bloodGroup', 'aadhaarNumber', 'fatherName', 'motherName', 'parentMobile',
      'parentAlternateMobile', 'parentEmail', 'occupation', 'address', 'city',
      'state', 'pincode', 'academicYearName', 'boardName', 'className', 'division',
      'rollNumber', 'admissionDate', 'remarks',
    ];
    const sampleRow = [
      'GR001', 'Rahul', 'Kumar', 'Sharma', 'Male', '2010-05-15',
      'A+', '', 'Suresh Sharma', 'Priya Sharma', '9876543210',
      '', '', 'Farmer', '123 Main St', 'Mumbai', 'Maharashtra', '400001',
      '2025-26', 'CBSE', 'Class 10', 'A',
      '101', '2025-04-01', '',
    ];
    const csv = `${headers.join(',')}\n${sampleRow.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'student-import-template.csv';
    link.click();
  };

  const handlePromote = async () => {
    if (promotion.fromYearId && promotion.toYearId && promotion.fromYearId === promotion.toYearId) {
      showToast('Cannot promote within the same academic year. Select a different target year.', 'error');
      return;
    }
    const toYear = academicYears.find((y) => y.id === promotion.toYearId);
    const currentClass = classes.find((c) => c.id === promotion.classId);
    const targetClass = classes.find((c) => c.id === promotion.targetClassId);
    if (!toYear || !currentClass || !targetClass || promotionStudents.length === 0) {
      showToast('Select source, target year, target class, and eligible students.', 'error');
      return;
    }
    try {
      await promoteStudents(promotionStudents, currentClass, toYear, promotion.boardId, targetClass, promotion.fromYearId);
      showToast(`${promotionStudents.length} students promoted successfully.`, 'success');
      setActiveModal(null);
      fetchData();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Promotion failed.', 'error');
    }
  };

  const handleMarkPassedOut = async (student: StudentRow) => {
    if (!window.confirm(`Mark ${fullName(student)} as passed out?`)) return;
    try {
      await markStudentPassedOut(student);
      showToast('Student marked as passed out.', 'success');
      fetchData();
    } catch (error) {
      console.error(error);
      showToast('Failed to mark passed out.', 'error');
    }
  };

  const handleMarkPassedOutFromPromotion = async () => {
    if (promotionStudents.length === 0) return;
    if (!window.confirm(`Mark ${promotionStudents.length} student${promotionStudents.length !== 1 ? 's' : ''} as passed out?`)) return;
    try {
      for (const student of promotionStudents) {
        await markStudentPassedOut(student);
      }
      showToast(`${promotionStudents.length} students marked as passed out.`, 'success');
      setActiveModal(null);
      fetchData();
    } catch (error) {
      console.error(error);
      showToast('Failed to mark students as passed out.', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Student Management</h1>
          <p className="mt-2 text-slate-500 font-medium">
            Permanent profiles, academic history, import, promotion, and alumni records.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveModal('promotion')}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 flex items-center gap-2 transition-colors"
          >
            <FiRefreshCw /> Promotions
          </button>
          <button
            onClick={() => setActiveModal('import')}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <FiUpload /> Bulk Import
          </button>
          <button
            onClick={openAdd}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 flex items-center gap-2 transition-colors"
          >
            <FiPlus /> Add Student
          </button>
        </div>
      </div>

      {/* Stats Panel */}
      <StudentStatsPanel stats={stats} />

      {/* Promotion Reminder Banner */}
      {pendingPromotionCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiRefreshCw className="text-amber-600" />
            <div>
              <p className="font-bold text-amber-900">
                {pendingPromotionCount} student{pendingPromotionCount !== 1 ? 's' : ''} need promotion to {activeYear?.name}
              </p>
              <p className="text-sm text-amber-700">
                Students from the previous academic year have not been promoted yet.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('promotion')}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 transition-colors"
          >
            Promote Now
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID, GR, name, mobile..."
              className="pl-10 w-full border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <Select
            value={filterYear}
            onChange={setFilterYear}
            options={academicYears.map((y) => [y.id, `${y.name}${y.isActive ? ' (Active)' : ''}`])}
            placeholder="All Academic Years"
          />
          <Select
            value={filterBoard}
            onChange={setFilterBoard}
            options={boards.map((b) => [b.id, b.name])}
            placeholder="All Boards"
          />
          <Select
            value={filterClass}
            onChange={setFilterClass}
            options={classes.map((c) => [c.id, `${c.name}${c.division ? ` - ${c.division}` : ''}`])}
            placeholder="All Classes"
          />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            options={ALL_STUDENT_STATUSES.map((s) => [s, s])}
            placeholder="All Status"
          />
        </div>
      </div>

      {/* Student Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex justify-center">
          <FiLoader className="animate-spin text-3xl text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Student ID', 'GR Number', 'Student Name', 'Board', 'Class', 'Division', 'Parent Mobile', 'Status', 'Actions'].map(
                    (head) => (
                      <th key={head} className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-gray-500">
                        {head}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((student) => (
                  <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-sm text-slate-700">{student.studentId}</td>
                    <td className="py-3.5 px-6 font-semibold text-slate-800">{student.grNumber}</td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <StudentAvatar student={student} size="sm" />
                        <div>
                          <div className="font-bold text-slate-900">{fullName(student)}</div>
                          <div className="text-xs text-slate-500">{student.parentEmail || 'No parent email'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">{student.currentRecord?.boardName || '-'}</td>
                    <td className="py-3.5 px-6 font-semibold text-slate-800">{student.currentRecord?.className || '-'}</td>
                    <td className="py-3.5 px-6 text-slate-600">{student.currentRecord?.division || '-'}</td>
                    <td className="py-3.5 px-6 text-slate-600">{student.parentMobile}</td>
                    <td className="py-3.5 px-6">
                      <StudentStatusBadge status={student.status} />
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-1">
                        <button
                          title="View Profile"
                          onClick={() => { setSelectedStudent(student); setActiveModal('view'); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <FiEye />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => openEdit(student)}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          title="View History"
                          onClick={() => { setSelectedStudent(student); setActiveModal('history'); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <FiClock />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(student)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-500">
                      No students match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <StudentFormModal
          mode={activeModal}
          form={form}
          setForm={setForm}
          academicYears={academicYears}
          boards={filteredBoards}
          classes={filteredClassesForForm}
          onClose={() => setActiveModal(null)}
          onSubmit={saveStudent}
          onMarkPassedOut={
            activeModal === 'edit' && selectedStudent
              ? () => {
                  handleMarkPassedOut(selectedStudent);
                  setActiveModal(null);
                }
              : undefined
          }
          isSubmitting={isSubmitting}
        />
      )}
      {activeModal === 'view' && selectedStudent && (
        <StudentProfileModal student={selectedStudent} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'history' && selectedStudent && (
        <StudentHistoryModal student={selectedStudent} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'import' && (
        <StudentImportModal
          rows={importRows}
          onFile={parseImportFile}
          onImport={handleImportValid}
          onTemplate={downloadTemplate}
          onClose={() => { setActiveModal(null); setImportRows([]); }}
          isSubmitting={isSubmitting}
        />
      )}
      {activeModal === 'promotion' && (
        <StudentPromotionModal
          promotion={promotion}
          setPromotion={setPromotion}
          academicYears={academicYears}
          boards={boards}
          classes={promotionClasses}
          allClasses={classes}
          eligibleStudents={promotionStudents}
          onPromote={handlePromote}
          onMarkPassedOut={handleMarkPassedOutFromPromotion}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
