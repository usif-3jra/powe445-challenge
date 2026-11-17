/* POWE445 Self-Balancing Robot Challenge — instructor control room */
import { createBackend } from './backend.js';
const C = window.Core, UI = window.UI, esc = UI.esc;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const A = { be: null, students: {}, cfg: C.mergeConfig(null), cfgRaw: null, tab: 'wait', editingSettings: false };
const fmtM = x => (Math.round(x * 10) / 10).toString();
const online = r => r.presence && Date.now() - r.presence.lastSeen < 75000;
const foot = `<div class="foot">POWE445 — CONTROL SYSTEMS II · CONTROL ROOM · ${C.VERSION} · CREATED BY YOUSSEF AJRA</div>`;

(async function boot() {
  try { A.be = await createBackend('admin'); } catch (e) { app.innerHTML = `<div class="login-wrap"><div class="msg bad">${esc(e.message)}</div></div>`; return; }
  const uid = await A.be.adminResume();
  uid ? start() : renderLogin();
})();

function renderLogin(err) {
  const local = A.be.mode === 'local';
  app.innerHTML = `<header class="topbar">${UI.logoHTML()}<div class="brand"><span class="course">POWE445 · CONTROL SYSTEMS II</span><span class="title">Control Room — Instructor</span></div></header>
  <div class="login-wrap"><div class="sheet" style="width:min(460px,100%)"><div class="sheet-label">ADMIN ACCESS</div>
    <h2>Instructor sign-in</h2><p class="lead">${local ? 'Local demo mode: enter the passcode from <code>js/config.js</code>.' : 'Firebase account listed under <code>/admins</code>.'}</p>
    ${local ? '' : '<label>Email</label><input id="em" type="email" autocomplete="username"><div class="spacer"></div>'}
    <label>${local ? 'Passcode' : 'Password'}</label><input id="pw" type="password" autocomplete="current-password">
    <div class="spacer"></div><button class="btn primary" id="go">SIGN IN</button>
    ${err ? `<div class="msg bad">${esc(err)}</div>` : ''}</div></div>${foot}`;
  const go = async () => { try { await A.be.adminSignIn(local ? '' : $('#em').value.trim(), $('#pw').value); start(); } catch (e) { renderLogin(e.message); } };
  $('#go').onclick = go; $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

function start() {
  app.innerHTML = `<header class="topbar">${UI.logoHTML()}<div class="brand"><span class="course">POWE445 · CONTROL SYSTEMS II</span><span class="title">Control Room — Self-Balancing Robot Challenge</span></div>
    <div class="who"><b>Dr. Youssef Ajra</b><span class="pill ${A.be.mode === 'local' ? 'warn' : 'ok'}">${A.be.mode === 'local' ? 'LOCAL DEMO' : 'FIREBASE LIVE'}</span> <button class="btn sm" id="out">Sign out</button></div></header>
    <div class="admin-shell"><div class="cards" id="cards"></div>
      <div class="row" style="margin:-6px 0 14px"><span class="mono small" id="live"></span><span class="grow"></span><button class="btn sm" id="refresh">⟳ Refresh</button></div>
      <div class="tabs" id="tabs"></div><section class="sheet" id="pane" style="margin-top:0"></section></div>${foot}`;
  $('#out').onclick = async () => { await A.be.adminSignOut(); location.reload(); };
  $('#refresh').onclick = () => refreshNow(true);
  A.be.watchConfig(c => { A.cfgRaw = c; A.cfg = C.mergeConfig(c); if (!c) A.be.saveConfig(A.cfg).catch(() => {}); if (A.tab !== 'settings' || !A.editingSettings) render(true); });
  subscribe();
  // if the admin session ends in another tab, say so instead of silently freezing
  A.be.onAuthChange(uid => { if (!uid) setLive(false, 'Admin session ended (signed out in another tab). Sign in again.'); });
  setInterval(() => { renderCards(); updateOnline(); }, 15000);
  setInterval(() => { if (!A.live) refreshNow(false); }, 20000);   // self-heal a dropped listener
}
function subscribe() {
  if (A.unsubS) { try { A.unsubS(); } catch {} }
  A.unsubS = A.be.watchStudents(s => { A.students = s || {}; setLive(true); onData(); },
    e => setLive(false, 'Live connection lost (' + (e && e.code || e && e.message || 'error') + '). Press Refresh.'));
}
async function refreshNow(manual) {
  try { A.students = await A.be.getStudents(); setLive(true); subscribe(); onData(true); if (manual) UI.toast('Refreshed', 'ok'); }
  catch (e) { setLive(false, 'Refresh failed: ' + (e.code || e.message) + ' — sign in again if this persists.'); if (manual) UI.toast('Refresh failed', 'bad'); }
}
function setLive(ok, msg) {
  A.live = ok; const el = $('#live'); if (!el) return;
  el.innerHTML = ok ? `<span class="online on"></span>&nbsp; LIVE · updated ${new Date().toLocaleTimeString()}` : `<span class="online"></span>&nbsp; <span style="color:var(--bad)">${esc(msg || 'offline')}</span>`;
}
function onData(force) {
  const typing = document.activeElement && document.activeElement.classList.contains('ov');
  if (A.tab === 'settings' || A.tab === 'key' || typing) {
    renderCards(); renderTabs();
    if (typing && !A.blurHook) { A.blurHook = true; document.activeElement.addEventListener('blur', () => { A.blurHook = false; setTimeout(() => render(true), 50); }, { once: true }); }
  } else render(force);
}
// signature of what the current tab shows — the pane is rebuilt only when it changes (no flicker)
function paneSig() {
  const L = list().map(r => ({ u: r.uid, p: r.profile, s: r.status, w: A.tab === 'wait' ? null : r.work, o: r.overrides, st: r.presence && r.presence.stage }));
  return A.tab + '|' + JSON.stringify(L) + '|' + JSON.stringify(A.cfg);
}
function updateOnline() { $$('[data-online]').forEach(d => { const r = A.students[d.dataset.online]; d.classList.toggle('on', !!(r && online(r))); }); }
const list = () => Object.entries(A.students).filter(([, r]) => r && r.profile).map(([uid, r]) => ({ uid, ...r, status: r.status || 'pending' }));
function dupIds() { const c = {}; list().forEach(r => { c[r.profile.id] = (c[r.profile.id] || 0) + 1; }); return c; }

function renderCards() {
  const L = list();
  const card = (t, v) => `<div class="metric"><span>${t}</span><b>${v}</b></div>`;
  $('#cards').innerHTML = card('WAITING', L.filter(r => r.status === 'pending').length) + card('ADMITTED', L.filter(r => r.status === 'approved').length) +
    card('ONLINE NOW', L.filter(r => r.status === 'approved' && online(r)).length) + card('CHALLENGE PASSED', L.filter(r => r.work && r.work.results && r.work.results.sim && r.work.results.sim.correct).length) +
    card('SESSION', `<span class="pill ${A.cfg.sessionOpen ? 'ok' : 'bad'}" style="font-size:14px;display:inline-block">${A.cfg.sessionOpen ? 'OPEN' : 'CLOSED'}</span> <button class="btn sm" id="tog">${A.cfg.sessionOpen ? 'close' : 'open'}</button>`);
  $('#tog').onclick = () => A.be.saveConfig({ ...A.cfg, sessionOpen: !A.cfg.sessionOpen });
}
function renderTabs() {
  const tabs = [['wait', `Waiting room (${list().filter(r => r.status === 'pending').length})`], ['students', 'Students & marks'], ['board', 'Leaderboard'], ['settings', 'Settings & marks'], ['key', 'Answer key']];
  $('#tabs').innerHTML = tabs.map(([k, t]) => `<button class="tab ${A.tab === k ? 'active' : ''}" data-t="${k}">${t}</button>`).join('');
  $$('#tabs .tab').forEach(b => b.onclick = () => { A.tab = b.dataset.t; A.editingSettings = false; render(true); });
}
function render(force) {
  renderCards(); renderTabs();
  const sig = paneSig();
  if (!force && sig === A.lastSig) { updateOnline(); return; }
  A.lastSig = sig;
  const y = window.scrollY;
  ({ wait: paneWait, students: paneStudents, board: paneBoard, settings: paneSettings, key: paneKey })[A.tab]($('#pane'));
  window.scrollTo(0, y); updateOnline();
}

/* ------------------------------------------------------------ waiting room */
function paneWait(el) {
  const d = dupIds(); const P = list().filter(r => r.status === 'pending').sort((a, b) => a.profile.requestedAt - b.profile.requestedAt);
  const R = list().filter(r => r.status === 'rejected');
  el.innerHTML = `<div class="sheet-label">WAITING ROOM</div><div class="row"><h2 class="grow">Students requesting access</h2>${P.length ? '<button class="btn ok" id="all">Accept all</button>' : ''}</div>
    <p class="lead">Check each name and ID against the class list. A red ID means the same ID is already registered from another browser or device.</p>
    ${P.length ? `<div class="tbl-wrap"><table class="adm"><tr><th>#</th><th>NAME</th><th>ID</th><th>REQUESTED</th><th>FLAG</th><th></th></tr>
      ${P.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.profile.name)}</td><td class="mono ${d[r.profile.id] > 1 ? 'dup' : ''}">${esc(r.profile.id)}</td><td class="mono">${new Date(r.profile.requestedAt).toLocaleTimeString()}</td>
        <td>${d[r.profile.id] > 1 ? '<span class="pill bad">duplicate ID</span>' : ''}</td><td><button class="btn sm ok" data-a="${r.uid}">Accept</button> <button class="btn sm bad" data-r="${r.uid}">Reject</button></td></tr>`).join('')}</table></div>`
      : '<div class="msg info">No pending requests. Students appear here the moment they sign in.</div>'}
    ${R.length ? `<h3>Rejected / removed</h3><table class="adm"><tr><th>NAME</th><th>ID</th><th></th></tr>${R.map(r => `<tr><td>${esc(r.profile.name)}</td><td class="mono">${esc(r.profile.id)}</td><td><button class="btn sm" data-a="${r.uid}">Admit</button> <button class="btn sm bad" data-del="${r.uid}">Delete</button></td></tr>`).join('')}</table>` : ''}`;
  $$('[data-a]', el).forEach(b => b.onclick = () => A.be.setStatus(b.dataset.a, 'approved'));
  $$('[data-r]', el).forEach(b => b.onclick = () => A.be.setStatus(b.dataset.r, 'rejected'));
  $$('[data-del]', el).forEach(b => b.onclick = () => { if (confirm('Delete this record permanently?')) A.be.removeStudent(b.dataset.del); });
  if ($('#all', el)) $('#all', el).onclick = () => P.forEach(r => A.be.setStatus(r.uid, 'approved'));
}

/* ------------------------------------------------------------ students & marks */
function paneStudents(el) {
  const Q = C.QUESTIONS, L = list().filter(r => r.status === 'approved').sort((a, b) => a.profile.name.localeCompare(b.profile.name));
  const d = dupIds();
  el.innerHTML = `<div class="sheet-label">STUDENTS & MARKS</div><div class="row"><h2 class="grow">Admitted students (${L.length})</h2><button class="btn" id="csv">⬇ Export results CSV</button></div>
    <p class="lead">Each mark cell shows the automatic mark. Type a number to override it for that student (clear the box to return to the automatic mark). Question weights are set in “Settings & marks”.</p>
    <div class="tbl-wrap"><table class="adm"><tr><th></th><th>NAME</th><th>ID</th><th>STAGE</th>${Q.map(q => `<th title="${esc(q.label)}">${q.key.toUpperCase()}<br>/${fmtM(A.cfg.weights[q.key])}</th>`).join('')}<th>TOTAL</th><th>%</th><th>R²</th><th>INDEX</th><th>CERT</th><th></th></tr>
    ${L.map(r => {
      const res = (r.work && r.work.results) || {}; const mk = C.computeMarks(res, r.overrides, A.cfg);
      return `<tr><td><span class="online ${online(r) ? 'on' : ''}" data-online="${r.uid}" title="${r.presence ? new Date(r.presence.lastSeen).toLocaleTimeString() : 'never'}"></span></td>
        <td>${esc(r.profile.name)}</td><td class="mono ${d[r.profile.id] > 1 ? 'dup' : ''}">${esc(r.profile.id)}</td><td class="num">${r.presence ? r.presence.stage || '—' : '—'}</td>
        ${mk.rows.map(q => `<td class="num" style="background:${q.done ? (q.correct ? '#eef8f3' : '#fdf0ee') : '#fff'}"><input class="ov" data-u="${r.uid}" data-k="${q.key}" value="${q.override ?? ''}" placeholder="${fmtM(q.auto)}" title="attempts: ${(res[q.key] || {}).attempts || 0}"></td>`).join('')}
        <td class="num"><b>${fmtM(mk.earned)}</b></td><td class="num">${mk.pct.toFixed(1)}</td><td class="num">${res.ml && res.ml.r2 !== undefined ? res.ml.r2.toFixed(4) : '—'}</td>
        <td class="num">${res.sim && res.sim.bestIndex ? Number(res.sim.bestIndex).toFixed(1) : '—'}</td><td>${r.work && r.work.cert ? '<span class="pill ok">issued</span>' : ''}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-rep="${r.uid}">Report</button> <button class="btn sm" data-key="${esc(r.profile.id)}">Key</button> <button class="btn sm" data-reset="${r.uid}">Reset</button> <button class="btn sm bad" data-kick="${r.uid}">Remove</button></td></tr>`;
    }).join('') || `<tr><td colspan="${Q.length + 11}" class="muted">No admitted students yet.</td></tr>`}</table></div>`;
  $$('input.ov', el).forEach(i => i.onchange = () => { const v = i.value.trim(); if (v !== '' && !isFinite(Number(v))) { i.value = ''; return; } A.be.setOverride(i.dataset.u, i.dataset.k, v === '' ? null : Number(v)); });
  $$('[data-key]', el).forEach(b => b.onclick = () => { A.tab = 'key'; render(true); $('#kid').value = b.dataset.key; $('#kgo').click(); });
  $$('[data-rep]', el).forEach(b => b.onclick = () => Report.open(A.students[b.dataset.rep], A.cfg));
  $$('[data-reset]', el).forEach(b => b.onclick = () => { if (confirm('Erase all work of this student (answers, marks, certificate)?')) A.be.resetWork(b.dataset.reset); });
  $$('[data-kick]', el).forEach(b => b.onclick = () => { if (confirm('Remove this student from the session?')) A.be.setStatus(b.dataset.kick, 'rejected'); });
  $('#csv', el).onclick = () => {
    const head = ['name', 'id', 'status', ...Q.map(q => q.key), 'total', 'out_of', 'percent', 'ml_r2', 'ml_model', 'best_balance_index', 'certificate_code'];
    const rows = list().map(r => { const res = (r.work && r.work.results) || {}; const mk = C.computeMarks(res, r.overrides, A.cfg);
      return [r.profile.name, r.profile.id, r.status, ...mk.rows.map(q => q.earned), mk.earned, mk.total, mk.pct.toFixed(2), res.ml ? res.ml.r2 : '', res.ml ? res.ml.modelType : '', res.sim ? res.sim.bestIndex : '', r.work && r.work.cert ? r.work.cert.code : '']; });
    UI.download(`POWE445_results_${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  };
}

