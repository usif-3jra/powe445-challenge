/* POWE445 Self-Balancing Robot Challenge — student application */
import { createBackend } from './backend.js';
const C = window.Core, UI = window.UI, esc = UI.esc;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const parseNum = s => { s = String(s ?? '').trim().replace(/[−–]/g, '-').replace(/,/g, '.'); return s === '' ? NaN : Number(s); };

const S = { be: null, uid: null, rec: null, cfg: C.mergeConfig(null), p: null, view: null, stage: 1, unsub: null, hb: null, robot: null, simCache: {} };
const work = () => (S.rec && S.rec.work) || {};
const res = k => ((work().results || {})[k]) || {};
const STAGES = [
  { n: 1, t: 'System & G(s)', d: 'Closed-loop transfer function' },
  { n: 2, t: 'State space', d: 'Controllable canonical form' },
  { n: 3, t: 'Analysis', d: 'Controllability · observability · stability' },
  { n: 4, t: 'ML block', d: 'Dataset · Regression Learner · export' },
  { n: 5, t: 'Challenge', d: 'Disturbance test with ML in the loop' },
  { n: 6, t: 'Certificate', d: 'Marks and certificate' }
];
function unlocked(n) {
  const r = k => res(k).done;
  switch (n) {
    case 1: return true;
    case 2: return r('tf');
    case 3: return r('ss') && r('io');
    case 4: return r('qc') && r('qo') && r('qs');
    case 5: return unlocked(4) && r('ml');
    case 6: return unlocked(5) && r('sim');
  }
  return false;
}
const stageDone = n => ({ 1: ['tf'], 2: ['ss', 'io'], 3: ['qc', 'qo', 'qs'], 4: ['ml'], 5: ['sim'], 6: [] }[n]).every(k => res(k).done) && n < 6;
const save = patch => S.be.saveWork(S.uid, patch).catch(e => UI.toast('Save failed: ' + e.message, 'bad'));
const footer = () => `<div class="foot">POWE445 — CONTROL SYSTEMS II · ${C.VERSION} · CREATED BY YOUSSEF AJRA</div>`;

/* ================================================================== boot */
(async function boot() {
  try { S.be = await createBackend('student'); }
  catch (e) { app.innerHTML = `<div class="login-wrap"><div class="msg bad">Could not connect to the challenge server: ${esc(e.message)}</div></div>`; return; }
  S.be.watchConfig(c => { S.cfg = C.mergeConfig(c); if (S.view === 'login') renderLogin(); if (S.view === 'main') refreshChrome(); });
  const uid = await S.be.studentResume();
  if (uid) attach(uid); else renderLogin();
})();

function attach(uid) {
  S.uid = uid;
  if (S.unsub) S.unsub();
  S.unsub = S.be.watchStudent(uid, rec => {
    const prevStatus = S.rec && S.rec.status;
    S.rec = rec;
    if (!rec || !rec.profile) return renderLogin();
    if (!S.p || S.p._id !== rec.profile.id) { S.p = C.generateParams(rec.profile.id); S.p._id = rec.profile.id; }
    const st = rec.status || 'pending';
    if (st === 'approved') {
      if (S.view !== 'main' || prevStatus !== 'approved') renderMain(); else refreshChrome();
    } else if (st === 'rejected') renderRejected(); else renderWaiting();
  });
  clearInterval(S.hb);
  S.hb = setInterval(() => S.be.heartbeat(S.uid, S.view === 'main' ? S.stage : 0).catch(() => {}), 30000);
  S.be.heartbeat(S.uid, 0).catch(() => {});
}

/* ================================================================== login / waiting */
function shellHead() {
  return `<header class="topbar">${UI.logoHTML()}<div class="brand"><span class="course">POWE445 · CONTROL SYSTEMS II</span><span class="title">Self-Balancing Robot Control Challenge</span></div></header>`;
}
function renderLogin() {
  S.view = 'login';
  const open = S.cfg.sessionOpen !== false;
  app.innerHTML = `${shellHead()}
  <div class="login-wrap"><div class="login-card">
    <div class="sheet-label">SHEET 00 — ACCESS</div>
    <div class="art">
      <div class="mono small muted">FIG. 0 — PROTOTYPE, SIDE ELEVATION</div>
      ${UI.robotSketchSVG({ attrs: 'style="width:100%;height:auto"' })}
      <div class="small muted">Two-wheeled inverted pendulum · PI tilt control with gyroscope rate feedback · learned actuator model.</div>
    </div>
    <div class="form">
      <div class="login-head">${UI.logoHTML()}<div><div class="mono small muted">POWE445 — CONTROL SYSTEMS II</div><h1>Technical Assessment</h1></div></div>
      <p class="muted" style="margin:0">Sign in with your full name and university ID. The instructor admits each student from the control room.</p>
      <div><label for="fn">Full name (first · father · family)</label><input id="fn" type="text" autocomplete="name" placeholder="e.g. Ahmad Khaled Haddad"><div class="hint" id="fnh"></div></div>
      <div><label for="sid">Student ID</label><input id="sid" type="text" inputmode="numeric" maxlength="9" placeholder="20XXXXXXX"><div class="hint" id="sidh"></div></div>
      <button class="btn primary" id="go" ${open ? '' : 'disabled'}>REQUEST ACCESS →</button>
      ${open ? '' : '<div class="msg warn">The session is closed. Wait for the instructor to open it.</div>'}
      ${S.be && S.be.mode === 'local' ? '<div class="msg info small">Local demo mode: data stays in this browser. Configure Firebase in <code>js/config.js</code> for the live class.</div>' : ''}
      <div id="lerr"></div>
    </div>
  </div></div>${footer()}`;
  const fn = $('#fn'), sid = $('#sid');
  const v = () => {
    const a = C.validateName(fn.value), b = C.validateId(sid.value);
    fn.classList.toggle('invalid', !!fn.value && !a.ok); fn.classList.toggle('valid', a.ok);
    sid.classList.toggle('invalid', !!sid.value && !b.ok); sid.classList.toggle('valid', b.ok);
    $('#fnh').textContent = fn.value && !a.ok ? a.msg : ''; $('#fnh').className = 'hint' + (fn.value && !a.ok ? ' err' : '');
    $('#sidh').textContent = sid.value && !b.ok ? b.msg : ''; $('#sidh').className = 'hint' + (sid.value && !b.ok ? ' err' : '');
    return a.ok && b.ok ? { name: a.value, id: b.value } : null;
  };
  sid.addEventListener('input', () => { sid.value = sid.value.replace(/\D/g, '').slice(0, 9); v(); });
  fn.addEventListener('input', v);
  const go = async () => {
    const ok = v(); if (!ok) { $('#lerr').innerHTML = '<div class="msg bad">Check the highlighted fields.</div>'; return; }
    if (S.cfg.sessionOpen === false) return;
    $('#go').disabled = true;
    try {
      const uid = await S.be.studentSignIn();
      await S.be.requestAccess(uid, { name: ok.name, id: ok.id, requestedAt: Date.now() });
      attach(uid);
    } catch (e) { $('#go').disabled = false; $('#lerr').innerHTML = `<div class="msg bad">${esc(e.message)}</div>`; }
  };
  $('#go').addEventListener('click', go);
  [fn, sid].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
}
function renderWaiting() {
  S.view = 'waiting';
  const pr = S.rec.profile;
  app.innerHTML = `${shellHead()}<div class="login-wrap"><div class="sheet" style="max-width:640px;width:100%">
    <div class="sheet-label">SHEET 00 — WAITING ROOM</div>
    <h2><span class="wait-dot"></span>Waiting for instructor approval</h2>
    <p class="lead">Your request is in the control room. Keep this page open — it opens automatically as soon as you are accepted.</p>
    <dl class="kv"><dt>NAME</dt><dd>${esc(pr.name)}</dd><dt>ID</dt><dd>${esc(pr.id)}</dd><dt>REQUESTED</dt><dd>${new Date(pr.requestedAt).toLocaleTimeString()}</dd></dl>
    <div class="spacer"></div><canvas id="wcv"></canvas>
    <div class="spacer"></div><button class="btn sm" id="chg">Wrong details? Sign out</button>
  </div></div>${footer()}`;
  const rv = new UI.RobotView($('#wcv'), S.p, { height: 220 }); rv.setScene({ showTrack: false, L: 0.6 });
  let t0 = performance.now();
  const tick = () => { if (S.view !== 'waiting') return; const t = (performance.now() - t0) / 1000; rv.draw({ x: 0.3 + 0.02 * Math.sin(t * 0.8), th: 0.03 * Math.sin(t * 2.1) * Math.exp(-0.02 * t) + 0.004 * Math.sin(t * 7), t }); requestAnimationFrame(tick); };
  tick();
  $('#chg').onclick = signOut;
}
function renderRejected() {
  S.view = 'rejected';
  app.innerHTML = `${shellHead()}<div class="login-wrap"><div class="sheet" style="max-width:560px">
    <div class="sheet-label">SHEET 00 — ACCESS</div><h2>Access not granted</h2>
    <p class="lead">The instructor did not admit this request. Check your name and ID with the instructor, then sign in again.</p>
    <button class="btn" id="chg">Sign out</button></div></div>${footer()}`;
  $('#chg').onclick = signOut;
}
async function signOut() { if (S.unsub) S.unsub(); S.unsub = null; S.rec = null; clearInterval(S.hb); await S.be.studentSignOut(); renderLogin(); }

