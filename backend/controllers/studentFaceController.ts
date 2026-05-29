import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import { admin, adminDb } from '../utils/firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const studentFacesRoot = path.join(backendRoot, 'student_faces');

function ensureBaseDir() {
  if (!fs.existsSync(studentFacesRoot)) {
    fs.mkdirSync(studentFacesRoot, { recursive: true });
  }
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') {
    return 'png';
  }
  return 'jpg';
}

async function generateStudentEmbedding(studentUid: string, studentName: string, rollNumber: string) {
  const aiServiceBaseUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').trim();
  let aiResponse: globalThis.Response;
  try {
    aiResponse = await fetch(`${aiServiceBaseUrl}/embeddings/generate-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        student_uid: studentUid,
        student_name: studentName,
        roll_number: rollNumber,
      }),
    });
  } catch {
    throw new Error(`AI service unavailable at ${aiServiceBaseUrl}`);
  }

  let payload: { detail?: string; error?: string; message?: string } = {};
  try {
    payload = (await aiResponse.json()) as { detail?: string; error?: string; message?: string };
  } catch {
    payload = {};
  }

  if (!aiResponse.ok) {
    throw new Error(payload.detail || payload.error || payload.message || 'Embedding generation failed');
  }
}

export async function registerStudentFaceController(req: Request, res: Response) {
  try {
    const studentUid = String(req.body.student_uid || '').trim();
    if (!studentUid) {
      res.status(400).json({ success: false, error: 'Student UID missing' });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length < 3) {
      res.status(400).json({ success: false, error: 'Minimum 3 images required' });
      return;
    }

    if (files.length > 10) {
      res.status(400).json({ success: false, error: 'Maximum 10 images allowed' });
      return;
    }

    ensureBaseDir();

    const studentFolderAbsolutePath = path.join(studentFacesRoot, studentUid);
    const relativeFolderPath = `student_faces/${studentUid}/`;

    if (fs.existsSync(studentFolderAbsolutePath)) {
      fs.rmSync(studentFolderAbsolutePath, { recursive: true, force: true });
    }

    fs.mkdirSync(studentFolderAbsolutePath, { recursive: true });

    files.forEach((file, index) => {
      const ext = extensionFromMimeType(file.mimetype);
      const fileName = `face_${index + 1}.${ext}`;
      const targetPath = path.join(studentFolderAbsolutePath, fileName);
      fs.writeFileSync(targetPath, file.buffer);
    });

    const studentDoc = await adminDb.collection('students').doc(studentUid).get();
    if (!studentDoc.exists) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    const studentData = studentDoc.data() || {};
    const studentName = String(studentData.name || '').trim();
    const rollNumber = String(studentData.roll_no || '').trim();
    if (!studentName || !rollNumber) {
      res.status(400).json({ success: false, error: 'Student profile incomplete for embedding generation' });
      return;
    }

    await generateStudentEmbedding(studentUid, studentName, rollNumber);

    await adminDb.collection('students').doc(studentUid).update({
      face_registered: true,
      face_registration_status: 'completed',
      face_image_count: files.length,
      face_folder_path: relativeFolderPath,
      face_last_updated: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: 'Face registration successful',
      imageCount: files.length,
      folderPath: relativeFolderPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Face registration failed';
    res.status(500).json({ success: false, error: message });
  }
}