/* ------------------------------------------------------------ leaderboard */
function paneBoard(el) {
  const L = list().filter(r => r.status === 'approved').map(r => { const res = (r.work && r.work.results) || {}; return { r, res, mk: C.computeMarks(res, r.overrides, A.cfg), idx: res.sim && res.sim.correct ? Number(res.sim.bestIndex || 0) : 0 }; })
    .sort((a, b) => b.idx - a.idx || b.mk.pct - a.mk.pct);
  el.innerHTML = `<div class="sheet-label">LEADERBOARD</div><h2>Most balanced robot</h2>
    <p class="lead">Ranked by the best passing Balance Index (100 = as good as the exactly compensated robot), then by total marks. Disturbance: ${esc(A.cfg.disturbance.mode)} · slope ${A.cfg.disturbance.slopeDeg}° · push ${A.cfg.disturbance.pushN} N.</p>
    <table class="adm"><tr><th>RANK</th><th>NAME</th><th>ID</th><th>BALANCE INDEX</th><th>ML MODEL</th><th>R²</th><th>MARKS %</th></tr>
    ${L.map((x, i) => `<tr><td class="num"><b>${i + 1}</b></td><td>${esc(x.r.profile.name)}</td><td class="mono">${esc(x.r.profile.id)}</td><td class="num"><b>${x.idx ? x.idx.toFixed(1) : '—'}</b></td><td>${esc(x.res.ml ? x.res.ml.modelType : '')}</td><td class="num">${x.res.ml && x.res.ml.r2 !== undefined ? x.res.ml.r2.toFixed(4) : '—'}</td><td class="num">${x.mk.pct.toFixed(1)}</td></tr>`).join('')}</table>`;
}

