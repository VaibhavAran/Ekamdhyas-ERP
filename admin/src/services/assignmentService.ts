import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import type {
  Assignment,
  AssignmentForm,
  AssignmentSubmission,
  AssignmentStatus,
  SubmissionDetail,
} from '../types/assignment';
import type { AcademicYear, Board, ClassModel } from '../types/board';
import type { Teacher } from '../types/teacher';

const COLLECTION = 'assignments';
const SUBMISSIONS_COLLECTION = 'assignmentSubmissions';

export async function fetchAllAssignments(): Promise<Assignment[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
}

export async function fetchAssignmentById(id: string): Promise<Assignment | null> {
  const d = await getDoc(doc(db, COLLECTION, id));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() } as Assignment;
}

export async function createAssignment(form: AssignmentForm): Promise<string> {
  const docData = {
    title: form.title.trim(),
    description: form.description.trim(),
    subjectId: form.subjectId,
    subjectName: form.subjectName,
    teacherId: form.teacherId,
    teacherName: form.teacherName,
    academicYearId: form.academicYearId,
    academicYearName: form.academicYearName,
    boardId: form.boardId,
    boardName: form.boardName,
    classId: form.classId,
    className: form.className,
    divisionId: form.divisionId,
    divisionName: form.divisionName,
    assignedDate: form.assignedDate,
    dueDate: form.dueDate,
    attachmentUrl: form.attachmentUrl,
    attachmentName: form.attachmentName,
    status: form.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, COLLECTION), docData);
  return docRef.id;
}

export async function updateAssignment(id: string, form: Partial<AssignmentForm>): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (form.title !== undefined) updateData.title = form.title.trim();
  if (form.description !== undefined) updateData.description = form.description.trim();
  if (form.subjectId !== undefined) updateData.subjectId = form.subjectId;
  if (form.subjectName !== undefined) updateData.subjectName = form.subjectName;
  if (form.teacherId !== undefined) updateData.teacherId = form.teacherId;
  if (form.teacherName !== undefined) updateData.teacherName = form.teacherName;
  if (form.academicYearId !== undefined) updateData.academicYearId = form.academicYearId;
  if (form.academicYearName !== undefined) updateData.academicYearName = form.academicYearName;
  if (form.boardId !== undefined) updateData.boardId = form.boardId;
  if (form.boardName !== undefined) updateData.boardName = form.boardName;
  if (form.classId !== undefined) updateData.classId = form.classId;
  if (form.className !== undefined) updateData.className = form.className;
  if (form.divisionId !== undefined) updateData.divisionId = form.divisionId;
  if (form.divisionName !== undefined) updateData.divisionName = form.divisionName;
  if (form.assignedDate !== undefined) updateData.assignedDate = form.assignedDate;
  if (form.dueDate !== undefined) updateData.dueDate = form.dueDate;
  if (form.attachmentUrl !== undefined) updateData.attachmentUrl = form.attachmentUrl;
  if (form.attachmentName !== undefined) updateData.attachmentName = form.attachmentName;
  if (form.status !== undefined) updateData.status = form.status;
  await updateDoc(doc(db, COLLECTION, id), updateData);
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function fetchSubmissionsByAssignment(assignmentId: string): Promise<AssignmentSubmission[]> {
  const q = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where('assignmentId', '==', assignmentId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssignmentSubmission));
}

export async function fetchAllSubmissions(): Promise<AssignmentSubmission[]> {
  const snap = await getDocs(collection(db, SUBMISSIONS_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssignmentSubmission));
}

