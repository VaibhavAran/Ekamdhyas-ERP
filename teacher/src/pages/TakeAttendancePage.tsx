import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import {
  FiAlertCircle,
  FiCamera,
  FiCheckCircle,
  FiChevronLeft,
  FiEdit3,
  FiLock,
  FiLoader,
  FiPauseCircle,
  FiPlayCircle,
  FiRefreshCw,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { fetchTeacherSchedule, formatTime, todayISO, toMinutes } from "../utils/substituteLectures";
import { getBackendUrl } from "../utils/apiConfig";

interface TimetableEntry {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  day: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  batch_id?: string | null;
  batch_name?: string | null;
  is_substitute?: boolean;
  original_timetable_id?: string;
  type?: string;
}

interface Student {
  uid: string;
  name: string;
  roll_no: string;
  class_id: string;
  class_name: string;
  batch_id?: string | null;
  batch_name?: string | null;
}

interface DetectedStudent {
  uid: string;
  name: string;
  roll_no: string;
  confidence: number;
  match_strength?: "recognized" | "unknown" | "ignored";
  detected_at: string;
}

interface RecognitionResponse {
  recognized_students: Array<{
    uid: string;
    name: string;
    roll_number: string;
    confidence: number;
    match_strength?: "recognized" | "unknown" | "ignored";
  }>;
  unknown_faces: number;
  ignored_faces?: number;
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
}

type AttendanceStatus = "present" | "absent";
type AttendanceMethod = "manual" | "image_assisted";
type Mode = "image" | "manual";

const nowMinutes = () => {
  const current = new Date();
  return current.getHours() * 60 + current.getMinutes();
};

const sessionIdFor = (session: TimetableEntry) => `${session.id}_${todayISO()}`;

const formatDebugCount = (value?: number) => value ?? 0;

const TakeAttendancePage = () => {
  const { currentUser, teacherProfile, loading: authLoading } = useAuth();
  const teacherUid = currentUser?.uid;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<TimetableEntry[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [manualStatus, setManualStatus] = useState<Record<string, AttendanceStatus>>({});
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([]);
  const [unknownFaces, setUnknownFaces] = useState(0);
  const [ignoredFaces, setIgnoredFaces] = useState(0);
  const [recognitionLoading, setRecognitionLoading] = useState(false);
  const [recognitionCompleted, setRecognitionCompleted] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<"idle" | "saving" | "recognizing" | "success" | "failed">("idle");
  const [recognitionError, setRecognitionError] = useState("");
  const [liveDetectedStudents, setLiveDetectedStudents] = useState<DetectedStudent[]>([]);
  const [liveUnknownFaces, setLiveUnknownFaces] = useState(0);
  const [liveIgnoredFaces, setLiveIgnoredFaces] = useState(0);
  const [liveRecognitionLoading, setLiveRecognitionLoading] = useState(false);
  const [liveRecognitionError, setLiveRecognitionError] = useState("");
  const [liveRecognitionDebug, setLiveRecognitionDebug] = useState<RecognitionResponse["debug"]>();
  const [mode, setMode] = useState<Mode>("image");
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">(() => {
    if (typeof window === "undefined") return "environment";
    return window.matchMedia("(pointer: coarse)").matches ? "environment" : "user";
  });
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState("");
  const [captureSource, setCaptureSource] = useState<"camera" | "upload" | null>(null);
  const [uploadedPhotoName, setUploadedPhotoName] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [captureNotice, setCaptureNotice] = useState("");
  const [cameraFullScreen, setCameraFullScreen] = useState(false);
  const [imageAssistedUsed, setImageAssistedUsed] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [editAttendanceEnabled, setEditAttendanceEnabled] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const liveRecognitionIntervalRef = useRef<number | null>(null);
  const liveRecognitionInFlightRef = useRef(false);

  const selectedSession = useMemo(
    () => sessions.find((item) => item.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const sessionKey = useMemo(() => {
    if (!selectedSession) return "";
    return sessionIdFor(selectedSession);
  }, [selectedSession]);

  const attendanceStarted = useMemo(
    () => (mode === "image" ? cameraRunning || detectedStudents.length > 0 || recognitionCompleted : true),
    [cameraRunning, detectedStudents.length, mode, recognitionCompleted],
  );

  const canEditAttendance = !sessionCompleted || editAttendanceEnabled;

  const stopLiveRecognition = () => {
    if (liveRecognitionIntervalRef.current) {
      window.clearInterval(liveRecognitionIntervalRef.current);
      liveRecognitionIntervalRef.current = null;
    }
  };

  const resetRecognitionSession = () => {
    setCapturedImage("");
    setCaptureSource(null);
    setUploadedPhotoName("");
    setPreviewMode(false);
    setDetectedStudents([]);
    setUnknownFaces(0);
    setIgnoredFaces(0);
    setRecognitionCompleted(false);
    setRecognitionStatus("idle");
    setRecognitionError("");
    setLiveDetectedStudents([]);
    setLiveUnknownFaces(0);
    setLiveIgnoredFaces(0);
    setLiveRecognitionLoading(false);
    setLiveRecognitionError("");
    setLiveRecognitionDebug(undefined);
    liveRecognitionInFlightRef.current = false;
  };

  const pauseCameraStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setCameraRunning(false);
  };

  const getBackendBaseUrl = () => {
    const raw = getBackendUrl();
    return raw.endsWith("/api") ? raw.slice(0, -4) : raw;
  };

  const applyTrackQualityConstraints = async (stream: MediaStream) => {
    const [track] = stream.getVideoTracks();
    if (!track) return;

    try {
      const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown>;
      const advanced: Record<string, unknown> = {};

      const focusModes = capabilities.focusMode as string[] | undefined;
      const sharpness = capabilities.sharpness as { min?: number; max?: number } | undefined;
      const brightness = capabilities.brightness as { min?: number; max?: number } | undefined;
      const exposureCompensation = capabilities.exposureCompensation as { min?: number; max?: number } | undefined;
      const exposureMode = capabilities.exposureMode as string[] | undefined;

      // Auto focus for sharp images
      if (focusModes?.includes?.("continuous")) {
        advanced.focusMode = "continuous";
      } else if (focusModes?.includes?.("auto")) {
        advanced.focusMode = "auto";
      }

      // Sharpness enhancement (85% of max for good quality without artifacts)
      if (typeof sharpness?.max === "number") {
        advanced.sharpness = Math.min(sharpness.max, Math.max(0, sharpness.max * 0.85));
      }

      // Brightness optimization (slightly above mid-range for classroom lighting)
      if (typeof brightness?.max === "number" && typeof brightness?.min === "number") {
        const midBrightness = (brightness.max + brightness.min) / 2;
        // Boost brightness slightly for far-distance faces
        advanced.brightness = Math.min(brightness.max, midBrightness * 1.1);
      }

      // Exposure control (prefer manual control when available)
      if (exposureMode?.includes?.("manual")) {
        advanced.exposureMode = "manual";
      } else if (exposureMode?.includes?.("auto")) {
        advanced.exposureMode = "auto";
      }

      // Exposure compensation (slight positive to brighten images)
      if (typeof exposureCompensation?.max === "number" && typeof exposureCompensation?.min === "number") {
        const compensation = Math.min(exposureCompensation.max * 0.5, 0.3);
        advanced.exposureCompensation = Math.max(exposureCompensation.min, compensation);
      }

      if (Object.keys(advanced).length > 0) {
        await track.applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] });
      }
    } catch (constraintError) {
      console.warn("Advanced camera constraints unsupported:", constraintError);
    }
  };

  const ensureCameraPermission = async () => {
    if (!Capacitor.isNativePlatform()) return true;
    const { camera } = await Camera.requestPermissions({ permissions: ["camera"] });
    return camera === "granted" || camera === "limited";
  };

  const stopCameraStream = () => {
    stopLiveRecognition();
    pauseCameraStream();
    setCameraFullScreen(false);
    resetRecognitionSession();
    setCaptureNotice("");
    console.log("Camera reset");
  };

  const closeCameraForRecognition = () => {
    stopLiveRecognition();
    pauseCameraStream();
    setCameraFullScreen(false);
  };

  useEffect(() => () => stopCameraStream(), []);

  useEffect(() => {
    document.body.classList.toggle("teacher-camera-open", cameraFullScreen);

    return () => {
      document.body.classList.remove("teacher-camera-open");
    };
  }, [cameraFullScreen]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!teacherUid) return;
      setLoadingSessions(true);
      setError("");

      try {
        const scheduleData = await fetchTeacherSchedule(db, teacherUid, todayISO());
        const entries = scheduleData.scheduleEntries
          .filter((item) => !item.is_break)
          .sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time));

        setSessions(entries);

        const requestedSessionId = searchParams.get("session_id") ?? searchParams.get("override_id") ?? "";
        if (requestedSessionId && entries.some((item) => item.id === requestedSessionId)) {
          setSelectedSessionId(requestedSessionId);
        } else {
          const currentSession = entries.find((item) => nowMinutes() >= toMinutes(item.start_time) && nowMinutes() < toMinutes(item.end_time));
          const nextSession = entries.find((item) => nowMinutes() < toMinutes(item.start_time));
          setSelectedSessionId((currentSession ?? nextSession ?? entries[0])?.id ?? "");
        }
      } catch (sessionError) {
        console.error("Error fetching sessions:", sessionError);
        setError("Unable to load your sessions for today.");
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [teacherUid, searchParams]);

  useEffect(() => {
    const fetchSessionState = async () => {
      if (!selectedSession || !teacherUid || !sessionKey) {
        setStudents([]);
        setManualStatus({});
        setDetectedStudents([]);
        setUnknownFaces(0);
        setIgnoredFaces(0);
        setRecognitionCompleted(false);
        setSessionCompleted(false);
        setEditAttendanceEnabled(false);
        setImageAssistedUsed(false);
        return;
      }

      setLoadingStudents(true);
      setSessionNotice("");
      setNotice("");
      setError("");

      try {
        const sessionDoc = await getDoc(doc(db, "attendance_sessions", sessionKey));
        const sessionData = sessionDoc.exists() ? sessionDoc.data() : null;
        setSessionCompleted(sessionData?.status === "completed");
        setEditAttendanceEnabled(false);
        setImageAssistedUsed(Boolean(sessionData?.attendance_method === "image_assisted" || sessionData?.attendance_method === "image-assisted"));

        const studentQuery = selectedSession.batch_id
          ? query(collection(db, "students"), where("class_id", "==", selectedSession.class_id), where("batch_id", "==", selectedSession.batch_id))
          : query(collection(db, "students"), where("class_id", "==", selectedSession.class_id));
        const studentSnapshot = await getDocs(studentQuery);
        const fetchedStudents = studentSnapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as Student);
        setStudents(fetchedStudents);

        const attendanceSnapshot = await getDocs(
          query(collection(db, "attendance"), where("attendance_session_id", "==", sessionKey)),
        );
        const existingStatusMap = attendanceSnapshot.docs.reduce<Record<string, AttendanceStatus>>((acc, item) => {
          const data = item.data() as { student_id?: string; status?: AttendanceStatus };
          if (data.student_id) acc[data.student_id] = data.status ?? "absent";
          return acc;
        }, {});

        setManualStatus(
          fetchedStudents.reduce<Record<string, AttendanceStatus>>((acc, student) => {
            acc[student.uid] = existingStatusMap[student.uid] ?? "absent";
            return acc;
          }, {}),
        );
      } catch (sessionStateError) {
        console.error("Error loading attendance state:", sessionStateError);
        setError("Unable to load attendance data for this session.");
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchSessionState();
  }, [selectedSession, teacherUid, sessionKey]);

  const saveAttendanceRecord = async (student: Student, status: AttendanceStatus, attendanceMethod: AttendanceMethod) => {
    if (!selectedSession || !teacherUid || !teacherProfile || !sessionKey) return;

    await setDoc(
      doc(db, "attendance", `${sessionKey}_${student.uid}`),
      {
        student_id: student.uid,
        student_name: student.name,
        roll_no: student.roll_no,
        attendance_session_id: sessionKey,
        teacher_id: teacherUid,
        teacher_name: teacherProfile.name,
        class_id: selectedSession.class_id,
        class_name: selectedSession.class_name,
        subject_id: selectedSession.subject_id ?? "",
        subject_name: selectedSession.subject_name ?? "",
        batch_id: selectedSession.batch_id ?? "",
        batch_name: selectedSession.batch_name ?? "",
        type: selectedSession.is_substitute ? "teacher_substitute" : "regular",
        original_timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
        date: todayISO(),
        session_time: `${selectedSession.start_time}-${selectedSession.end_time}`,
        time: new Date().toTimeString().slice(0, 5),
        status,
        attendance_method: attendanceMethod,
        verified_by_teacher: true,
        updated_at: serverTimestamp(),
        created_at: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const buildRecognitionFile = async (imageData: string) => {
    const response = await fetch(imageData);
    const imageBlob = await response.blob();
    return new File([imageBlob], `classroom-${Date.now()}.jpg`, { type: "image/jpeg" });
  };

  const requestRecognition = async (imageData: string) => {
    if (!selectedSession) throw new Error("Please select a session first.");
    const classroomImage = await buildRecognitionFile(imageData);

    const formData = new FormData();
    formData.append("class_id", selectedSession.class_id);
    formData.append("batch_id", selectedSession.batch_id ?? "");
    formData.append("session_id", sessionKey);
    formData.append("captured_image", classroomImage);

    const backendBaseUrl = getBackendBaseUrl();
    const recognitionUrl = `${backendBaseUrl}/api/recognize-attendance`;
    console.log("=== RECOGNITION DEBUG ===");
    console.log("Recognition URL:", recognitionUrl);
    console.log("Backend base URL:", backendBaseUrl);
    console.log("Raw getBackendUrl():", getBackendUrl());
    console.log("VITE_BACKEND_URL env:", import.meta.env.VITE_BACKEND_URL);
    console.log("FormData keys:", [...formData.keys()]);
    console.log("class_id:", selectedSession.class_id);
    console.log("session_id:", sessionKey);
    console.log("=========================");
    let apiResponse: Response;
    try {
      apiResponse = await fetch(recognitionUrl, {
        method: "POST",
        body: formData,
      });
      console.log("Recognition response status:", apiResponse.status);
    } catch (netError) {
      console.error("Network error connecting to backend:", netError);
      console.error("Failed URL was:", recognitionUrl);
      throw new Error(`Cannot reach local attendance server at ${backendBaseUrl}. Please ensure the server is running on the laptop, and your device is connected to the same WiFi network.`);
    }

    let payload: { detail?: string; error?: string } & Partial<RecognitionResponse> = {};
    try {
      payload = (await apiResponse.json()) as { detail?: string; error?: string } & Partial<RecognitionResponse>;
    } catch {
      payload = {};
    }

    if (!apiResponse.ok) {
      throw new Error(payload.detail || payload.error || "Recognition failed");
    }

    return payload;
  };

  const startCamera = async () => {
    if (sessionCompleted && !editAttendanceEnabled) return;

    try {
      stopLiveRecognition();
      pauseCameraStream();
      resetRecognitionSession();
      setImageAssistedUsed(true);
      setCaptureNotice("");
      setError("");
      console.log("Camera started");

      const hasPermission = await ensureCameraPermission();
      if (!hasPermission) {
        setError("Camera permission denied. Please allow camera access.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: { ideal: cameraFacingMode },
        },
        audio: false,
      });
      await applyTrackQualityConstraints(stream);
      mediaStreamRef.current = stream;
      setCameraRunning(true);
      setCameraReady(false);
      setCameraFullScreen(true);
    } catch (cameraError) {
      console.error("Unable to start camera:", cameraError);
      setError("Unable to access the camera. Please allow webcam permission.");
      setCameraRunning(false);
      setCameraReady(false);
    }
  };

  const captureImage = async () => {
    if (!cameraReady || !videoRef.current || !canvasRef.current || !selectedSession) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const maxWidth = 1280;
    const maxHeight = 720;
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);

    canvas.width = Math.max(640, Math.round(sourceWidth * scale));
    canvas.height = Math.max(360, Math.round(sourceHeight * scale));
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setCapturedImage(canvas.toDataURL("image/jpeg", 0.95));
    setCaptureSource("camera");
    setUploadedPhotoName("");
    setPreviewMode(true);
    pauseCameraStream();
    stopLiveRecognition();
    setCaptureNotice("Image captured successfully. Save Image to run recognition.");
    console.log("Image captured");
  };

  const uploadClassroomPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    const photoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read the uploaded file."));
      reader.readAsDataURL(file);
    });

    stopLiveRecognition();
    pauseCameraStream();
    setCapturedImage(photoDataUrl);
    setCaptureSource("upload");
    setUploadedPhotoName(file.name);
    setPreviewMode(true);
    setCaptureNotice("Image uploaded successfully. Save Image to run recognition.");
    setRecognitionError("");
    setError("");
  };

  const triggerUploadPicker = () => {
    uploadInputRef.current?.click();
  };

  const saveCurrentCapture = async () => {
    if (!teacherUid || !teacherProfile) {
      setRecognitionStatus("failed");
      setRecognitionError("Teacher profile is not ready. Please re-login and try again.");
      return;
    }

    if (!selectedSession || !sessionKey) {
      setRecognitionStatus("failed");
      setRecognitionError("Please select a valid session before recognition.");
      return;
    }

    if (!capturedImage) {
      setRecognitionError("Please capture an image first.");
      setRecognitionStatus("failed");
      return;
    }

    try {
      setRecognitionLoading(true);
      setRecognitionStatus("saving");
      setRecognitionError("");
      closeCameraForRecognition();
      setCaptureNotice("Recognizing Students...");
      console.log("Image saved");

      await addDoc(collection(db, "attendance_images"), {
        teacher_id: teacherUid,
        teacher_name: teacherProfile?.name ?? "",
        class_id: selectedSession?.class_id ?? "",
        class_name: selectedSession?.class_name ?? "",
        subject_id: selectedSession?.subject_id ?? "",
        subject_name: selectedSession?.subject_name ?? "",
        batch_id: selectedSession?.batch_id ?? "",
        batch_name: selectedSession?.batch_name ?? "",
        type: selectedSession?.is_substitute ? "teacher_substitute" : "regular",
        original_timetable_id: selectedSession?.original_timetable_id ?? selectedSession?.id ?? "",
        date: todayISO(),
        time: new Date().toTimeString().slice(0, 5),
        captured_image: capturedImage,
        attendance_method: "image",
        created_at: serverTimestamp(),
      });

      setRecognitionStatus("recognizing");
      const payload = await requestRecognition(capturedImage);
      const recognizedStudents = (payload.recognized_students || []).map((student) => ({
        uid: student.uid,
        name: student.name,
        roll_no: student.roll_number,
        confidence: student.confidence,
        match_strength: student.match_strength,
        detected_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));

      setDetectedStudents(recognizedStudents);
      setUnknownFaces(payload.unknown_faces || 0);
      setIgnoredFaces(payload.ignored_faces || 0);
      setRecognitionCompleted(true);
      setRecognitionStatus("success");
      setCaptureNotice("Recognition completed. Verify the pre-filled table before saving attendance.");
      setLiveRecognitionDebug(payload.debug);
      setCameraFullScreen(false);
      console.log("Recognition success", payload.debug);
    } catch (captureError) {
      console.error("Failed to save captured image:", captureError);
      const message = captureError instanceof Error ? captureError.message : "Recognition failed";
      setRecognitionStatus("failed");
      setRecognitionCompleted(false);
      setDetectedStudents([]);
      setUnknownFaces(0);
      setIgnoredFaces(0);
      setRecognitionError(message);
      setError(message);
      console.log("Recognition failed");
    } finally {
      setRecognitionLoading(false);
    }
  };

  useEffect(() => {
    if (!cameraRunning || !mediaStreamRef.current || !videoRef.current) return;
    const videoElement = videoRef.current;
    const handleCanPlay = () => setCameraReady(true);

    videoElement.srcObject = mediaStreamRef.current;
    videoElement.onloadedmetadata = handleCanPlay;
    void videoElement.play().catch((playError) => {
      console.error("Unable to start video playback:", playError);
      setError("Unable to start camera preview. Please retry.");
    });

    return () => {
      videoElement.onloadedmetadata = null;
    };
  }, [cameraRunning, cameraFullScreen]);

  useEffect(() => {
    stopLiveRecognition();
    if (mode !== "image" || !selectedSession || !cameraRunning || previewMode) return;

    let cancelled = false;
    const runLiveRecognition = async () => {
      if (cancelled || liveRecognitionInFlightRef.current || !cameraReady || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context || !video.videoWidth || !video.videoHeight) return;

      const liveMaxWidth = 960;
      const scale = Math.min(1, liveMaxWidth / video.videoWidth);
      canvas.width = Math.max(640, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(360, Math.round(video.videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      liveRecognitionInFlightRef.current = true;
      setLiveRecognitionLoading(true);
      setLiveRecognitionError("");
      try {
        const payload = await requestRecognition(canvas.toDataURL("image/jpeg", 0.78));
        const liveStudents = (payload.recognized_students || []).map((student) => ({
          uid: student.uid,
          name: student.name,
          roll_no: student.roll_number,
          confidence: student.confidence,
          match_strength: student.match_strength,
          detected_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
        setLiveDetectedStudents(liveStudents);
        setLiveUnknownFaces(payload.unknown_faces || 0);
        setLiveIgnoredFaces(payload.ignored_faces || 0);
        setLiveRecognitionDebug(payload.debug);
        console.log("Live recognition success", payload.debug);
      } catch (liveError) {
        const message = liveError instanceof Error ? liveError.message : "Recognition failed";
        setLiveRecognitionError(message);
        console.error("Live recognition failed:", liveError);
      } finally {
        liveRecognitionInFlightRef.current = false;
        setLiveRecognitionLoading(false);
      }
    };

    void runLiveRecognition();
    liveRecognitionIntervalRef.current = window.setInterval(() => {
      void runLiveRecognition();
    }, 4000);

    return () => {
      cancelled = true;
      stopLiveRecognition();
    };
  }, [cameraReady, cameraRunning, mode, previewMode, selectedSession]);

  useEffect(() => {
    if (!selectedSession || mode !== "image" || !recognitionCompleted) return;
    setImageAssistedUsed(true);
    setManualStatus(
      students.reduce<Record<string, AttendanceStatus>>((acc, student) => {
        acc[student.uid] = detectedStudents.some((detectedStudent) => detectedStudent.uid === student.uid) ? "present" : "absent";
        return acc;
      }, {}),
    );
  }, [detectedStudents, mode, recognitionCompleted, selectedSession, students]);

  const updateManualStatus = async (student: Student, nextStatus: AttendanceStatus) => {
    if (!canEditAttendance) return;
    setManualStatus((current) => ({ ...current, [student.uid]: nextStatus }));
  };

  const completeAttendance = async () => {
    if (savingAttendance) return;

    if (!selectedSession) {
      setError("Please select a session before saving attendance.");
      return;
    }

    if (!teacherUid || !teacherProfile) {
      setError("Teacher profile not loaded. Please re-login and try again.");
      return;
    }

    if (students.length === 0) {
      setError("No students found for this session. Cannot save attendance.");
      return;
    }

    const attendanceMethod: AttendanceMethod = imageAssistedUsed ? "image_assisted" : "manual";
    try {
      setSavingAttendance(true);
      setError("");
      for (const student of students) {
        const status = manualStatus[student.uid] ?? "absent";
        await saveAttendanceRecord(student, status, attendanceMethod);
      }

      await setDoc(
        doc(db, "attendance_sessions", sessionKey),
        {
          session_id: selectedSession.id,
          timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
          teacher_id: teacherUid,
          teacher_name: teacherProfile.name,
          class_id: selectedSession.class_id,
          class_name: selectedSession.class_name,
          subject_id: selectedSession.subject_id ?? "",
          subject_name: selectedSession.subject_name ?? "",
          batch_id: selectedSession.batch_id ?? "",
          batch_name: selectedSession.batch_name ?? "",
          type: selectedSession.is_substitute ? "teacher_substitute" : "regular",
          original_timetable_id: selectedSession.original_timetable_id ?? selectedSession.id,
          date: todayISO(),
          start_time: selectedSession.start_time,
          end_time: selectedSession.end_time,
          attendance_method: attendanceMethod,
          recognized_students_count: detectedStudents.length,
          teacher_verified: true,
          status: "completed",
          completed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );

      setSessionCompleted(true);
      setEditAttendanceEnabled(false);
      setCameraRunning(false);
      setSessionNotice("Attendance completed");
    } catch (completeError) {
      console.error("Error completing attendance:", completeError);
      const message = completeError instanceof Error ? completeError.message : "Unable to complete attendance right now.";
      setError(message);
    } finally {
      setSavingAttendance(false);
    }
  };

  const selectEditAttendance = () => {
    setEditAttendanceEnabled(true);
    setMode("manual");
    setNotice("");
    setSessionNotice("");
  };

  if (authLoading || loadingSessions) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-200">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
          <FiLoader className="animate-spin" />
          <span className="text-sm font-medium">Loading today's sessions...</span>
        </div>
      </div>
    );
  }

  if (selectedSession && sessionCompleted && !editAttendanceEnabled) {
    return (
      <div className="space-y-6 pb-8 text-slate-100">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-white">Take Attendance</h1>
          <p className="text-sm text-slate-400">Attendance is locked for completed sessions.</p>
        </div>
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                <FiCheckCircle /> Attendance Completed
              </div>
              <p className="mt-4 text-sm text-slate-400">Session:</p>
              <p className="text-lg font-bold text-white">
                {selectedSession.class_name} • {selectedSession.subject_name ?? "Subject not set"} • {selectedSession.batch_name ?? "Full Class"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {formatTime(selectedSession.start_time)} – {formatTime(selectedSession.end_time)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectEditAttendance} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
                <FiEdit3 /> Edit Attendance
              </button>
              <button type="button" onClick={() => navigate("/teacher/attendance-records")} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-200">
                View Attendance
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 text-slate-100">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-white">Take Attendance</h1>
        <p className="text-sm text-slate-400">Start the camera, see live recognition names, capture a clean frame, then verify and save manually.</p>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <FiCheckCircle className="shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {sessionNotice ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <FiAlertCircle className="shrink-0" />
          <span>{sessionNotice}</span>
        </div>
      ) : null}

      {!selectedSession ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
          No assigned sessions found for today.
        </div>
      ) : null}

      {selectedSession ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
            <span className="font-semibold text-white">Session:</span> {selectedSession.class_name} • {selectedSession.subject_name ?? "Subject not set"} • {selectedSession.batch_name ?? "Full Class"}
            <span className="mx-2 text-slate-600">|</span>
            {formatTime(selectedSession.start_time)} – {formatTime(selectedSession.end_time)}
          </div>

          <div className="flex flex-wrap gap-2">
            <TabButton active={mode === "image"} onClick={() => setMode("image")} icon={FiCamera} label="Image-Assisted Attendance" />
            <TabButton active={mode === "manual"} onClick={() => setMode("manual")} icon={FiUsers} label="Manual Attendance" />
          </div>

          {sessionCompleted && !editAttendanceEnabled ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              <FiLock className="text-emerald-300" />
              <span>Attendance is completed for this session. Use Edit Attendance to make corrections.</span>
              <button type="button" onClick={selectEditAttendance} className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                <FiEdit3 /> Edit Attendance
              </button>
            </div>
          ) : null}

          {mode === "image" ? (
            <div className="space-y-4">
              <ImageMode
                detectedStudents={detectedStudents}
                unknownFaces={unknownFaces}
                ignoredFaces={ignoredFaces}
                liveDetectedStudents={liveDetectedStudents}
                liveUnknownFaces={liveUnknownFaces}
                liveIgnoredFaces={liveIgnoredFaces}
                liveRecognitionLoading={liveRecognitionLoading}
                liveRecognitionError={liveRecognitionError}
                liveRecognitionDebug={liveRecognitionDebug}
                recognitionCompleted={recognitionCompleted}
                recognitionLoading={recognitionLoading}
                recognitionStatus={recognitionStatus}
                recognitionError={recognitionError}
                selectedSession={selectedSession}
                teacherUid={teacherUid}
                cameraRunning={cameraRunning}
                cameraReady={cameraReady}
                videoRef={videoRef}
                canvasRef={canvasRef}
                uploadInputRef={uploadInputRef}
                startCamera={startCamera}
                stopCamera={stopCameraStream}
                captureImage={captureImage}
                uploadClassroomPhoto={uploadClassroomPhoto}
                triggerUploadPicker={triggerUploadPicker}
                locked={sessionCompleted && !editAttendanceEnabled}
                attendanceStarted={attendanceStarted}
                capturedImage={capturedImage}
                captureSource={captureSource}
                uploadedPhotoName={uploadedPhotoName}
                previewMode={previewMode}
                captureNotice={captureNotice}
                cameraFullScreen={cameraFullScreen}
                setCameraFullScreen={setCameraFullScreen}
                cameraFacingMode={cameraFacingMode}
                setCameraFacingMode={setCameraFacingMode}
                saveCurrentCapture={saveCurrentCapture}
              />
              <ManualMode
                loadingStudents={loadingStudents}
                selectedSession={selectedSession}
                students={students}
                manualStatus={manualStatus}
                onToggleStatus={updateManualStatus}
                locked={sessionCompleted && !editAttendanceEnabled}
              />
            </div>
          ) : (
            <ManualMode
              loadingStudents={loadingStudents}
              selectedSession={selectedSession}
              students={students}
              manualStatus={manualStatus}
              onToggleStatus={updateManualStatus}
              locked={sessionCompleted && !editAttendanceEnabled}
            />
          )}

          {!sessionCompleted || editAttendanceEnabled ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={completeAttendance}
                disabled={savingAttendance || loadingStudents || !students.length}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAttendance ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
                {savingAttendance ? "Saving Attendance..." : "Save Attendance"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

const TabButton = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
      active ? "border-blue-500/30 bg-blue-500/10 text-blue-200" : "border-slate-700 bg-slate-950/60 text-slate-300 hover:bg-slate-900"
    }`}
  >
    <Icon />
    {label}
  </button>
);

const ImageMode = ({
  detectedStudents,
  unknownFaces,
  ignoredFaces,
  liveDetectedStudents,
  liveUnknownFaces,
  liveIgnoredFaces,
  liveRecognitionLoading,
  liveRecognitionError,
  liveRecognitionDebug,
  recognitionCompleted,
  recognitionLoading,
  recognitionStatus,
  recognitionError,
  selectedSession,
  teacherUid,
  cameraRunning,
  cameraReady,
  videoRef,
  canvasRef,
  uploadInputRef,
  startCamera,
  stopCamera,
  captureImage,
  uploadClassroomPhoto,
  triggerUploadPicker,
  locked,
  attendanceStarted,
  capturedImage,
  captureSource,
  uploadedPhotoName,
  previewMode,
  captureNotice,
  cameraFullScreen,
  setCameraFullScreen,
  cameraFacingMode,
  setCameraFacingMode,
  saveCurrentCapture,
}: {
  detectedStudents: DetectedStudent[];
  unknownFaces: number;
  ignoredFaces: number;
  liveDetectedStudents: DetectedStudent[];
  liveUnknownFaces: number;
  liveIgnoredFaces: number;
  liveRecognitionLoading: boolean;
  liveRecognitionError: string;
  liveRecognitionDebug?: RecognitionResponse["debug"];
  recognitionCompleted: boolean;
  recognitionLoading: boolean;
  recognitionStatus: "idle" | "saving" | "recognizing" | "success" | "failed";
  recognitionError: string;
  selectedSession: TimetableEntry;
  teacherUid?: string;
  cameraRunning: boolean;
  cameraReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureImage: () => Promise<void>;
  uploadClassroomPhoto: (file: File) => Promise<void>;
  triggerUploadPicker: () => void;
  locked: boolean;
  attendanceStarted: boolean;
  capturedImage: string;
  captureSource: "camera" | "upload" | null;
  uploadedPhotoName: string;
  previewMode: boolean;
  captureNotice: string;
  cameraFullScreen: boolean;
  setCameraFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  cameraFacingMode: "user" | "environment";
  setCameraFacingMode: React.Dispatch<React.SetStateAction<"user" | "environment">>;
  saveCurrentCapture: () => Promise<void>;
}) => {
  const cameraStatus = locked ? "Attendance Completed" : cameraRunning ? "Camera open" : "Waiting for model...";
  const cameraFacingLabel = cameraFacingMode === "environment" ? "Back camera" : "Front camera";
  const previewStudents = recognitionCompleted ? detectedStudents : liveDetectedStudents;
  const previewUnknownFaces = recognitionCompleted ? unknownFaces : liveUnknownFaces;
  const previewIgnoredFaces = recognitionCompleted ? ignoredFaces : liveIgnoredFaces;
  const isUploadPreview = captureSource === "upload";
  const previewEmptyText = recognitionCompleted
    ? "No registered students detected."
    : previewMode
      ? "Save image to run final recognition."
      : liveRecognitionError
        ? liveRecognitionError
        : "Live recognition starts when the camera opens.";

  return (
    <>
      {cameraFullScreen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-slate-100">
          <div className="flex min-h-full flex-col gap-4 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCameraFullScreen(false);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200"
              >
                <FiChevronLeft /> Exit Camera
              </button>
              <div className="text-sm text-slate-300">
                <span className="font-semibold text-white">Session:</span> {selectedSession.class_name} • {selectedSession.subject_name ?? "Subject not set"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              <span className="font-semibold text-white">{cameraFacingLabel}</span>
              <button
                type="button"
                onClick={() => setCameraFacingMode((current) => (current === "environment" ? "user" : "environment"))}
                disabled={locked || cameraRunning}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiRefreshCw /> Switch camera
              </button>
              <span className="text-xs text-slate-500">Mobile devices default to the back camera.</span>
            </div>

            <div className="flex-1 min-h-0 rounded-3xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
              {previewMode ? (
                <img src={capturedImage} alt={isUploadPreview ? "Uploaded classroom" : "Captured attendance"} className="h-[32dvh] min-h-[220px] w-full rounded-2xl border border-slate-800 bg-black object-contain sm:h-[calc(100vh-260px)] sm:min-h-[420px]" />
              ) : cameraRunning ? (
                <video ref={videoRef} className="h-[32dvh] min-h-[220px] w-full rounded-2xl border border-slate-800 bg-black object-cover sm:h-[calc(100vh-260px)] sm:min-h-[420px]" autoPlay playsInline muted />
              ) : (
                <div className="flex h-[32dvh] min-h-[220px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80 text-slate-500 sm:h-[calc(100vh-260px)] sm:min-h-[420px]">
                  <div className="text-center">
                    <FiCamera className="mx-auto text-3xl" />
                    <p className="mt-3 text-sm">Camera is ready</p>
                  </div>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  await uploadClassroomPhoto(file);
                }
                event.target.value = "";
              }}
            />

            <div className="grid gap-3 sm:flex sm:flex-wrap">
              {!capturedImage ? (
                <>
                  <button type="button" onClick={captureImage} disabled={locked || !cameraReady} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    <FiCamera /> Capture Image
                  </button>
                  <button type="button" onClick={triggerUploadPicker} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                    <FiUpload /> Upload Classroom Photo
                  </button>
                  <button type="button" onClick={stopCamera} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                    <FiPauseCircle /> Stop Camera
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={isUploadPreview ? triggerUploadPicker : () => void startCamera()} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                    {isUploadPreview ? "Upload Another" : "Retake Image"}
                  </button>
                  <button type="button" onClick={saveCurrentCapture} disabled={locked || recognitionLoading} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    Save Image
                  </button>
                </>
              )}
            </div>

            {previewMode && isUploadPreview ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                Uploaded file: <span className="font-semibold text-white">{uploadedPhotoName || "Classroom image"}</span>
              </div>
            ) : null}

            {recognitionError ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{recognitionError}</div> : null}
            {captureNotice ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{captureNotice}</div> : null}
            {recognitionStatus !== "idle" ? <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">Recognition status: {recognitionStatus}</div> : null}
          </div>
        </div>
      ) : null}

      {!cameraFullScreen ? (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">Image-Assisted Attendance</h3>
                <p className="mt-1 text-sm text-slate-400">Capture the classroom image, then let AI prefill the manual table for teacher verification.</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${locked ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : cameraRunning ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-950/60 text-slate-300"}`}>
                {cameraStatus}
              </span>
            </div>

            <div className="mt-4 rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 p-6">
              {capturedImage ? (
                <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-slate-400">
                  <div className="text-center">
                    <FiCamera className="mx-auto text-3xl" />
                    <p className="mt-3 text-sm">Captured image preview</p>
                  </div>
                </div>
              ) : cameraRunning ? (
                <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-slate-400">
                  <div className="text-center">
                    <FiCamera className="mx-auto text-3xl" />
                    <p className="mt-3 text-sm">Camera running in full-screen mode</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-500">
                  <div className="text-center">
                    <FiCamera className="mx-auto text-3xl" />
                    <p className="mt-3 text-sm">Camera preview area</p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                {!cameraRunning ? (
                  <>
                    <button type="button" onClick={startCamera} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      <FiPlayCircle /> Start Camera
                    </button>
                    <button type="button" onClick={() => setCameraFacingMode((current) => (current === "environment" ? "user" : "environment"))} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                      <FiRefreshCw /> {cameraFacingLabel}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={captureImage} disabled={locked || !cameraReady} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      <FiCamera /> Capture Image
                    </button>
                    <button type="button" onClick={stopCamera} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                      <FiPauseCircle /> Stop Camera
                    </button>
                  </>
                )}
              </div>

              {!cameraRunning ? <p className="mt-3 text-sm text-slate-400">Start the camera to open the webcam preview.</p> : null}
              <p className="mt-3 text-sm text-slate-400">
                {locked ? "Session is completed. Use Edit Attendance to adjust records manually." : "Capture an image to prefill the manual table, then verify and save once."}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-lg font-bold text-white">Live Detected Students</h3>
            <p className="mt-1 text-sm text-slate-400">Recognition preview. Verify results manually before marking attendance.</p>

            <div className="mt-4 space-y-3">
              {liveRecognitionLoading && !recognitionCompleted ? (
                <EmptyState text="Running live recognition..." />
              ) : previewStudents.length === 0 ? (
                <EmptyState text={previewEmptyText} />
              ) : (
                previewStudents.map((student, index) => (
                  <div key={`${recognitionCompleted ? "saved" : "live"}-${student.roll_no ?? "student"}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">✓ {student.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{student.roll_no}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-300">{student.confidence.toFixed(1)}%</p>
                        <span className="text-xs text-slate-500">{student.detected_at}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              ⚠ Unknown Faces: {previewUnknownFaces}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 text-sm text-slate-200">
              Unknown Faces Ignored: {previewIgnoredFaces}
            </div>

            {liveRecognitionDebug ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                <div className="font-semibold text-white">Recognition Debug</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>Detected faces: {formatDebugCount(liveRecognitionDebug.face_count)}</div>
                  <div>Matched faces: {formatDebugCount(liveRecognitionDebug.matched_count)}</div>
                  <div>Unknown faces: {formatDebugCount(liveRecognitionDebug.unknown_count)}</div>
                  <div>Ignored faces: {formatDebugCount(liveRecognitionDebug.ignored_count)}</div>
                  <div>Metric: {liveRecognitionDebug.distance_metric ?? "cosine_similarity"}</div>
                  <div>Embedding dim: {formatDebugCount(liveRecognitionDebug.detected_embedding_dim)}</div>
                  <div>Registered embeddings: {formatDebugCount(liveRecognitionDebug.registered_embeddings_count)}</div>
                  <div>Backend filtered out: {formatDebugCount(liveRecognitionDebug.backend_filtered_out)}</div>
                  <div>Dimension filtered out: {formatDebugCount(liveRecognitionDebug.dimension_filtered_out)}</div>
                  <div>Unknown threshold: {liveRecognitionDebug.unknown_confidence_threshold ?? 55}%</div>
                  <div>Recognized threshold: {liveRecognitionDebug.recognized_confidence_threshold ?? 70}%</div>
                  <div>Backend: live preview</div>
                </div>
                {liveRecognitionDebug.reason ? <div className="mt-3 text-xs text-amber-200">Reason: {liveRecognitionDebug.reason}</div> : null}
                {liveRecognitionDebug.faces?.length ? (
                  <div className="mt-3 space-y-2">
                    {liveRecognitionDebug.faces.map((face, index) => (
                      <div key={`debug-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
                        <div className="font-semibold text-white">
                          {face.match_strength === "recognized" && face.best_student_name ? `Face ${face.face_index + 1}: ${face.best_student_name}` : `Face ${face.face_index + 1}: Unknown Face`}
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <span>Matched student: {face.match_strength === "recognized" ? (face.best_student_name ?? "Unknown") : "None"}</span>
                          <span>Student UID: {face.match_strength === "recognized" ? (face.best_student_uid ?? "n/a") : "n/a"}</span>
                          <span>Embedding dim: {face.embedding_dim ?? 0}</span>
                          <span>Metric: {face.distance_metric ?? "cosine_similarity"}</span>
                          <span>Similarity: {face.similarity?.toFixed(4) ?? "n/a"}</span>
                          <span>Confidence: {face.confidence?.toFixed(1) ?? 0}%</span>
                          <span>Distance: {face.distance?.toFixed(4) ?? "n/a"}</span>
                          <span>Quality: {(face.quality_score ?? 0).toFixed(3)}</span>
                          <span>Thresholds: {(face.threshold?.unknown_confidence ?? 55)} / {(face.threshold?.recognized_confidence ?? 70)}</span>
                          <span>Reason: {face.reason ?? (face.match_strength === "recognized" ? "match" : "Below recognition threshold")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
              Teacher UID: <span className="text-slate-200">{teacherUid ?? "Not available"}</span>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
              Selected session: <span className="text-slate-200">{selectedSession.class_name}</span>
              <span className="mx-2 text-slate-600">•</span>
              <span className="text-slate-200">{attendanceStarted ? "Attendance started" : "Not started"}</span>
            </div>
            {captureNotice ? (
              <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{captureNotice}</div>
            ) : null}
            {recognitionLoading ? (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
                <FiLoader className="animate-spin" /> Recognizing Students...
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};

const ManualMode = ({
  loadingStudents,
  selectedSession,
  students,
  manualStatus,
  onToggleStatus,
  locked,
}: {
  loadingStudents: boolean;
  selectedSession: TimetableEntry;
  students: Student[];
  manualStatus: Record<string, AttendanceStatus>;
  onToggleStatus: (student: Student, nextStatus: AttendanceStatus) => void;
  locked: boolean;
}) => (
  <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold text-white">Manual Attendance</h3>
        <p className="mt-1 text-sm text-slate-400">
          {selectedSession.batch_id ? "Batch students only." : "Full class students only."} Changes stay local until Save Attendance.
        </p>
      </div>
      <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
        {locked ? "Locked" : "Editable"}
      </span>
    </div>

    {loadingStudents ? (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-5 text-sm text-slate-400">
        <FiLoader className="animate-spin" /> Loading students...
      </div>
    ) : students.length === 0 ? (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-sm text-slate-400">No students found for this session.</div>
    ) : (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
        <div className="hidden grid-cols-[1.6fr_1fr_auto] gap-0 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:grid">
          <span>Student Name</span>
          <span>Roll Number</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-slate-800 bg-slate-950/50">
          {students.map((student) => {
            const status = manualStatus[student.uid] ?? "absent";
            return (
              <div key={student.uid} className="grid grid-cols-1 gap-3 px-4 py-3 text-sm sm:grid-cols-[1.6fr_1fr_auto] sm:items-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 sm:hidden">Student</p>
                  <p className="font-semibold text-white">{student.name}</p>
                </div>
                <div className="text-slate-300">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 sm:hidden">Roll Number</p>
                  <p>{student.roll_no}</p>
                </div>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onToggleStatus(student, status === "present" ? "absent" : "present")}
                  className={`justify-self-start rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-50 sm:justify-self-end ${status === "present" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-950/60 text-slate-300"}`}
                >
                  {status === "present" ? "Present" : "Absent"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {locked ? (
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <FiLock /> Attendance is completed. Use Edit Attendance to change records.
      </div>
    ) : null}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">{text}</div>
);

export default TakeAttendancePage;