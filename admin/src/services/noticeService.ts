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
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { Notice, NoticeForm, NoticeStatus } from '../types/notice';

const COLLECTION = 'notices';

export async function fetchAllNotices(): Promise<Notice[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice));
}

export async function fetchNoticeById(id: string): Promise<Notice | null> {
  const d = await getDoc(doc(db, COLLECTION, id));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() } as Notice;
}

export async function createNotice(form: NoticeForm, createdBy: string): Promise<string> {
  const docData = {
    ...form,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, COLLECTION), docData);
  return docRef.id;
}

export async function updateNotice(id: string, form: Partial<NoticeForm>): Promise<void> {
  const updateData = {
    ...form,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, COLLECTION, id), updateData);
}

export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function updateNoticeStatus(id: string, status: NoticeStatus): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadAttachment(
  file: File,
  noticeId: string
): Promise<{ url: string; name: string }> {
  const storageRef = ref(storage, `notices/${noticeId}/${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, name: file.name };
}

export async function deleteAttachment(noticeId: string, fileName: string): Promise<void> {
  try {
    const storageRef = ref(storage, `notices/${noticeId}/${fileName}`);
    await deleteObject(storageRef);
  } catch {
    // File may not exist
  }
}

export function computeNoticeStats(notices: Notice[]) {
  const now = new Date().toISOString().split('T')[0];
  const total = notices.length;
  const active = notices.filter((n) => n.status === 'published' && n.expiryDate >= now).length;
  const scheduled = notices.filter((n) => n.status === 'scheduled').length;
  const expired = notices.filter((n) => n.status === 'expired' || (n.status === 'published' && n.expiryDate < now)).length;
  return { total, active, scheduled, expired };
}
