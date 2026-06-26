import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { SystemUser, UserRole, UserAccountStatus } from '../types/userManagement';

export async function fetchAllUsers(): Promise<SystemUser[]> {
  const [controllerSnap, teacherSnap, studentSnap] = await Promise.all([
    getDocs(collection(db, 'controllers')),
    getDocs(collection(db, 'teachers')),
    getDocs(query(collection(db, 'students'), where('role', '==', 'student'))),
  ]);

  const users: SystemUser[] = [];

  controllerSnap.docs.forEach((d) => {
    const data = d.data();
    users.push({
      id: d.id,
      name: data.username || 'Admin',
      username: data.username || '',
      email: data.username || '',
      role: 'admin',
      status: (data.status as UserAccountStatus) || 'active',
      lastLogin: data.lastLogin || '',
      createdAt: data.created_at,
      collection: 'controllers',
    });
  });

  teacherSnap.docs.forEach((d) => {
    const data = d.data();
    const firstName = data.personalDetails?.firstName || '';
    const middleName = data.personalDetails?.middleName || '';
    const lastName = data.personalDetails?.lastName || '';
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    users.push({
      id: d.id,
      name: fullName || data.username || 'Teacher',
      username: data.username || data.personalDetails?.email || '',
      email: data.personalDetails?.email || '',
      role: 'teacher',
      status: (data.status as UserAccountStatus) || 'active',
      lastLogin: data.lastLogin || '',
      createdAt: data.createdAt,
      collection: 'teachers',
      phone: data.personalDetails?.mobileNumber || '',
      employeeId: data.employeeId || '',
      className: (data.assignedClassNames || []).join(', '),
      department: (data.assignedSubjectNames || []).join(', '),
    });
  });

  studentSnap.docs.forEach((d) => {
    const data = d.data();
    const firstName = data.firstName || '';
    const middleName = data.middleName || '';
    const lastName = data.lastName || '';
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    users.push({
      id: d.id,
      name: fullName || data.name || 'Student',
      username: data.studentId || data.grNumber || '',
      email: data.parentEmail || '',
      role: 'student',
      status: (data.status === 'Active' ? 'active' : 'inactive') as UserAccountStatus,
      lastLogin: data.lastLogin || '',
      createdAt: data.created_at,
      collection: 'students',
      phone: data.parentMobile || '',
      className: data.class_name || '',
      boardName: data.board_name || '',
    });
  });

  return users.sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bTime - aTime;
  });
}

export async function updateUserStatus(
  collectionName: 'controllers' | 'teachers' | 'students',
  userId: string,
  status: UserAccountStatus
): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (collectionName === 'students') {
    updateData.status = status === 'active' ? 'Active' : 'Inactive';
  } else {
    updateData.status = status;
  }
  await updateDoc(doc(db, collectionName, userId), updateData);
}

export async function resetUserPassword(
  collectionName: 'controllers' | 'teachers' | 'students',
  userId: string,
  newPassword: string
): Promise<void> {
  await updateDoc(doc(db, collectionName, userId), {
    password: newPassword,
    forcePasswordChange: true,
    updatedAt: serverTimestamp(),
  });
}

export function computeUserStats(users: SystemUser[]) {
  const total = users.length;
  const admins = users.filter((u) => u.role === 'admin').length;
  const teachers = users.filter((u) => u.role === 'teacher').length;
  const students = users.filter((u) => u.role === 'student').length;
  const active = users.filter((u) => u.status === 'active').length;
  const inactive = users.filter((u) => u.status === 'inactive').length;
  return { total, admins, teachers, students, active, inactive };
}
