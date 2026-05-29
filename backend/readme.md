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

Out of scope in this step:

- Face recognition
- Embeddings
- Attendance detection