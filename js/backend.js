/* POWE445 challenge — data backend (Firebase Realtime Database, or local demo mode) */
import { FIREBASE_CONFIG, LOCAL_ADMIN_PASSCODE } from './config.js';

const FB_VERSION = '10.12.2';
export const isFirebaseConfigured = () =>
  !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !/^PASTE/.test(FIREBASE_CONFIG.apiKey) && FIREBASE_CONFIG.databaseURL);

// role 'admin' runs on its own Firebase app instance, so its sign-in never collides with a
// student session opened in another tab of the same browser (separate auth persistence).
export async function createBackend(role = 'student') {
  return isFirebaseConfigured() ? firebaseBackend(role) : localBackend();
}

/* ------------------------------------------------------------------ Firebase */
async function firebaseBackend(role) {
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
  const [{ initializeApp }, A, D] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')]);
  const app = role === 'admin' ? initializeApp(FIREBASE_CONFIG, 'powe445-admin') : initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app), db = D.getDatabase(app);
  const ref = p => D.ref(db, p);
  const authReady = new Promise(res => { const un = A.onAuthStateChanged(auth, u => { un(); res(u); }); });
  const isAdmin = async uid => (await D.get(ref('admins/' + uid))).val() === true;
  return {
    mode: 'firebase',
    async studentSignIn() {
      let u = await authReady; u = auth.currentUser || u;
      if (!u || !u.isAnonymous) { if (u) await A.signOut(auth); u = (await A.signInAnonymously(auth)).user; }
      return u.uid;
    },
    async studentResume() { const u = (await authReady, auth.currentUser); return u && u.isAnonymous ? u.uid : null; },
    async studentSignOut() { await A.signOut(auth); },
    requestAccess: (uid, profile) => D.set(ref(`students/${uid}/profile`), profile),
    watchStudent: (uid, cb) => D.onValue(ref('students/' + uid), s => cb(s.val()), e => console.error(e)),
    saveWork: (uid, patch) => D.update(ref(`students/${uid}/work`), patch),
    heartbeat: (uid, stage) => D.set(ref(`students/${uid}/presence`), { lastSeen: Date.now(), stage: stage || 0 }),
    watchConfig: cb => D.onValue(ref('config'), s => cb(s.val()), () => cb(null)),
    // ---- admin
    async adminSignIn(email, password) {
      const c = await A.signInWithEmailAndPassword(auth, email, password);
      if (!(await isAdmin(c.user.uid))) {
        const uid = c.user.uid; await A.signOut(auth);
        throw new Error(`Signed in, but this account is not an admin. In the Realtime Database add  admins/${uid} = true`);
      }
      return c.user.uid;
    },
    async adminResume() { await authReady; const u = auth.currentUser; return u && !u.isAnonymous && (await isAdmin(u.uid)) ? u.uid : null; },
    adminSignOut: () => A.signOut(auth),
    watchStudents: (cb, onErr) => D.onValue(ref('students'), s => cb(s.val() || {}), e => { console.error(e); onErr && onErr(e); }),
    getStudents: async () => (await D.get(ref('students'))).val() || {},
    onAuthChange: cb => A.onAuthStateChanged(auth, u => cb(u && !u.isAnonymous ? u.uid : null)),
    setStatus: (uid, status) => D.set(ref(`students/${uid}/status`), status),
    setOverride: (uid, key, val) => D.set(ref(`students/${uid}/overrides/${key}`), val === null || val === '' ? null : Number(val)),
    saveConfig: cfg => D.set(ref('config'), cfg),
    removeStudent: uid => D.remove(ref('students/' + uid)),
    resetWork: uid => D.remove(ref(`students/${uid}/work`))
  };
}

/* ------------------------------------------------------------------ Local demo */
function localBackend() {
  const KEY = 'powe445_local_db';
  const listeners = new Set();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const emit = () => listeners.forEach(f => f());
  const save = db => { localStorage.setItem(KEY, JSON.stringify(db)); emit(); };
  window.addEventListener('storage', e => { if (e.key === KEY) emit(); });
  const parts = p => p.split('/').filter(Boolean);
  const get = (db, p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), db);
  const set = (db, p, v) => {
    const ks = parts(p); let o = db;
    for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
    if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const write = (p, v) => { const db = load(); set(db, p, v); save(db); return Promise.resolve(); };
  const watch = (p, cb) => {
    let last; const f = () => { const v = get(load(), p); const s = JSON.stringify(v ?? null); if (s !== last) { last = s; cb(v === undefined ? null : JSON.parse(s)); } };
    listeners.add(f); setTimeout(f, 0); return () => listeners.delete(f);
  };
  const uidKey = 'powe445_local_uid';
  return {
    mode: 'local',
    async studentSignIn() {
      let u = sessionStorage.getItem(uidKey);
      if (!u) { u = 'local-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem(uidKey, u); }
      return u;
    },
    async studentResume() { return sessionStorage.getItem(uidKey); },
    async studentSignOut() { sessionStorage.removeItem(uidKey); },
    requestAccess: (uid, profile) => write(`students/${uid}/profile`, profile),
    watchStudent: (uid, cb) => watch('students/' + uid, cb),
    saveWork: (uid, patch) => { const db = load(); for (const k of Object.keys(patch)) set(db, `students/${uid}/work/${k}`, patch[k]); save(db); return Promise.resolve(); },
    heartbeat: (uid, stage) => write(`students/${uid}/presence`, { lastSeen: Date.now(), stage: stage || 0 }),
    watchConfig: cb => watch('config', cb),
    async adminSignIn(_email, password) {
      if (password !== LOCAL_ADMIN_PASSCODE) throw new Error('Wrong passcode (local demo mode — see js/config.js).');
      sessionStorage.setItem('powe445_local_admin', '1'); return 'local-admin';
    },
    async adminResume() { return sessionStorage.getItem('powe445_local_admin') ? 'local-admin' : null; },
    async adminSignOut() { sessionStorage.removeItem('powe445_local_admin'); },
    watchStudents: cb => watch('students', v => cb(v || {})),
    getStudents: async () => get(load(), 'students') || {},
    onAuthChange: () => () => {},
    setStatus: (uid, status) => write(`students/${uid}/status`, status),
    setOverride: (uid, key, val) => write(`students/${uid}/overrides/${key}`, val === null || val === '' ? null : Number(val)),
    saveConfig: cfg => write('config', cfg),
    removeStudent: uid => write('students/' + uid, null),
    resetWork: uid => write(`students/${uid}/work`, null)
  };
}
