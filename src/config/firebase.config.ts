import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

let firebaseApp: App | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let messaging: Messaging | null = null;

try {
  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(__dirname, '../../serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8')
    );

    if (getApps().length === 0) {
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      firebaseApp = getApps()[0];
    }

    auth = getAuth(firebaseApp);
    firestore = getFirestore(firebaseApp);
    messaging = getMessaging(firebaseApp);

    console.log(
      `[Firebase] Admin SDK initialized successfully for project: ${
        serviceAccount.project_id || 'wildguard-95639'
      }`
    );
  } else {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
    } else {
      firebaseApp = getApps()[0];
    }
    auth = getAuth(firebaseApp);
    firestore = getFirestore(firebaseApp);
    messaging = getMessaging(firebaseApp);
    console.log('[Firebase] Admin SDK initialized with default application credentials.');
  }
} catch (error: any) {
  console.warn(
    `[Firebase Warning] Failed to initialize Firebase Admin SDK: ${error.message}`
  );
}

export { firebaseApp, auth, firestore, messaging };
export default firebaseApp;
