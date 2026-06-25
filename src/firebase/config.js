// Firebase initialisation for the 1ATF portal.
//
// The web config below is safe to ship in client code — Firebase access is
// controlled by the Firestore/Storage security rules, not by hiding these keys.
// Values can still be overridden per-environment via a .env file.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB6ae-piKsafwP1xRcc9kpBgfwzgPQxr3k',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'atf-operations.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'atf-operations',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'atf-operations.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '191632442456',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:191632442456:web:11b79fd007a0c7a90e362d',
}

// Firebase is enabled whenever the essential keys are present (they always are
// now, via the defaults above). Set VITE_FIREBASE_DISABLE=1 to force local mode.
export const FIREBASE_ENABLED =
  !import.meta.env.VITE_FIREBASE_DISABLE && Boolean(cfg.apiKey && cfg.projectId)

let app = null
let auth = null
let db = null

if (FIREBASE_ENABLED) {
  app = initializeApp(cfg)
  auth = getAuth(app)
  db = getFirestore(app)
} else {
  // eslint-disable-next-line no-console
  console.warn('[1ATF] Running in LOCAL MODE (localStorage). Set Firebase keys to go live.')
}

export { app, auth, db }
