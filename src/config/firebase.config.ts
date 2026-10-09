import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';

const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');

// Ensure we don't initialize multiple times (e.g. during nodemon restarts)
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccountPath),
  });
}

export const authAdmin = getAuth();
