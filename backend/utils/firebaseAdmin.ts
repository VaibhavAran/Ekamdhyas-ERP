import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');
const envResult = dotenv.config({ path: envPath });

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) {
    return undefined;
  }
  const cleaned = key.replace(/^"|"$/g, '');
  return cleaned.replace(/\\n/g, '\n');
}

function getMissingEnvVars() {
  const requiredKeys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'] as const;
  return requiredKeys.filter((key) => {
    const value = process.env[key];
    if (!value) {
      return true;
    }
    return /your_|YOUR_/.test(value);
  });
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  console.log(`[FirebaseAdmin] env path: ${envPath}`);
  console.log(`[FirebaseAdmin] dotenv loaded: ${envResult.error ? 'false' : 'true'}`);
  console.log(`[FirebaseAdmin] FIREBASE_PROJECT_ID: ${projectId || 'undefined'}`);
  console.log(`[FirebaseAdmin] FIREBASE_CLIENT_EMAIL: ${clientEmail || 'undefined'}`);

  const missing = getMissingEnvVars();
  if (missing.length > 0 || !privateKey) {
    throw new Error(
      `Firebase Admin configuration invalid. Missing or placeholder values: ${[...missing, !privateKey ? 'FIREBASE_PRIVATE_KEY' : null]
        .filter(Boolean)
        .join(', ')}. Ensure backend/.env is loaded with real service account values.`
    );
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Invalid Firebase private key format in backend/.env');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const app = initFirebaseAdmin();
export const adminDb = admin.firestore(app);
export { admin };
