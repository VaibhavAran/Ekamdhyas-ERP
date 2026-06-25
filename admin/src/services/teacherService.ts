import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase';
import type { Teacher, TeacherForm } from '../types/teacher';

const COLLECTION = 'teachers';

export async function fetchAllTeachers(): Promise<Teacher[]> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
}

export async function fetchTeachersByAcademicYear(academicYear: string): Promise<Teacher[]> {
  const q = query(collection(db, COLLECTION), where('academicYear', '==', academicYear));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
}

export async function validateEmployeeIdUnique(employeeId: string, excludeId?: string): Promise<boolean> {
  const q = query(collection(db, COLLECTION), where('employeeId', '==', employeeId));
  const snapshot = await getDocs(q);
  if (excludeId) {
    return snapshot.docs.every((d) => d.id === excludeId);
  }
  return snapshot.empty;
}

export async function validateEmailUnique(email: string, excludeId?: string): Promise<boolean> {
  const q = query(collection(db, COLLECTION), where('personalDetails.email', '==', email));
  const snapshot = await getDocs(q);
  if (excludeId) {
    return snapshot.docs.every((d) => d.id === excludeId);
  }
  return snapshot.empty;
}

export async function createTeacher(form: TeacherForm): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, 'TeacherSecondary' + Date.now());
  const secondaryAuth = getAuth(secondaryApp);

  let uid = '';
  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      form.personalDetails.email,
      form.password
    );
    uid = userCredential.user.uid;
    await secondaryAuth.signOut();
  } catch (authError: any) {
    console.error('Firebase Auth error:', authError);
    if (authError.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered in Firebase Auth. Use a different email.');
    }
    if (authError.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Use at least 6 characters.');
    }
    throw new Error(authError.message || 'Failed to create teacher login account');
  }

  try {
    const teacherData = {
      employeeId: form.employeeId,
      personalDetails: { ...form.personalDetails },
      professionalDetails: { ...form.professionalDetails },
      assignedBoards: form.assignedBoards,
      assignedBoardNames: form.assignedBoardNames,
      assignedClasses: form.assignedClasses,
      assignedClassNames: form.assignedClassNames,
      assignedSubjects: form.assignedSubjects,
      assignedSubjectNames: form.assignedSubjectNames,
      academicYear: form.academicYear,
      username: form.username,
      status: form.status,
      role: 'teacher',
      authUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, COLLECTION), teacherData);
    return uid;
  } catch (firestoreError: any) {
    console.error('Firestore write error:', firestoreError);
    throw new Error(firestoreError.message || 'Failed to save teacher data to database');
  }
}

export async function updateTeacher(teacherId: string, form: TeacherForm): Promise<void> {
  const teacherRef = doc(db, COLLECTION, teacherId);
  const updateData = {
    employeeId: form.employeeId,
    personalDetails: { ...form.personalDetails },
    professionalDetails: { ...form.professionalDetails },
    assignedBoards: form.assignedBoards,
    assignedBoardNames: form.assignedBoardNames,
    assignedClasses: form.assignedClasses,
    assignedClassNames: form.assignedClassNames,
    assignedSubjects: form.assignedSubjects,
    assignedSubjectNames: form.assignedSubjectNames,
    academicYear: form.academicYear,
    username: form.username,
    status: form.status,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(teacherRef, updateData);
}

export async function updateTeacherAssignments(
  teacherId: string,
  assignments: {
    assignedBoards?: string[];
    assignedBoardNames?: string[];
    assignedClasses?: string[];
    assignedClassNames?: string[];
    assignedSubjects?: string[];
    assignedSubjectNames?: string[];
  }
): Promise<void> {
  const teacherRef = doc(db, COLLECTION, teacherId);
  await updateDoc(teacherRef, { ...assignments, updatedAt: serverTimestamp() });
}

export async function updateTeacherStatus(teacherId: string, status: 'active' | 'inactive'): Promise<void> {
  const teacherRef = doc(db, COLLECTION, teacherId);
  await updateDoc(teacherRef, { status, updatedAt: serverTimestamp() });
}

export async function deleteTeacher(teacherId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, teacherId));
}
