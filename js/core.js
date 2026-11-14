/* =====================================================================
   POWE445 Self-Balancing Robot Challenge — computational core
   Shared by the student app, the admin panel and the Node test-suite.
   Pure functions only (no DOM).                       Created by Y. Ajra
   ===================================================================== */
(function (root) {
  'use strict';
  const G = 9.81;
  const VERSION = 'v1.0';

  /* ---------------------------------------------------------------- RNG */
  function hashStr(str) {                       // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function rng(seedStr) {                       // mulberry32
    let a = hashStr(String(seedStr));
    const next = () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 8; i++) next();
    next.normal = () => {                       // Box–Muller
      let u = 0; while (u === 0) u = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    };
    next.uniform = (lo, hi) => lo + (hi - lo) * next();
    return next;
  }
  const roundTo = (x, step) => Math.round(x / step) * step;
  function sig(x, n) {                          // round to n significant figures
    if (x === 0 || !isFinite(x)) return x;
    const d = Math.ceil(Math.log10(Math.abs(x)));
    const p = Math.pow(10, n - d);
    return Math.round(x * p) / p;
  }
  const fix = (x, d = 6) => Number(x.toFixed(d));

  /* -------------------------------------------------------- validation */
  function validateName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length !== 3) return { ok: false, msg: 'Full name must contain exactly three words (first, father, family).' };
    if (!parts.every(p => /^[A-Za-zÀ-ɏ؀-ۿ'\-]{2,}$/.test(p)))
      return { ok: false, msg: 'Each name word must have at least 2 letters (letters, hyphen or apostrophe only).' };
    return { ok: true, value: parts.map(p => p[0].toUpperCase() + p.slice(1)).join(' ') };
  }
  function validateId(id) {
    const v = String(id || '').trim();
    if (!/^20\d{7}$/.test(v)) return { ok: false, msg: 'Student ID must be 9 digits and start with 20 (e.g. 202312345).' };
    return { ok: true, value: v };
  }

  /* ---------------------------------------------------- polynomials */
  const trimLead = p => { let i = 0; while (i < p.length - 1 && Math.abs(p[i]) === 0) i++; return p.slice(i); };
  function polyMul(a, b) {
    const r = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j];
    return r;
  }
  function polyAdd(a, b) {
    const n = Math.max(a.length, b.length), r = new Array(n).fill(0);
    for (let i = 0; i < a.length; i++) r[n - a.length + i] += a[i];
    for (let i = 0; i < b.length; i++) r[n - b.length + i] += b[i];
    return r;
  }
  const polyScale = (a, k) => a.map(x => x * k);
  const polyVal = (p, x) => p.reduce((acc, c) => acc * x + c, 0);
  // complex helpers
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const cabs = a => Math.hypot(a[0], a[1]);
  function cpolyVal(p, z) { let r = [0, 0]; for (const c of p) r = cadd(cmul(r, z), [c, 0]); return r; }
  function cpolyDer(p) { const n = p.length - 1; return p.slice(0, -1).map((c, i) => c * (n - i)); }

  // Aberth–Ehrlich root finder (degree <= ~12), returns [[re,im],...]
  function roots(pIn) {
    let p = trimLead(pIn.map(Number));
    while (p.length > 1 && p[p.length - 1] === 0) p = p.slice(0, -1); // zero roots handled below
    const zeroRoots = trimLead(pIn.map(Number)).length - p.length;
    const n = p.length - 1;
    const out = [];
    for (let i = 0; i < zeroRoots; i++) out.push([0, 0]);
    if (n < 1) return out;
    const a0 = p[0]; p = p.map(c => c / a0);
    if (n === 1) { out.push([-p[1], 0]); return out; }
    const dp = cpolyDer(p);
    const R = 1 + Math.max(...p.slice(1).map(Math.abs));
    let z = [];
    for (let k = 0; k < n; k++) { const ang = 2 * Math.PI * k / n + 0.4; z.push([R * 0.5 * Math.cos(ang), R * 0.5 * Math.sin(ang)]); }
    for (let it = 0; it < 800; it++) {
      let maxStep = 0;
      for (let k = 0; k < n; k++) {
        const ratio = cdiv(cpolyVal(p, z[k]), cpolyVal(dp, z[k]));
        let s = [0, 0];
        for (let j = 0; j < n; j++) if (j !== k) s = cadd(s, cdiv([1, 0], csub(z[k], z[j])));
        const w = cdiv(ratio, csub([1, 0], cmul(ratio, s)));
        if (!isFinite(w[0]) || !isFinite(w[1])) continue;
        z[k] = csub(z[k], w);
        maxStep = Math.max(maxStep, cabs(w) / (1 + cabs(z[k])));
      }
      if (maxStep < 1e-15) break;
    }
    z = z.map(r => [r[0], Math.abs(r[1]) < 1e-9 * (1 + Math.abs(r[0])) ? 0 : r[1]]);
    z.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    return out.concat(z);
  }

  /* ------------------------------------------------------- matrices */
  const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
  const eye = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  function matMul(A, B) {
    const r = A.length, c = B[0].length, k = B.length, C = zeros(r, c);
    for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) { let s = 0; for (let t = 0; t < k; t++) s += A[i][t] * B[t][j]; C[i][j] = s; }
    return C;
  }
  const trace = A => A.reduce((s, row, i) => s + row[i], 0);
  // singular values (one-sided Jacobi)
  function singularValues(Ain) {
    let A = Ain.map(r => r.slice());
    let m = A.length, n = A[0].length;
    if (m < n) { A = A[0].map((_, j) => A.map(r => r[j])); [m, n] = [n, m]; }
    for (let sweep = 0; sweep < 80; sweep++) {
      let off = 0;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        let a = 0, b = 0, c = 0;
        for (let i = 0; i < m; i++) { a += A[i][p] * A[i][p]; b += A[i][q] * A[i][q]; c += A[i][p] * A[i][q]; }
        if (Math.abs(c) <= 1e-300) continue;
        off = Math.max(off, Math.abs(c) / Math.sqrt(a * b));
        const zeta = (b - a) / (2 * c);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const cs = 1 / Math.sqrt(1 + t * t), sn = cs * t;
        for (let i = 0; i < m; i++) { const x = A[i][p], y = A[i][q]; A[i][p] = cs * x - sn * y; A[i][q] = sn * x + cs * y; }
      }
      if (off < 1e-15) break;
    }
    const s = [];
    for (let j = 0; j < n; j++) { let t = 0; for (let i = 0; i < m; i++) t += A[i][j] * A[i][j]; s.push(Math.sqrt(t)); }
    return s.sort((x, y) => y - x);
  }
  function rank(A) {                             // MATLAB-style tolerance
    if (!A.length || !A[0].length) return 0;
    const s = singularValues(A);
    const tol = Math.max(A.length, A[0].length) * s[0] * 2.220446049250313e-16 * 16;
    return s.filter(x => x > tol).length;
  }
  function charPoly(A) {                         // Faddeev–LeVerrier, descending powers
    const n = A.length; const coeffs = [1]; let M = eye(n);
    for (let k = 1; k <= n; k++) {
      const AM = matMul(A, M); const c = -trace(AM) / k; coeffs.push(c);
      M = AM.map((row, i) => row.map((v, j) => v + (i === j ? c : 0)));
    }
    return coeffs;
  }
  const eig = A => roots(charPoly(A));
  function ctrb(A, B) {
    const n = A.length; let blk = B; const cols = [];
    for (let k = 0; k < n; k++) { cols.push(blk); blk = matMul(A, blk); }
    return A.map((_, i) => cols.flatMap(Bk => Bk[i]));
  }
  function obsv(A, C) {
    const n = A.length; let blk = C; const rows = [];
    for (let k = 0; k < n; k++) { rows.push(...blk.map(r => r.slice())); blk = matMul(blk, A); }
    return rows;
  }

  /* ------------------------------------------- per-student robot model */
  function generateParams(id) {
    const R = rng('POWE445|robot|' + id);
    for (let attempt = 0; attempt < 400; attempt++) {
      const p = {};
      p.m_b = fix(roundTo(R.uniform(1.20, 1.80), 0.05), 3);     // body mass [kg]
      p.l = fix(roundTo(R.uniform(0.14, 0.20), 0.005), 4);      // axle -> COM [m]
      p.J_b = fix(roundTo(R.uniform(0.012, 0.020), 0.001), 4);  // body inertia about COM [kg m^2]
      p.r = [0.035, 0.040, 0.045][Math.floor(R() * 3)];          // wheel radius [m]
      p.m_w = fix(roundTo(R.uniform(0.06, 0.10), 0.01), 3);     // wheel mass (each) [kg]
      p.Km = fix(roundTo(R.uniform(0.050, 0.080), 0.005), 4);   // torque per volt, each motor [N m/V]
      p.tau_m = [0.008, 0.010, 0.012][Math.floor(R() * 3)]; // motor+driver time constant [s]
      p.Ke = fix(roundTo(R.uniform(0.20, 0.35), 0.01), 3);      // back-EMF constant (wheel side) [V s/rad]
      p.V_dz = fix(roundTo(R.uniform(0.25, 0.50), 0.05), 3);    // driver/brush dead-zone [V]
      // derived physics (linearised wheeled inverted pendulum, wheel inertia J_w = m_w r^2/2)
      const J_w = 0.5 * p.m_w * p.r * p.r;
      const M_a = p.m_b + 2 * p.m_w + 2 * J_w / (p.r * p.r);
      const J_p = p.J_b + p.m_b * p.l * p.l;
      const J_e = J_p - (p.m_b * p.l) ** 2 / M_a;
      const b = 1 + p.m_b * p.l / (p.r * M_a);
      p.J_w = J_w; p.M_a = M_a; p.M_t = p.m_b + 2 * p.m_w; p.J_p = J_p; p.J_e = J_e; p.b = b;
      p.K_B = sig(b / J_e, 4);                  // body gain  [rad/(N m s^2)]
      p.w2 = sig(p.m_b * G * p.l / J_e, 4);      // unstable pole^2 [1/s^2]
      p.h_push = fix(2 * p.l, 4);               // push application height [m]
      // controller design by pole placement, then rounding to 3 s.f.
      const K = 2 * p.Km * p.K_B;
      const sgm = R.uniform(9, 13), wd = R.uniform(4, 8), p3 = R.uniform(5, 9);
      const p4 = 1 / p.tau_m - 2 * sgm - p3;
      if (p4 < 2 * sgm + 5) continue;
      const des = polyMul(polyMul([1, p4], [1, p3]), [1, 2 * sgm, sgm * sgm + wd * wd]);
      p.Kd = sig((des[2] + p.w2) * p.tau_m / K, 3);
      p.Kp = sig((des[3] * p.tau_m + p.w2) / K, 3);
      p.Ki = sig(des[4] * p.tau_m / K, 3);
      const tf = closedLoopTF(p);
      const pl = roots(tf.den);
      if (!pl.every(z => z[0] < -1.0)) continue;
      const zr = -p.Ki / p.Kp;
      if (pl.some(z => Math.hypot(z[0] - zr, z[1]) < 0.05 * Math.abs(zr) + 0.05)) continue;
      // outer (position) loop — given to students, not part of the TF exercise
      p.g_eff = p.m_b * G * p.l / (b * p.r * M_a);
      p.Kx = fix(0.64 / p.g_eff, 4); p.Kv = fix(2.08 / p.g_eff, 4); p.Kix = fix(0.15 / p.g_eff, 4); p.Td = 0.35;
      p.attempt = attempt;
      return p;
    }
    throw new Error('parameter generation failed for ' + id);
  }

  /* closed-loop θ(s)/θref(s):
     C=(Kp s+Ki)/s, Gm=2Km/(τs+1), Gb=K_B/(s²−ω²), inner gyro rate feedback Kd·s, unity tilt feedback
     T = C·Gm·Gb / (1 + Gm·Gb·(Kd s + C))                                                    */
  function closedLoopTF(p) {
    const K = 2 * p.Km * p.K_B;
    const den = polyAdd(polyMul(polyMul([1, 0], [p.tau_m, 1]), [1, 0, -p.w2]), polyScale([p.Kd, p.Kp, p.Ki], K));
    const num = polyScale([p.Kp, p.Ki], K);
    const a0 = den[0];
    return { num: num.map(c => c / a0), den: den.map(c => c / a0) };
  }
  // CCF — convention 'bottom' (phase-variable / Ogata) or 'top' (Nise controller canonical form)
  function ccf(num, den, conv = 'bottom') {
    const a0 = den[0]; const d = den.map(c => c / a0); const nm = num.map(c => c / a0);
    const n = d.length - 1;
    const b = new Array(n).fill(0); for (let i = 0; i < nm.length; i++) b[n - nm.length + i] = nm[i];
    // b[0..n-1] = coefficients of s^(n-1) ... s^0 (strictly proper assumed)
    let A = zeros(n, n), B = zeros(n, 1), C = zeros(1, n);
    if (conv === 'bottom') {
      for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
      for (let j = 0; j < n; j++) A[n - 1][j] = -d[n - j];
      B[n - 1][0] = 1;
      for (let j = 0; j < n; j++) C[0][j] = b[n - 1 - j];
    } else {
      for (let j = 0; j < n; j++) A[0][j] = -d[j + 1];
      for (let i = 1; i < n; i++) A[i][i - 1] = 1;
      B[0][0] = 1;
      for (let j = 0; j < n; j++) C[0][j] = b[j];
    }
    return { A, B, C, D: [[0]] };
  }

  /* --------------------------------------------------------- grading */
  const near = (x, ref, tol) => Math.abs(x - ref) <= tol * Math.abs(ref) + 1e-6;
  function checkTF(student, p, tolPct = 1) {
    const ref = closedLoopTF(p), tol = tolPct / 100;
    const num = trimLead(student.num.map(Number)), den = trimLead(student.den.map(Number));
    if (num.some(x => !isFinite(x)) || den.some(x => !isFinite(x))) return { ok: false, msg: 'All coefficients must be numbers.' };
    if (den[0] === 0) return { ok: false, msg: 'The leading denominator coefficient cannot be zero.' };
    const nN = num.map(c => c / den[0]), dN = den.map(c => c / den[0]);
    if (dN.length !== ref.den.length) return { ok: false, msg: `Denominator order is ${dN.length - 1}; check the order of the closed-loop system.` };
    if (nN.length !== ref.num.length) return { ok: false, msg: `Numerator order is ${nN.length - 1}; check the numerator order.` };
    const okD = dN.every((c, i) => near(c, ref.den[i], tol)), okN = nN.every((c, i) => near(c, ref.num[i], tol));
    if (okD && okN) return { ok: true, msg: 'Correct closed-loop transfer function.' };
    return { ok: false, msg: (okD ? 'Denominator matches, ' : 'Denominator incorrect, ') + (okN ? 'numerator matches.' : 'numerator incorrect.') };
  }
  function matEq(M, R, tol) {
    if (M.length !== R.length) return false;
    return M.every((row, i) => row.length === R[i].length && row.every((v, j) => isFinite(v) && near(Number(v), R[i][j], tol)));
  }
  function checkSS(student, p, tolPct = 1, conventions = ['bottom', 'top']) {
    const ref = closedLoopTF(p), tol = tolPct / 100;
    const sizeMsg = `Expected n = ${ref.den.length - 1} states, 1 input, 1 output.`;
    const { A, B, C, D } = student;
    if (A.length !== ref.den.length - 1 || B[0].length !== 1 || C.length !== 1) return { ok: false, msg: 'Wrong dimensions. ' + sizeMsg };
    for (const conv of conventions) {
      const R = ccf(ref.num, ref.den, conv);
      if (matEq(A, R.A, tol) && matEq(B, R.B, tol) && matEq(C, R.C, tol) && matEq(D, R.D, tol))
        return { ok: true, conv, msg: `Correct CCF (${conv === 'bottom' ? 'phase-variable, last-row' : 'first-row'} convention).` };
    }
    return { ok: false, msg: 'Matrices do not match the controllable canonical form of your G(s).' };
  }
  function analyse(A, B, C) {
    const Mc = ctrb(A, B), Mo = obsv(A, C);
    const ev = eig(A);
    return { Mc, Mo, rc: rank(Mc), ro: rank(Mo), n: A.length, eig: ev, stable: ev.every(z => z[0] < -1e-9) };
  }

  /* ---------------------------------------- real motor & ML inverse model */
  const ML_AXES = (() => {
    const lin = (a, b, n) => Array.from({ length: n }, (_, i) => fix(a + (b - a) * i / (n - 1), 6));
    return { V_cmd: lin(-10, 10, 41), omega_m: lin(-25, 25, 41), V_bat: lin(10.0, 12.6, 5) };
  })();
  const ML_RANGES = { V_cmd: [-10, 10], omega_m: [-25, 25], V_bat: [10.0, 12.6] };
  const V_NOMINAL = 12.0;
  // Real H-bridge + DC motor: terminal voltage -> effective voltage (dead-zone)
  function deadzone(v, vdz) { return Math.sign(v) * Math.max(Math.abs(v) - vdz, 0); }
  // exact inverse: duty that makes the real motor deliver the ideal-model torque Km*V_cmd
  function trueDuty(p, V_cmd, omega_m, V_bat) {
    const ve = V_cmd + p.Ke * omega_m;
    const vt = ve === 0 ? 0 : Math.sign(ve) * (Math.abs(ve) + p.V_dz);
    return Math.max(-1, Math.min(1, vt / V_bat));
  }
  function sampleFeatures(R) {
    const mix = (lo, hi, sd) => {
      if (R() < 0.35) return R.uniform(lo, hi);
      let v; do { v = R.normal() * sd; } while (v < lo || v > hi); return v;
    };
    return [mix(-10, 10, 3.5), mix(-25, 25, 9), R.uniform(10.0, 12.6)];
  }
  function generateDataset(p, id, N) {
    N = Math.max(3000, Math.min(5000, Math.round(N || 4000)));
    const R = rng('POWE445|data|' + id);
    const rows = [];
    for (let k = 0; k < N; k++) {
      const [V, w, Vb] = sampleFeatures(R);
      const y = Math.max(-1, Math.min(1, trueDuty(p, V, w, Vb) + 0.003 * R.normal()));
      rows.push([fix(V, 4), fix(w, 4), fix(Vb, 4), fix(y, 5)]);
    }
    return rows;
  }
  function datasetCSV(rows) {
    return 'V_cmd,omega_m,V_bat,duty\n' + rows.map(r => r.join(',')).join('\n') + '\n';
  }
  // grid model (exported from MATLAB) — trilinear interpolation, clamped to the grid
  function makeGridModel(json) {
    const ax = json.axes, vals = json.values;
    const A = [ax.V_cmd, ax.omega_m, ax.V_bat];
    const n = A.map(a => a.length);
    if (vals.length !== n[0] * n[1] * n[2]) throw new Error(`values has ${vals.length} entries, expected ${n[0] * n[1] * n[2]}`);
    if (vals.some(v => !isFinite(v))) throw new Error('values contains NaN/Inf');
    const loc = (a, x) => {
      if (x <= a[0]) return [0, 0]; const m = a.length - 1;
      if (x >= a[m]) return [m - 1, 1];
      let lo = 0, hi = m; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid] <= x) lo = mid; else hi = mid; }
      return [lo, (x - a[lo]) / (a[lo + 1] - a[lo])];
    };
    const at = (i, j, k) => vals[i + n[0] * (j + n[1] * k)];
    const f = (V, w, Vb) => {
      const [i, u] = loc(A[0], V), [j, v] = loc(A[1], w), [k, t] = loc(A[2], Vb);
      let s = 0;
      for (let di = 0; di < 2; di++) for (let dj = 0; dj < 2; dj++) for (let dk = 0; dk < 2; dk++)
        s += (di ? u : 1 - u) * (dj ? v : 1 - v) * (dk ? t : 1 - t) * at(i + di, j + dj, k + dk);
      return s;
    };
    f.meta = json; return f;
  }
  function idealGridJSON(p, id) {            // admin/testing only: grid of the exact inverse
    const ax = ML_AXES, values = [];
    for (let k = 0; k < ax.V_bat.length; k++) for (let j = 0; j < ax.omega_m.length; j++) for (let i = 0; i < ax.V_cmd.length; i++)
      values.push(fix(trueDuty(p, ax.V_cmd[i], ax.omega_m[j], ax.V_bat[k]), 6));
    return { format: 'POWE445-ML-GRID-v1', studentId: id, modelType: 'Reference (exact inverse)', predictors: ['V_cmd', 'omega_m', 'V_bat'], response: 'duty', axes: ax, values };
  }
  function validateModel(p, id, model, n = 3000) {
    const R = rng('POWE445|hidden-test|' + id);
    let se = 0, sy = 0, sy2 = 0;
    for (let k = 0; k < n; k++) {
      const [V, w, Vb] = sampleFeatures(R);
      const y = trueDuty(p, V, w, Vb), yh = model(V, w, Vb);
      se += (y - yh) ** 2; sy += y; sy2 += y * y;
    }
    const mse = se / n, vary = sy2 / n - (sy / n) ** 2;
    return { rmse: Math.sqrt(mse), r2: 1 - mse / vary, n };
  }

  /* --------------------------------------------------------- simulation
     Nonlinear wheeled inverted pendulum on a slope (x along slope, θ from true vertical).
     Real actuator: H-bridge duty -> dead-zone -> back-EMF -> first-order torque lag.        */
  function minJerk(t, t0, t1, x0, x1) {
    if (t <= t0) return [x0, 0, 0, 0]; if (t >= t1) return [x1, 0, 0, 0];
    const T = t1 - t0, s = (t - t0) / T, d = x1 - x0;
    return [x0 + d * (10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5), d * (30 * s ** 2 - 60 * s ** 3 + 30 * s ** 4) / T,
      d * (60 * s - 180 * s ** 2 + 120 * s ** 3) / (T * T), d * (60 - 360 * s + 360 * s ** 2) / (T * T * T)];
  }
  function scenario(cfg) {
    const mode = (cfg && cfg.mode) || 'both';
    return {
      mode,
      slopeDeg: mode === 'push' ? 0 : Number((cfg && cfg.slopeDeg) ?? 6),
      pushN: mode === 'incline' ? 0 : Number((cfg && cfg.pushN) ?? 4),
      L: 1.2, Tend: 18, Vbat: 11.1,
      pushes: [{ t: 6.0, dur: 0.1, dir: -1 }, { t: 14.0, dur: 0.1, dir: +1 }]
    };
  }
  function reference(t, sc) {
    if (t < 9) return minJerk(t, 1, 5, 0, sc.L);        // A -> B, hold at B (push at 6 s)
    return minJerk(t, 9, 13, sc.L, 0);                   // B -> A, hold at A (push at 14 s)
  }
  /* actuator: 'ideal' | 'naive' | 'oracle' | function(V_cmd, omega_m, V_bat) -> duty
     opts.record: sample every k ms for animation                                         */
  function simulate(p, sc, actuator, opts = {}) {
    const dt = 0.0005, Ts = 0.002, nCtrl = Math.round(Ts / dt), rec = opts.record || 40;
    const alpha = sc.slopeDeg * Math.PI / 180, R = rng('POWE445|noise');
    const { m_b: m, l, r, M_a, M_t, J_p, Km, Ke, V_dz, tau_m, h_push } = p;
    const cr = 0.05;                                  // rolling resistance [N s/m]
    // start at rest in the equilibrium for the slope (already balanced at point A)
    const Tw0 = r * M_t * G * Math.sin(alpha), th0 = Math.asin(Math.max(-0.9, Math.min(0.9, Tw0 / (m * G * l))));
    let s = [0, 0, th0, 0, Tw0];                      // x, xd, th, thd, Tw (total wheel torque)
    let I = -Tw0 / (2 * Km), Ix = th0, thF = th0, duty = 0, Vcmd = 0, Vctrl = 0, thref = th0;
    const out = { t: [], x: [], th: [], thref: [], xr: [], duty: [], F: [] };
    let fallen = false, tFall = null, sumTh2 = 0, maxTh = 0, sumE2 = 0, nS = 0, sumDuty2 = 0, sat = 0;
    const force = t => { for (const ps of sc.pushes) if (t >= ps.t && t < ps.t + ps.dur) return ps.dir * sc.pushN; return 0; };
    function deriv(st, t) {
      const [x, xd, th, thd, Tw] = st;
      const F = force(t);
      const ca = Math.cos(th + alpha), sa = Math.sin(th + alpha);
      // [M_a, m l c; m l c, J_p] [xdd; thdd] = rhs
      const r1 = Tw / r + F * Math.cos(alpha) - M_t * G * Math.sin(alpha) + m * l * sa * thd * thd - cr * xd;
      const r2 = -Tw + m * G * l * Math.sin(th) + F * h_push * Math.cos(th);
      const a11 = M_a, a12 = m * l * ca, a22 = J_p, det = a11 * a22 - a12 * a12;
      const xdd = (r1 * a22 - a12 * r2) / det, thdd = (a11 * r2 - a12 * r1) / det;
      // motors (both), motor-shaft speed relative to chassis
      const wm = xd / r - thd;
      let Vt = duty * sc.Vbat, target;
      if (actuator === 'ideal') target = 2 * Km * Vcmd;
      else target = 2 * Km * (deadzone(Vt, V_dz) - Ke * wm);
      return [xd, xdd, thd, thdd, (target - Tw) / tau_m];
    }
    const N = Math.round(sc.Tend / dt);
    for (let k = 0; k <= N; k++) {
      const t = k * dt;
      if (k % nCtrl === 0 && !fallen) {
        const [x, xd, th, thd] = s;
        const thM = th + 0.001 * R.normal(), gyro = thd + 0.005 * R.normal();
        const wmM = xd / r - thd + 0.05 * R.normal(), xM = x;
        const Td = p.Td ?? 0.3;                           // reference-model delay (2-DOF tracking)
        const [, , ar] = reference(t, sc), [xr, vr] = reference(t - Td, sc);
        const ex = xr - xM, zf = p.Ki / p.Kp;
        // outer position loop (given) -> tilt reference; lean feed-forward pre-compensated for the pre-filter
        let thr = ar / p.g_eff + p.Kx * ex + p.Kv * (vr - xd) + Ix;
        thr = Math.max(-0.2, Math.min(0.2, thr));
        if (Math.abs(thr) < 0.2) Ix += p.Kix * ex * Ts;
        // set-point pre-filter z/(s+z), z = Ki/Kp (removes the PI-zero overshoot; part of the given planner)
        thF += (thr - thF) * (1 - Math.exp(-zf * Ts));
        thref = thF;
        thr = thF;
        // inner loop: PI on tilt + gyro rate feedback
        const e = thr - thM;
        let v = p.Kp * e + I - p.Kd * gyro;
        const vmax = 14;
        if (Math.abs(v) < vmax || Math.sign(v) !== Math.sign(e)) I += p.Ki * e * Ts;
        v = Math.max(-vmax, Math.min(vmax, v));
        Vctrl = v;
        Vcmd = -Vctrl;                      // motor polarity wired for restoring torque
        if (actuator === 'ideal') duty = Vcmd / sc.Vbat;
        else if (actuator === 'naive') duty = Vcmd / V_NOMINAL;
        else if (actuator === 'oracle') duty = trueDuty(p, Vcmd, wmM, sc.Vbat);
        else duty = actuator(Vcmd, wmM, sc.Vbat);
        if (!isFinite(duty)) duty = 0;
        duty = Math.max(-1, Math.min(1, duty));
        if (Math.abs(duty) > 0.999) sat++;
        sumDuty2 += duty * duty;
        sumTh2 += th * th; maxTh = Math.max(maxTh, Math.abs(th)); sumE2 += ex * ex; nS++;
      }
      if (k % rec === 0) {
        out.t.push(fix(t, 3)); out.x.push(s[0]); out.th.push(s[2]); out.thref.push(thref);
        out.xr.push(reference(t, sc)[0]); out.duty.push(duty); out.F.push(force(t));
      }
      if (k === N) break;
      if (!fallen && Math.abs(s[2]) > 0.6) { fallen = true; tFall = t; }
      if (fallen) {                          // robot lies down: simple fall-over kinematics
        const sg = Math.sign(s[2]);
        s[3] += sg * 9 * dt; s[2] += s[3] * dt; s[1] *= 0.995; s[0] += s[1] * dt;
        if (Math.abs(s[2]) > Math.PI / 2 - 0.25) { s[2] = sg * (Math.PI / 2 - 0.25); s[3] = 0; s[1] = 0; }
        continue;
      }
      const k1 = deriv(s, t), k2 = deriv(s.map((v, i) => v + 0.5 * dt * k1[i]), t + dt / 2);
      const k3 = deriv(s.map((v, i) => v + 0.5 * dt * k2[i]), t + dt / 2), k4 = deriv(s.map((v, i) => v + dt * k3[i]), t + dt);
      s = s.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    }
    out.fallenAt = tFall;
    const finalErr = Math.abs(s[0] - 0);
    const deg = 180 / Math.PI;
    const metrics = {
      fallen, tFall,
      rmsTiltDeg: Math.sqrt(sumTh2 / Math.max(nS, 1)) * deg,
      maxTiltDeg: maxTh * deg,
      rmsPosErr: Math.sqrt(sumE2 / Math.max(nS, 1)),
      finalErr,
      satPct: 100 * sat / Math.max(nS, 1)
    };
    return { out, metrics };
  }
  function balanceCost(m) {                     // lower is better (tilt-weighted)
    return m.rmsTiltDeg / 1.0 + m.maxTiltDeg / 5 + m.rmsPosErr / 0.1 + m.finalErr / 0.1;
  }
  function balanceScore(m) { return m.fallen ? 0 : fix(balanceCost(m), 3); }
  const refCache = {};
  // Balance Index: 100 = performance of the exactly-compensated robot (reference), 0 = fell
  function challenge(p, sc, actuator) {
    const key = JSON.stringify([p.Kp, p.Ki, p.Kd, p.Ke, p.V_dz, p.m_b, p.l, sc.mode, sc.slopeDeg, sc.pushN]);
    const ref = refCache[key] || (refCache[key] = simulate(p, sc, 'oracle').metrics);
    const run = simulate(p, sc, actuator);
    const m = run.metrics;
    m.index = m.fallen ? 0 : fix(Math.min(100, 100 * balanceCost(ref) / balanceCost(m)), 1);
    return { ...run, ref };
  }
  function passTest(m, th) {
    const checks = [
      { k: 'Robot stays upright (no fall)', ok: !m.fallen, v: m.fallen ? 'fell at ' + m.tFall.toFixed(2) + ' s' : 'upright' },
      { k: `Balance Index ≥ ${th.minIndex}`, ok: m.index >= th.minIndex, v: m.index.toFixed(1) },
      { k: `Max tilt ≤ ${th.maxTiltDeg}°`, ok: m.maxTiltDeg <= th.maxTiltDeg, v: m.maxTiltDeg.toFixed(2) + '°' },
      { k: `Returns to point A within ${th.finalErr} m`, ok: m.finalErr <= th.finalErr, v: m.finalErr.toFixed(3) + ' m' }
    ];
    return { pass: checks.every(c => c.ok), checks };
  }

  /* ---------------------------------------------------------- config */
  const QUESTIONS = [
    { key: 'tf', label: 'Closed-loop transfer function G(s)', stage: 1 },
    { key: 'ss', label: 'CCF state-space matrices (A, B, C, D)', stage: 2 },
    { key: 'io', label: 'Input u(t) and output y(t) signals', stage: 2 },
    { key: 'qc', label: 'Controllability (yes/no)', stage: 3 },
    { key: 'qo', label: 'Observability (yes/no)', stage: 3 },
    { key: 'qs', label: 'Stability (yes/no)', stage: 3 },
    { key: 'ml', label: 'ML model validation (hidden test set)', stage: 4 },
    { key: 'sim', label: 'Simulation challenge with ML block', stage: 5 }
  ];
  const DEFAULT_CONFIG = {
    weights: { tf: 20, ss: 15, io: 5, qc: 5, qo: 5, qs: 5, ml: 20, sim: 25 },
    attempts: { tf: 3, ss: 3, io: 2 },
    tolPct: 1,
    datasetN: 4000,
    disturbance: { mode: 'both', slopeDeg: 6, pushN: 4 },
    r2Min: 0.995,
    thresholds: { minIndex: 80, maxTiltDeg: 20, finalErr: 0.15 },
    sessionOpen: true,
    certRequiresPass: true,
    ccfConventions: ['bottom', 'top']
  };
  function mergeConfig(c) {
    const d = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (!c) return d;
    for (const k of Object.keys(d)) if (c[k] !== undefined) {
      if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) d[k] = Object.assign(d[k], c[k]); else d[k] = c[k];
    }
    return d;
  }
  function computeMarks(results, overrides, cfg) {
    const rows = QUESTIONS.map(q => {
      const r = (results || {})[q.key] || {};
      const w = Number(cfg.weights[q.key]) || 0;
      const auto = r.correct ? w : 0;
      const ov = overrides && overrides[q.key] !== undefined && overrides[q.key] !== null && overrides[q.key] !== '' ? Number(overrides[q.key]) : null;
      return { ...q, weight: w, earned: ov !== null ? Math.min(ov, w) : auto, auto, override: ov, done: !!r.done, correct: !!r.correct };
    });
    const total = rows.reduce((s, r) => s + r.weight, 0), earned = rows.reduce((s, r) => s + r.earned, 0);
    return { rows, total, earned, pct: total ? 100 * earned / total : 0 };
  }
  function certCode(id, name, pct, dateStr) {
    return ('BAU-POWE445-' + hashStr(id + '|' + name + '|' + pct.toFixed(1) + '|' + dateStr).toString(36).toUpperCase().padStart(7, '0')).slice(0, 20);
  }
  function fmt(x, n = 4) {
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) return x.toExponential(n - 1);
    return String(Number(x.toPrecision(n + 1)));
  }

  const Core = {
    VERSION, G, rng, hashStr, sig, validateName, validateId,
    polyMul, polyAdd, polyVal, roots, matMul, rank, singularValues, charPoly, eig, ctrb, obsv,
    generateParams, closedLoopTF, ccf, checkTF, checkSS, analyse,
    ML_AXES, ML_RANGES, V_NOMINAL, trueDuty, generateDataset, datasetCSV, makeGridModel, idealGridJSON, validateModel,
    scenario, reference, simulate, balanceCost, challenge, passTest,
    QUESTIONS, DEFAULT_CONFIG, mergeConfig, computeMarks, certCode, fmt, trimLead
  };
  root.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
