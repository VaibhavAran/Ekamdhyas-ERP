import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import recognizeAttendanceRoute from './routes/recognizeAttendance.js';
import registerStudentFaceRoute from './routes/registerStudentFace.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const port = Number(process.env.PORT || 5000);
const studentFacesDir = path.join(__dirname, 'student_faces');

if (!fs.existsSync(studentFacesDir)) {
  fs.mkdirSync(studentFacesDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Backend is running' });
});

app.use('/api', registerStudentFaceRoute);
app.use('/api', recognizeAttendanceRoute);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Internal server error';
  res.status(500).json({ success: false, error: message });
});

app.listen(port, () => {
  console.log(`[Server] dotenv path: ${envPath}`);
  console.log(`[Server] FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'undefined'}`);
  console.log(`[Server] FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL || 'undefined'}`);
  console.log(`Face registration backend running on http://localhost:${port}`);
});