/* ------------------------------------------------------------ settings */
function paneSettings(el) {
  const c = JSON.parse(JSON.stringify(A.cfg));
  const num = (path, label, step = 1, extra = '') => { const v = path.split('.').reduce((o, k) => o[k], c); return `<div><label>${label}</label><input type="number" step="${step}" data-p="${path}" value="${v}" ${extra}></div>`; };
  el.innerHTML = `<div class="sheet-label">SETTINGS & MARKS</div><h2>Challenge settings</h2>
    <p class="lead">Changes apply live to every student. Marks already earned are recomputed with the new weights.</p>
    <h3>Question weights (marks)</h3><div class="settings-grid">${C.QUESTIONS.map(q => num('weights.' + q.key, esc(q.label), 0.5, 'min="0"')).join('')}</div>
    <h3>Attempts & tolerance</h3><div class="settings-grid">${num('attempts.tf', 'Attempts — transfer function', 1, 'min="1"')}${num('attempts.ss', 'Attempts — CCF matrices', 1, 'min="1"')}${num('attempts.io', 'Attempts — input/output signals', 1, 'min="1"')}${num('tolPct', 'Numeric tolerance (%)', 0.1, 'min="0.01"')}</div>
    <h3>Disturbance test</h3><div class="settings-grid">
      <div><label>Test variable</label><select data-p="disturbance.mode">${[['both', 'Inclined surface + lateral pushes'], ['incline', 'Inclined surface only'], ['push', 'Lateral pushes only']].map(([v, t]) => `<option value="${v}" ${c.disturbance.mode === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      ${num('disturbance.slopeDeg', 'Slope angle α (deg, + = uphill A→B)', 0.5, 'min="-12" max="12"')}${num('disturbance.pushN', 'Push force F (N, 0.1 s pulse)', 0.5, 'min="0" max="8"')}</div>
    <h3>ML & challenge pass criteria</h3><div class="settings-grid">${num('datasetN', 'Dataset size N (3000–5000)', 100, 'min="3000" max="5000"')}${num('r2Min', 'ML pass: minimum R² (hidden test)', 0.001, 'min="0" max="1"')}
      ${num('thresholds.minIndex', 'Challenge pass: min Balance Index', 1, 'min="0" max="100"')}${num('thresholds.maxTiltDeg', 'Challenge pass: max tilt (deg)', 0.5)}${num('thresholds.finalErr', 'Challenge pass: final error at A (m)', 0.01)}</div>
    <h3>Other</h3><div class="settings-grid">
      <div><label><input type="checkbox" data-p="certRequiresPass" ${c.certRequiresPass ? 'checked' : ''}> Certificate requires a passed challenge</label></div>
      <div><label><input type="checkbox" data-p="sessionOpen" ${c.sessionOpen ? 'checked' : ''}> Session open for new sign-ins</label></div>
      <div><label><input type="checkbox" data-cv="bottom" ${c.ccfConventions.includes('bottom') ? 'checked' : ''}> Accept CCF with companion row at the bottom</label></div>
      <div><label><input type="checkbox" data-cv="top" ${c.ccfConventions.includes('top') ? 'checked' : ''}> Accept CCF with companion row at the top</label></div></div>
    <div class="row" style="margin-top:18px"><button class="btn primary" id="sv">SAVE SETTINGS</button><button class="btn" id="df">Restore defaults</button><span id="svm" class="mono small"></span></div>
    <h3>Check the current test on a sample robot</h3><div class="row"><input id="tid" type="text" placeholder="student ID" style="max-width:200px" value="${list()[0] ? list()[0].profile.id : '202312345'}"><button class="btn" id="tst">Run PI-only vs reference</button></div><div id="tstres"></div>`;
  el.oninput = () => { A.editingSettings = true; };
  const collect = () => {
    $$('[data-p]', el).forEach(i => {
      const ks = i.dataset.p.split('.'); let o = c; for (let k = 0; k < ks.length - 1; k++) o = o[ks[k]];
      o[ks[ks.length - 1]] = i.type === 'checkbox' ? i.checked : (i.tagName === 'SELECT' ? i.value : Number(i.value));
    });
    c.ccfConventions = $$('[data-cv]', el).filter(i => i.checked).map(i => i.dataset.cv); if (!c.ccfConventions.length) c.ccfConventions = ['bottom', 'top'];
    c.datasetN = Math.max(3000, Math.min(5000, Math.round(c.datasetN)));
    return c;
  };
  $('#sv', el).onclick = async () => { await A.be.saveConfig(collect()); A.editingSettings = false; $('#svm', el).textContent = 'saved ✓'; UI.toast('Settings saved', 'ok'); };
  $('#df', el).onclick = async () => { if (confirm('Restore all default settings?')) { await A.be.saveConfig({ ...C.DEFAULT_CONFIG, sessionOpen: A.cfg.sessionOpen }); A.editingSettings = false; render(true); } };
  $('#tst', el).onclick = () => {
    const v = C.validateId($('#tid', el).value); if (!v.ok) { $('#tstres', el).innerHTML = `<div class="msg bad">${v.msg}</div>`; return; }
    const cc = collect(); const p = C.generateParams(v.value), sc = C.scenario(cc.disturbance);
    const ref = C.simulate(p, sc, 'oracle').metrics, pi = C.challenge(p, sc, 'naive').metrics, g = C.challenge(p, sc, C.makeGridModel(C.idealGridJSON(p, v.value))).metrics;
    const row = (t, m) => `<tr><td>${t}</td><td>${m.fallen ? '<span class="pill bad">fell</span>' : '<span class="pill ok">upright</span>'}</td><td class="num">${m.rmsTiltDeg.toFixed(2)}</td><td class="num">${m.maxTiltDeg.toFixed(2)}</td><td class="num">${m.rmsPosErr.toFixed(3)}</td><td class="num">${m.finalErr.toFixed(3)}</td><td class="num">${m.index !== undefined ? m.index.toFixed(1) : '100'}</td></tr>`;
    $('#tstres', el).innerHTML = `<table class="adm" style="margin-top:10px"><tr><th>RUN</th><th>RESULT</th><th>RMS TILT °</th><th>MAX TILT °</th><th>RMS TRACK m</th><th>FINAL m</th><th>INDEX</th></tr>${row('Exact inverse (reference)', ref)}${row('Reference model sampled on the export grid', g)}${row('PI only, no ML', pi)}</table>
      <p class="small muted">A good student model scores close to the grid-sampled reference. If the PI-only run does not fall, the ML block is less essential for that setting.</p>`;
  };
}

/* ------------------------------------------------------------ answer key */
function paneKey(el) {
  el.innerHTML = `<div class="sheet-label">ANSWER KEY</div><h2>Answer key for any student ID</h2>
    <p class="lead">Parameters, closed-loop G(s), CCF and analysis for one ID — exactly as the student page computes them.</p>
    <div class="row"><input id="kid" type="text" placeholder="20XXXXXXX" style="max-width:200px"><button class="btn primary" id="kgo">Show</button></div><div id="kout"></div>`;
  $('#kgo', el).onclick = () => {
    const v = C.validateId($('#kid', el).value); if (!v.ok) { $('#kout', el).innerHTML = `<div class="msg bad">${v.msg}</div>`; return; }
    const id = v.value, p = C.generateParams(id), tf = C.closedLoopTF(p), b = C.ccf(tf.num, tf.den, 'bottom'), t = C.ccf(tf.num, tf.den, 'top'), an = C.analyse(b.A, b.B, b.C);
    $('#kout', el).innerHTML = `<div class="grid2" style="margin-top:14px"><div><h3>Block parameters</h3><table class="spec">
        ${[['Kp', p.Kp, 'V/rad'], ['Ki', p.Ki, 'V/(rad·s)'], ['Kd', p.Kd, 'V·s/rad'], ['Km (each motor)', p.Km, 'N·m/V'], ['τm', p.tau_m, 's'], ['K_B', p.K_B, 'rad/(N·m·s²)'], ['ωp²', p.w2, 's⁻²'], ['Ke (real motor)', p.Ke, 'V·s/rad'], ['V_dz (real driver)', p.V_dz, 'V']].map(r => `<tr><td>${r[0]}</td><td class="num">${C.fmt(r[1], 5)}</td><td>${r[2]}</td></tr>`).join('')}</table></div>
      <div><h3>Closed-loop G(s) (monic)</h3><div class="preview">G(s) = ${UI.fracHTML(tf.num, tf.den)}</div>
        <p class="mono small">num = [${tf.num.map(x => C.fmt(x, 7)).join(', ')}]<br>den = [${tf.den.map(x => C.fmt(x, 7)).join(', ')}]</p>
        <h3>Analysis</h3><p class="mono">rank 𝒞 = ${an.rc}, rank 𝒪 = ${an.ro}, n = ${an.n}<br>eig = ${an.eig.map(z => C.fmt(z[0], 5) + (z[1] ? (z[1] > 0 ? '+' : '−') + C.fmt(Math.abs(z[1]), 4) + 'j' : '')).join(', ')}<br>Answers: controllable YES · observable YES · stable YES</p></div></div>
      <h3>CCF — companion row at the bottom</h3><div class="matrices">${['A', 'B', 'C', 'D'].map(k => `<div class="matrix"><span class="name">${k} =</span>${UI.matHTML(b[k], 6)}</div>`).join('')}</div>
      <h3>CCF — companion row at the top</h3><div class="matrices">${['A', 'B', 'C', 'D'].map(k => `<div class="matrix"><span class="name">${k} =</span>${UI.matHTML(t[k], 6)}</div>`).join('')}</div>
      <div class="row" style="margin-top:16px"><button class="btn" id="kds">⬇ Student dataset (CSV)</button><button class="btn" id="km">⬇ MATLAB verification script</button><button class="btn" id="kref">⬇ Reference model JSON (testing only)</button></div>
      <p class="small muted">The reference model is the exact inverse sampled on the export grid. Use it to test the upload/challenge pipeline; do not share it with students.</p>`;
    $('#kds', el).onclick = () => UI.download(`POWE445_dataset_${id}.csv`, C.datasetCSV(C.generateDataset(p, id, A.cfg.datasetN)), 'text/csv');
    $('#kref', el).onclick = () => UI.download(`POWE445_model_${id}_REFERENCE.json`, JSON.stringify(C.idealGridJSON(p, id)), 'application/json');
    $('#km', el).onclick = () => UI.download(`POWE445_key_${id}.m`, matlabKey(id, p), 'text/plain');
  };
}
function matlabKey(id, p) {
  const n = x => String(Number(x));
  return `%% POWE445 Self-Balancing Robot Challenge — answer key for student ${id}
% Generated by the Control Room (${C.VERSION}). Requires Control System Toolbox.
clear; clc;
Km = ${n(p.Km)};   % N·m/V, each motor
tau_m = ${n(p.tau_m)};   % s
K_B = ${n(p.K_B)};   % rad/(N·m·s^2)
w2 = ${n(p.w2)};   % s^-2
Kp = ${n(p.Kp)}; Ki = ${n(p.Ki)}; Kd = ${n(p.Kd)};

%% Closed-loop transfer function theta(s)/theta_ref(s)
K   = 2*Km*K_B;                                   % two identical motors in parallel
num = K*[Kp Ki];
den = conv(conv([1 0],[tau_m 1]),[1 0 -w2]) + [0 0 K*Kd K*Kp K*Ki];
num = num/den(1); den = den/den(1);
G   = tf(num, den)

% cross-check by block-diagram reduction
s  = tf('s');
Cs = Kp + Ki/s;  Gm = 2*Km/(tau_m*s + 1);  Gb = K_B/(s^2 - w2);
Gin = feedback(Gm*Gb, Kd*s);                      % inner gyro-rate loop
G2  = minreal(feedback(Cs*Gin, 1));               % outer unity tilt loop
fprintf('max |G - G2| on j-axis: %.3g\\n', max(abs(squeeze(freqresp(G - G2, logspace(-1,3,200))))));

%% Controllable canonical form (companion row at the bottom)
n = numel(den) - 1;
A = [zeros(n-1,1) eye(n-1); -fliplr(den(2:end))];
B = [zeros(n-1,1); 1];
C = [fliplr(num) zeros(1, n - numel(num))];
D = 0;
disp(A); disp(B); disp(C);

%% Analysis
fprintf('rank(ctrb) = %d, rank(obsv) = %d, n = %d\\n', rank(ctrb(A,B)), rank(obsv(A,C)), n);
disp('eigenvalues of A:'); disp(eig(A));
fprintf('stable: %d\\n', all(real(eig(A)) < 0));
[nn, dd] = ss2tf(A, B, C, D);  disp('ss2tf check (should equal num/den):'); disp(nn); disp(dd);
`;
}
