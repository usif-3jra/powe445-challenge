/* =====================================================================
   POWE445 challenge — site configuration
   1) Paste your Firebase web-app config below (Firebase console ->
      Project settings -> Your apps -> Web app -> SDK setup: "Config").
   2) Leave apiKey as 'PASTE_...' to run in LOCAL DEMO MODE (one browser,
      data in localStorage; admin and students in different tabs).
   ===================================================================== */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyANTFNeIoHJMX8zzfxx7LvNtUG9CdNJWj8',
  authDomain: 'powe445-challenge.firebaseapp.com',
  databaseURL: 'https://powe445-challenge-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'powe445-challenge',
  storageBucket: 'powe445-challenge.firebasestorage.app',
  messagingSenderId: '413388635059',
  appId: '1:413388635059:web:88ebd5caff97f0d57ea9c6'
};

/* Local demo mode only (ignored when Firebase is configured). */
export const LOCAL_ADMIN_PASSCODE = 'powe445-admin';