/* ================================================================== main shell */
function renderMain() {
  S.view = 'main';
  const pr = S.rec.profile;
  app.innerHTML = `<header class="topbar">${UI.logoHTML()}<div class="brand"><span class="course">POWE445 · CONTROL SYSTEMS II</span><span class="title">Self-Balancing Robot Control Challenge</span></div>
      <div class="who"><b>${esc(pr.name)}</b><span class="mono">${esc(pr.id)}</span> <span class="pill ok">ADMITTED</span></div></header>
    <div class="shell"><nav class="stepper" id="stepper"></nav><main id="stage"></main></div>
    <div class="titleblock"><div><span>PROJECT</span>SELF-BALANCING ROBOT CONTROL CHALLENGE</div><div><span>COURSE</span>POWE445 — CONTROL SYSTEMS II</div><div><span>CREATED BY</span>YOUSSEF AJRA</div><div><span>REV</span>${C.VERSION}</div><div><span>SHEET</span><b id="sheetno">1 / 6</b></div></div>
    ${footer()}`;
  let target = 1; for (let n = 1; n <= 6; n++) if (unlocked(n)) target = n;
  S.stage = Math.min(target, 6);
  refreshChrome(); go(S.stage);
}
function refreshChrome() {
  if (S.view !== 'main') return;
  const mk = C.computeMarks(work().results, S.rec.overrides, S.cfg);
  $('#stepper').innerHTML = STAGES.map(s => {
    const lk = !unlocked(s.n), dn = stageDone(s.n);
    return `<button class="step ${S.stage === s.n ? 'active' : ''} ${lk ? 'locked' : ''} ${dn ? 'done' : ''}" data-n="${s.n}" ${lk ? 'disabled' : ''}>
      <span class="num">${dn ? '✓' : s.n}</span><span>${s.t}<small>${s.d}</small></span></button>`;
  }).join('') + `<div class="scorebox"><div class="muted">MARKS</div><div class="big">${fmtM(mk.earned)} / ${fmtM(mk.total)}</div><div>${mk.pct.toFixed(1)} %</div><div class="bar"><i style="width:${mk.pct}%"></i></div>
    <button class="btn sm" id="sbrep" style="margin-top:10px;width:100%;justify-content:center">⬇ Full report (PDF)</button>
    <div class="small muted" style="margin-top:8px">Robot ID-seed: ${esc(S.rec.profile.id)}<br>Parameters are unique to you.</div></div>`;
  $$('#stepper .step').forEach(b => b.onclick = () => { if (!b.disabled) go(+b.dataset.n); });
  $('#sbrep').onclick = () => openReport();
  $('#sheetno').textContent = `${S.stage} / 6`;
}
const fmtM = x => (Math.round(x * 10) / 10).toString();
function go(n) {
  if (!unlocked(n)) return;
  if (S.robot) { S.robot.stop(); S.robot = null; }
  S.stage = n; refreshChrome();
  S.be.heartbeat(S.uid, n).catch(() => {});
  const el = $('#stage');
  ({ 1: stage1, 2: stage2, 3: stage3, 4: stage4, 5: stage5, 6: stage6 })[n](el);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
const nextBtn = n => unlocked(n) ? `<button class="btn accent" data-next="${n}">Continue to stage ${n} →</button>` : '';
function wireNext(el) { $$('[data-next]', el).forEach(b => b.onclick = () => go(+b.dataset.next)); }
const attemptsLeft = (k) => Math.max(0, (S.cfg.attempts[k] || 3) - (res(k).attempts || 0));

/* ================================================================== stage 1 */
function paramTable(p) {
  return `<table class="spec"><tr><th>BLOCK</th><th>PARAMETER</th><th>VALUE</th><th>UNIT</th></tr>
    <tr><td rowspan="2">PI controller C(s)</td><td>Kp</td><td class="num">${C.fmt(p.Kp)}</td><td>V/rad</td></tr>
    <tr><td>Ki</td><td class="num">${C.fmt(p.Ki)}</td><td>V/(rad·s)</td></tr>
    <tr><td rowspan="2">DC motor + driver (×2, identical, in parallel)</td><td>Km</td><td class="num">${C.fmt(p.Km)}</td><td>N·m/V (each)</td></tr>
    <tr><td>τm</td><td class="num">${C.fmt(p.tau_m)}</td><td>s</td></tr>
    <tr><td rowspan="2">Robot body G_B(s)</td><td>K_B</td><td class="num">${C.fmt(p.K_B)}</td><td>rad/(N·m·s²)</td></tr>
    <tr><td>ωp²</td><td class="num">${C.fmt(p.w2)}</td><td>s⁻²</td></tr>
    <tr><td>Gyroscope path</td><td>Kd</td><td class="num">${C.fmt(p.Kd)}</td><td>V·s/rad</td></tr>
    <tr><td>Tilt estimator</td><td>Hθ</td><td class="num">1</td><td>—</td></tr></table>`;
}
function datasheet(p) {
  return `<details><summary class="mono small" style="cursor:pointer">ROBOT DATASHEET (where the block values come from)</summary>
    <table class="spec" style="margin-top:8px"><tr><th>QUANTITY</th><th>VALUE</th></tr>
    <tr><td>Body mass m</td><td class="num">${p.m_b} kg</td></tr><tr><td>Axle → centre of mass l</td><td class="num">${p.l} m</td></tr>
    <tr><td>Body inertia about COM J_b</td><td class="num">${p.J_b} kg·m²</td></tr><tr><td>Wheel radius r · mass m_w (each)</td><td class="num">${p.r} m · ${p.m_w} kg</td></tr>
    <tr><td>Effective pitch inertia J_e = J_p − (m l)²/M_a</td><td class="num">${C.fmt(p.J_e, 4)} kg·m²</td></tr>
    <tr><td>K_B = (1 + m l/(r M_a)) / J_e ,  ωp² = m g l / J_e</td><td class="num">${C.fmt(p.K_B)} , ${C.fmt(p.w2)}</td></tr></table>
    <p class="small muted">Linearised wheeled inverted pendulum about the upright position (wheel translation eliminated). Use the block values in the table above for the exercise.</p></details>`;
}
function stage1(el) {
  const p = S.p, r = res('tf');
  el.innerHTML = `
  <section class="sheet"><div class="sheet-label">SHEET 01 — SYSTEM MODEL</div>
    <h2>Self-balancing robot: closed-loop pitch control</h2>
    <p class="lead">The robot is an unstable inverted pendulum on two wheels. A PI controller acts on the tilt error; the gyroscope's rate signal is fed back through K<sub>d</sub> to damp the motion. Both wheel motors receive the same command, so they act in parallel.</p>
    <div class="canvas-wrap"><canvas id="cv1"></canvas></div><div class="legend"><span><i style="border-color:#0d2b55"></i>robot — model-based preview (ideal actuator, flat floor, no disturbance)</span><span><i style="border-color:#0b6bd3;border-top-style:dashed"></i>planned position</span></div>
    <div class="grid2" style="margin-top:16px">
      <div>${paramTable(p)}</div>
      <div>${datasheet(p)}<div class="msg info small" style="margin-top:12px">The robot moves from A to B and back by changing θref (lean forward to accelerate). The position planner that generates θref is given; your task is the inner tilt loop from θref to θ.</div></div>
    </div>
    <h3>Block diagram</h3>
    ${UI.blockDiagram(p, {})}
  </section>
  <section class="sheet"><div class="sheet-label">TASK 1 — CLOSED-LOOP TRANSFER FUNCTION</div>
    <h2>Find G(s) = θ(s) / θ<sub>ref</sub>(s)</h2>
    <p class="lead">Reduce the block diagram with D(s) = 0. Enter the coefficients of the numerator and denominator in descending powers of s. Use the + / − buttons to set each order. Any common scaling of numerator and denominator is accepted; numeric tolerance ±${S.cfg.tolPct}%.</p>
    <div id="tfed"></div>
    <div class="preview" id="tfprev"></div>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="tfsub">SUBMIT G(s)</button><span class="mono small muted" id="tfatt"></span><span class="grow"></span>${nextBtn(2)}</div>
    <div id="tfmsg"></div>
  </section>`;
  // preview animation
  const sc = { ...C.scenario({ mode: 'push', pushN: 0 }) };
  const run = cachedSim('demo', () => C.simulate(p, sc, 'ideal', { record: 40 }));
  S.robot = new UI.RobotView($('#cv1', el), p, { height: 330 }); S.robot.setScene({ slopeDeg: 0, L: sc.L });
  const loop = () => S.robot && S.robot.play(run.out, { speed: 1.5, onEnd: () => setTimeout(() => S.robot && loop(), 600) }); loop();
  // editor
  const ans = r.answer || { num: [NaN], den: [NaN, NaN] };
  const st = { num: ans.num.slice(), den: ans.den.slice() };
  const locked = !!r.done;
  const draw = () => {
    $('#tfed', el).innerHTML = ['num', 'den'].map(k => `<div class="polyrow"><div><b>${k === 'num' ? 'Numerator N(s)' : 'Denominator D(s)'}</b></div>
      <div class="order">order <button class="btn stepbtn" data-k="${k}" data-d="-1" ${locked ? 'disabled' : ''}>−</button><b>${st[k].length - 1}</b><button class="btn stepbtn" data-k="${k}" data-d="1" ${locked ? 'disabled' : ''}>+</button></div>
      <div class="coefs">${st[k].map((v, i) => `<div class="coef"><input type="text" data-k="${k}" data-i="${i}" value="${isFinite(v) ? v : ''}" ${locked ? 'disabled' : ''} placeholder="0"><span>s${st[k].length - 1 - i > 0 ? '^' + (st[k].length - 1 - i) : '^0'}</span></div>`).join('')}</div></div>`).join('');
    $$('#tfed input', el).forEach(inp => inp.oninput = () => { st[inp.dataset.k][+inp.dataset.i] = parseNum(inp.value); prev(); });
    $$('#tfed .stepbtn', el).forEach(b => b.onclick = () => {
      const k = b.dataset.k, d = +b.dataset.d, a = st[k];
      if (d > 0 && a.length < 9) a.unshift(NaN); if (d < 0 && a.length > (k === 'den' ? 2 : 1)) a.shift();
      draw(); prev();
    });
  };
  const prev = () => { $('#tfprev', el).innerHTML = `G(s) = ${UI.fracHTML(st.num, st.den)}`; };
  draw(); prev();
  const showState = () => {
    const rr = res('tf');
    $('#tfatt', el).textContent = rr.done ? '' : `attempts left: ${attemptsLeft('tf')}`;
    if (rr.done) {
      const ref = C.closedLoopTF(p);
      $('#tfmsg', el).innerHTML = rr.correct
        ? `<div class="msg ok">✔ Correct — ${fmtM(S.cfg.weights.tf)} marks. G(s) is 4th order: one pole from the PI integrator, one from the motor lag, two from the pendulum.</div>`
        : `<div class="msg bad">✘ No attempts left. The correct (monic) closed-loop transfer function is shown below; continue with it.<div class="preview" style="margin-top:8px">G(s) = ${UI.fracHTML(ref.num, ref.den)}</div></div>`;
      $('#tfsub', el).disabled = true;
    }
  };
  showState();
  $('#tfsub', el).onclick = async () => {
    if (res('tf').done) return;
    if ([...st.num, ...st.den].some(v => !isFinite(v))) { $('#tfmsg', el).innerHTML = '<div class="msg warn">Fill every coefficient (use 0 where a power is absent).</div>'; return; }
    const chk = C.checkTF(st, p, S.cfg.tolPct);
    const att = (res('tf').attempts || 0) + 1;
    const done = chk.ok || att >= (S.cfg.attempts.tf || 3);
    await save({ 'results/tf': { done, correct: chk.ok, attempts: att, answer: { num: st.num, den: st.den }, at: Date.now() } });
    stage1(el); refreshChrome();
    if (!done) $('#tfmsg', el).innerHTML = `<div class="msg bad">✘ ${esc(chk.msg)} Try again.</div>`;
  };
  wireNext(el);
}
function cachedSim(key, fn) { const k = key + '|' + S.p._id; return S.simCache[k] || (S.simCache[k] = fn()); }

/* ================================================================== stage 2 */
const SIG_KEYS = Object.keys(UI.SIGNALS);
function stage2(el) {
  const p = S.p, ref = C.closedLoopTF(p), rs = res('ss'), ri = res('io');
  const prevAns = rs.answer;
  const st = prevAns ? JSON.parse(JSON.stringify(prevAns)) : { n: 2, m: 1, q: 1, A: [[NaN, NaN], [NaN, NaN]], B: [[NaN], [NaN]], C: [[NaN, NaN]], D: [[NaN]] };
  let io = ri.answer || { u: '', y: '' };
  const lockS = !!rs.done, lockI = !!ri.done;
  el.innerHTML = `
  <section class="sheet"><div class="sheet-label">SHEET 02 — STATE-SPACE REALISATION</div>
    <h2>Controllable canonical form (CCF)</h2>
    <p class="lead">Realise your closed-loop G(s) as ẋ = A x + B u, y = C x + D u in controllable canonical (companion) form. Set the number of states, inputs and outputs, fill every element, and identify the physical input and output signals. Either standard CCF convention (companion row at the bottom with B = [0 … 0 1]ᵀ, or at the top with B = [1 0 … 0]ᵀ) is accepted.</p>
    <div class="preview">G(s) = ${UI.fracHTML(ref.num, ref.den)}</div>
    <div class="dims">${[['n', 'states n'], ['m', 'inputs m'], ['q', 'outputs p']].map(([k, l]) => `<div class="order">${l} <button class="btn stepbtn" data-dim="${k}" data-d="-1" ${lockS ? 'disabled' : ''}>−</button><b>${st[k]}</b><button class="btn stepbtn" data-dim="${k}" data-d="1" ${lockS ? 'disabled' : ''}>+</button></div>`).join('')}</div>
    <div class="matrices" id="mats"></div>
    <h3>Input and output of the realisation</h3>
    <div class="grid2"><div><label>Input u(t) is</label><select id="selu" ${lockI ? 'disabled' : ''}><option value="">— choose a signal —</option>${SIG_KEYS.map(k => `<option value="${k}" ${io.u === k ? 'selected' : ''}>${esc(UI.SIGNALS[k].label)}</option>`).join('')}</select></div>
    <div><label>Output y(t) is</label><select id="sely" ${lockI ? 'disabled' : ''}><option value="">— choose a signal —</option>${SIG_KEYS.map(k => `<option value="${k}" ${io.y === k ? 'selected' : ''}>${esc(UI.SIGNALS[k].label)}</option>`).join('')}</select></div></div>
    <div class="spacer"></div><div id="iodiag"></div>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="sssub">SUBMIT STATE SPACE</button><span class="mono small muted" id="ssatt"></span><span class="grow"></span>${nextBtn(3)}</div>
    <div id="ssmsg"></div>
  </section>`;
  const resize = () => {
    const fit = (M, r, c) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (M[i] && M[i][j] !== undefined ? M[i][j] : NaN)));
    st.A = fit(st.A, st.n, st.n); st.B = fit(st.B, st.n, st.m); st.C = fit(st.C, st.q, st.n); st.D = fit(st.D, st.q, st.m);
  };
  const drawM = () => {
    resize();
    const g = (name, M) => `<div class="matrix"><span class="name">${name} =</span><div class="mbracket"><div class="mgrid" style="grid-template-columns:repeat(${M[0].length},auto)">${M.map((row, i) => row.map((v, j) => `<input type="text" data-m="${name}" data-i="${i}" data-j="${j}" value="${isFinite(v) ? v : ''}" placeholder="0" ${lockS ? 'disabled' : ''}>`).join('')).join('')}</div></div></div>`;
    $('#mats', el).innerHTML = g('A', st.A) + g('B', st.B) + g('C', st.C) + g('D', st.D);
    $$('#mats input', el).forEach(inp => inp.oninput = () => { st[inp.dataset.m][+inp.dataset.i][+inp.dataset.j] = parseNum(inp.value); });
    $$('.dims b', el).forEach((b, i) => b.textContent = st[['n', 'm', 'q'][i]]);
  };
  drawM();
  $$('[data-dim]', el).forEach(b => b.onclick = () => { const k = b.dataset.dim, d = +b.dataset.d, max = k === 'n' ? 8 : 3; st[k] = Math.max(1, Math.min(max, st[k] + d)); drawM(); });
  const drawIO = () => { $('#iodiag', el).innerHTML = UI.blockDiagram(p, { u: io.u, y: io.y }); };
  drawIO();
  $('#selu', el).onchange = e => { io.u = e.target.value; drawIO(); };
  $('#sely', el).onchange = e => { io.y = e.target.value; drawIO(); };
  const showState = () => {
    const a = res('ss'), b = res('io'); const msgs = [];
    $('#ssatt', el).textContent = (a.done && b.done) ? '' : `attempts left — matrices: ${a.done ? '✓' : attemptsLeft('ss')} · signals: ${b.done ? '✓' : attemptsLeft('io')}`;
    if (a.done) msgs.push(a.correct ? `<div class="msg ok">✔ State-space matrices correct — ${fmtM(S.cfg.weights.ss)} marks.</div>`
      : `<div class="msg bad">✘ No attempts left for the matrices. A correct CCF is:<div class="matrices" style="margin-top:8px">${(() => { const R = C.ccf(ref.num, ref.den, 'bottom'); return ['A', 'B', 'C', 'D'].map(k => `<div class="matrix"><span class="name">${k} =</span>${UI.matHTML(R[k])}</div>`).join(''); })()}</div></div>`);
    if (b.done) msgs.push(b.correct ? `<div class="msg ok">✔ Input u = θref(t) and output y = θ(t) — ${fmtM(S.cfg.weights.io)} marks.</div>`
      : `<div class="msg bad">✘ No attempts left for the signals. G(s) = θ(s)/θref(s), so u(t) = θref(t) and y(t) = θ(t).</div>`);
    if (msgs.length) $('#ssmsg', el).innerHTML = msgs.join('');
    $('#sssub', el).disabled = a.done && b.done;
  };
  showState();
  $('#sssub', el).onclick = async () => {
    const patch = {}; const fb = [];
    if (!res('ss').done) {
      const all = [...st.A.flat(), ...st.B.flat(), ...st.C.flat(), ...st.D.flat()];
      if (all.some(v => !isFinite(v))) { $('#ssmsg', el).innerHTML = '<div class="msg warn">Fill every matrix element (use 0 for zeros).</div>'; return; }
      const chk = C.checkSS(st, p, S.cfg.tolPct, S.cfg.ccfConventions);
      const att = (res('ss').attempts || 0) + 1, done = chk.ok || att >= (S.cfg.attempts.ss || 3);
      patch['results/ss'] = { done, correct: chk.ok, attempts: att, answer: st, conv: chk.conv || null, at: Date.now() };
      if (!chk.ok && !done) fb.push(chk.msg);
    }
    if (!res('io').done) {
      if (!io.u || !io.y) { $('#ssmsg', el).innerHTML = '<div class="msg warn">Choose both the input and the output signal.</div>'; return; }
      const ok = io.u === 'theta_ref' && io.y === 'theta';
      const att = (res('io').attempts || 0) + 1, done = ok || att >= (S.cfg.attempts.io || 2);
      patch['results/io'] = { done, correct: ok, attempts: att, answer: io, at: Date.now() };
      if (!ok && !done) fb.push('Input/output signals are not the ones of G(s).');
    }
    await save(patch);
    stage2(el); refreshChrome();
    if (fb.length) $('#ssmsg', el).insertAdjacentHTML('afterbegin', `<div class="msg bad">✘ ${fb.map(esc).join(' ')} Try again.</div>`);
  };
  wireNext(el);
}

