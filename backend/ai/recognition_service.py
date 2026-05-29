from __future__ import annotations

import os
import pickle
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any, Dict, List

import numpy as np

from face_engine import FaceEngine


# Business confidence policy:
# >= 70% -> recognized
# 55% - 69.99% -> unknown
# < 55% -> ignored
RECOGNIZED_CONFIDENCE_THRESHOLD = 70.0
UNKNOWN_CONFIDENCE_THRESHOLD = 55.0


@dataclass
class EmbeddingRecord:
    student_uid: str
    student_name: str
    roll_number: str
    embedding: np.ndarray
    backend: str
    embedding_dim: int
    normalized: bool


class RecognitionService:
    def __init__(self, backend_root: Path) -> None:
        self.backend_root = backend_root
        self.embeddings_dir = backend_root / "embeddings"
        self.engine = FaceEngine()
        self._all_embeddings_cache: List[EmbeddingRecord] = []
        self._embedding_file_signature: tuple[tuple[str, int], ...] = ()
        self._last_refresh_time: float = 0.0
        self._refresh_interval_seconds: float = 30.0  # Check for new embeddings every 30s
        self.refresh_embeddings(force=True)

    def _build_embedding_signature(self) -> tuple[tuple[str, int], ...]:
        signature: list[tuple[str, int]] = []
        for pkl_file in sorted(self.embeddings_dir.glob("*.pkl")):
            try:
                signature.append((pkl_file.name, pkl_file.stat().st_mtime_ns))
            except OSError:
                continue
        return tuple(signature)

    def refresh_embeddings(self, force: bool = False) -> int:
        """Refresh embeddings cache if signature changed or interval elapsed.
        
        Args:
            force: Force refresh regardless of interval
            
        Returns:
            Number of cached embeddings
        """
        if not force and self._all_embeddings_cache:
            return len(self._all_embeddings_cache)

        current_time = perf_counter()
        signature = self._build_embedding_signature()
        if not force and signature == self._embedding_file_signature:
            return len(self._all_embeddings_cache)

        self._all_embeddings_cache = self._load_embeddings()
        self._embedding_file_signature = signature
        self._last_refresh_time = current_time
        return len(self._all_embeddings_cache)

    def preload_embeddings(self) -> int:
        return self.refresh_embeddings(force=True)

    @property
    def cached_embeddings_count(self) -> int:
        return len(self._all_embeddings_cache)

    def _load_embeddings(self) -> List[EmbeddingRecord]:
        def load_embedding(pkl_file: Path) -> EmbeddingRecord | None:
            try:
                with open(pkl_file, "rb") as handle:
                    payload = pickle.load(handle)
                embedding = np.asarray(payload["embedding"], dtype=np.float32)
                return EmbeddingRecord(
                    student_uid=str(payload["student_uid"]),
                    student_name=str(payload["student_name"]),
                    roll_number=str(payload["roll_number"]),
                    embedding=embedding,
                    backend=str(payload.get("backend", "unknown")),
                    embedding_dim=int(payload.get("embedding_dim", embedding.shape[0])),
                    normalized=bool(payload.get("normalized", False)),
                )
            except Exception:
                return None

        pkl_files = sorted(self.embeddings_dir.glob("*.pkl"))
        if not pkl_files:
            return []

        max_workers = min(8, os.cpu_count() or 4, len(pkl_files))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            records = [record for record in executor.map(load_embedding, pkl_files) if record is not None]
        return records

    @staticmethod
    def _filter_registered_embeddings(
        embeddings: List[EmbeddingRecord],
        allowed_student_uids: set[str] | None,
    ) -> List[EmbeddingRecord]:
        if not allowed_student_uids:
            return []
        return [record for record in embeddings if record.student_uid in allowed_student_uids]

    @staticmethod
    def _l2_normalize(vector: np.ndarray) -> np.ndarray:
        norm = float(np.linalg.norm(vector))
        if norm <= 1e-12:
            return vector.astype(np.float32)
        return (vector / norm).astype(np.float32)

    @staticmethod
    def _similarity_to_confidence(similarity: float) -> float:
        # Cosine similarity in [-1, 1] mapped to confidence in [0, 100].
        return round(float(max(0.0, min(1.0, (similarity + 1.0) / 2.0)) * 100.0), 2)

    def recognize_classroom(
        self,
        image_bytes: bytes,
        allowed_student_uids: set[str] | None = None,
    ) -> Dict[str, Any]:
        """Recognize faces in a classroom image with comprehensive timing logs.
        
        Args:
            image_bytes: Raw image bytes
            allowed_student_uids: Set of student UIDs to match against
            
        Returns:
            Dict with recognized students, unknown faces, and debug timing info
        """
        request_started = perf_counter()
        timing: Dict[str, float] = {}

        model_loading = self.engine.ensure_model_loaded()
        timing["model_loading"] = model_loading

        if not self._all_embeddings_cache:
            self.preload_embeddings()

        embeddings_started = perf_counter()
        embeddings = self._filter_registered_embeddings(self._all_embeddings_cache, allowed_student_uids)
        timing["embedding_loading"] = perf_counter() - embeddings_started
        timing["embedding_generation"] = 0.0

        face_timing: Dict[str, float] = {}
        faces = self.engine.encode_faces(image_bytes, timing_log=face_timing)
        timing["face_detection"] = face_timing.get("detect", 0.0)
        timing["image_loading"] = face_timing.get("load_image", 0.0)
        timing["image_resize"] = face_timing.get("resize", 0.0)
        timing["image_enhance"] = face_timing.get("enhance", 0.0)

        recognized_students: List[Dict[str, Any]] = []
        unknown_faces = 0
        ignored_faces = 0
        debug_faces: List[Dict[str, Any]] = []

        def finalize(payload: Dict[str, Any]) -> Dict[str, Any]:
            timing["final_response"] = perf_counter() - request_started
            print(
                "[AI] recognition timings (ms): "
                + ", ".join(f"{name}={round(duration * 1000, 2)}" for name, duration in timing.items()),
                flush=True,
            )
            debug = payload.get("debug")
            if isinstance(debug, dict):
                debug["timing_ms"] = {name: round(duration * 1000, 2) for name, duration in timing.items()}
            return payload

        if not embeddings:
            return finalize({
                "recognized_students": [],
                "unknown_faces": len(faces),
                "ignored_faces": 0,
                "backend": self.engine.backend_name,
                "debug": {
                    "face_count": len(faces),
                    "matched_count": 0,
                    "unknown_count": len(faces),
                    "ignored_count": 0,
                    "distance_metric": "cosine_similarity",
                    "reason": "No registered embeddings available for allowed students",
                    "timing_ms": {k: round(v * 1000, 2) for k, v in timing.items()},
                },
            })

        # Keep only embeddings produced with the active backend and valid dimensions.
        active_backend_embeddings = [record for record in embeddings if record.backend == self.engine.backend_name]
        backend_filtered_out = len(embeddings) - len(active_backend_embeddings)
        candidates = active_backend_embeddings if active_backend_embeddings else embeddings

        if not faces:
            return finalize({
                "recognized_students": [],
                "unknown_faces": 0,
                "ignored_faces": 0,
                "backend": self.engine.backend_name,
                "debug": {
                    "face_count": 0,
                    "matched_count": 0,
                    "unknown_count": 0,
                    "ignored_count": 0,
                    "distance_metric": "cosine_similarity",
                    "registered_embeddings_count": len(embeddings),
                    "backend_filtered_out": backend_filtered_out,
                    "reason": "No faces detected",
                    "timing_ms": {k: round(v * 1000, 2) for k, v in timing.items()},
                },
            })

        reference_dim = int(faces[0].embedding.shape[0])
        same_dim_embeddings = [record for record in candidates if int(record.embedding.shape[0]) == reference_dim]
        dim_filtered_out = len(candidates) - len(same_dim_embeddings)

        if not same_dim_embeddings:
            return finalize({
                "recognized_students": [],
                "unknown_faces": len(faces),
                "ignored_faces": 0,
                "backend": self.engine.backend_name,
                "debug": {
                    "face_count": len(faces),
                    "matched_count": 0,
                    "unknown_count": len(faces),
                    "ignored_count": 0,
                    "distance_metric": "cosine_similarity",
                    "registered_embeddings_count": len(embeddings),
                    "backend_filtered_out": backend_filtered_out,
                    "dimension_filtered_out": dim_filtered_out,
                    "detected_embedding_dim": reference_dim,
                    "reason": "No registered embeddings with matching dimension for current model",
                    "timing_ms": {k: round(v * 1000, 2) for k, v in timing.items()},
                },
            })

        # Batch matrix multiplication for all face-to-embedding comparisons (optimized)
        t0 = perf_counter()
        known_vectors = np.vstack([self._l2_normalize(record.embedding) for record in same_dim_embeddings])
        face_vectors = np.vstack([self._l2_normalize(face.embedding) for face in faces])
        # Matrix multiply lets NumPy/BLAS compare all faces in one batched operation.
        similarity_matrix = face_vectors @ known_vectors.T
        best_indexes = np.argmax(similarity_matrix, axis=1)
        timing["similarity_matching"] = perf_counter() - t0

        # Process results
        for index, face in enumerate(faces):
            best_index = int(best_indexes[index])
            normalized_face_embedding = face_vectors[index]
            best_similarity = float(similarity_matrix[index, best_index])
            best_distance = float(np.linalg.norm(known_vectors[best_index] - normalized_face_embedding))
            confidence = self._similarity_to_confidence(best_similarity)
            best_student = same_dim_embeddings[best_index]

            face_debug = {
                "face_index": index,
                "bbox": face.bbox,
                "quality_score": round(float(face.quality_score), 3),
                "embedding_dim": int(normalized_face_embedding.shape[0]),
                "distance_metric": "cosine_similarity",
                "similarity": round(best_similarity, 4),
                "threshold": {
                    "recognized_confidence": RECOGNIZED_CONFIDENCE_THRESHOLD,
                    "unknown_confidence": UNKNOWN_CONFIDENCE_THRESHOLD,
                },
                "distance": round(best_distance, 4),
                "confidence": confidence,
            }

            if confidence < UNKNOWN_CONFIDENCE_THRESHOLD:
                ignored_faces += 1
                face_debug["match_strength"] = "ignored"
                face_debug["reason"] = "Confidence below ignore threshold"
                face_debug["best_student_uid"] = None
                face_debug["best_student_name"] = None
                debug_faces.append(face_debug)
                continue

            if confidence < RECOGNIZED_CONFIDENCE_THRESHOLD:
                unknown_faces += 1
                face_debug["match_strength"] = "unknown"
                face_debug["reason"] = "Confidence below recognized threshold"
                face_debug["best_student_uid"] = None
                face_debug["best_student_name"] = None
                debug_faces.append(face_debug)
                continue

            face_debug["best_student_uid"] = best_student.student_uid
            face_debug["best_student_name"] = best_student.student_name
            recognized_students.append(
                {
                    "uid": best_student.student_uid,
                    "name": best_student.student_name,
                    "roll_number": best_student.roll_number,
                    "confidence": confidence,
                    "match_strength": "recognized",
                }
            )
            face_debug["match_strength"] = "recognized"
            debug_faces.append(face_debug)

        return finalize({
            "recognized_students": recognized_students,
            "unknown_faces": unknown_faces,
            "ignored_faces": ignored_faces,
            "backend": self.engine.backend_name,
            "debug": {
                "face_count": len(faces),
                "matched_count": len(recognized_students),
                "unknown_count": unknown_faces,
                "ignored_count": ignored_faces,
                "registered_embeddings_count": len(embeddings),
                "backend_filtered_out": backend_filtered_out,
                "dimension_filtered_out": dim_filtered_out,
                "detected_embedding_dim": reference_dim,
                "distance_metric": "cosine_similarity",
                "recognized_confidence_threshold": RECOGNIZED_CONFIDENCE_THRESHOLD,
                "unknown_confidence_threshold": UNKNOWN_CONFIDENCE_THRESHOLD,
                "timing_ms": {k: round(v * 1000, 2) for k, v in timing.items()},
                "faces": debug_faces,
            },
        })
