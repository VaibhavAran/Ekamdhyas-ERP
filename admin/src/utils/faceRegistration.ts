import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getBackendUrl } from './apiConfig';

export const FACE_MIN_IMAGES = 3;
export const FACE_MAX_IMAGES = 10;
export const FACE_VALIDATION_GUIDANCE = 'Please upload a clear image with one face.';

export interface FaceValidationResult {
  isValid: boolean;
  message?: string;
  guidance: string;
}

export interface FaceRegistrationPayload {
  studentUid: string;
  images: File[];
}

export interface FaceRegistrationResponse {
  success: boolean;
  message: string;
  imageCount: number;
  folderPath?: string;
}

const allowedMimeTypes = ['image/jpeg', 'image/png'];

export function validateFaceRegistration(images: File[]): FaceValidationResult {
  if (!Array.isArray(images) || images.length < FACE_MIN_IMAGES) {
    return {
      isValid: false,
      message: `Minimum ${FACE_MIN_IMAGES} face images required.`,
      guidance: FACE_VALIDATION_GUIDANCE,
    };
  }

  if (images.length > FACE_MAX_IMAGES) {
    return {
      isValid: false,
      message: `Maximum ${FACE_MAX_IMAGES} face images allowed.`,
      guidance: FACE_VALIDATION_GUIDANCE,
    };
  }

  const invalidFile = images.find((file) => !allowedMimeTypes.includes(file.type));
  if (invalidFile) {
    return {
      isValid: false,
      message: 'Only jpg, jpeg, and png files are allowed',
      guidance: FACE_VALIDATION_GUIDANCE,
    };
  }

  return {
    isValid: true,
    guidance: FACE_VALIDATION_GUIDANCE,
  };
}

export async function registerStudentFace({ studentUid, images }: FaceRegistrationPayload): Promise<FaceRegistrationResponse> {
  const formData = new FormData();
  formData.append('student_uid', studentUid);
  images.forEach((image) => {
    formData.append('images[]', image, image.name);
  });

  const apiBaseUrl = getBackendUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/register-student-face`, {
      method: 'POST',
      body: formData,
    });
  } catch (netError) {
    console.error('Network error connecting to backend:', netError);
    throw new Error(`Cannot reach local attendance server at ${apiBaseUrl}. Please ensure the server is running on the laptop, and your device is connected to the same WiFi network.`);
  }

  let payload: { success?: boolean; error?: string; message?: string; imageCount?: number; folderPath?: string } = {};
  try {
    payload = (await response.json()) as { success?: boolean; error?: string; message?: string; imageCount?: number; folderPath?: string };
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Face registration failed');
  }

  return {
    success: payload.success ?? true,
    message: payload.message || 'Face registration successful',
    imageCount: payload.imageCount ?? images.length,
    folderPath: payload.folderPath,
  };
}

export async function updateFaceRegistrationStatus(studentUid: string, folderPath: string, imageCount: number) {
  await updateDoc(doc(db, 'students', studentUid), {
    face_registered: true,
    face_folder_path: folderPath,
    face_registration_status: 'completed',
    face_image_count: imageCount,
    face_last_updated: serverTimestamp(),
  });
}