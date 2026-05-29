from __future__ import annotations

import io
import time
import warnings
from dataclasses import dataclass
from typing import List

import cv2
import numpy as np
from PIL import Image


def _safe_import_face_recognition():
    try:
        import face_recognition as fr

        return fr
    except Exception as exc:
        warnings.warn(f"face_recognition import failed: {exc}")
        return None


def _safe_import_insightface():
    try:
        from insightface.app import FaceAnalysis

        return FaceAnalysis
    except Exception as exc:
        warnings.warn(f"insightface import failed: {exc}")
        return None


@dataclass
class EncodedFace:
    embedding: np.ndarray
    bbox: tuple[int, int, int, int]
    quality_score: float = 0.0


class FaceEngine:
    """Face detection with a warmable backend and light preprocessing."""

    def __init__(self) -> None:
        self._fr = _safe_import_face_recognition()
        self._insight_ctor = _safe_import_insightface()
        self._insight_app = None

        if self._insight_ctor is not None:
            self._backend = "insightface"
            print("✓ Using insightface backend", flush=True)
        elif self._fr is not None:
            self._backend = "face_recognition"
            print("✓ Using face_recognition backend", flush=True)
        else:
            self._backend = "mock"
            print("⚠ Using mock backend (no face detection libraries available)", flush=True)
            print("  Install: pip install insightface  OR  pip install face-recognition", flush=True)

    @property
    def backend_name(self) -> str:
        return self._backend

    def ensure_model_loaded(self) -> float:
        """Load the detector model once and keep it warm for later requests."""
        if self._backend != "insightface" or self._insight_app is not None:
            return 0.0

        started = time.perf_counter()
        self._insight_app = self._insight_ctor(name="buffalo_l")
        self._insight_app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=0.35)
        return time.perf_counter() - started

    @staticmethod
    def _resize_for_recognition(image_rgb: np.ndarray, max_width: int = 1600, max_height: int = 900) -> np.ndarray:
        height, width = image_rgb.shape[:2]
        scale = min(max_width / float(width or 1), max_height / float(height or 1), 1.0)
        if scale >= 0.999:
            return image_rgb

        target_width = max(1, int(width * scale))
        target_height = max(1, int(height * scale))
        return cv2.resize(image_rgb, (target_width, target_height), interpolation=cv2.INTER_AREA)

    @staticmethod
    def _quality_score(image_rgb: np.ndarray, bbox: tuple[int, int, int, int]) -> float:
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(np.mean(gray))

        left, top, right, bottom = bbox
        image_height, image_width = gray.shape[:2]
        face_width = max(0, right - left)
        face_height = max(0, bottom - top)
        face_area_ratio = 0.0
        if image_width > 0 and image_height > 0:
            face_area_ratio = (face_width * face_height) / float(image_width * image_height)

        blur_component = min(blur_score / 120.0, 1.0)
        brightness_component = 1.0 - min(abs(brightness - 120.0) / 120.0, 1.0)
        size_component = min(face_area_ratio / 0.08, 1.0)
        combined = (blur_component * 0.45) + (brightness_component * 0.25) + (size_component * 0.30)
        return float(max(0.0, min(1.0, combined)))

    @staticmethod
    def _image_quality_metrics(image_rgb: np.ndarray) -> tuple[float, float]:
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(np.mean(gray))
        return blur_score, brightness

    @staticmethod
    def _enhance_image(image_rgb: np.ndarray) -> np.ndarray:
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        denoised = cv2.fastNlMeansDenoisingColored(image_bgr, None, 3, 3, 7, 21)
        ycrcb = cv2.cvtColor(denoised, cv2.COLOR_BGR2YCrCb)
        y_channel, cr_channel, cb_channel = cv2.split(ycrcb)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        y_enhanced = clahe.apply(y_channel)
        merged = cv2.merge((y_enhanced, cr_channel, cb_channel))
        contrast_enhanced = cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)
        gaussian = cv2.GaussianBlur(contrast_enhanced, (0, 0), 1.0)
        sharpened = cv2.addWeighted(contrast_enhanced, 1.35, gaussian, -0.35, 0)
        return cv2.cvtColor(sharpened, cv2.COLOR_BGR2RGB)

    @staticmethod
    def _load_image_rgb(image_bytes: bytes) -> np.ndarray:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return np.asarray(image)

    @staticmethod
    def _generate_mock_embedding(image_rgb: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        histogram = cv2.calcHist([gray], [0], None, [128], [0, 256]).flatten()
        histogram = histogram / (histogram.sum() + 1e-6)
        if len(histogram) < 128:
            embedding = np.pad(histogram, (0, 128 - len(histogram)), mode="constant")
        else:
            embedding = histogram[:128]
        return embedding.astype(np.float32)

    def _encode_with_mock(self, image_rgb: np.ndarray) -> List[EncodedFace]:
        height, width = image_rgb.shape[:2]
        faces: List[EncodedFace] = []

        face1_width = int(width * 0.25)
        face1_height = int(height * 0.4)
        bbox1 = (width // 6, height // 5, width // 6 + face1_width, height // 5 + face1_height)
        roi1 = image_rgb[max(0, bbox1[1]):min(height, bbox1[3]), max(0, bbox1[0]):min(width, bbox1[2])]
        if roi1.size > 0:
            faces.append(EncodedFace(embedding=self._generate_mock_embedding(roi1), bbox=bbox1, quality_score=0.7))

        if width > 800:
            face2_width = int(width * 0.22)
            face2_height = int(height * 0.38)
            bbox2 = (width // 2 + 50, height // 5 + 20, width // 2 + 50 + face2_width, height // 5 + 20 + face2_height)
            roi2 = image_rgb[max(0, bbox2[1]):min(height, bbox2[3]), max(0, bbox2[0]):min(width, bbox2[2])]
            if roi2.size > 0:
                faces.append(EncodedFace(embedding=self._generate_mock_embedding(roi2), bbox=bbox2, quality_score=0.65))

        return faces

    def _encode_with_face_recognition(self, image_rgb: np.ndarray, upsample: int) -> List[EncodedFace]:
        locations = self._fr.face_locations(image_rgb, model="hog", number_of_times_to_upsample=upsample)
        encodings = self._fr.face_encodings(image_rgb, known_face_locations=locations)

        faces: List[EncodedFace] = []
        for location, encoding in zip(locations, encodings):
            top, right, bottom, left = location
            bbox = (left, top, right, bottom)
            faces.append(
                EncodedFace(
                    embedding=np.asarray(encoding, dtype=np.float32),
                    bbox=bbox,
                    quality_score=self._quality_score(image_rgb, bbox),
                )
            )
        return faces

    def _encode_with_insightface(self, image_rgb: np.ndarray) -> List[EncodedFace]:
        self.ensure_model_loaded()
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        detections = self._insight_app.get(image_bgr)

        faces: List[EncodedFace] = []
        for detection in detections:
            x1, y1, x2, y2 = detection.bbox.astype(int).tolist()
            bbox = (x1, y1, x2, y2)
            faces.append(
                EncodedFace(
                    embedding=np.asarray(detection.embedding, dtype=np.float32),
                    bbox=bbox,
                    quality_score=self._quality_score(image_rgb, bbox),
                )
            )
        return faces

    def encode_faces(self, image_bytes: bytes, timing_log: dict | None = None) -> List[EncodedFace]:
        """Encode faces from image bytes with timing tracking."""
        step_times = timing_log if timing_log is not None else {}

        started = time.perf_counter()
        step_times["model_loading"] = self.ensure_model_loaded()

        started = time.perf_counter()
        image_rgb = self._load_image_rgb(image_bytes)
        step_times["load_image"] = time.perf_counter() - started

        started = time.perf_counter()
        image_rgb = self._resize_for_recognition(image_rgb)
        step_times["resize"] = time.perf_counter() - started

        blur_score, brightness = self._image_quality_metrics(image_rgb)
        should_enhance = blur_score < 85.0 or brightness < 70.0 or brightness > 170.0 or min(image_rgb.shape[:2]) < 720

        if self._backend == "mock":
            started = time.perf_counter()
            faces = self._encode_with_mock(image_rgb)
            step_times["enhance"] = 0.0
            step_times["detect"] = time.perf_counter() - started
            return faces

        enhanced_image = image_rgb
        step_times["enhance"] = 0.0
        if should_enhance and self._backend == "face_recognition":
            started = time.perf_counter()
            enhanced_image = self._enhance_image(image_rgb)
            step_times["enhance"] = time.perf_counter() - started

        started = time.perf_counter()
        if self._backend == "insightface":
            faces = self._encode_with_insightface(enhanced_image)
        else:
            faces = self._encode_with_face_recognition(enhanced_image, upsample=1)
            if not faces and not should_enhance:
                fallback_started = time.perf_counter()
                enhanced_image = self._enhance_image(image_rgb)
                step_times["enhance"] = time.perf_counter() - fallback_started
                faces = self._encode_with_face_recognition(enhanced_image, upsample=2)
        step_times["detect"] = time.perf_counter() - started

        return faces
