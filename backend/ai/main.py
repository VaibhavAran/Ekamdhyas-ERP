from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import firebase_admin
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore
from pydantic import BaseModel

from embedding_service import EmbeddingService
from recognition_service import RecognitionService


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)


def _clean_private_key(raw_key: Optional[str]) -> Optional[str]:
    if not raw_key:
        return None
    return raw_key.strip('"').replace("\\n", "\n")


def _ensure_firebase_admin() -> firestore.Client:
    if firebase_admin._apps:
        return firestore.client()

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    private_key = _clean_private_key(os.getenv("FIREBASE_PRIVATE_KEY"))

    missing = []
    if not project_id:
        missing.append("FIREBASE_PROJECT_ID")
    if not client_email:
        missing.append("FIREBASE_CLIENT_EMAIL")
    if not private_key:
        missing.append("FIREBASE_PRIVATE_KEY")

    if missing:
        raise RuntimeError(
            f"Firebase Admin configuration invalid for AI service. Missing: {', '.join(missing)}"
        )

    cred = credentials.Certificate(
        {
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": private_key,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )
    firebase_admin.initialize_app(cred)
    return firestore.client()


class GenerateEmbeddingRequest(BaseModel):
    student_uid: str
    student_name: str
    roll_number: str


embedding_service = EmbeddingService(BASE_DIR)
recognition_service = RecognitionService(BASE_DIR)
firestore_client = _ensure_firebase_admin()

app = FastAPI(title="Student Face Recognition Engine", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "success": True,
        "message": "AI recognition service running",
        "engine": recognition_service.engine.backend_name,
        "cached_embeddings": recognition_service.cached_embeddings_count,
    }


@app.on_event("startup")
def warm_embedding_cache() -> None:
    model_loading_time = recognition_service.engine.ensure_model_loaded()
    cached_embeddings = recognition_service.preload_embeddings()
    print(
        "[AI] startup warmup: "
        f"model_loading_ms={round(model_loading_time * 1000, 2)}, "
        f"cached_embeddings={cached_embeddings}",
        flush=True,
    )


@app.post("/embeddings/generate-student")
def generate_student_embedding(payload: GenerateEmbeddingRequest) -> dict:
    student_uid = payload.student_uid.strip()
    if not student_uid:
        raise HTTPException(status_code=400, detail="Student UID missing")

    student_doc = firestore_client.collection("students").document(student_uid).get()
    if not student_doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")

    student_data = student_doc.to_dict() or {}
    if str(student_data.get("role", "student")) != "student":
        raise HTTPException(status_code=400, detail="Only student profiles are supported")

    result = embedding_service.generate_student_embedding(
        student_uid=student_uid,
        student_name=payload.student_name,
        roll_number=payload.roll_number,
    )

    return {
        "success": True,
        "message": "Embedding generated successfully",
        "data": result,
    }


@app.post("/recognition/classroom")
async def recognize_classroom(image: UploadFile = File(...)) -> dict:
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=400, detail="Invalid file type")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file missing")

    registered_students_snapshot = (
        firestore_client.collection("students")
        .where("face_registered", "==", True)
        .stream()
    )
    allowed_student_uids = {doc.id for doc in registered_students_snapshot}

    result = recognition_service.recognize_classroom(image_bytes, allowed_student_uids)

    return {
        "recognized_students": result["recognized_students"],
        "unknown_faces": result["unknown_faces"],
        "ignored_faces": result.get("ignored_faces", 0),
        "backend": result.get("backend", "face_recognition"),
        "debug": result.get("debug"),
    }
