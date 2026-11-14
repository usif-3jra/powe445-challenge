/* POWE445 challenge — drawing & UI helpers (block diagram, robot, plots, certificate) */
(function (root) {
  'use strict';
  const C = root.Core;
  const INK = '#0d2b55', LINE = '#1f5fa8', ACC = '#0b6bd3', SOFT = '#9cb8dc';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f3 = x => C.fmt(x, 3);

  /* ------------------------------------------------------------ polynomial text */
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = n => String(n).split('').map(d => SUP[d]).join('');
  function polyText(c, v = 's') {
    const n = c.length - 1; const parts = [];
    c.forEach((a, i) => {
      a = Number(a); if (!isFinite(a)) { parts.push({ s: 1, t: '□' + (n - i > 0 ? v + (n - i > 1 ? sup(n - i) : '') : '') }); return; }
      if (a === 0) return;
      const k = n - i, mag = Math.abs(a);
      const coef = (mag === 1 && k > 0) ? '' : C.fmt(mag, 5);
      parts.push({ s: Math.sign(a), t: coef + (k > 0 ? (coef ? ' ' : '') + v + (k > 1 ? sup(k) : '') : '') });
    });
    if (!parts.length) return '0';
    return parts.map((p, i) => (i === 0 ? (p.s < 0 ? '−' : '') : (p.s < 0 ? ' − ' : ' + ')) + p.t).join('');
  }
  const fracHTML = (num, den) => `<span class="frac"><span>${esc(polyText(num))}</span><span>${esc(polyText(den))}</span></span>`;

  /* ------------------------------------------------------------ block diagram */
  const SIGNALS = {
    theta_ref: { label: 'θref(t) — reference tilt angle (from position planner) [rad]', at: [52, 172] },
    e: { label: 'e(t) — tilt error [rad]', at: [150, 172] },
    v: { label: 'V(t) — motor command voltage [V]', at: [372, 172] },
    tau: { label: 'τ(t) — total corrective pitch torque [N·m]', at: [770, 172] },
    theta: { label: 'θ(t) — robot tilt (pitch) angle [rad]', at: [1060, 172] },
    thetadot: { label: 'θ̇(t) — pitch rate measured by gyroscope [rad/s]', at: [790, 318] },
    d: { label: 'd(t) — disturbance torque (slope / push) [N·m]', at: [806, 60] }
  };
  function blockDiagram(p, o = {}) {
    const W = 1120, H = 440;
    const box = (x, y, w, h, title, l1, l2, opt = {}) => `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opt.fill || '#fff'}" stroke="${opt.stroke || INK}" stroke-width="1.6" ${opt.dash ? 'stroke-dasharray="6 4"' : ''}/>
        <text x="${x + w / 2}" y="${y - 7}" text-anchor="middle" class="bt">${title}</text>
        <text x="${x + w / 2}" y="${y + h / 2 - (l2 ? 6 : -5)}" text-anchor="middle" class="bf">${l1}</text>
        ${l2 ? `<text x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" class="bv">${l2}</text>` : ''}
      </g>`;
    const sum = (x, y, signs) => `<g><circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
      <line x1="${x - 9}" y1="${y - 9}" x2="${x + 9}" y2="${y + 9}" stroke="${INK}" stroke-width="1"/><line x1="${x - 9}" y1="${y + 9}" x2="${x + 9}" y2="${y - 9}" stroke="${INK}" stroke-width="1"/>
      ${signs.map(([dx, dy, s]) => `<text x="${x + dx}" y="${y + dy}" class="sg">${s}</text>`).join('')}</g>`;
    const ar = (pts, lbl, lx, ly, cls = '') => `<polyline points="${pts}" fill="none" stroke="${INK}" stroke-width="1.5" marker-end="url(#ah)" class="${cls}"/>` +
      (lbl ? `<text x="${lx}" y="${ly}" class="sl">${lbl}</text>` : '');
    const showML = !!o.showML;
    const mlBox = showML
      ? box(394, 128, 102, 44, 'ML block', 'f(V,ω,Vbat)', 'learned inverse', { dash: true, fill: '#eef5fd', stroke: ACC })
      : '';
    const tag = (key, txt, color) => {
      if (!key || !SIGNALS[key]) return '';
      const [x, y] = SIGNALS[key].at;
      return `<g><rect x="${x - 18}" y="${y + 6}" width="36" height="20" rx="10" fill="${color}"/><text x="${x}" y="${y + 20}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="12" fill="#fff" font-weight="600">${txt}</text></g>`;
    };
    return `<svg class="diagram" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Closed-loop block diagram">
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker>
        <pattern id="g1" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(31,95,168,.07)"/></pattern>
        <style>
          .bt{font:600 11.5px 'IBM Plex Sans',sans-serif;fill:${LINE};letter-spacing:.02em}
          .bf{font:500 14px 'IBM Plex Mono',monospace;fill:${INK}}
          .bv{font:400 11px 'IBM Plex Mono',monospace;fill:#4a6383}
          .sl{font:italic 500 13px 'IBM Plex Mono',monospace;fill:${INK}}
          .sg{font:600 13px 'IBM Plex Mono',monospace;fill:${INK}}
          .nt{font:400 10.5px 'IBM Plex Mono',monospace;fill:#6c84a3}
        </style>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g1)"/>
      <text x="16" y="24" class="nt">CLOSED-LOOP PITCH CONTROL — s-DOMAIN  (motor leads wired so positive V gives restoring torque)</text>
      <!-- forward path -->
      ${ar('14,150 84,150', 'θref(s)', 14, 140)}
      ${sum(98, 150, [[-24, -6, '+'], [5, 30, '−']])}
      ${ar('111,150 168,150', 'E(s)', 124, 140)}
      ${box(168, 122, 128, 56, 'PI controller', 'C(s)=Kp+Ki/s', `Kp=${f3(p.Kp)} Ki=${f3(p.Ki)}`)}
      ${ar('296,150 345,150')}
      ${sum(358, 150, [[-24, -6, '+'], [5, 30, '−']])}
      ${showML ? ar('371,150 394,150') + mlBox + `<polyline points="496,150 512,150" fill="none" stroke="${INK}" stroke-width="1.5"/><text x="374" y="140" class="sl">V</text><text x="452" y="196" text-anchor="middle" class="nt">→ PWM duty</text>`
        : `<polyline points="371,150 512,150" fill="none" stroke="${INK}" stroke-width="1.5"/><text x="400" y="140" class="sl">V(s)</text>`}
      <circle cx="512" cy="150" r="3.2" fill="${INK}"/>
      ${ar('512,150 512,88 548,88')}
      ${ar('512,150 512,212 548,212')}
      ${box(548, 62, 150, 52, 'DC motor — left wheel', 'Km/(τm s+1)', `Km=${f3(p.Km)} τm=${f3(p.tau_m)}`)}
      ${box(548, 186, 150, 52, 'DC motor — right wheel', 'Km/(τm s+1)', `Km=${f3(p.Km)} τm=${f3(p.tau_m)}`)}
      ${ar('698,88 742,88 742,136')}${ar('698,212 742,212 742,164')}
      <text x="704" y="80" class="sl">τL</text><text x="704" y="230" class="sl">τR</text>
      ${sum(742, 150, [[-26, -14, '+'], [-26, 28, '+']])}
      ${ar('755,150 793,150', 'τ(s)', 760, 140)}
      ${ar('806,40 806,137', 'D(s)', 814, 50)}
      ${sum(806, 150, [[-22, 20, '+'], [6, -16, '+']])}
      ${ar('819,150 846,150')}
      ${box(846, 122, 150, 56, 'Robot body (pitch)', 'K_B/(s²−ωp²)', `K_B=${f3(p.K_B)} ωp²=${f3(p.w2)}`)}
      <polyline points="996,150 1040,150" fill="none" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="1040" cy="150" r="3.2" fill="${INK}"/>
      ${ar('1040,150 1106,150', 'θ(s)', 1058, 140)}
      <!-- feedback: IMU -->
      <rect x="640" y="266" width="330" height="166" fill="none" stroke="${SOFT}" stroke-width="1.2" stroke-dasharray="5 4"/>
      <text x="648" y="427" class="nt">IMU · MPU-6050 (gyro + accelerometer)</text>
      ${ar('1040,150 1040,318 940,318')}
      ${box(820, 296, 120, 44, 'Gyroscope', 'Hg(s)=s', 'rate dθ/dt')}
      ${ar('820,318 744,318')}
      ${box(652, 296, 92, 44, 'Rate gain', 'Kd', `Kd=${f3(p.Kd)}`)}
      ${ar('652,318 358,318 358,163')}
      ${ar('1040,318 1040,388 860,388')}
      ${box(720, 366, 140, 44, 'Tilt estimator', 'Hθ(s)=1', 'fused angle θ')}
      ${ar('720,388 98,388 98,163')}
      <text x="560" y="310" class="sl">Kd·sθ(s)</text>
      ${tag(o.u, 'u', ACC)}${tag(o.y, 'y', '#0f7a55')}
    </svg>`;
  }

  /* ------------------------------------------------------------ robot drawing */
  // draws robot body in local coords (origin = axle, y up negative), scale S px/m
  function drawRobotBody(ctx, S, p, col = INK, thin = 1.3) {
    const w = 0.095 * S, H = (2 * p.l + 0.05) * S;
    ctx.save(); ctx.lineWidth = thin; ctx.strokeStyle = col; ctx.fillStyle = '#fff';
    // standoffs
    ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -0.03 * S); ctx.lineTo(-w / 2 + 4, -H); ctx.moveTo(w / 2 - 4, -0.03 * S); ctx.lineTo(w / 2 - 4, -H); ctx.stroke();
    const plate = y => { ctx.fillRect(-w / 2 - 3, -y * S - 2.5, w + 6, 5); ctx.strokeRect(-w / 2 - 3, -y * S - 2.5, w + 6, 5); };
    // motor housing
    ctx.fillRect(-0.04 * S, -0.028 * S, 0.08 * S, 0.056 * S); ctx.strokeRect(-0.04 * S, -0.028 * S, 0.08 * S, 0.056 * S);
    plate(0.045);
    // battery
    const by0 = 0.055, by1 = by0 + 0.065;
    ctx.strokeRect(-0.04 * S, -by1 * S, 0.08 * S, (by1 - by0) * S);
    for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo((-0.04 + k * 0.08 / 3) * S, -by1 * S); ctx.lineTo((-0.04 + k * 0.08 / 3) * S, -by0 * S); ctx.stroke(); }
    plate(by1 + 0.012);
    // controller board
    const cy0 = by1 + 0.03, cy1 = Math.min(cy0 + 0.07, 2 * p.l - 0.03);
    ctx.strokeRect(-0.038 * S, -cy1 * S, 0.076 * S, (cy1 - cy0) * S);
    ctx.strokeRect(-0.014 * S, -(cy0 + (cy1 - cy0) * 0.7) * S, 0.028 * S, (cy1 - cy0) * 0.45 * S);
    plate(cy1 + 0.012);
    // IMU
    ctx.strokeRect(-0.012 * S, -(cy1 + 0.04) * S, 0.024 * S, 0.018 * S);
    plate(2 * p.l + 0.05);
    // COM symbol
    const ly = -p.l * S, rc = 6;
    ctx.beginPath(); ctx.arc(0, ly, rc, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, ly); ctx.arc(0, ly, rc, -Math.PI / 2, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.arc(0, ly, rc, Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawWheel(ctx, S, rM, phi, col = INK) {
    const R = rM * S;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, 2 * Math.PI); ctx.stroke();
    ctx.rotate(phi);
    for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); ctx.lineTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, 2 * Math.PI); ctx.stroke();
    ctx.restore();
  }
  class RobotView {
    constructor(canvas, p, opts = {}) {
      this.cv = canvas; this.p = p; this.opts = opts; this.anim = null;
      this.scene = { slopeDeg: 0, L: 1.2, showTrack: true };
      this.resize(); this.draw({ x: 0, th: 0, F: 0, t: 0 });
      this._onR = () => { this.resize(); this.draw(this.last || { x: 0, th: 0, F: 0, t: 0 }); };
      root.addEventListener('resize', this._onR);
    }
    resize() {
      const dpr = root.devicePixelRatio || 1, w = this.cv.clientWidth || 800, h = this.opts.height || 400;
      this.cv.width = w * dpr; this.cv.height = h * dpr; this.cv.style.height = h + 'px';
      this.W = w; this.H = h; this.dpr = dpr;
    }
    setScene(s) { Object.assign(this.scene, s); this.draw(this.last || { x: 0, th: 0, F: 0, t: 0 }); }
    draw(st) {
      this.last = st;
      const { cv, p } = this; const ctx = cv.getContext('2d'); const dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, this.W, this.H);
      // grid
      ctx.lineWidth = 1;
      for (let x = 0; x < this.W; x += 20) { ctx.strokeStyle = x % 100 ? 'rgba(31,95,168,.05)' : 'rgba(31,95,168,.11)'; ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, this.H); ctx.stroke(); }
      for (let y = 0; y < this.H; y += 20) { ctx.strokeStyle = y % 100 ? 'rgba(31,95,168,.05)' : 'rgba(31,95,168,.11)'; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(this.W, y + .5); ctx.stroke(); }
      const sc = this.scene, a = sc.slopeDeg * Math.PI / 180, L = sc.L;
      const span = L + 0.75; const S = Math.min((this.W - 60) / (span * Math.cos(a)), (this.H - 80) / (0.55 + span * Math.sin(Math.abs(a))));
      const ex = [Math.cos(a), -Math.sin(a)], nx = [-Math.sin(a), -Math.cos(a)];
      const totalW = span * Math.cos(a) * S;
      const base = this.H - 52;
      const P0 = [(this.W - totalW) / 2 + 0.35 * Math.cos(a) * S, a >= 0 ? base - 0.35 * Math.sin(a) * S : base + (L + 0.4) * Math.sin(a) * S];
      const pt = (s, n) => [P0[0] + s * S * ex[0] + n * S * nx[0], P0[1] + s * S * ex[1] + n * S * nx[1]];
      // ground
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      const g0 = pt(-0.35, 0), g1 = pt(L + 0.4, 0);
      ctx.beginPath(); ctx.moveTo(...g0); ctx.lineTo(...g1); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = LINE;
      for (let s = -0.35; s < L + 0.4; s += 0.04) { const q = pt(s, 0), q2 = pt(s - 0.03, -0.03); ctx.beginPath(); ctx.moveTo(...q); ctx.lineTo(...q2); ctx.stroke(); }
      if (Math.abs(sc.slopeDeg) > 0.01) {      // slope angle annotation
        const o = pt(-0.35, 0); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(...o); ctx.lineTo(o[0] + 0.55 * S, o[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(o[0], o[1], 0.42 * S, -a, 0, a < 0); ctx.stroke();
        ctx.fillStyle = INK; ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`α = ${sc.slopeDeg}°`, o[0] + 0.45 * S, o[1] - 8);
      }
      if (sc.showTrack) {                      // A / B markers + dimension
        ctx.font = '600 13px IBM Plex Mono, monospace'; ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        [[0, 'A'], [L, 'B']].forEach(([s, lab]) => {
          const b = pt(s, 0), t = pt(s, -0.0); const top = [b[0], b[1] - 0.06 * S];
          ctx.beginPath(); ctx.moveTo(b[0], b[1] + 10); ctx.lineTo(b[0], b[1] + 22); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(b[0] - 6, b[1] + 22); ctx.lineTo(b[0] + 6, b[1] + 22); ctx.stroke();
          ctx.fillText(lab, b[0] - 4, b[1] + 38); void t; void top;
        });
        const d0 = pt(0, 0), d1 = pt(L, 0); const off = 28;
        ctx.strokeStyle = LINE; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(d0[0], d0[1] + off); ctx.lineTo(d1[0], d1[1] + off); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = LINE; ctx.font = '11px IBM Plex Mono, monospace';
        ctx.fillText(`L = ${L.toFixed(2)} m`, (d0[0] + d1[0]) / 2 - 30, (d0[1] + d1[1]) / 2 + off + 14);
      }
      // reference ghost
      if (st.xr !== undefined) {
        const gc = pt(st.xr, p.r); ctx.save(); ctx.globalAlpha = .28; ctx.translate(...gc);
        ctx.strokeStyle = ACC; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, p.r * S, 0, 2 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -(2 * p.l + 0.05) * S); ctx.stroke(); ctx.restore();
      }
      // robot
      const wc = pt(st.x, p.r);
      ctx.save(); ctx.translate(...wc);
      // true vertical + angle arc
      const Hb = (2 * p.l + 0.05) * S;
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -Hb - 18); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.rotate(st.th); drawRobotBody(ctx, S, p, INK, 1.3); ctx.restore();
      const rA = Hb * 0.8; ctx.beginPath();
      if (Math.abs(st.th) > 0.002) { ctx.arc(0, 0, rA, -Math.PI / 2, -Math.PI / 2 + st.th, st.th < 0); ctx.strokeStyle = ACC; ctx.lineWidth = 1.4; ctx.stroke(); }
      ctx.fillStyle = ACC; ctx.font = '600 12px IBM Plex Mono, monospace';
      ctx.fillText(`θ = ${(st.th * 180 / Math.PI).toFixed(1)}°`, 10, -Hb - 6);
      drawWheel(ctx, S, p.r, st.x / p.r);
      // push arrow
      if (st.F) {
        const h = p.h_push * S, px = Math.sin(st.th) * h, py = -Math.cos(st.th) * h, dir = Math.sign(st.F), len = 70;
        ctx.strokeStyle = '#b8322a'; ctx.fillStyle = '#b8322a'; ctx.lineWidth = 2.2;
        const sx = px - dir * (len + 8), ex2 = px - dir * 8;
        ctx.beginPath(); ctx.moveTo(sx, py); ctx.lineTo(ex2, py); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex2, py); ctx.lineTo(ex2 - dir * 11, py - 6); ctx.lineTo(ex2 - dir * 11, py + 6); ctx.closePath(); ctx.fill();
        ctx.font = '600 12px IBM Plex Mono, monospace'; ctx.fillText(`F = ${Math.abs(st.F).toFixed(1)} N`, Math.min(sx, ex2), py - 10);
      }
      ctx.restore();
      if (st.fallen) {
        ctx.save(); ctx.translate(this.W / 2, 60); ctx.rotate(-0.06); ctx.strokeStyle = '#b8322a'; ctx.lineWidth = 2.5; ctx.strokeRect(-90, -24, 180, 44);
        ctx.fillStyle = '#b8322a'; ctx.font = '700 22px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.fillText('ROBOT FELL', 0, 6); ctx.restore();
      }
      // readout
      ctx.fillStyle = INK; ctx.font = '11.5px IBM Plex Mono, monospace';
      ctx.fillText(`t = ${(st.t || 0).toFixed(2)} s    x = ${(st.x || 0).toFixed(3)} m`, 14, 20);
    }
    play(out, { speed = 1, onFrame, onEnd } = {}) {
      this.stop();
      const t0 = performance.now(), T = out.t[out.t.length - 1];
      const step = () => {
        const tt = Math.min(T, (performance.now() - t0) / 1000 * speed);
        let i = Math.min(out.t.length - 1, Math.round(tt / (out.t[1] - out.t[0])));
        const st = { t: out.t[i], x: out.x[i], th: out.th[i], F: out.F[i], xr: out.xr[i], fallen: out.fallenAt !== null && out.fallenAt !== undefined && out.t[i] >= out.fallenAt };
        this.draw(st); onFrame && onFrame(i, st);
        if (tt < T) this.anim = requestAnimationFrame(step); else { this.anim = null; onEnd && onEnd(); }
      };
      this.anim = requestAnimationFrame(step);
    }
    stop() { if (this.anim) cancelAnimationFrame(this.anim); this.anim = null; }
  }

  /* ------------------------------------------------------------ plots */
  function plot(canvas, x, series, o = {}) {
    const dpr = root.devicePixelRatio || 1, w = canvas.clientWidth || 600, h = o.height || 200;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const m = { l: 54, r: 12, t: 18, b: 28 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const upto = o.upto ?? x.length - 1;
    let lo = Infinity, hi = -Infinity;
    series.forEach(s => s.data.forEach(v => { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (o.ylim) [lo, hi] = o.ylim;
    if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const x0 = x[0], x1 = x[x.length - 1];
    const X = v => m.l + (v - x0) / (x1 - x0) * pw, Y = v => m.t + (hi - v) / (hi - lo) * ph;
    ctx.strokeStyle = 'rgba(31,95,168,.12)'; ctx.lineWidth = 1; ctx.font = '10.5px IBM Plex Mono, monospace'; ctx.fillStyle = '#5a7293';
    const ticks = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const k = [1, 2, 5, 10].find(k => (b - a) / (k * st) <= n) * st; const r = []; for (let v = Math.ceil(a / k) * k; v <= b + 1e-12; v += k) r.push(+v.toFixed(10)); return r; };
    ticks(lo, hi, 5).forEach(v => { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke(); ctx.fillText(String(+v.toPrecision(3)), 6, Y(v) + 3); });
    ticks(x0, x1, 9).forEach(v => { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), h - m.b); ctx.stroke(); ctx.fillText(String(v), X(v) - 6, h - 10); });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(m.l, m.t, pw, ph);
    if (lo < 0 && hi > 0) { ctx.strokeStyle = 'rgba(13,43,85,.35)'; ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(w - m.r, Y(0)); ctx.stroke(); }
    series.forEach(s => {
      ctx.strokeStyle = s.color || INK; ctx.lineWidth = s.width || 1.6; ctx.setLineDash(s.dash || []);
      ctx.beginPath(); let started = false;
      for (let i = 0; i <= upto && i < s.data.length; i++) { const v = s.data[i]; if (!isFinite(v)) continue; const px = X(x[i]), py = Y(Math.max(lo, Math.min(hi, v))); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
    });
    if (o.title) { ctx.fillStyle = INK; ctx.font = '600 11.5px IBM Plex Mono, monospace'; ctx.fillText(o.title, m.l, 12); }
    if (o.xlabel) { ctx.fillStyle = '#5a7293'; ctx.fillText(o.xlabel, w - m.r - 60, 12); }
  }

  /* ------------------------------------------------------------ static sketch (SVG) */
  function robotSketchSVG(o = {}) {
    const col = o.color || INK, acc = o.accent || LINE, txt = o.text || col;
    const p = o.p || { l: 0.17, r: 0.04 };
    const S = 600, l = p.l * S, r = p.r * S, H = (2 * p.l + 0.05) * S, w = 0.095 * S;
    const cx = 190, gy = 360, ay = gy - r;
    const plateY = y => ay - y * S;
    const plate = y => `<rect x="${cx - w / 2 - 4}" y="${plateY(y) - 3}" width="${w + 8}" height="6" fill="#fff" stroke="${col}" stroke-width="1.4"/>`;
    const by0 = 0.055, by1 = by0 + 0.065, cy0 = by1 + 0.03, cy1 = Math.min(cy0 + 0.07, 2 * p.l - 0.03);
    const spokes = Array.from({ length: 5 }, (_, k) => { const a = k * 2 * Math.PI / 5 + .3; return `<line x1="${cx + Math.cos(a) * r * .2}" y1="${ay + Math.sin(a) * r * .2}" x2="${cx + Math.cos(a) * r * .8}" y2="${ay + Math.sin(a) * r * .8}" stroke="${col}" stroke-width="1.2"/>`; }).join('');
    const calls = [];
    const call = (x1, y1, x2, y2, t) => { calls.push({ x1, y1, x2, y2, t }); return ''; };
    const renderCalls = () => {
      calls.sort((a, b) => a.y2 - b.y2);
      for (let i = 1; i < calls.length; i++) if (calls[i].y2 < calls[i - 1].y2 + 17) calls[i].y2 = calls[i - 1].y2 + 17;
      const over = calls.length ? calls[calls.length - 1].y2 - (gy - 8) : 0;
      if (over > 0) calls.forEach(c => { c.y2 -= over; });
      for (let i = calls.length - 2; i >= 0; i--) if (calls[i].y2 > calls[i + 1].y2 - 17) calls[i].y2 = calls[i + 1].y2 - 17;
      return calls.map(c => `<polyline points="${c.x1},${c.y1} ${c.x2 - 14},${c.y2} ${c.x2},${c.y2}" fill="none" stroke="${acc}" stroke-width=".9"/><circle cx="${c.x1}" cy="${c.y1}" r="2.2" fill="${acc}"/><text x="${c.x2 + 6}" y="${c.y2 + 4}" font-family="IBM Plex Mono,monospace" font-size="11" fill="${txt}">${c.t}</text>`).join('');
    };
    const hatch = Array.from({ length: 22 }, (_, k) => `<line x1="${40 + k * 14}" y1="${gy}" x2="${32 + k * 14}" y2="${gy + 9}" stroke="${acc}" stroke-width=".9"/>`).join('');
    return `<svg viewBox="0 0 ${o.w || 420} 400" xmlns="http://www.w3.org/2000/svg" ${o.attrs || ''}>
      <g fill="none">
        <line x1="34" y1="${gy}" x2="350" y2="${gy}" stroke="${col}" stroke-width="1.6"/>${hatch}
        <line x1="${cx}" y1="${ay + 6}" x2="${cx}" y2="${ay - H - 26}" stroke="${acc}" stroke-width=".9" stroke-dasharray="6 3 2 3"/>
        <line x1="${cx - w / 2 + 5}" y1="${ay - 16}" x2="${cx - w / 2 + 5}" y2="${ay - H}" stroke="${col}" stroke-width="1.3"/>
        <line x1="${cx + w / 2 - 5}" y1="${ay - 16}" x2="${cx + w / 2 - 5}" y2="${ay - H}" stroke="${col}" stroke-width="1.3"/>
        <rect x="${cx - 0.04 * S}" y="${ay - 0.028 * S}" width="${0.08 * S}" height="${0.056 * S}" fill="#fff" stroke="${col}" stroke-width="1.4"/>
        ${plate(0.045)}
        <rect x="${cx - 0.04 * S}" y="${plateY(by1)}" width="${0.08 * S}" height="${(by1 - by0) * S}" fill="#fff" stroke="${col}" stroke-width="1.3"/>
        <line x1="${cx - 0.04 * S + 0.08 * S / 3}" y1="${plateY(by1)}" x2="${cx - 0.04 * S + 0.08 * S / 3}" y2="${plateY(by0)}" stroke="${col}"/>
        <line x1="${cx - 0.04 * S + 0.16 * S / 3}" y1="${plateY(by1)}" x2="${cx - 0.04 * S + 0.16 * S / 3}" y2="${plateY(by0)}" stroke="${col}"/>
        ${plate(by1 + 0.012)}
        <rect x="${cx - 0.038 * S}" y="${plateY(cy1)}" width="${0.076 * S}" height="${(cy1 - cy0) * S}" fill="#fff" stroke="${col}" stroke-width="1.3"/>
        <rect x="${cx - 0.014 * S}" y="${plateY(cy0 + (cy1 - cy0) * .7)}" width="${0.028 * S}" height="${(cy1 - cy0) * .45 * S}" stroke="${col}"/>
        ${plate(cy1 + 0.012)}
        <rect x="${cx - 0.012 * S}" y="${plateY(cy1 + 0.04)}" width="${0.024 * S}" height="${0.018 * S}" stroke="${col}" stroke-width="1.2"/>
        ${plate(2 * p.l + 0.05)}
        <circle cx="${cx}" cy="${ay}" r="${r}" fill="#fff" stroke="${col}" stroke-width="1.5"/>
        <circle cx="${cx}" cy="${ay}" r="${r * .82}" stroke="${col}" stroke-width="1"/>
        <circle cx="${cx}" cy="${ay}" r="${r * .2}" stroke="${col}" stroke-width="1"/>${spokes}
        <circle cx="${cx}" cy="${ay - l}" r="7" fill="#fff" stroke="${col}" stroke-width="1.3"/>
        <path d="M${cx} ${ay - l} L${cx} ${ay - l - 7} A7 7 0 0 1 ${cx + 7} ${ay - l} Z" fill="${col}"/>
        <path d="M${cx} ${ay - l} L${cx} ${ay - l + 7} A7 7 0 0 1 ${cx - 7} ${ay - l} Z" fill="${col}"/>
        <!-- dimensions -->
        <line x1="${cx - 70}" y1="${ay}" x2="${cx - 70}" y2="${ay - l}" stroke="${acc}" stroke-width=".9"/>
        <line x1="${cx - 76}" y1="${ay}" x2="${cx - 18}" y2="${ay}" stroke="${acc}" stroke-width=".6" stroke-dasharray="2 2"/>
        <line x1="${cx - 76}" y1="${ay - l}" x2="${cx - 8}" y2="${ay - l}" stroke="${acc}" stroke-width=".6" stroke-dasharray="2 2"/>
        <path d="M${cx - 73} ${ay - 8} L${cx - 70} ${ay} L${cx - 67} ${ay - 8}M${cx - 73} ${ay - l + 8} L${cx - 70} ${ay - l} L${cx - 67} ${ay - l + 8}" stroke="${acc}" stroke-width=".9"/>
        <text x="${cx - 80}" y="${ay - l / 2}" font-family="IBM Plex Mono,monospace" font-size="12" fill="${txt}" text-anchor="end">l</text>
        <line x1="${cx - 118}" y1="${gy}" x2="${cx - 118}" y2="${ay - H}" stroke="${acc}" stroke-width=".9"/>
        <line x1="${cx - 124}" y1="${ay - H}" x2="${cx - w / 2 - 6}" y2="${ay - H}" stroke="${acc}" stroke-width=".6" stroke-dasharray="2 2"/>
        <text x="${cx - 126}" y="${(gy + ay - H) / 2}" font-family="IBM Plex Mono,monospace" font-size="12" fill="${txt}" text-anchor="end">H</text>
        <line x1="${cx}" y1="${ay}" x2="${cx + (H + 22) * Math.sin(.17)}" y2="${ay - (H + 22) * Math.cos(.17)}" stroke="${acc}" stroke-width=".8" stroke-dasharray="3 3"/>
        <path d="M${cx} ${ay - H - 12} A ${H + 12} ${H + 12} 0 0 1 ${cx + (H + 12) * Math.sin(.17)} ${ay - (H + 12) * Math.cos(.17)}" stroke="${acc}" stroke-width="1"/>
        <text x="${cx + 12}" y="${ay - H - 18}" font-family="IBM Plex Mono,monospace" font-size="12" fill="${txt}">θ</text>
        ${call(cx + 0.012 * S, plateY(cy1 + 0.032), 300, plateY(cy1 + 0.07), 'IMU  MPU-6050')}
        ${call(cx + 0.03 * S, plateY((cy0 + cy1) / 2), 300, plateY((cy0 + cy1) / 2) + 6, 'ESP32 + H-bridge')}
        ${call(cx + 0.035 * S, plateY((by0 + by1) / 2), 300, plateY((by0 + by1) / 2) + 4, 'Li-ion 3S pack')}
        ${call(cx + 7, ay - l, 300, ay - l + 2, 'centre of mass')}
        ${call(cx + 0.04 * S, ay - 6, 300, ay - 18, 'DC gear-motor ×2')}
        ${call(cx + r * .9, ay + r * .3, 300, ay + 22, 'wheel  r')}
        ${renderCalls()}
      </g>
    </svg>`;
  }

  /* ------------------------------------------------------------ certificate (SVG, A4 landscape) */
  function certificateSVG(d) {
    const W = 1123, H = 794, K = '#13294b', G = '#5b6b82', A = '#a8843a', S = '#1c1c1c';
    const corner = (x, y, sx, sy) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${A}" stroke-width="1.2"><path d="M0 46 L0 0 L46 0"/><path d="M8 38 L8 8 L38 8"/><circle cx="8" cy="8" r="3"/><path d="M16 30 Q16 16 30 16"/></g>`;
    const sketch = robotSketchSVG({ color: S, accent: '#777', text: S, p: d.p, attrs: `x="742" y="250" width="330" height="314"`, w: 420 });
    const logo = d.logo
      ? `<image href="${esc(d.logo)}" x="${W / 2 - 120}" y="52" width="240" height="96" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="${W / 2}" cy="100" r="40" fill="none" stroke="${K}"/><text x="${W / 2}" y="106" text-anchor="middle" font-family="Cormorant Garamond,serif" font-size="22" fill="${K}">BAU</text>`;
    return `<svg class="cert-frame" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:100%;height:auto;display:block;background:#fff">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="${K}" stroke-width="3"/>
      <rect x="31" y="31" width="${W - 62}" height="${H - 62}" fill="none" stroke="${A}" stroke-width="1.2"/>
      <rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${A}" stroke-width=".5"/>
      ${corner(44, 44, 1, 1)}${corner(W - 44, 44, -1, 1)}${corner(44, H - 44, 1, -1)}${corner(W - 44, H - 44, -1, -1)}
      ${logo}
      <text x="${W / 2}" y="170" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-size="12.5" letter-spacing="3.2" fill="${G}">FACULTY OF ENGINEERING · DEPARTMENT OF ELECTRICAL AND COMPUTER ENGINEERING</text>
      <text x="${W / 2}" y="196" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="14" letter-spacing="2" fill="${K}">POWE445 — CONTROL SYSTEMS II</text>
      <line x1="${W / 2 - 170}" y1="214" x2="${W / 2 - 12}" y2="214" stroke="${A}" stroke-width="1"/><path d="M${W / 2} 208 L${W / 2 + 6} 214 L${W / 2} 220 L${W / 2 - 6} 214 Z" fill="${A}"/><line x1="${W / 2 + 12}" y1="214" x2="${W / 2 + 170}" y2="214" stroke="${A}" stroke-width="1"/>
      <text x="${W / 2}" y="270" text-anchor="middle" font-family="Cormorant Garamond,Garamond,Georgia,serif" font-size="50" font-weight="500" letter-spacing="1.5" fill="${K}">Certificate of Achievement</text>
      <text x="96" y="330" font-family="Cormorant Garamond,Georgia,serif" font-size="21" font-style="italic" fill="${G}">This is to certify that</text>
      <text x="96" y="390" font-family="Cormorant Garamond,Georgia,serif" font-size="46" font-weight="600" fill="${K}">${esc(d.name)}</text>
      <line x1="96" y1="404" x2="700" y2="404" stroke="${A}" stroke-width="1.2"/>
      <text x="96" y="426" font-family="IBM Plex Mono,monospace" font-size="13" letter-spacing="1.5" fill="${G}">STUDENT ID  ${esc(d.id)}</text>
      <text x="96" y="468" font-family="Cormorant Garamond,Georgia,serif" font-size="21" fill="${K}">has successfully passed the <tspan font-weight="700" fill="${A}">Control II Technical Assessment</tspan>:</text>
      <text x="96" y="496" font-family="Cormorant Garamond,Georgia,serif" font-size="21" font-style="italic" fill="${K}">Machine-Learning-Enhanced Control of a Self-Balancing Robot,</text>
      <text x="96" y="524" font-family="Cormorant Garamond,Georgia,serif" font-size="19" fill="${G}">covering closed-loop modelling, CCF state-space realisation, controllability,</text>
      <text x="96" y="548" font-family="Cormorant Garamond,Georgia,serif" font-size="19" fill="${G}">observability and stability analysis, and a learned actuator model in the loop.</text>
      <g transform="translate(96 574)">
        <rect x="0" y="0" width="200" height="62" fill="#fbf7ee" stroke="${A}" stroke-width="1.2"/>
        <text x="100" y="20" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10.5" letter-spacing="2" fill="${G}">ACHIEVEMENT</text>
        <text x="100" y="50" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="30" font-weight="700" fill="${K}">${d.pct.toFixed(1)} %</text>
        <rect x="216" y="0" width="200" height="62" fill="#fbf7ee" stroke="${A}" stroke-width="1.2"/>
        <text x="316" y="20" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10.5" letter-spacing="2" fill="${G}">BALANCE INDEX</text>
        <text x="316" y="50" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="30" font-weight="700" fill="${K}">${d.index !== undefined && d.index !== null ? Number(d.index).toFixed(1) : '—'}</text>
      </g>
      ${sketch}
      <text x="906" y="586" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10" letter-spacing="1.6" fill="${G}">PROTOTYPE · SIDE ELEVATION</text>
      <line x1="740" y1="628" x2="1000" y2="628" stroke="${A}" stroke-width="1"/>
      <text x="870" y="648" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-size="12" letter-spacing="1" fill="${G}">Under the supervision of</text>
      <text x="870" y="676" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="26" font-weight="600" fill="${K}">Dr. Youssef Ajra</text>
      <text x="870" y="696" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-size="11" letter-spacing="1" fill="${G}">Course Instructor · Beirut Arab University</text>
      <text x="96" y="676" font-family="IBM Plex Mono,monospace" font-size="11" letter-spacing="1.4" fill="${G}">DATE</text>
      <text x="96" y="698" font-family="Cormorant Garamond,Georgia,serif" font-size="21" fill="${K}">${esc(d.date)}</text>
      <text x="300" y="676" font-family="IBM Plex Mono,monospace" font-size="11" letter-spacing="1.4" fill="${G}">VERIFICATION CODE</text>
      <text x="300" y="698" font-family="IBM Plex Mono,monospace" font-size="15" fill="${K}">${esc(d.code)}</text>
      <g transform="translate(594 640)">
        <defs><path id="sealp" d="M -44 0 A 44 44 0 1 1 44 0 A 44 44 0 1 1 -44 0"/></defs>
        <circle r="56" fill="#fbf7ee" stroke="${A}" stroke-width="1.6"/><circle r="51" fill="none" stroke="${A}" stroke-width=".6"/><circle r="33" fill="none" stroke="${A}" stroke-width=".6"/>
        <text font-family="IBM Plex Mono,monospace" font-size="8.6" letter-spacing="2.2" fill="${A}"><textPath href="#sealp" startOffset="0">POWE445 · CONTROL SYSTEMS II · TECHNICAL ASSESSMENT ·</textPath></text>
        <text y="-4" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="17" font-weight="700" fill="${K}">BAU</text>
        <text y="12" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="8" letter-spacing="1" fill="${G}">${esc(C.VERSION)}</text>
      </g>
      <text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9.5" letter-spacing="1.6" fill="${G}">POWE445 SELF-BALANCING ROBOT CHALLENGE · ${esc(C.VERSION)} · CREATED BY YOUSSEF AJRA</text>
    </svg>`;
  }

  /* ------------------------------------------------------------ misc */
  function download(name, text, mime = 'text/plain') {
    const b = new Blob([text], { type: mime }); const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function toast(msg, type = '') {
    let host = document.querySelector('.toast'); if (!host) { host = document.createElement('div'); host.className = 'toast'; document.body.appendChild(host); }
    const d = document.createElement('div'); d.className = type; d.textContent = msg; host.appendChild(d); setTimeout(() => d.remove(), 3800);
  }
  // local copy first (put the file in assets/), then the hosted logo, then a text badge
  const LOGO_SOURCES = ['assets/bau-logo.png', 'https://usif-3jra.github.io/epme-study-plan/assets/logo_ECE.png'];
  function logoHTML(cls = 'logo') {
    return `<img class="${cls}" src="${LOGO_SOURCES[0]}" alt="Beirut Arab University" data-i="0" onerror="var i=+this.dataset.i+1;var L=${esc(JSON.stringify(LOGO_SOURCES))};if(i<L.length){this.dataset.i=i;this.src=L[i];}else{this.outerHTML='<div class=&quot;logo-fallback&quot;>BAU</div>';}">`;
  }
  function resolveLogo() {             // -> Promise<absolute URL | null>
    return new Promise(res => {
      const tryAt = i => {
        if (i >= LOGO_SOURCES.length) return res(null);
        const url = new URL(LOGO_SOURCES[i], location.href).href, img = new Image();
        img.onload = () => res(url); img.onerror = () => tryAt(i + 1); img.src = url;
      };
      tryAt(0);
    });
  }
  function matHTML(M, digits = 5) {
    return `<div class="mbracket"><table class="mview">${M.map(r => `<tr>${r.map(v => `<td>${esc(C.fmt(v, digits))}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  function eigPlotSVG(ev) {
    const W = 360, H = 220, m = 30;
    const re = ev.map(z => z[0]), im = ev.map(z => z[1]);
    const xr = Math.max(1, ...re.map(Math.abs)) * 1.15, yr = Math.max(1, ...im.map(Math.abs)) * 1.3;
    const X = v => m + (v + xr) / (xr * 1.25) * (W - 2 * m), Y = v => H / 2 - v / yr * (H / 2 - m);
    const x0 = X(0);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:420px;border:1px solid ${SOFT};background:#fff">
      <rect x="${x0}" y="0" width="${W - x0}" height="${H}" fill="#fbe9e7" opacity=".6"/>
      <line x1="${m - 10}" y1="${H / 2}" x2="${W - 8}" y2="${H / 2}" stroke="${INK}" marker-end="url(#ah2)"/><line x1="${x0}" y1="${H - 8}" x2="${x0}" y2="8" stroke="${INK}"/>
      <text x="${W - 30}" y="${H / 2 - 6}" font-family="IBM Plex Mono,monospace" font-size="11" fill="${INK}">Re</text><text x="${x0 + 6}" y="16" font-family="IBM Plex Mono,monospace" font-size="11" fill="${INK}">Im</text>
      <text x="${x0 + 6}" y="${H - 10}" font-family="IBM Plex Mono,monospace" font-size="10" fill="#b8322a">unstable (RHP)</text>
      ${ev.map(z => `<g transform="translate(${X(z[0])} ${Y(z[1])})"><line x1="-5" y1="-5" x2="5" y2="5" stroke="${ACC}" stroke-width="2"/><line x1="-5" y1="5" x2="5" y2="-5" stroke="${ACC}" stroke-width="2"/></g>`).join('')}
      <text x="${m}" y="${H - 10}" font-family="IBM Plex Mono,monospace" font-size="10" fill="#5a7293">Re min ${C.fmt(Math.min(...re), 3)}</text>
    </svg>`;
  }

  root.UI = { resolveLogo, LOGO_SOURCES, esc, polyText, fracHTML, SIGNALS, blockDiagram, RobotView, plot, robotSketchSVG, certificateSVG, download, toast, logoHTML, matHTML, eigPlotSVG };
})(window);
