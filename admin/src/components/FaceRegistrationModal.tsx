import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiCamera, FiCheck, FiInfo, FiLoader, FiUpload, FiX, FiTrash2 } from 'react-icons/fi';
import { FACE_MAX_IMAGES, FACE_MIN_IMAGES, FACE_VALIDATION_GUIDANCE, validateFaceRegistration } from '../utils/faceRegistration';

export interface FaceRegistrationStudent {
  uid: string;
  name: string;
  roll_no: string;
  class_name: string;
  batch_name?: string;
  face_registered: boolean;
  face_image_count: number;
  face_last_updated: unknown;
}

interface FaceRegistrationModalProps {
  isOpen: boolean;
  student: FaceRegistrationStudent | null;
  onClose: () => void;
  onSubmit: (images: File[]) => Promise<void>;
}

type RegistrationMode = 'choose' | 'camera' | 'upload';

type CapturedImage = {
  file: File;
  previewUrl: string;
  label: string;
};

const cameraSteps = [
  'Front Face',
  'Left Face',
  'Right Face',
  'Slight Up',
  'Slight Down',
];

const readFileAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read image preview'));
    reader.readAsDataURL(file);
  });

export function FaceRegistrationModal({ isOpen, student, onClose, onSubmit }: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<RegistrationMode>('choose');
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const resetModal = () => {
    stopCamera();
    setMode('choose');
    setImages([]);
    setErrorMessage(null);
    setIsCameraLoading(false);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const nextCaptureLabel = useMemo(() => {
    if (images.length < cameraSteps.length) {
      return cameraSteps[images.length];
    }
    return `Additional Capture ${images.length + 1 - cameraSteps.length}`;
  }, [images.length]);

  const handleStartCamera = async () => {
    setErrorMessage(null);
    setMode('camera');
    setIsCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setErrorMessage('Unable to access camera. Please allow camera permission or use image upload.');
      setMode('choose');
    } finally {
      setIsCameraLoading(false);
    }
  };

  const handleUploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    const validation = validateFaceRegistration(files);
    if (!validation.isValid) {
      setErrorMessage(validation.message || FACE_VALIDATION_GUIDANCE);
      setImages([]);
      setMode('upload');
      return;
    }

    const previewImages = await Promise.all(
      files.map(async (file, index) => ({
        file,
        previewUrl: await readFileAsDataUrl(file),
        label: `Image ${index + 1}`,
      }))
    );

    setImages(previewImages);
    setMode('upload');
  };

  const handleCaptureImage = async () => {
    if (!videoRef.current || images.length >= FACE_MAX_IMAGES) {
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      setErrorMessage('Unable to capture frame from camera.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));

    if (!blob) {
      setErrorMessage('Unable to capture image.');
      return;
    }

    const previewUrl = await readFileAsDataUrl(blob);
    const label = nextCaptureLabel;
    const safeLabel = label.toLowerCase().replace(/\s+/g, '-');
    const file = new File([blob], `${student?.uid || 'student'}-${safeLabel}-${Date.now()}.jpg`, { type: 'image/jpeg' });

    setImages((previous) => [...previous, { file, previewUrl, label }]);
  };

  const handleRemoveImage = (index: number) => {
    setImages((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async () => {
    if (!student) {
      return;
    }

    const files = images.map((image) => image.file);
    const validation = validateFaceRegistration(files);
    if (!validation.isValid) {
      setErrorMessage(validation.message || FACE_VALIDATION_GUIDANCE);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit(files);
      resetModal();
    } catch (error) {
      console.error('Face registration submit error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Face registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !student) {
    return null;
  }

  const registrationLabel = student.face_registered ? 'Re-register Face' : 'Register Face';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={isSubmitting ? undefined : onClose}></div>
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{registrationLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">Step 2 prepares local face images for later attendance AI.</p>
          </div>
          <button onClick={isSubmitting ? undefined : onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <FiX className="text-xl" />
          </button>
        </div>

        <div className="grid gap-6 px-8 py-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Student Name</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{student.name}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Roll Number</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{student.roll_no}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Class</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{student.class_name}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Batch</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{student.batch_name || 'Not Assigned'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {mode === 'choose' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Choose registration method</h3>
                    <p className="mt-1 text-sm text-slate-500">Minimum 3 face images required.</p>
                    <p className="mt-1 text-sm text-slate-500">For best accuracy, upload 5–10 images.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button type="button" onClick={handleStartCamera} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-left transition-all hover:border-blue-400 hover:bg-blue-50">
                      <FiCamera className="text-2xl text-blue-600" />
                      <div className="mt-3 text-base font-bold text-slate-900">Open Camera</div>
                      <div className="mt-1 text-sm text-slate-500">Capture front, left, and right angles first.</div>
                    </button>
                    <label className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50">
                      <input type="file" className="hidden" accept="image/jpeg,image/png" multiple onChange={handleUploadImages} />
                      <FiUpload className="text-2xl text-emerald-600" />
                      <div className="mt-3 text-base font-bold text-slate-900">Upload Images</div>
                      <div className="mt-1 text-sm text-slate-500">jpg, jpeg, png only.</div>
                    </label>
                  </div>
                </div>
              )}

              {mode === 'camera' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Camera Capture</h3>
                      <p className="mt-1 text-sm text-slate-500">Minimum 3 captures required. You can still add up to 10 images.</p>
                    </div>
                    <button type="button" onClick={handleCaptureImage} disabled={isCameraLoading || isSubmitting || images.length >= FACE_MAX_IMAGES} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
                      <FiCamera />
                      Capture
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                    <video ref={videoRef} autoPlay playsInline muted className="h-[320px] w-full object-cover bg-slate-900" />
                    {isCameraLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-white">
                        <FiLoader className="mr-2 animate-spin" />
                        Starting camera...
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span>Next capture: <strong>{nextCaptureLabel}</strong></span>
                    <span>{images.length} / {FACE_MAX_IMAGES} captured</span>
                  </div>
                </div>
              )}

              {mode === 'upload' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Uploaded Images</h3>
                      <p className="mt-1 text-sm text-slate-500">Minimum {FACE_MIN_IMAGES} face images required.</p>
                      <p className="mt-1 text-sm text-slate-500">For best accuracy, upload 5–10 images.</p>
                    </div>
                    <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                      <input type="file" className="hidden" accept="image/jpeg,image/png" multiple onChange={handleUploadImages} />
                      Replace Files
                    </label>
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    {images.length === 0 ? 'No images selected yet.' : `${images.length} image(s) selected.`}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Face Image Queue</h3>
                  <p className="mt-1 text-sm text-slate-500">Images stay local on the backend.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {images.length} / {FACE_MAX_IMAGES}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {images.length > 0 ? (
                  images.map((image, index) => (
                    <div key={`${image.label}-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <img src={image.previewUrl} alt={image.label} className="h-16 w-16 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900">{image.label}</div>
                        <div className="text-xs text-slate-500">{image.file.name}</div>
                      </div>
                      <button type="button" onClick={() => handleRemoveImage(index)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors">
                        <FiTrash2 />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                    No face images added yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <FiInfo className="mt-0.5 text-lg text-amber-500" />
                <div>
                  <div className="text-sm font-bold text-slate-900">Validation note</div>
                  <p className="mt-1 text-sm text-slate-600">{FACE_VALIDATION_GUIDANCE}</p>
                  <p className="mt-2 text-xs text-slate-500">Future AI checks will enforce single-face, non-blurry validation. Step 2 only prepares the flow.</p>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-8 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {images.length < FACE_MIN_IMAGES
              ? `Minimum ${FACE_MIN_IMAGES} face images required.`
              : `${images.length} image(s) ready to save.`}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={isSubmitting || images.length < FACE_MIN_IMAGES} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? <FiLoader className="animate-spin" /> : <FiCheck />}
              {isSubmitting ? 'Saving...' : images.length >= FACE_MIN_IMAGES ? 'Save Face Registration' : registrationLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
