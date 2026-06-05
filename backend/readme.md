Student Face Registration backend (Step 2).

What it does:

- Exposes `POST /api/register-student-face` on `http://localhost:5000`
- Accepts `multipart/form-data` with `student_uid` and `images[]`
- Validates 3 to 10 images (`jpg`, `jpeg`, `png`)
- Replaces existing files in `student_faces/{student_uid}/`
- Updates Firestore `students/{uid}` face registration fields

Run locally:

1. Copy `.env.example` to `.env` and fill Firebase Admin values.
2. Run `npm install`.
3. Run `npm run dev`.
4. Start the AI service from `backend/ai` using the configured Python venv.

AI service:

- `http://127.0.0.1:8000/health`
- `POST /embeddings/generate-student`
- `POST /recognition/classroom`

### Run with Docker (Production-Ready Setup)

This project is containerized to compile and bundle the backend and AI services with all their native dependencies (including `cmake`, `dlib`, `insightface`, and `opencv`).

#### 1. Configure Environment
Copy `.env.example` to `.env` (if you haven't already) and fill in your Firebase Admin service account keys:
```env
PORT=5000
AI_HOST=ai-service
AI_PORT=8000
AI_SERVICE_URL=http://ai-service:8000

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"
```

#### 2. Run with Docker Compose
To build and start both the Node.js backend and the Python AI services in separate containers:
```bash
docker compose up --build
```
This will:
- Build the unified image.
- Download the InsightFace `buffalo_l` model weights during the build phase (baked into the image).
- Start the Python AI service at `http://localhost:8000` (exposing `/health`, `/embeddings/generate-student`, and `/recognition/classroom`).
- Start the Node.js backend at `http://localhost:5000` (after waiting for the AI service to pass its health check).
- Mount bind volumes for `student_faces/` and `embeddings/` to persist files locally on the host.

#### 3. Run Node Backend with Python Sidecar (Single Container)
If you wish to run the backend as a single container and let Node.js automatically spawn the Python sidecar process inside the container:
```bash
docker build -t face-attendance-backend .
docker run -d -p 5000:5000 -p 8000:8000 --env-file .env \
  -v ${PWD}/student_faces:/app/student_faces \
  -v ${PWD}/embeddings:/app/embeddings \
  face-attendance-backend
```
In this mode, ensure your `.env` has:
```env
AI_HOST=127.0.0.1
AI_PORT=8000
AI_SERVICE_URL=http://localhost:8000
```
This starts only the Node process, which detects that Python is installed in the container and automatically spawns the uvicorn process inside it.

#### 4. Health Checks
- Node backend: `http://localhost:5000/health`
- Python AI service: `http://localhost:8000/health`