/* ================================================================== stage 3 */
function systemForAnalysis() {
  const rs = res('ss'), ref = C.closedLoopTF(S.p);
  if (rs.correct && rs.answer) return { A: rs.answer.A, B: rs.answer.B, C: rs.answer.C, src: 'your submitted CCF' };
  const R = C.ccf(ref.num, ref.den, 'bottom'); return { ...R, src: 'the reference CCF' };
}
function stage3(el) {
  const sys = systemForAnalysis();
  const keys = [['qc', 'Is the system controllable?'], ['qo', 'Is the system observable?'], ['qs', 'Is the closed-loop system stable?']];
  const done = keys.every(([k]) => res(k).done);
  const ranRec = work().analysisRun;
  el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET 03 — ANALYSIS</div>
    <h2>Controllability, observability and stability</h2>
    <p class="lead">The test bench analyses ${sys.src}. Run it, read the ranks of the controllability matrix 𝒞 = [B AB A²B …] and the observability matrix 𝒪 = [C; CA; CA²; …], and the eigenvalues of A. Then answer the three questions (one attempt each).</p>
    <div class="matrices"><div class="matrix"><span class="name">A =</span>${UI.matHTML(sys.A)}</div><div class="matrix"><span class="name">B =</span>${UI.matHTML(sys.B)}</div><div class="matrix"><span class="name">C =</span>${UI.matHTML(sys.C)}</div></div>
    <div class="row" style="margin-top:14px"><button class="btn accent" id="run">▶ RUN ANALYSIS</button></div>
    <div id="anres"></div>
    <h3>Questions</h3>
    <div id="qs">${keys.map(([k, q]) => {
      const r = res(k); const a = r.answer;
      return `<div class="question"><span>${q}</span><div class="yn">${['yes', 'no'].map(v => `<label><input type="radio" name="${k}" value="${v}" ${a === v ? 'checked' : ''} ${r.done ? 'disabled' : ''}> ${v.toUpperCase()}</label>`).join('')}</div>
        <span>${r.done ? (r.correct ? `<span class="pill ok">✔ +${fmtM(S.cfg.weights[k])}</span>` : '<span class="pill bad">✘ 0</span>') : ''}</span></div>`;
    }).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="qsub" ${done ? 'disabled' : ''}>SUBMIT ANSWERS</button><span class="grow"></span>${nextBtn(4)}</div>
    <div id="qmsg"></div></section>`;
  const show = () => {
    const an = C.analyse(sys.A, sys.B, sys.C);
    $('#anres', el).innerHTML = `<div class="grid2" style="margin-top:16px">
      <div><h3>Controllability matrix 𝒞</h3>${UI.matHTML(an.Mc, 4)}<p class="mono">rank(𝒞) = <b>${an.rc}</b> &nbsp; (n = ${an.n})</p>
        <h3>Observability matrix 𝒪</h3>${UI.matHTML(an.Mo, 4)}<p class="mono">rank(𝒪) = <b>${an.ro}</b> &nbsp; (n = ${an.n})</p></div>
      <div><h3>Eigenvalues of A</h3><table class="spec">${an.eig.map((z, i) => `<tr><td class="mono">λ${i + 1}</td><td class="num">${C.fmt(z[0], 5)} ${z[1] ? (z[1] > 0 ? '+ ' : '− ') + C.fmt(Math.abs(z[1]), 5) + ' j' : ''}</td></tr>`).join('')}</table>
        <div class="spacer"></div>${UI.eigPlotSVG(an.eig)}</div></div>`;
    return an;
  };
  if (ranRec) show();
  $('#run', el).onclick = () => { show(); if (!work().analysisRun) save({ analysisRun: Date.now() }); };
  $('#qsub', el).onclick = async () => {
    if (!work().analysisRun) { $('#qmsg', el).innerHTML = '<div class="msg warn">Run the analysis first.</div>'; return; }
    const ans = Object.fromEntries(keys.map(([k]) => [k, ($(`input[name=${k}]:checked`, el) || {}).value]));
    if (keys.some(([k]) => !ans[k])) { $('#qmsg', el).innerHTML = '<div class="msg warn">Answer all three questions.</div>'; return; }
    const an = C.analyse(sys.A, sys.B, sys.C);
    const truth = { qc: an.rc === an.n ? 'yes' : 'no', qo: an.ro === an.n ? 'yes' : 'no', qs: an.stable ? 'yes' : 'no' };
    const patch = {}; keys.forEach(([k]) => patch['results/' + k] = { done: true, correct: ans[k] === truth[k], answer: ans[k], attempts: 1, at: Date.now() });
    await save(patch); stage3(el); refreshChrome();
  };
  wireNext(el);
}

/* ================================================================== stage 4 */
const modelKey = () => 'powe445_model_' + S.rec.profile.id;
function loadModel() { try { const j = JSON.parse(localStorage.getItem(modelKey())); return j ? C.makeGridModel(j) : null; } catch { return null; } }
function stage4(el) {
  const p = S.p, r = res('ml'), N = Math.max(3000, Math.min(5000, Number(S.cfg.datasetN) || 4000));
  el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET 04 — MACHINE-LEARNING BLOCK</div>
    <h2>Why the robot needs an ML block</h2>
    <p class="lead">Your G(s) assumes an ideal motor: torque = K<sub>m</sub>·V. The real H-bridge and gear-motors are not ideal: a <b>dead-zone</b> of a few hundred millivolts, <b>back-EMF</b> that eats voltage as the wheels spin, and a <b>battery</b> whose voltage drops during the run. A plain PI controller on the real motors loses balance as soon as the robot moves. The ML block learns the inverse of the real actuator: given the voltage the controller wants (V<sub>cmd</sub>), the motor speed and the battery voltage, it outputs the PWM duty that makes the real motor behave like the ideal block in your diagram.</p>
    ${UI.blockDiagram(p, { showML: true })}
    <h3>Dataset (bench test of your robot's motors)</h3>
    <table class="spec"><tr><th>ROLE</th><th>VARIABLE (CSV column)</th><th>MEANING</th><th>UNIT</th><th>RANGE</th></tr>
      <tr><td>feature</td><td class="mono">V_cmd</td><td>voltage the controller wants at the motor (ideal-model voltage)</td><td>V</td><td class="mono">−10 … 10</td></tr>
      <tr><td>feature</td><td class="mono">omega_m</td><td>motor shaft speed relative to the chassis (wheel encoder)</td><td>rad/s</td><td class="mono">−25 … 25</td></tr>
      <tr><td>feature</td><td class="mono">V_bat</td><td>battery voltage (ADC)</td><td>V</td><td class="mono">10.0 … 12.6</td></tr>
      <tr><td><b>label</b></td><td class="mono"><b>duty</b></td><td>PWM duty cycle that produces the ideal torque K<sub>m</sub>·V<sub>cmd</sub> (saturates at ±1)</td><td>—</td><td class="mono">−1 … 1</td></tr></table>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="dl">⬇ DOWNLOAD DATASET (${N} rows, CSV)</button>
      <a class="btn" href="matlab/exportModelForWeb.m" download>⬇ MATLAB EXPORT SCRIPT</a></div>
    <h3>Procedure in MATLAB</h3>
    <ol class="steps-list">
      <li>Import the data: <code>data = readtable('POWE445_dataset_${esc(S.rec.profile.id)}.csv');</code></li>
      <li>Open <b>Apps → Regression Learner</b> → New Session → From Workspace → <code>data</code>. Response: <code>duty</code>; predictors: <code>V_cmd, omega_m, V_bat</code>. Keep 5-fold cross-validation (or 20 % hold-out).</li>
      <li>In the Models gallery choose <b>All</b> and press <b>Train All</b>. Compare validation RMSE and R² and decide which model is best. Look at the Response plot and the Predicted-vs-Actual plot — the dead-zone appears as a jump at V<sub>cmd</sub> + K<sub>e</sub>ω = 0.</li>
      <li>Select your best model → <b>Export → Export Model</b> → keep the name <code>trainedModel</code>.</li>
      <li>Put <code>exportModelForWeb.m</code> in the current folder and run <code>exportModelForWeb(trainedModel, '${esc(S.rec.profile.id)}')</code>. It writes <code>POWE445_model_${esc(S.rec.profile.id)}.json</code>.</li>
      <li>Upload the JSON below. It is validated on a hidden test set generated from your robot.</li></ol>
    <h3>Upload trained model</h3>
    <div class="row"><input type="file" id="mf" accept=".json,application/json" class="btn"><span class="mono small muted">pass mark: R² ≥ ${S.cfg.r2Min} on the hidden test set</span></div>
    <div id="mlres"></div>
    <div class="row" style="margin-top:14px"><span class="grow"></span>${nextBtn(5)}</div></section>`;
  $('#dl', el).onclick = () => { UI.download(`POWE445_dataset_${S.rec.profile.id}.csv`, C.datasetCSV(C.generateDataset(p, S.rec.profile.id, N)), 'text/csv'); save({ datasetAt: Date.now() }); };
  const showRes = (info, model) => {
    const ok = info.r2 >= S.cfg.r2Min;
    $('#mlres', el).innerHTML = `<div class="grid3" style="margin-top:12px">
        <div class="metric"><span>MODEL</span><b style="font-size:15px">${esc(info.modelType || '—')}</b></div>
        <div class="metric"><span>R² (HIDDEN TEST)</span><b>${info.r2.toFixed(4)}</b></div>
        <div class="metric"><span>RMSE (DUTY)</span><b>${info.rmse.toFixed(4)}</b></div></div>
      <div class="msg ${ok ? 'ok' : 'warn'}">${ok ? `✔ Validation passed${res('ml').correct ? ` — ${fmtM(S.cfg.weights.ml)} marks.` : '.'}` : `Validation R² is below ${S.cfg.r2Min}. You can still test it in the challenge, but the ML marks need a better model — compare more model types.`}</div>
      ${model ? '<div class="spacer"></div><canvas id="slice"></canvas><div class="legend"><span><i style="border-color:#0d2b55"></i>true inverse (ω = 0)</span><span><i style="border-color:#0b6bd3"></i>your model (ω = 0)</span><span><i style="border-color:#0f7a55;border-top-style:dashed"></i>true (ω = 12 rad/s)</span><span><i style="border-color:#b8322a;border-top-style:dashed"></i>model (ω = 12 rad/s)</span><span>V_bat = 11.1 V</span></div>' : ''}`;
    if (model) {
      const xs = Array.from({ length: 241 }, (_, i) => -6 + i * 0.05);
      UI.plot($('#slice', el), xs, [
        { data: xs.map(v => C.trueDuty(p, v, 0, 11.1)), color: '#0d2b55' }, { data: xs.map(v => model(v, 0, 11.1)), color: '#0b6bd3' },
        { data: xs.map(v => C.trueDuty(p, v, 12, 11.1)), color: '#0f7a55', dash: [5, 4] }, { data: xs.map(v => model(v, 12, 11.1)), color: '#b8322a', dash: [5, 4] }],
        { height: 230, title: 'duty vs V_cmd [V] — model slice', ylim: [-0.7, 0.9] });
    }
  };
  const existing = loadModel();
  if (r.done) showRes({ r2: r.r2, rmse: r.rmse, modelType: r.modelType }, existing);
  $('#mf', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.format !== 'POWE445-ML-GRID-v1') throw new Error('Not a POWE445 model file. Export it with exportModelForWeb.m.');
      if (String(j.studentId) !== String(S.rec.profile.id)) throw new Error(`This model was exported for ID ${j.studentId}. Train on your own dataset and export with your ID.`);
      const model = C.makeGridModel(j);
      const v = C.validateModel(p, S.rec.profile.id, model);
      localStorage.setItem(modelKey(), JSON.stringify(j));
      const prev = res('ml'); const ok = v.r2 >= S.cfg.r2Min;
      const best = !prev.done || v.r2 > (prev.r2 ?? -Infinity);
      await save({ 'results/ml': { done: true, correct: !!(prev.correct || ok), r2: best ? v.r2 : prev.r2, rmse: best ? v.rmse : prev.rmse, modelType: j.modelType || 'unknown', lastR2: v.r2, attempts: (prev.attempts || 0) + 1, slice: best ? Report.packSlice(model) : (prev.slice || Report.packSlice(model)), at: Date.now() } });
      refreshChrome(); showRes({ r2: v.r2, rmse: v.rmse, modelType: j.modelType }, model);
      if (!$('[data-next="5"]', el) && unlocked(5)) { $('#mlres', el).insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:10px">${nextBtn(5)}</div>`); wireNext(el); }
    } catch (err) { $('#mlres', el).innerHTML = `<div class="msg bad">✘ ${esc(err.message)}</div>`; }
  };
  wireNext(el);
}

