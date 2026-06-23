import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AcademicRecordStatus,
  StudentAcademicRecord,
  StudentForm,
  StudentMaster,
  StudentRow,
  StudentStatus,
} from '../types/student';
import type { AcademicYear, Board, ClassModel } from '../types/board';

export const fullName = (student: Pick<StudentMaster, 'firstName' | 'middleName' | 'lastName'>) =>
  [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ');

export const generateStudentId = () =>
  `STU-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

export const getClassNumber = (name: string) => {
  const match = name.match(/\d+/);
  return match ? Number(match[0]) : null;
};

export function buildStudentPayload(form: StudentForm, studentId?: string) {
  return {
    studentId: studentId || generateStudentId(),
    grNumber: (form.grNumber || '').trim(),
    firstName: (form.firstName || '').trim(),
    middleName: (form.middleName || '').trim(),
    lastName: (form.lastName || '').trim(),
    gender: form.gender || '',
    dateOfBirth: form.dateOfBirth || '',
    bloodGroup: form.bloodGroup || '',
    aadhaarNumber: (form.aadhaarNumber || '').trim(),
    photoUrl: (form.photoUrl || '').trim(),
    fatherName: (form.fatherName || '').trim(),
    motherName: (form.motherName || '').trim(),
    parentMobile: (form.parentMobile || '').trim(),
    parentAlternateMobile: (form.parentAlternateMobile || '').trim(),
    parentEmail: (form.parentEmail || '').trim(),
    occupation: (form.occupation || '').trim(),
    address: (form.address || '').trim(),
    city: (form.city || '').trim(),
    state: (form.state || '').trim(),
    pincode: (form.pincode || '').trim(),
    status: form.status || 'Active',
    role: 'student' as const,
  };
}

export function buildAcademicRecordPayload(
  form: StudentForm,
  studentDocId: string,
  studentId: string,
  year: AcademicYear,
  board: Board,
  classModel: ClassModel
) {
  return {
    studentDocId,
    studentId,
    academicYearId: year.id,
    academicYearName: year.name,
    boardId: board.id,
    boardName: board.name,
    classId: classModel.id,
    className: classModel.name,
    division: form.division || classModel.division || '',
    rollNumber: (form.rollNumber || '').trim(),
    admissionDate: form.admissionDate,
    status: form.academicStatus || 'Active',
    remarks: (form.remarks || '').trim(),
  };
}

export interface FetchStudentsResult {
  students: StudentMaster[];
  academicRecords: StudentAcademicRecord[];
  academicYears: AcademicYear[];
  boards: Board[];
  classes: ClassModel[];
}

export async function fetchAllStudentData(): Promise<FetchStudentsResult> {
  const [studentSnap, recordSnap, yearSnap, boardSnap, classSnap] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
    getDocs(collection(db, 'studentAcademicRecords')),
    getDocs(collection(db, 'academic_years')),
    getDocs(collection(db, 'boards')),
    getDocs(collection(db, 'classes')),
  ]);

  return {
    students: studentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentMaster)),
    academicRecords: recordSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAcademicRecord)),
    academicYears: (yearSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as AcademicYear[])
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.startDate.localeCompare(a.startDate)),
    boards: boardSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Board)),
    classes: classSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassModel)),
  };
}

export function buildRecordsByStudent(records: StudentAcademicRecord[]) {
  const map = new Map<string, StudentAcademicRecord[]>();
  records.forEach((record) => {
    const key = record.studentDocId || record.studentId;
    map.set(key, [...(map.get(key) || []), record]);
  });
  map.forEach((recs) => recs.sort((a, b) => a.academicYearName.localeCompare(b.academicYearName)));
  return map;
}

export function buildStudentRows(
  students: StudentMaster[],
  recordsByStudent: Map<string, StudentAcademicRecord[]>,
  filterYear: string
): StudentRow[] {
  return students.map((student) => {
    const records = recordsByStudent.get(student.id) || [];
    const currentRecord =
      records.find((r) => r.academicYearId === filterYear) ||
      records.find((r) => r.status === 'Active') ||
      records[records.length - 1];
    return { ...student, records, currentRecord };
  });
}

export async function createStudent(form: StudentForm, students: StudentMaster[]) {
  const duplicate = students.find((s) => s.grNumber === form.grNumber.trim());
  if (duplicate) {
    throw new Error('GR / Admission Number already exists.');
  }

  const year = await getAcademicYearById(form.academicYearId);
  const board = await getBoardById(form.boardId);
  const classModel = await getClassById(form.classId);

  if (!year || !board || !classModel) {
    throw new Error('Select a valid academic year, board, and class.');
  }

  const payload = buildStudentPayload(form);
  const studentRef = doc(collection(db, 'students'));
  const batch = writeBatch(db);

  batch.set(studentRef, {
    ...payload,
    name: fullName(payload),
    roll_no: form.rollNumber,
    class_id: classModel.id,
    class_name: classModel.name,
    board_id: board.id,
    board_name: board.name,
    academic_year_id: year.id,
    status: payload.status,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  batch.set(doc(collection(db, 'studentAcademicRecords')), {
    ...buildAcademicRecordPayload(form, studentRef.id, payload.studentId, year, board, classModel),
    created_at: serverTimestamp(),
  });

  await batch.commit();
}

export async function updateStudent(student: StudentRow, form: StudentForm) {
  const payload = buildStudentPayload(form, student.studentId);
  await updateDoc(doc(db, 'students', student.id), {
    ...payload,
    name: fullName(payload),
    updated_at: serverTimestamp(),
  });

  const record = student.currentRecord;
  const year = await getAcademicYearById(form.academicYearId);
  const board = await getBoardById(form.boardId);
  const classModel = await getClassById(form.classId);

  if (!year || !board || !classModel) {
    throw new Error('Select a valid academic year, board, and class.');
  }

  const recordPayload = buildAcademicRecordPayload(form, student.id, student.studentId, year, board, classModel);
  if (record) {
    await updateDoc(doc(db, 'studentAcademicRecords', record.id), recordPayload);
  } else {
    await addDoc(collection(db, 'studentAcademicRecords'), {
      ...recordPayload,
      created_at: serverTimestamp(),
    });
  }
}

export async function deleteStudent(student: StudentRow) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'students', student.id));
  student.records.forEach((record) => batch.delete(doc(db, 'studentAcademicRecords', record.id)));
  await batch.commit();
}

export async function promoteStudents(
  promotionStudents: StudentRow[],
  fromClass: ClassModel,
  toYear: AcademicYear,
  boardId: string,
  targetClass: ClassModel,
  fromYearId: string
) {
  if (!targetClass) {
    throw new Error('Target class not found in target academic year.');
  }

  const batch = writeBatch(db);
  promotionStudents.forEach((student) => {
    const sourceRecord = student.records.find(
      (r) =>
        r.academicYearId === fromYearId &&
        r.boardId === boardId &&
        r.classId === fromClass.id &&
        r.status === 'Active'
    );
    if (sourceRecord) {
      batch.update(doc(db, 'studentAcademicRecords', sourceRecord.id), {
        status: 'Promoted' as AcademicRecordStatus,
        remarks: 'Promoted to next academic year',
      });
    }
    batch.set(doc(collection(db, 'studentAcademicRecords')), {
      studentDocId: student.id,
      studentId: student.studentId,
      academicYearId: toYear.id,
      academicYearName: toYear.name,
      boardId: boardId,
      boardName: fromClass.board_name,
      classId: targetClass.id,
      className: targetClass.name,
      division: targetClass.division || student.currentRecord?.division || '',
      rollNumber: student.currentRecord?.rollNumber || '',
      admissionDate: new Date().toISOString().slice(0, 10),
      status: 'Active' as AcademicRecordStatus,
      remarks: `Promoted from ${fromClass.name}`,
      created_at: serverTimestamp(),
    });
    batch.update(doc(db, 'students', student.id), {
      class_id: targetClass.id,
      class_name: targetClass.name,
      academic_year_id: toYear.id,
      board_id: boardId,
      board_name: fromClass.board_name,
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function markStudentPassedOut(student: StudentRow) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'students', student.id), {
    status: 'Passed Out' as StudentStatus,
    updated_at: serverTimestamp(),
  });
  if (student.currentRecord) {
    batch.update(doc(db, 'studentAcademicRecords', student.currentRecord.id), {
      status: 'Passed Out' as AcademicRecordStatus,
      remarks: 'Marked as passed out',
    });
  }
  await batch.commit();
}

export function fuzzyMatch(input: string, candidates: { id: string; name: string }[]): { id: string; name: string } | null {
  const query = input.trim().toLowerCase();
  if (!query) return null;

  const exact = candidates.find((c) => c.name.toLowerCase() === query);
  if (exact) return exact;

  const startsWith = candidates.find((c) => c.name.toLowerCase().startsWith(query));
  if (startsWith) return startsWith;

  const includes = candidates.find((c) => c.name.toLowerCase().includes(query));
  if (includes) return includes;

  const queryWords = query.split(/\s+/);
  const wordMatch = candidates.find((c) => {
    const nameLower = c.name.toLowerCase();
    return queryWords.every((w) => nameLower.includes(w));
  });
  if (wordMatch) return wordMatch;

  return null;
}

export function resolveGender(input: string): string {
  const lower = input.trim().toLowerCase();
  if (!lower) return '';
  const genderMap: Record<string, string> = {
    m: 'Male', male: 'Male', man: 'Male', boy: 'Male',
    f: 'Female', female: 'Female', woman: 'Female', girl: 'Female',
    o: 'Other', other: 'Other', transgender: 'Other', nonbinary: 'Other', non: 'Other',
  };
  return genderMap[lower] || input.trim();
}

export function resolveAcademicYear(input: string, years: AcademicYear[]): AcademicYear | null {
  return fuzzyMatch(input, years.map((y) => ({ id: y.id, name: y.name }))) as AcademicYear | null;
}

export function resolveBoard(input: string, boards: Board[]): Board | null {
  return fuzzyMatch(input, boards.map((b) => ({ id: b.id, name: b.name }))) as Board | null;
}

export function resolveClass(input: string, classes: ClassModel[]): ClassModel | null {
  return fuzzyMatch(input, classes.map((c) => ({ id: c.id, name: c.name }))) as ClassModel | null;
}

export async function importValidStudents(validRows: StudentForm[]) {
  const academicYears = await getDocs(collection(db, 'academic_years')).then((s) =>
    s.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicYear))
  );
  const boards = await getDocs(collection(db, 'boards')).then((s) =>
    s.docs.map((d) => ({ id: d.id, ...d.data() } as Board))
  );
  const classes = await getDocs(collection(db, 'classes')).then((s) =>
    s.docs.map((d) => ({ id: d.id, ...d.data() } as ClassModel))
  );

  let batch = writeBatch(db);
  let operationCount = 0;

  for (const row of validRows) {
    const year = academicYears.find((y) => y.id === row.academicYearId);
    const board = boards.find((b) => b.id === row.boardId);
    const classModel = classes.find((c) => c.id === row.classId);
    if (!year || !board || !classModel) continue;

    const studentRef = doc(collection(db, 'students'));
    const payload = buildStudentPayload(row);

    batch.set(studentRef, {
      ...payload,
      name: fullName(payload),
      roll_no: row.rollNumber,
      class_id: classModel.id,
      class_name: classModel.name,
      board_id: board.id,
      board_name: board.name,
      academic_year_id: year.id,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'studentAcademicRecords')), {
      ...buildAcademicRecordPayload(row, studentRef.id, payload.studentId, year, board, classModel),
      created_at: serverTimestamp(),
    });

    operationCount += 2;
    if (operationCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();
}

async function getDocById(collectionName: string, id: string) {
  const snap = await getDocs(query(collection(db, collectionName), where('__name__', '==', id)));
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

async function getAcademicYearById(id: string): Promise<AcademicYear | null> {
  const result = await getDocById('academic_years', id);
  return result as AcademicYear | null;
}

async function getBoardById(id: string): Promise<Board | null> {
  const result = await getDocById('boards', id);
  return result as Board | null;
}

async function getClassById(id: string): Promise<ClassModel | null> {
  const result = await getDocById('classes', id);
  return result as ClassModel | null;
}
