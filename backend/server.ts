import fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
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
const aiPort = Number(process.env.AI_PORT || 8000);
const aiHost = process.env.AI_HOST || '127.0.0.1';
const studentFacesDir = path.join(__dirname, 'student_faces');
const repoRoot = path.resolve(__dirname, '..');
const aiWorkingDir = path.join(__dirname, 'ai');

let aiProcess: ChildProcess | null = null;
let aiOwnedByBackend = false;
let shuttingDown = false;

if (!fs.existsSync(studentFacesDir)) {
  fs.mkdirSync(studentFacesDir, { recursive: true });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isAiRunning = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(`http://${aiHost}:${aiPort}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

const resolvePythonCommand = () => {
  const envPython = process.env.AI_PYTHON_PATH?.trim();
  if (envPython) return envPython;

  if (process.platform === 'win32') {
    return path.join(repoRoot, '.venv', 'Scripts', 'python.exe');
  }

  return path.join(repoRoot, '.venv', 'bin', 'python');
};

const waitForAiStartup = async () => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (await isAiRunning()) return true;
    await sleep(250);
  }
  return false;
};

const startAiSidecar = async () => {
  if (await isAiRunning()) {
    console.log(`[AI] Running on port ${aiPort}`);
    return;
  }

  const pythonCommand = resolvePythonCommand();
  const aiArgs = ['-m', 'uvicorn', 'main:app', '--host', aiHost, '--port', String(aiPort)];

  const spawned = spawn(pythonCommand, aiArgs, {
    cwd: aiWorkingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    },
  });

  aiProcess = spawned;
  aiOwnedByBackend = true;

  spawned.stdout.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.log(`[AI] ${text}`);
    }
  });

  spawned.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.error(`[AI] ${text}`);
    }
  });

  spawned.on('exit', (code, signal) => {
    if (shuttingDown) return;
    aiProcess = null;
    aiOwnedByBackend = false;
    console.error(`[AI] Process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
  });

  const online = await waitForAiStartup();
  if (online) {
    console.log(`[AI] Running on port ${aiPort}`);
  } else {
    console.error(`[AI] Failed to become ready on port ${aiPort}`);
  }
};

const stopAiSidecar = () => {
  if (!aiProcess || !aiOwnedByBackend) return;

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(aiProcess.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      aiProcess.kill('SIGTERM');
    }
  } catch {
    // no-op
  }

  aiProcess = null;
  aiOwnedByBackend = false;
};

const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAiSidecar();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
process.on('uncaughtException', (error) => {
  console.error('[Backend] Uncaught exception:', error);
  shutdown();
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Backend] Unhandled rejection:', reason);
});

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

const start = async () => {
  await startAiSidecar();

  app.listen(port, () => {
  console.log(`[Server] dotenv path: ${envPath}`);
  console.log(`[Server] FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'undefined'}`);
  console.log(`[Server] FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL || 'undefined'}`);
    console.log(`[Backend] Running on port ${port}`);
    console.log(`Face registration backend running on http://localhost:${port}`);
  });
};

void start();