/* ================================================================== stage 5 */
function stage5(el) {
  const p = S.p, d = S.cfg.disturbance, sc = C.scenario(d), th = S.cfg.thresholds;
  const model = loadModel(); const r = res('sim');
  const modeTxt = { incline: `inclined surface α = ${sc.slopeDeg}°`, push: `lateral pushes F = ${sc.pushN} N (0.1 s)`, both: `inclined surface α = ${sc.slopeDeg}° and lateral pushes F = ${sc.pushN} N` }[sc.mode];
  el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET 05 — CHALLENGE TEST</div>
    <h2>Point-to-point run under disturbance</h2>
    <p class="lead">Test set by the instructor: <b>${modeTxt}</b>. The robot starts balanced at A, drives to B (L = ${sc.L} m) at t = 1–5 s, holds, returns to A at t = 9–13 s and holds until t = ${sc.Tend} s. ${sc.pushN ? 'Pushes hit the body at t = 6 s (from the right) and t = 14 s (from the left).' : ''} Battery: ${sc.Vbat} V. The <b>Balance Index</b> compares your run with an exactly compensated robot (100 = as good as the reference).</p>
    <div class="row"><button class="btn" id="runpi">▶ RUN PI ONLY (no ML)</button><button class="btn accent" id="runml" ${model ? '' : 'disabled'}>▶ RUN PI + ML BLOCK</button>
      ${model ? `<span class="mono small muted">model: ${esc(model.meta.modelType || '')}</span>` : '<span class="msg warn small">Upload a model in stage 4 first.</span>'}</div>
    <div class="spacer"></div>
    <div class="canvas-wrap"><canvas id="cv5"></canvas></div>
    <div class="grid2" style="margin-top:12px"><div><canvas id="pth"></canvas><div class="legend"><span><i style="border-color:#0d2b55"></i>θ [deg]</span><span><i style="border-color:#0b6bd3;border-top-style:dashed"></i>θref [deg]</span></div></div>
      <div><canvas id="px"></canvas><div class="legend"><span><i style="border-color:#0d2b55"></i>x [m]</span><span><i style="border-color:#0b6bd3;border-top-style:dashed"></i>planned x [m]</span><span><i style="border-color:#b8322a"></i>duty</span></div></div></div>
    <div id="simres"></div>
    <div class="row" style="margin-top:14px"><span class="grow"></span>${nextBtn(6)}</div></section>`;
  S.robot = new UI.RobotView($('#cv5', el), p, { height: 360 }); S.robot.setScene({ slopeDeg: sc.slopeDeg, L: sc.L });
  const blankPlots = () => { const t = [0, sc.Tend]; UI.plot($('#pth', el), t, [{ data: [0, 0] }], { height: 190, title: 'tilt' }); UI.plot($('#px', el), t, [{ data: [0, 0] }], { height: 190, title: 'position' }); };
  blankPlots();
  const play = (run, label) => {
    const o = run.out, deg = o.th.map(v => v * 57.2958), degr = o.thref.map(v => v * 57.2958);
    S.robot.play(o, { speed: 1.6, onFrame: i => {
      if (i % 3) return;
      UI.plot($('#pth', el), o.t, [{ data: deg }, { data: degr, color: '#0b6bd3', dash: [5, 4] }], { height: 190, title: 'tilt θ [deg] — ' + label, upto: i, ylim: [Math.min(-6, ...deg.map(v => Math.max(v, -40))), Math.max(6, ...deg.map(v => Math.min(v, 40)))] });
      UI.plot($('#px', el), o.t, [{ data: o.x }, { data: o.xr, color: '#0b6bd3', dash: [5, 4] }, { data: o.duty, color: '#b8322a', width: 1 }], { height: 190, title: 'position x [m] · duty', upto: i, ylim: [-1, Math.max(1.4, sc.L + 0.2)] });
    } });
  };
  const showMetrics = (m, label, verdict) => {
    $('#simres', el).innerHTML = `<h3>${label}</h3><div class="grid3">
      <div class="metric"><span>BALANCE INDEX</span><b>${m.index.toFixed(1)}</b></div><div class="metric"><span>RMS TILT</span><b>${m.rmsTiltDeg.toFixed(2)}°</b></div><div class="metric"><span>MAX TILT</span><b>${m.maxTiltDeg.toFixed(2)}°</b></div>
      <div class="metric"><span>RMS TRACKING ERROR</span><b>${m.rmsPosErr.toFixed(3)} m</b></div><div class="metric"><span>FINAL ERROR AT A</span><b>${m.finalErr.toFixed(3)} m</b></div><div class="metric"><span>DUTY SATURATED</span><b>${m.satPct.toFixed(1)} %</b></div></div>
      ${verdict ? `<ul class="checks">${verdict.checks.map(c => `<li class="${c.ok ? 'ok' : 'bad'}">${esc(c.k)} — <span class="mono">${esc(c.v)}</span></li>`).join('')}</ul>
        <div class="msg ${verdict.pass ? 'ok' : 'bad'}">${verdict.pass ? `✔ Challenge passed${res('sim').correct ? ` — ${fmtM(S.cfg.weights.sim)} marks.` : '.'} Best Balance Index so far: ${(res('sim').bestIndex ?? m.index).toFixed(1)}` : '✘ Not passed yet. Improve the ML model (stage 4) and run again.'}</div>` : ''}`;
  };
  $('#runpi', el).onclick = () => {
    const run = C.challenge(p, sc, 'naive'); play(run, 'PI only');
    showMetrics(run.metrics, 'Result — PI only (real motors, no ML)', null);
    $('#simres', el).insertAdjacentHTML('beforeend', `<div class="msg ${run.metrics.fallen ? 'bad' : 'warn'}">${run.metrics.fallen ? 'The PI design that is correct for the ideal model cannot hold the real robot: dead-zone, back-EMF and battery sag break the model assumption.' : 'PI only survives here, but compare the Balance Index with the ML run.'}</div>`);
  };
  $('#runml', el).onclick = async () => {
    const run = C.challenge(p, sc, model); const m = run.metrics; const v = C.passTest(m, th);
    const prev = res('sim');
    const rec = { done: true, correct: !!(prev.correct || v.pass), lastIndex: m.index, bestIndex: Math.max(prev.bestIndex ?? 0, v.pass ? m.index : 0), runs: (prev.runs || 0) + 1,
      last: { rms: m.rmsTiltDeg, max: m.maxTiltDeg, pos: m.rmsPosErr, fin: m.finalErr, fallen: m.fallen }, scenario: { mode: sc.mode, slopeDeg: sc.slopeDeg, pushN: sc.pushN }, model: model.meta.modelType || '', at: Date.now() };
    const mm = { fallen: m.fallen, tFall: m.tFall, rmsTiltDeg: m.rmsTiltDeg, maxTiltDeg: m.maxTiltDeg, rmsPosErr: m.rmsPosErr, finalErr: m.finalErr, satPct: m.satPct, index: m.index };
    rec.lastMetrics = mm; rec.trace = Report.packTrace(run.out);
    rec.best = (v.pass && (!prev.best || m.index >= (prev.best.metrics.index || 0))) ? { metrics: mm, trace: rec.trace, at: Date.now() } : (prev.best || null);
    await save({ 'results/sim': rec });
    play(run, 'PI + ML'); showMetrics(m, 'Result — PI + ML block', v); refreshChrome();
    if (!$('[data-next="6"]', el) && unlocked(6)) { $('#simres', el).insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:10px">${nextBtn(6)}</div>`); wireNext(el); }
  };
  if (r.done && r.last) $('#simres', el).innerHTML = `<div class="msg ${r.correct ? 'ok' : 'info'}">Last run: Balance Index ${Number(r.lastIndex).toFixed(1)} · best passing ${Number(r.bestIndex || 0).toFixed(1)} · ${r.runs} run(s). ${r.correct ? 'Challenge passed.' : ''}</div>`;
  wireNext(el);
}

