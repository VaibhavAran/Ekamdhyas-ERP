import type { Request, Response } from 'express';
import { adminDb } from '../utils/firebaseAdmin.js';

type RecognitionStudent = {
  uid: string;
  name: string;
  roll_number: string;
  confidence: number;
  match_strength?: 'recognized' | 'unknown' | 'ignored';
};

type RecognitionResponse = {
  recognized_students?: RecognitionStudent[];
  unknown_faces?: number;
  ignored_faces?: number;
  backend?: string;
  debug?: {
    face_count?: number;
    matched_count?: number;
    unknown_count?: number;
    ignored_count?: number;
    registered_embeddings_count?: number;
    backend_filtered_out?: number;
    dimension_filtered_out?: number;
    detected_embedding_dim?: number;
    distance_metric?: string;
    recognized_confidence_threshold?: number;
    unknown_confidence_threshold?: number;
    faces?: Array<{
      face_index: number;
      best_student_name?: string;
      best_student_uid?: string;
      confidence?: number;
      similarity?: number;
      distance?: number;
      embedding_dim?: number;
      distance_metric?: string;
      threshold?: {
        unknown_confidence?: number;
        recognized_confidence?: number;
      };
      quality_score?: number;
      match_strength?: string;
      reason?: string;
    }>;
    reason?: string;
  };
};

const aiServiceBaseUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').trim();

function dedupeRecognizedStudents(students: RecognitionStudent[]) {
  const bestMatchByUid = new Map<string, RecognitionStudent>();

  students.forEach((student) => {
    const existing = bestMatchByUid.get(student.uid);
    if (!existing || student.confidence > existing.confidence) {
      bestMatchByUid.set(student.uid, student);
    }
  });

  return Array.from(bestMatchByUid.values());
}

const RECOGNIZED_CONFIDENCE_THRESHOLD = 70;
async function loadAllowedStudentUids(classId: string, batchId: string) {
  let studentQuery = adminDb
    .collection('students')
    .where('class_id', '==', classId)
    .where('face_registered', '==', true);

  if (batchId) {
    studentQuery = studentQuery.where('batch_id', '==', batchId);
  }

  const snapshot = await studentQuery.get();
  return new Set(snapshot.docs.map((studentDoc) => studentDoc.id));
}

export async function recognizeAttendanceController(req: Request, res: Response) {
  try {
    const classId = String(req.body.class_id || '').trim();
    const batchId = String(req.body.batch_id || '').trim();
    const sessionId = String(req.body.session_id || '').trim();
    const imageFile = (req.file as Express.Multer.File | undefined) ?? null;

    if (!classId) {
      res.status(400).json({ success: false, error: 'Class ID missing' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Session ID missing' });
      return;
    }

    if (!imageFile) {
      res.status(400).json({ success: false, error: 'Captured image missing' });
      return;
    }

    const allowedStudentUids = await loadAllowedStudentUids(classId, batchId);

    const imageFormData = new FormData();
    imageFormData.append(
      'image',
      new Blob([new Uint8Array(imageFile.buffer)], { type: imageFile.mimetype }),
      imageFile.originalname || 'captured-image.jpg',
    );

    let aiResponse: globalThis.Response;
    try {
      aiResponse = await fetch(`${aiServiceBaseUrl}/recognition/classroom`, {
        method: 'POST',
        body: imageFormData,
      });
    } catch {
      res.status(503).json({ success: false, error: `AI service unavailable at ${aiServiceBaseUrl}` });
      return;
    }

    let payload: RecognitionResponse = {};
    try {
      payload = (await aiResponse.json()) as RecognitionResponse;
    } catch {
      payload = {};
    }

    if (!aiResponse.ok) {
      res.status(aiResponse.status).json({
        success: false,
        error: 'Recognition failed',
        detail: (payload as { detail?: string }).detail,
      });
      return;
    }

    const filteredStudents = dedupeRecognizedStudents(
      (payload.recognized_students || []).filter(
        (student) => allowedStudentUids.has(student.uid) && Number(student.confidence || 0) >= RECOGNIZED_CONFIDENCE_THRESHOLD,
      ),
    );

    res.status(200).json({
      success: true,
      session_id: sessionId,
      class_id: classId,
      batch_id: batchId,
      recognized_students: filteredStudents,
      recognized_students_count: filteredStudents.length,
      unknown_faces: payload.unknown_faces ?? 0,
      ignored_faces: payload.ignored_faces ?? 0,
      backend: payload.backend ?? 'face_recognition',
      debug: payload.debug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recognition failed';
    res.status(500).json({ success: false, error: message });
  }
}