export async function uploadAttachment(
  file: File,
  assignmentId: string
): Promise<{ url: string; name: string }> {
  const storageRef = ref(storage, `assignments/${assignmentId}/${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, name: file.name };
}

export async function deleteAttachment(assignmentId: string, fileName: string): Promise<void> {
  try {
    const storageRef = ref(storage, `assignments/${assignmentId}/${fileName}`);
    await deleteObject(storageRef);
  } catch {
    // File may not exist
  }
}

export async function fetchMetadata(): Promise<{
  academicYears: AcademicYear[];
  boards: Board[];
  classes: ClassModel[];
  teachers: Teacher[];
  subjects: { id: string; name: string }[];
}> {
  const [yearSnap, boardSnap, classSnap, teacherSnap, subjectSnap] = await Promise.all([
    getDocs(collection(db, 'academic_years')),
    getDocs(collection(db, 'boards')),
    getDocs(collection(db, 'classes')),
    getDocs(query(collection(db, 'teachers'), where('status', '==', 'active'))),
    getDocs(collection(db, 'subjects')),
  ]);

  return {
    academicYears: yearSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicYear))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    boards: boardSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Board)),
    classes: classSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassModel)),
    teachers: teacherSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)),
    subjects: subjectSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string })),
  };
}

export function computeAssignmentStats(
  assignments: Assignment[],
  submissions: AssignmentSubmission[]
) {
  const now = new Date().toISOString().split('T')[0];
  const total = assignments.length;
  const active = assignments.filter(
    (a) => a.status === 'active' && a.dueDate >= now
  ).length;
  const completed = assignments.filter((a) => a.status === 'completed').length;
  const overdue = assignments.filter(
    (a) => a.status !== 'completed' && a.dueDate < now
  ).length;
  const pending = total - active - completed - overdue;

  const submittedCount = submissions.filter((s) => s.status === 'submitted' || s.status === 'reviewed').length;
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;
  const lateCount = submissions.filter((s) => s.status === 'late').length;
  const overallPercentage = submissions.length > 0
    ? Math.round((submittedCount / submissions.length) * 100)
    : 0;

  return { total, active, completed, overdue, pending: Math.max(0, pending), submittedCount, pendingCount, lateCount, overallPercentage };
}

export function computeClassWiseCompletion(
  assignments: Assignment[],
  submissions: AssignmentSubmission[]
) {
  const map = new Map<string, { className: string; total: number; submitted: number }>();
  assignments.forEach((a) => {
    const key = a.classId || a.className;
    const existing = map.get(key) || { className: a.className, total: 0, submitted: 0 };
    existing.total += 1;
    map.set(key, existing);
  });
  submissions.forEach((s) => {
    const assignment = assignments.find((a) => a.id === s.assignmentId);
    if (assignment) {
      const key = assignment.classId || assignment.className;
      const existing = map.get(key);
      if (existing && (s.status === 'submitted' || s.status === 'reviewed')) {
        existing.submitted += 1;
      }
    }
  });
  return Array.from(map.values()).map((v) => ({
    ...v,
    percentage: v.total > 0 ? Math.round((v.submitted / (v.total * 1)) * 100) : 0,
  }));
}

export function computeSubjectWiseCompletion(
  assignments: Assignment[],
  submissions: AssignmentSubmission[]
) {
  const map = new Map<string, { subjectName: string; total: number; submitted: number }>();
  assignments.forEach((a) => {
    const key = a.subjectId || a.subjectName;
    const existing = map.get(key) || { subjectName: a.subjectName, total: 0, submitted: 0 };
    existing.total += 1;
    map.set(key, existing);
  });
  submissions.forEach((s) => {
    const assignment = assignments.find((a) => a.id === s.assignmentId);
    if (assignment) {
      const key = assignment.subjectId || assignment.subjectName;
      const existing = map.get(key);
      if (existing && (s.status === 'submitted' || s.status === 'reviewed')) {
        existing.submitted += 1;
      }
    }
  });
  return Array.from(map.values()).map((v) => ({
    ...v,
    percentage: v.total > 0 ? Math.round((v.submitted / (v.total * 1)) * 100) : 0,
  }));
}

export function computeTeacherWiseActivity(
  assignments: Assignment[],
  submissions: AssignmentSubmission[]
) {
  const map = new Map<string, { teacherName: string; total: number; submitted: number }>();
  assignments.forEach((a) => {
    const key = a.teacherId || a.teacherName;
    const existing = map.get(key) || { teacherName: a.teacherName, total: 0, submitted: 0 };
    existing.total += 1;
    map.set(key, existing);
  });
  submissions.forEach((s) => {
    const assignment = assignments.find((a) => a.id === s.assignmentId);
    if (assignment) {
      const key = assignment.teacherId || assignment.teacherName;
      const existing = map.get(key);
      if (existing && (s.status === 'submitted' || s.status === 'reviewed')) {
        existing.submitted += 1;
      }
    }
  });
  return Array.from(map.values()).map((v) => ({
    ...v,
    percentage: v.total > 0 ? Math.round((v.submitted / (v.total * 1)) * 100) : 0,
  }));
}

export async function fetchStudents(): Promise<{ uid: string; name: string; grNumber?: string; class_id?: string }[]> {
  const snap = await getDocs(query(collection(db, 'students'), where('role', '==', 'student')));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as { uid: string; name: string; grNumber?: string; class_id?: string }[];
}

export function computeSubmissionDetails(
  students: { uid: string; name: string; grNumber?: string; class_id?: string }[],
  submissions: AssignmentSubmission[],
  assignmentClassId: string
): SubmissionDetail[] {
  const classStudents = students.filter((s) => !assignmentClassId || s.class_id === assignmentClassId);
  return classStudents.map((student) => {
    const submission = submissions.find((s) => s.studentId === student.uid) || null;
    return {
      studentId: student.uid,
      studentName: student.name,
      grNumber: student.grNumber || '',
      submission,
      status: submission ? submission.status : 'pending',
    };
  });
}