/* ================================================================== stage 6 */
function stage6(el) {
  const mk = C.computeMarks(work().results, S.rec.overrides, S.cfg);
  const sim = res('sim'); const eligible = !S.cfg.certRequiresPass || sim.correct;
  const cert = work().cert;
  el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET 06 — RESULTS</div>
    <h2>Marks summary</h2>
    <div class="tbl-wrap"><table class="spec"><tr><th>#</th><th>ITEM</th><th>STATUS</th><th>MARK</th></tr>
      ${mk.rows.map((r, i) => `<tr><td class="mono">${i + 1}</td><td>${esc(r.label)}</td><td>${r.done ? (r.correct ? '<span class="pill ok">correct</span>' : '<span class="pill bad">incorrect</span>') : '<span class="pill warn">pending</span>'}${r.override !== null ? ' <span class="pill info">adjusted by instructor</span>' : ''}</td><td class="num">${fmtM(r.earned)} / ${fmtM(r.weight)}</td></tr>`).join('')}
      <tr><td></td><td><b>Total</b></td><td></td><td class="num"><b>${fmtM(mk.earned)} / ${fmtM(mk.total)} (${mk.pct.toFixed(1)} %)</b></td></tr></table></div>
    <div class="row" style="margin-top:16px">${eligible ? `<button class="btn primary" id="gen">${cert ? 'VIEW CERTIFICATE' : 'CLAIM CERTIFICATE'}</button>` : '<div class="msg warn">The certificate requires a passed challenge run (stage 5).</div>'}
      <button class="btn hidden" id="prt">🖶 PRINT / SAVE AS PDF</button><button class="btn accent" id="rep">⬇ DOWNLOAD FULL REPORT (PDF)</button></div>
    <p class="small muted">The report contains every step with your numbers: parameters, block-diagram reduction, G(s), CCF, ranks, eigenvalues, step response, ML validation and the challenge graphs. It opens in a new tab; choose “Save as PDF”.</p>
  </section>
  <section class="sheet hidden" id="certsheet"><div class="sheet-label">CERTIFICATE</div><div class="cert-scale"><div id="certificate"></div></div></section>`;
  const showCert = async c => {
    const logo = await UI.resolveLogo();
    $('#certificate', el).innerHTML = UI.certificateSVG({ name: S.rec.profile.name, id: S.rec.profile.id, pct: mk.pct, date: new Date(c.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), code: c.code, index: sim.bestIndex, p: S.p, logo });
    $('#certsheet', el).classList.remove('hidden'); $('#prt', el).classList.remove('hidden');
  };
  if ($('#gen', el)) $('#gen', el).onclick = async () => {
    let c = work().cert;
    if (!c) { const issuedAt = Date.now(); c = { issuedAt, code: C.certCode(S.rec.profile.id, S.rec.profile.name, mk.pct, new Date(issuedAt).toISOString().slice(0, 10)), pct: mk.pct }; await save({ cert: c }); }
    showCert(c);
  };
  $('#prt', el).onclick = () => window.print();
  $('#rep', el).onclick = () => openReport();
}
function openReport() {
  const ml = res('ml');
  if (ml.done && !ml.slice) { const m = loadModel(); if (m) save({ 'results/ml/slice': Report.packSlice(m) }); }
  Report.open(S.rec, S.cfg);
}
