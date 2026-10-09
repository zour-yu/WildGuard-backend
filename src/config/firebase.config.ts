import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let firebaseApp: admin.app.App | null = null;

try {
  // Check if standard service account file exists
  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(__dirname, '../../serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8')
    );

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
    });

    console.log(
      `[Firebase] Admin SDK initialized successfully for project: ${
        serviceAccount.project_id || 'wildguard-95639'
      }`
    );
  } else {
    // Attempt default initialization if credentials environment is set
    firebaseApp = admin.initializeApp();
    console.log('[Firebase] Admin SDK initialized with default application credentials.');
  }
} catch (error: any) {
  console.warn(
    `[Firebase Warning] Failed to initialize Firebase Admin SDK: ${error.message}`
  );
}

export const firebaseAdmin = admin;
export const auth = firebaseApp ? admin.auth() : null;
export const firestore = firebaseApp ? admin.firestore() : null;
export const messaging = firebaseApp ? admin.messaging() : null;

export default firebaseApp;
