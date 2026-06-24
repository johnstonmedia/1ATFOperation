// Firebase initialisation for the 1ATF portal.
//
// Provide your Firebase project credentials via a .env file (see .env.example).
// If no credentials are present the app runs in LOCAL MODE: auth + data are
// emulated against the browser's localStorage so the site is fully previewable
// before the backend is wired up.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// We consider Firebase "configured" only when the essential keys exist.
export const FIREBASE_ENABLED = Boolean(cfg.apiKey && cfg.projectId)

let app = null
let auth = null
let db = null
let storage = null

if (FIREBASE_ENABLED) {
  app = initializeApp(cfg)
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[1ATF] Firebase not configured — running in LOCAL MODE (localStorage). ' +
      'Add credentials to .env to enable the live backend.',
  )
}

export { app, auth, db, storage }
