/* POWE445 challenge — full technical report (same document for the student and the instructor) */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, esc = UI.esc;
  const NAVY = '#13294b', GOLD = '#a8843a', MUTED = '#5b6b82', LINE = '#c9d3e1';
  const f = (x, n = 5) => C.fmt(Number(x), n);
  const sup = k => ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸'][k] || '^' + k;

  /* ---------------------------------------------------------------- small renderers */
  const mat = (M, n = 5) => `<span class="mat"><table>${M.map(r => `<tr>${r.map(v => `<td>${esc(isFinite(v) ? f(v, n) : '—')}</td>`).join('')}</tr>`).join('')}</table></span>`;
  const frac = (num, den) => `<span class="frac"><span>${esc(UI.polyText(num))}</span><span>${esc(UI.polyText(den))}</span></span>`;
  const verdict = r => !r || !r.done ? '<span class="tag pend">pending</span>' : r.correct ? '<span class="tag ok">correct</span>' : '<span class="tag bad">incorrect</span>';
  const cz = z => f(z[0], 5) + (z[1] ? (z[1] > 0 ? ' + ' : ' − ') + f(Math.abs(z[1]), 5) + 'j' : '');

  function svgPlot(x, series, o = {}) {
    const W = o.w || 680, H = o.h || 220, m = { l: 56, r: 14, t: 22, b: 34 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    let lo = Infinity, hi = -Infinity;
    series.forEach(s => s.data.forEach(v => { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (o.ylim) [lo, hi] = o.ylim;
    if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
    const pad = (hi - lo) * 0.07; lo -= pad; hi += pad;
    const x0 = x[0], x1 = x[x.length - 1];
    const X = v => m.l + (v - x0) / (x1 - x0) * pw, Y = v => m.t + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * ph;
    const ticks = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const k = [1, 2, 5, 10].find(k => (b - a) / (k * st) <= n) * st; const r = []; for (let v = Math.ceil(a / k) * k; v <= b + 1e-12; v += k) r.push(+v.toFixed(10)); return r; };
    const gy = ticks(lo, hi, 5).map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e8f0"/><text x="${m.l - 6}" y="${Y(v) + 3}" text-anchor="end">${+v.toPrecision(3)}</text>`).join('');
    const gx = ticks(x0, x1, 9).map(v => `<line y1="${m.t}" y2="${H - m.b}" x1="${X(v)}" x2="${X(v)}" stroke="#e3e8f0"/><text x="${X(v)}" y="${H - m.b + 14}" text-anchor="middle">${+v.toPrecision(4)}</text>`).join('');
    const zero = lo < 0 && hi > 0 ? `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa7b9"/>` : '';
    const paths = series.map(s => {
      let d = ''; s.data.forEach((v, i) => { if (!isFinite(v)) return; d += (d ? 'L' : 'M') + X(x[i]).toFixed(1) + ',' + Y(v).toFixed(1); });
      return `<path d="${d}" fill="none" stroke="${s.color || NAVY}" stroke-width="${s.width || 1.6}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
    }).join('');
    const legend = series.filter(s => s.label).map((s, i) => `<g transform="translate(${m.l + 8 + i * 150} ${m.t + 12})"><line x1="0" x2="18" y1="-4" y2="-4" stroke="${s.color || NAVY}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/><text x="24" y="0">${esc(s.label)}</text></g>`).join('');
    return `<figure><svg viewBox="0 0 ${W} ${H}" class="plot"><g font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">${gy}${gx}</g>${zero}
      <rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="${NAVY}"/>${paths}
      <g font-family="IBM Plex Mono,monospace" font-size="10" fill="${NAVY}">${legend}</g>
      <text x="${W - m.r}" y="${H - 6}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">${esc(o.xlabel || '')}</text>
      <text x="12" y="${m.t + ph / 2}" transform="rotate(-90 12 ${m.t + ph / 2})" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">${esc(o.ylabel || '')}</text></svg>
      ${o.caption ? `<figcaption>${o.caption}</figcaption>` : ''}</figure>`;
  }
  function pzMap(poles, zeros) {
    const W = 680, H = 250, m = 36;
    const all = poles.concat(zeros);
    const xr = Math.max(...all.map(z => Math.abs(z[0]))) * 1.12 || 1, yr = Math.max(1, ...all.map(z => Math.abs(z[1]))) * 1.3;
    const X = v => m + (v + xr) / (xr * 1.15) * (W - 2 * m), Y = v => H / 2 - v / yr * (H / 2 - m);
    const x0 = X(0);
    return `<figure><svg viewBox="0 0 ${W} ${H}" class="plot"><rect x="${x0}" y="10" width="${W - m - x0}" height="${H - 20}" fill="#fbecea"/>
      <line x1="${m}" x2="${W - m}" y1="${H / 2}" y2="${H / 2}" stroke="${NAVY}"/><line x1="${x0}" x2="${x0}" y1="10" y2="${H - 10}" stroke="${NAVY}"/>
      ${poles.map(z => `<g transform="translate(${X(z[0])} ${Y(z[1])})" stroke="${NAVY}" stroke-width="2"><line x1="-6" y1="-6" x2="6" y2="6"/><line x1="-6" y1="6" x2="6" y2="-6"/></g><text x="${X(z[0])}" y="${Y(z[1]) - 10}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="${NAVY}">${esc(cz(z))}</text>`).join('')}
      ${zeros.map(z => `<circle cx="${X(z[0])}" cy="${Y(z[1])}" r="6" fill="#fff" stroke="${GOLD}" stroke-width="2"/><text x="${X(z[0])}" y="${Y(z[1]) + 20}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="${GOLD}">${esc(cz(z))}</text>`).join('')}
      <text x="${W - m}" y="${H / 2 - 6}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">Re</text><text x="${x0 + 6}" y="22" font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">Im</text>
      <text x="${W - m - 4}" y="${H - 16}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="#b8322a">right half-plane (unstable)</text></svg>
      <figcaption>Pole–zero map of G(s): × poles, ○ zero (horizontal axis compressed to fit the fast motor pole).</figcaption></figure>`;
  }
  function stepResponse(A, B, Cm, T = 4, dt = 0.0005) {
    const n = A.length; let x = new Array(n).fill(0); const t = [], y = [];
    const fx = s => A.map((row, i) => row.reduce((a, v, j) => a + v * s[j], 0) + B[i][0]);
    const N = Math.round(T / dt);
    for (let k = 0; k <= N; k++) {
      if (k % 10 === 0) { t.push(+(k * dt).toFixed(4)); y.push(Cm[0].reduce((a, v, j) => a + v * x[j], 0)); }
      const k1 = fx(x), k2 = fx(x.map((v, i) => v + dt / 2 * k1[i])), k3 = fx(x.map((v, i) => v + dt / 2 * k2[i])), k4 = fx(x.map((v, i) => v + dt * k3[i]));
      x = x.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    }
    const yf = y[y.length - 1], ymax = Math.max(...y);
    const tAt = lvl => { const i = y.findIndex(v => v >= lvl * yf); return i < 0 ? NaN : t[i]; };
    let ts = 0; for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] - yf) > 0.02 * Math.abs(yf)) { ts = t[Math.min(i + 1, t.length - 1)]; break; }
    return { t, y, yf, overshoot: 100 * (ymax - yf) / yf, tr: tAt(0.9) - tAt(0.1), ts, tp: t[y.indexOf(ymax)] };
  }

  /* ---------------------------------------------------------------- document */
  function build(rec, cfgIn, logo) {
    const cfg = C.mergeConfig(cfgIn), pr = rec.profile, id = pr.id, p = C.generateParams(id);
    const R = (rec.work && rec.work.results) || {}, mk = C.computeMarks(R, rec.overrides, cfg);
    const ref = C.closedLoopTF(p), K = 2 * p.Km * p.K_B;
    const conv = (R.ss && R.ss.conv) || 'bottom';
    const ccf = C.ccf(ref.num, ref.den, conv), an = C.analyse(ccf.A, ccf.B, ccf.C);
    const zeros = [[-p.Ki / p.Kp, 0]];
    const sr = stepResponse(C.ccf(ref.num, ref.den, 'bottom').A, C.ccf(ref.num, ref.den, 'bottom').B, C.ccf(ref.num, ref.den, 'bottom').C);
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const sc = C.scenario((R.sim && R.sim.scenario) || cfg.disturbance);
    const piRun = C.challenge(p, sc, 'naive'), refRun = C.simulate(p, sc, 'oracle');
    const sim = R.sim || {}, best = sim.best || null, trace = (best && best.trace) || sim.trace || null;
    const mlM = (best && best.metrics) || sim.lastMetrics || null;
    const ow = n => (n === undefined ? '' : esc(String(n)));

    // ---------- step-by-step coefficient table
    const plant = C.polyMul(C.polyMul([1, 0], [p.tau_m, 1]), [1, 0, -p.w2]);         // τ s⁴ + s³ − τω² s² − ω² s + 0
    const ctrl = [0, 0, K * p.Kd, K * p.Kp, K * p.Ki];
    const sum = plant.map((v, i) => v + ctrl[i]);
    const coefRow = (label, arr) => `<tr><td>${label}</td>${arr.map(v => `<td class="n">${f(v, 6)}</td>`).join('')}</tr>`;
    const stuTF = R.tf && R.tf.answer;
    const stuSS = R.ss && R.ss.answer;
    const sig = k => (UI.SIGNALS[k] ? UI.SIGNALS[k].label : '—');

    // ---------- ML slice
    const sl = R.ml && R.ml.slice;
    const slicePlot = sl ? svgPlot(sl.v, [
      { data: sl.v.map(v => C.trueDuty(p, v, 0, 11.1)), color: NAVY, label: 'true, ω=0' },
      { data: sl.w0, color: GOLD, label: 'model, ω=0', dash: '6 3' },
      { data: sl.v.map(v => C.trueDuty(p, v, 12, 11.1)), color: '#2e7d5b', label: 'true, ω=12' },
      { data: sl.w12, color: '#b8322a', label: 'model, ω=12', dash: '6 3' }], { xlabel: 'V_cmd [V]', ylabel: 'duty [–]', caption: 'Learned inverse actuator vs. the exact inverse of the real motor (V_bat = 11.1 V).' }) : '<p class="note">Model slice not recorded (model uploaded before report support). Re-upload the model in stage 4 to include this figure.</p>';

    // ---------- challenge figures
    let simFigs = '<p class="note">No ML challenge run recorded yet. Run the challenge with the ML block (stage 5) to include the response figures.</p>';
    if (trace) {
      const pi = piRun.out, every = Math.max(1, Math.round(pi.t.length / trace.t.length));
      const piTh = trace.t.map((t, i) => { if (piRun.metrics.fallen && t > piRun.metrics.tFall) return NaN; const v = pi.th[Math.min(pi.th.length - 1, i * every)]; return v * 57.2958; });
      simFigs = svgPlot(trace.t, [{ data: trace.th, color: NAVY, label: 'θ with ML' }, { data: trace.thr, color: GOLD, label: 'θref', dash: '5 3' }, { data: piTh, color: '#b8322a', label: 'θ PI only', width: 1, dash: '2 2' }],
        { xlabel: 't [s]', ylabel: 'tilt [deg]', ylim: [Math.min(-8, ...trace.th) , Math.max(8, ...trace.th)], caption: `Tilt angle during the challenge run (${esc(sc.mode)}; slope ${sc.slopeDeg}°, push ${sc.pushN} N). PI-only trace is shown until ${piRun.metrics.fallen ? 'the robot falls at ' + piRun.metrics.tFall.toFixed(2) + ' s' : 'the end of the run'}.` }) +
        svgPlot(trace.t, [{ data: trace.x, color: NAVY, label: 'x with ML' }, { data: trace.xr, color: GOLD, label: 'planned x', dash: '5 3' }], { xlabel: 't [s]', ylabel: 'position [m]', caption: 'Point-to-point motion A → B → A along the track.' }) +
        svgPlot(trace.t, [{ data: trace.duty, color: NAVY, label: 'PWM duty (ML output)' }, { data: trace.F.map(v => v / Math.max(1, sc.pushN || 1)), color: '#b8322a', label: 'push (normalised)', width: 1 }], { xlabel: 't [s]', ylabel: 'duty [–]', ylim: [-1, 1], caption: 'Actuator command produced by the ML block, with the push instants.' });
    }
    const mrow = (name, m, idx) => `<tr><td>${name}</td><td>${m ? (m.fallen ? '<span class="tag bad">fell</span>' : '<span class="tag ok">upright</span>') : '—'}</td><td class="n">${m ? f(m.rmsTiltDeg ?? m.rms, 4) : '—'}</td><td class="n">${m ? f(m.maxTiltDeg ?? m.max, 4) : '—'}</td><td class="n">${m ? f(m.rmsPosErr ?? m.pos, 4) : '—'}</td><td class="n">${m ? f(m.finalErr ?? m.fin, 4) : '—'}</td><td class="n">${idx ?? '—'}</td></tr>`;

    const cert = rec.work && rec.work.cert;

    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>POWE445 Report — ${esc(pr.name)} (${esc(id)})</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 20mm 16mm 18mm 16mm;
  @top-left { content: "POWE445 — Control Systems II · Technical Assessment Report"; font: 7.5pt 'IBM Plex Mono', monospace; color: ${MUTED}; border-bottom: .6pt solid ${GOLD}; vertical-align: bottom; padding-bottom: 3mm; }
  @top-right { content: "${esc(pr.name)} · ${esc(id)}"; font: 7.5pt 'IBM Plex Mono', monospace; color: ${MUTED}; border-bottom: .6pt solid ${GOLD}; vertical-align: bottom; padding-bottom: 3mm; }
  @bottom-left { content: "Self-Balancing Robot Control Challenge · ${esc(C.VERSION)} · Created by Youssef Ajra"; font: 7pt 'IBM Plex Mono', monospace; color: ${MUTED}; vertical-align: top; padding-top: 3mm; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7pt 'IBM Plex Mono', monospace; color: ${MUTED}; vertical-align: top; padding-top: 3mm; } }
@page :first { @top-left { content: none; border: 0; } @top-right { content: none; border: 0; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 10.5pt; color: #1d2633; line-height: 1.45; background: #eef1f6; }
.doc { max-width: 210mm; margin: 0 auto; background: #fff; padding: 18mm 16mm; }
.bar { position: sticky; top: 0; background: ${NAVY}; color: #fff; padding: 10px 16px; display: flex; gap: 10px; align-items: center; z-index: 5; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
.bar button { font: inherit; background: ${GOLD}; color: #fff; border: 0; padding: 7px 14px; cursor: pointer; border-radius: 3px; }
h1, h2, h3 { color: ${NAVY}; margin: 0; }
h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20pt; font-weight: 600; border-bottom: 1.5px solid ${GOLD}; padding-bottom: 3px; margin: 22px 0 10px; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 14px 0 6px; break-after: avoid; }
p { margin: 5px 0; }
.note { color: ${MUTED}; font-style: italic; }
table.t { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 9.5pt; break-inside: avoid; }
table.t th, table.t td { border: 1px solid ${LINE}; padding: 4px 6px; text-align: left; vertical-align: top; }
table.t th { background: #f3f6fa; color: ${MUTED}; font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt; font-weight: 600; letter-spacing: .04em; }
td.n { font-family: 'IBM Plex Mono', monospace; text-align: right; white-space: nowrap; }
.eq { font-family: 'IBM Plex Mono', monospace; font-size: 10pt; background: #f8f9fc; border-left: 3px solid ${GOLD}; padding: 8px 12px; margin: 6px 0; overflow-x: auto; break-inside: avoid; }
.frac { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; margin: 0 4px; }
.frac > span:first-child { border-bottom: 1.2px solid ${NAVY}; padding: 0 6px 2px; } .frac > span:last-child { padding: 2px 6px 0; }
.mat { display: inline-block; vertical-align: middle; border-left: 1.5px solid ${NAVY}; border-right: 1.5px solid ${NAVY}; border-radius: 4px; padding: 2px 4px; margin: 2px 6px; }
.mat td { font-family: 'IBM Plex Mono', monospace; font-size: 8.8pt; padding: 1px 6px; text-align: right; }
.mats { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; break-inside: avoid; }
.mats b { font-family: 'IBM Plex Mono', monospace; } .mp { display: inline-flex; align-items: center; white-space: nowrap; }
.tag { font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt; padding: 1px 6px; border-radius: 9px; border: 1px solid; white-space: nowrap; }
.tag.ok { color: #0f7a55; background: #e3f5ee; } .tag.bad { color: #b8322a; background: #fbe9e7; } .tag.pend { color: #a86a00; background: #fff4dc; }
figure { margin: 8px 0 12px; break-inside: avoid; } figcaption { font-size: 9pt; color: ${MUTED}; margin-top: 2px; }
svg.plot { width: 100%; height: auto; display: block; } svg.bd { width: 100%; height: auto; border: 1px solid ${LINE}; }
.cover { text-align: center; padding: 30mm 0 10mm; break-after: page; }
.cover img.logo { height: 90px; margin-bottom: 18px; }
.cover .k { font-family: 'IBM Plex Mono', monospace; font-size: 10pt; letter-spacing: .18em; color: ${MUTED}; }
.cover h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 34pt; font-weight: 600; margin: 18px 0 6px; }
.cover .sub { font-size: 13pt; color: ${GOLD}; font-style: italic; font-family: 'Cormorant Garamond', Georgia, serif; }
.cover .who { margin: 26mm auto 0; width: 70%; border-top: 1.5px solid ${GOLD}; border-bottom: 1.5px solid ${GOLD}; padding: 12px 0; }
.cover .who .name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24pt; font-weight: 700; color: ${NAVY}; }
.kpis { display: flex; justify-content: center; gap: 14px; margin-top: 14mm; }
.kpi { border: 1.2px solid ${GOLD}; background: #fbf7ee; padding: 8px 18px; min-width: 120px; }
.kpi span { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 8pt; letter-spacing: .12em; color: ${MUTED}; }
.kpi b { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20pt; color: ${NAVY}; }
.sign { display: flex; justify-content: space-between; margin-top: 18mm; break-inside: avoid; }
.sign div { width: 42%; border-top: 1px solid ${NAVY}; padding-top: 4px; font-size: 9pt; color: ${MUTED}; text-align: center; }
@media print {
  body { background: #fff; } .bar { display: none; } .doc { max-width: none; padding: 0; }
  h2.newpage { break-before: page; }
}
</style></head><body>
<div class="bar"><span>POWE445 technical report — ${esc(pr.name)} (${esc(id)})</span><span style="flex:1"></span><button onclick="window.print()">⬇ Save as PDF / Print</button></div>
<div class="doc">
<section class="cover">
  ${logo ? `<img class="logo" src="${esc(logo)}" alt="Beirut Arab University">` : ''}
  <div class="k">BEIRUT ARAB UNIVERSITY · FACULTY OF ENGINEERING</div>
  <div class="k">DEPARTMENT OF ELECTRICAL AND COMPUTER ENGINEERING</div>
  <h1>Technical Assessment Report</h1>
  <div class="sub">Machine-Learning-Enhanced Control of a Self-Balancing Robot</div>
  <div class="k" style="margin-top:8px">POWE445 — CONTROL SYSTEMS II</div>
  <div class="who"><div class="name">${esc(pr.name)}</div><div class="k">STUDENT ID ${esc(id)}</div></div>
  <div class="kpis"><div class="kpi"><span>MARKS</span><b>${(Math.round(mk.earned * 10) / 10)} / ${mk.total}</b></div><div class="kpi"><span>ACHIEVEMENT</span><b>${mk.pct.toFixed(1)} %</b></div><div class="kpi"><span>BALANCE INDEX</span><b>${sim.bestIndex ? Number(sim.bestIndex).toFixed(1) : '—'}</b></div></div>
  <p class="k" style="margin-top:16mm">Instructor: Dr. Youssef Ajra · Report generated ${esc(today)}${cert ? ' · Certificate ' + esc(cert.code) : ''}</p>
</section>

<h2>1. Summary of results</h2>
<table class="t"><tr><th>#</th><th>ITEM</th><th>STATUS</th><th>ATTEMPTS</th><th>MARK</th></tr>
${mk.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.label)}</td><td>${verdict(R[r.key])}${r.override !== null ? ' <span class="tag pend">adjusted by instructor</span>' : ''}</td><td class="n">${ow((R[r.key] || {}).attempts)}</td><td class="n">${Math.round(r.earned * 10) / 10} / ${r.weight}</td></tr>`).join('')}
<tr><td></td><td><b>Total</b></td><td></td><td></td><td class="n"><b>${Math.round(mk.earned * 10) / 10} / ${mk.total} (${mk.pct.toFixed(1)} %)</b></td></tr></table>

<h2 class="newpage">2. System model</h2>
<p>The robot is a two-wheeled inverted pendulum linearised about the upright position. A PI controller acts on the tilt error, the gyroscope rate is fed back through K<sub>d</sub>, and both wheel motors receive the same command (parallel blocks). Parameters are unique to student ID ${esc(id)}.</p>
<h3>2.1 Block parameters</h3>
<table class="t"><tr><th>BLOCK</th><th>TRANSFER FUNCTION</th><th>PARAMETER</th><th>VALUE</th><th>UNIT</th></tr>
<tr><td>PI controller</td><td>C(s) = Kp + Ki/s</td><td>Kp · Ki</td><td class="n">${f(p.Kp)} · ${f(p.Ki)}</td><td>V/rad · V/(rad·s)</td></tr>
<tr><td>DC motor + driver (×2)</td><td>Km/(τm s + 1)</td><td>Km · τm</td><td class="n">${f(p.Km)} · ${f(p.tau_m)}</td><td>N·m/V · s</td></tr>
<tr><td>Robot body (pitch)</td><td>K_B/(s² − ωp²)</td><td>K_B · ωp²</td><td class="n">${f(p.K_B)} · ${f(p.w2)}</td><td>rad/(N·m·s²) · s⁻²</td></tr>
<tr><td>Gyroscope + rate gain</td><td>Kd·s</td><td>Kd</td><td class="n">${f(p.Kd)}</td><td>V·s/rad</td></tr>
<tr><td>Tilt estimator</td><td>Hθ(s) = 1</td><td>—</td><td class="n">1</td><td>—</td></tr></table>
<h3>2.2 Robot datasheet</h3>
<table class="t"><tr><th>QUANTITY</th><th>VALUE</th><th>QUANTITY</th><th>VALUE</th></tr>
<tr><td>Body mass m</td><td class="n">${p.m_b} kg</td><td>Axle → COM l</td><td class="n">${p.l} m</td></tr>
<tr><td>Body inertia J_b</td><td class="n">${p.J_b} kg·m²</td><td>Wheel radius r · mass m_w</td><td class="n">${p.r} m · ${p.m_w} kg</td></tr>
<tr><td>Effective inertia J_e</td><td class="n">${f(p.J_e)} kg·m²</td><td>Unstable pole ωp</td><td class="n">${f(Math.sqrt(p.w2))} rad/s</td></tr>
<tr><td>Real motor back-EMF Ke</td><td class="n">${p.Ke} V·s/rad</td><td>Real driver dead-zone</td><td class="n">${p.V_dz} V</td></tr></table>
<h3>2.3 Block diagram</h3>
<figure>${UI.blockDiagram(p, { showML: true, u: 'theta_ref', y: 'theta' }).replace('class="diagram"', 'class="bd"')}<figcaption>Closed-loop pitch control in the s-domain, with the ML block between the PI output and the motor drivers.</figcaption></figure>

<h2 class="newpage">3. Closed-loop transfer function — step by step</h2>
<p><b>Step 1 — parallel motors.</b> G<sub>M</sub>(s) = 2K<sub>m</sub>/(τ<sub>m</sub>s + 1) = ${frac([2 * p.Km], [p.tau_m, 1])}</p>
<p><b>Step 2 — inner gyro-rate loop.</b> G<sub>in</sub>(s) = G<sub>M</sub>G<sub>B</sub> / (1 + K<sub>d</sub>s·G<sub>M</sub>G<sub>B</sub>)</p>
<p><b>Step 3 — outer unity tilt loop.</b> G(s) = C·G<sub>in</sub>/(1 + C·G<sub>in</sub>) = C·G<sub>M</sub>G<sub>B</sub> / [1 + G<sub>M</sub>G<sub>B</sub>(K<sub>d</sub>s + C)]</p>
<div class="eq">G(s) = K (Kp s + Ki) / [ s(τm s + 1)(s² − ωp²) + K (Kd s² + Kp s + Ki) ],&nbsp;&nbsp; K = 2·Km·K_B = 2 × ${f(p.Km)} × ${f(p.K_B)} = ${f(K, 6)}</div>
<p><b>Step 4 — expand and collect the denominator coefficients.</b></p>
<table class="t"><tr><th>TERM</th><th>s⁴</th><th>s³</th><th>s²</th><th>s¹</th><th>s⁰</th></tr>
${coefRow('s(τm s+1)(s² − ωp²)', plant)}${coefRow('K(Kd s² + Kp s + Ki)', ctrl)}${coefRow('<b>Denominator</b>', sum)}${coefRow('<b>÷ τm (monic)</b>', sum.map(v => v / p.tau_m))}</table>
<p>Numerator: K·Kp = ${f(K * p.Kp, 6)}, K·Ki = ${f(K * p.Ki, 6)} → after ÷ τm: ${f(ref.num[0], 6)} s + ${f(ref.num[1], 6)}.</p>
<div class="eq">G(s) = ${frac(ref.num, ref.den)}</div>
<h3>3.1 Submitted answer</h3>
${stuTF ? `<div class="eq">G<sub>student</sub>(s) = ${frac(stuTF.num, stuTF.den)}</div><p>Verdict: ${verdict(R.tf)} — tolerance ±${cfg.tolPct}% on monic coefficients, ${ow(R.tf.attempts)} attempt(s).</p>` : '<p class="note">No answer submitted.</p>'}
<h3>3.2 Poles, zero and step response</h3>
${pzMap(an.eig, zeros)}
<table class="t"><tr><th>POLE</th><th>VALUE</th><th>ωn [rad/s]</th><th>ζ</th><th>τ = 1/|Re| [s]</th></tr>
${an.eig.map((z, i) => { const wn = Math.hypot(z[0], z[1]); return `<tr><td>p${i + 1}</td><td class="n">${cz(z)}</td><td class="n">${f(wn, 4)}</td><td class="n">${f(-z[0] / wn, 4)}</td><td class="n">${f(1 / Math.abs(z[0]), 4)}</td></tr>`; }).join('')}
<tr><td>zero</td><td class="n">${f(zeros[0][0], 5)}</td><td colspan="3">−Ki/Kp (PI zero)</td></tr></table>
${svgPlot(sr.t, [{ data: sr.y, color: NAVY, label: 'θ(t) for θref = 1 rad step' }], { xlabel: 't [s]', ylabel: 'θ [rad]', caption: 'Unit-step response of the closed-loop G(s) (computed from the CCF realisation).' })}
<table class="t"><tr><th>DC GAIN</th><th>OVERSHOOT</th><th>PEAK TIME</th><th>RISE TIME (10–90 %)</th><th>SETTLING TIME (2 %)</th></tr>
<tr><td class="n">${f(sr.yf, 5)}</td><td class="n">${f(sr.overshoot, 4)} %</td><td class="n">${f(sr.tp, 4)} s</td><td class="n">${f(sr.tr, 4)} s</td><td class="n">${f(sr.ts, 4)} s</td></tr></table>
${sr.overshoot > 20 ? `<p class="note">The large overshoot comes from the PI zero at ${f(zeros[0][0], 4)} s⁻¹, not from poorly damped poles (minimum ζ = ${f(Math.min(...an.eig.map(z => -z[0] / Math.hypot(z[0], z[1]))), 3)}). In the challenge the position planner passes θref through the pre-filter (Ki/Kp)/(s + Ki/Kp), which cancels this zero.</p>` : ''}

<h2 class="newpage">4. State-space realisation (controllable canonical form)</h2>
<p>With G(s) = (b₁s + b₀)/(s⁴ + a₃s³ + a₂s² + a₁s + a₀), the ${conv === 'bottom' ? 'phase-variable (companion row at the bottom)' : 'companion row at the top'} realisation is:</p>
<div class="mats"><span class="mp"><b>A =</b>${mat(ccf.A, 6)}</span><span class="mp"><b>B =</b>${mat(ccf.B)}</span><span class="mp"><b>C =</b>${mat(ccf.C, 6)}</span><span class="mp"><b>D =</b>${mat(ccf.D)}</span></div>
<p>Input u(t) = θref(t) (reference tilt angle, rad); output y(t) = θ(t) (tilt angle, rad).</p>
<h3>4.1 Submitted answer</h3>
${stuSS ? `<div class="mats"><span class="mp"><b>A =</b>${mat(stuSS.A, 6)}</span><span class="mp"><b>B =</b>${mat(stuSS.B)}</span><span class="mp"><b>C =</b>${mat(stuSS.C, 6)}</span><span class="mp"><b>D =</b>${mat(stuSS.D)}</span></div>
<p>Dimensions n = ${stuSS.n}, m = ${stuSS.m}, p = ${stuSS.q}. Verdict: ${verdict(R.ss)} (${ow(R.ss.attempts)} attempt(s)).</p>` : '<p class="note">No matrices submitted.</p>'}
<p>Signals chosen — input: <i>${esc(sig(R.io && R.io.answer && R.io.answer.u))}</i>; output: <i>${esc(sig(R.io && R.io.answer && R.io.answer.y))}</i>. Verdict: ${verdict(R.io)}</p>

<h2 class="newpage">5. Controllability, observability and stability</h2>
<div class="mats"><b>𝒞 = [B AB A²B A³B] =</b>${mat(an.Mc, 5)}</div><p>rank 𝒞 = <b>${an.rc}</b> = n = ${an.n} → <b>${an.rc === an.n ? 'controllable' : 'not controllable'}</b>.</p>
<div class="mats"><b>𝒪 = [C; CA; CA²; CA³] =</b>${mat(an.Mo, 5)}</div><p>rank 𝒪 = <b>${an.ro}</b> = n = ${an.n} → <b>${an.ro === an.n ? 'observable' : 'not observable'}</b> (the PI zero −Ki/Kp = ${f(zeros[0][0], 4)} cancels no pole).</p>
<p>Eigenvalues of A: ${an.eig.map(cz).join(' ; ')} → all real parts negative → <b>${an.stable ? 'asymptotically stable' : 'unstable'}</b>.</p>
<table class="t"><tr><th>QUESTION</th><th>CORRECT</th><th>STUDENT</th><th>VERDICT</th></tr>
${[['qc', 'Controllable?', an.rc === an.n], ['qo', 'Observable?', an.ro === an.n], ['qs', 'Stable?', an.stable]].map(([k, q, t]) => `<tr><td>${q}</td><td>${t ? 'YES' : 'NO'}</td><td>${R[k] && R[k].answer ? esc(R[k].answer.toUpperCase()) : '—'}</td><td>${verdict(R[k])}</td></tr>`).join('')}</table>

<h2 class="newpage">6. Machine-learning block</h2>
<p>The ideal block in G(s) assumes torque = Km·V. The real H-bridge and motors have a dead-zone (${p.V_dz} V), back-EMF (Ke = ${p.Ke} V·s/rad) and battery sag. The ML block learns the inverse actuator map duty = f(V_cmd, ω_m, V_bat) so that the real motor reproduces the ideal block. Exact inverse: duty = sat[ sgn(v)(|v| + V_dz)/V_bat ], v = V_cmd + Ke·ω_m.</p>
<table class="t"><tr><th>ITEM</th><th>VALUE</th></tr>
<tr><td>Dataset</td><td>N = ${cfg.datasetN} rows; features V_cmd [V], omega_m [rad/s], V_bat [V]; label duty [–]</td></tr>
<tr><td>Training tool</td><td>MATLAB Regression Learner (all models), exported with exportModelForWeb.m (41×41×5 grid)</td></tr>
<tr><td>Selected model</td><td>${esc((R.ml && R.ml.modelType) || '—')}</td></tr>
<tr><td>Hidden-test R² · RMSE</td><td class="n">${R.ml && R.ml.r2 !== undefined ? f(R.ml.r2, 5) + ' · ' + f(R.ml.rmse, 4) : '—'}</td></tr>
<tr><td>Pass criterion</td><td>R² ≥ ${cfg.r2Min} → ${verdict(R.ml)}</td></tr></table>
${slicePlot}

<h2 class="newpage">7. Challenge test with the ML block in the loop</h2>
<p>Test: ${esc({ incline: 'inclined surface', push: 'lateral pushes', both: 'inclined surface + lateral pushes' }[sc.mode])}; slope α = ${sc.slopeDeg}°, push F = ${sc.pushN} N for 0.1 s at t = 6 s and 14 s; battery ${sc.Vbat} V; track A → B (L = ${sc.L} m) → A, ${sc.Tend} s.</p>
<table class="t"><tr><th>RUN</th><th>RESULT</th><th>RMS TILT [°]</th><th>MAX TILT [°]</th><th>RMS TRACK [m]</th><th>FINAL ERR [m]</th><th>BALANCE INDEX</th></tr>
${mrow('Reference (exact inverse)', refRun.metrics, '100')}${mrow('<b>PI + ML block (student)</b>', mlM || (sim.last ? { ...sim.last } : null), sim.bestIndex ? Number(sim.bestIndex).toFixed(1) : (sim.lastIndex !== undefined ? Number(sim.lastIndex).toFixed(1) : null))}${mrow('PI only (real motors)', piRun.metrics, piRun.metrics.index.toFixed(1))}</table>
<p>Pass criteria: upright, Balance Index ≥ ${cfg.thresholds.minIndex}, max tilt ≤ ${cfg.thresholds.maxTiltDeg}°, final error ≤ ${cfg.thresholds.finalErr} m → ${verdict(R.sim)}${sim.runs ? ` (${sim.runs} run(s))` : ''}.</p>
${simFigs}

<h2>8. Conclusion</h2>
<p>The closed-loop pitch system of this robot is 4th order, controllable, observable and asymptotically stable (slowest pole ${f(Math.max(...an.eig.map(z => z[0])), 4)} s⁻¹). The PI controller designed for the ideal model ${piRun.metrics.fallen ? 'cannot hold the real robot on its own (it falls at ' + piRun.metrics.tFall.toFixed(2) + ' s)' : 'survives on the real robot only with a reduced Balance Index (' + piRun.metrics.index.toFixed(1) + ')'}; ${sim.correct ? `with the learned actuator inverse in the loop the robot passed the challenge with a Balance Index of ${Number(sim.bestIndex).toFixed(1)}` : 'the challenge with the ML block is not yet passed'}. Overall achievement: <b>${mk.pct.toFixed(1)} %</b>.</p>
<div class="sign"><div>${esc(pr.name)} — Student</div><div>Dr. Youssef Ajra — Course Instructor</div></div>
</div>
<script>document.fonts && document.fonts.ready.then(() => setTimeout(() => { if (!window.__printed) { window.__printed = 1; window.print(); } }, 400));</script>
</body></html>`;
  }

  /* open synchronously (keeps the click's popup permission), fill when the logo is resolved */
  function open(rec, cfg) {
    const w = root.open('', '_blank');
    if (!w) { UI.toast('Allow pop-ups for this site to download the report.', 'bad'); return; }
    w.document.write('<p style="font-family:monospace;padding:20px">Building report…</p>');
    UI.resolveLogo().then(logo => {
      try { const html = build(rec, cfg, logo); w.document.open(); w.document.write(html); w.document.close(); }
      catch (e) { w.document.body.innerHTML = '<pre>Report failed: ' + esc(e.stack || e.message) + '</pre>'; }
    });
  }
  // compact trace for the report (stored in the database)
  function packTrace(out, n = 300) {
    const step = Math.max(1, Math.floor(out.t.length / n)), r = (v, d) => Math.round(v * d) / d, pick = (a, fn) => a.filter((_, i) => i % step === 0).map(fn);
    return { t: pick(out.t, v => r(v, 1000)), th: pick(out.th, v => r(v * 57.2958, 1000)), thr: pick(out.thref, v => r(v * 57.2958, 1000)), x: pick(out.x, v => r(v, 10000)), xr: pick(out.xr, v => r(v, 10000)), duty: pick(out.duty, v => r(v, 10000)), F: pick(out.F, v => r(v, 100)) };
  }
  function packSlice(model) {
    const v = Array.from({ length: 121 }, (_, i) => Math.round((-6 + i * 0.1) * 100) / 100), r = x => Math.round(x * 1e5) / 1e5;
    return { v, w0: v.map(x => r(model(x, 0, 11.1))), w12: v.map(x => r(model(x, 12, 11.1))) };
  }
  root.Report = { open, build, packTrace, packSlice };
})(window);
