import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is required. Set it in .env as a base64-encoded service account JSON. ' +
      'Generate with: node -e "console.log(Buffer.from(JSON.stringify(require(\'./service-account.json\'))).toString(\'base64\'))"'
    );
  }
  return cert(JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')));
}

const firebaseApp = getApps().length
  ? getApps()[0]!
  : initializeApp({ credential: loadCredential() });

export const db = getFirestore(firebaseApp);
export const adminAuth = getAuth(firebaseApp);