from __future__ import annotations

import os
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import List

import numpy as np
import cv2

from face_engine import FaceEngine


@dataclass
class StudentEmbedding:
    student_uid: str
    student_name: str
    roll_number: str
    embedding: np.ndarray


class EmbeddingService:
    def __init__(self, backend_root: Path) -> None:
        self.backend_root = backend_root
        self.student_faces_dir = backend_root / "student_faces"
        self.embeddings_dir = backend_root / "embeddings"
        self.engine = FaceEngine()
        self.embeddings_dir.mkdir(parents=True, exist_ok=True)

    def _list_student_images(self, student_uid: str) -> List[Path]:
        folder = self.student_faces_dir / student_uid
        if not folder.exists():
            raise FileNotFoundError(f"Student face folder not found: {folder}")

        valid_suffixes = {".jpg", ".jpeg", ".png"}
        images = [
            file_path
            for file_path in sorted(folder.iterdir())
            if file_path.is_file() and file_path.suffix.lower() in valid_suffixes
        ]
        return images

    @staticmethod
    def _image_quality_score(image_bytes: bytes) -> float:
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            return 0.0

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(np.mean(gray))

        blur_component = min(blur_score / 120.0, 1.0)
        brightness_component = 1.0 - min(abs(brightness - 120.0) / 120.0, 1.0)
        return float(max(0.0, min(1.0, (blur_component * 0.6) + (brightness_component * 0.4))))

    @staticmethod
    def _l2_normalize(vector: np.ndarray) -> np.ndarray:
        norm = float(np.linalg.norm(vector))
        if norm <= 1e-12:
            return vector.astype(np.float32)
        return (vector / norm).astype(np.float32)

    def generate_student_embedding(self, student_uid: str, student_name: str, roll_number: str) -> dict:
        image_paths = self._list_student_images(student_uid)
        if len(image_paths) < 3:
            raise ValueError("Minimum 3 images required")

        weighted_vectors = []
        quality_scores = []
        for image_path in image_paths:
            image_bytes = image_path.read_bytes()
            image_quality = self._image_quality_score(image_bytes)
            faces = self.engine.encode_faces(image_bytes)
            if len(faces) != 1:
                # Ignore noisy images for embedding generation.
                continue
            face = faces[0]
            face_quality = float(face.quality_score or 0.0)
            combined_quality = (image_quality * 0.4) + (face_quality * 0.6)
            if combined_quality < 0.45:
                continue

            normalized_face_embedding = self._l2_normalize(face.embedding)
            weighted_vectors.append((normalized_face_embedding, combined_quality))
            quality_scores.append(combined_quality)

        if len(weighted_vectors) < 3:
            raise ValueError("Not enough valid single-face images to generate embedding")

        stacked_vectors = np.vstack([vector for vector, _ in weighted_vectors])
        weights = np.asarray([weight for _, weight in weighted_vectors], dtype=np.float32)
        mean_embedding = np.average(stacked_vectors, axis=0, weights=weights).astype(np.float32)
        mean_embedding = self._l2_normalize(mean_embedding)

        payload = {
            "student_uid": student_uid,
            "student_name": student_name,
            "roll_number": roll_number,
            "embedding": mean_embedding,
            "image_count": len(weighted_vectors),
            "quality_scores": quality_scores,
            "backend": self.engine.backend_name,
            "embedding_dim": int(mean_embedding.shape[0]),
            "normalized": True,
            "metric": "cosine",
        }

        target_file = self.embeddings_dir / f"{student_uid}.pkl"
        with open(target_file, "wb") as handle:
            pickle.dump(payload, handle)

        return {
            "student_uid": student_uid,
            "student_name": student_name,
            "roll_number": roll_number,
            "image_count": len(weighted_vectors),
            "embedding_file": os.fspath(target_file),
            "backend": self.engine.backend_name,
            "embedding_dim": int(mean_embedding.shape[0]),
            "metric": "cosine",
        }
