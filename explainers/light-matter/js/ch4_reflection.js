/* ch4_reflection.js — Huygens wavelets from real atoms, and Brewster's angle from the dipole pattern */
(function () {
  'use strict';
  const { s, text, TAU, clamp, mod } = LM;

  /* ================= wavelets from surface atoms ================= */
  LM.scene('fig-huygens', function (fig, sc) {
    const svg = document.getElementById('huy-svg');
    const W = 960, H = 440, YI = 220, XA = 60, XB = 900, LAM = 56, CV = 140, N2 = 1.5;
    let th = 35 * LM.DEG, dRel = 0.3, mode = 'pulse', env = true;
    const defs = s('defs', null, svg);
    s('clipPath', { id: 'hy-up' }, defs).appendChild(LM.s('rect', { x: 0, y: 0, width: W, height: YI }));
    s('clipPath', { id: 'hy-lo' }, defs).appendChild(LM.s('rect', { x: 0, y: YI, width: W, height: H - YI }));
    s('rect', { x: 0, y: YI, width: W, height: H - YI, class: 'f-med2' }, svg);
    text(svg, 18, H - 16, '介质 n = 1.5（子波以 c/n 传播）', 't-s');
    text(svg, 18, 30, '真空 / 空气', 't-s');
    const gUp = s('g', { 'clip-path': 'url(#hy-up)' }, svg);
    const gLo = s('g', { 'clip-path': 'url(#hy-lo)' }, svg);
    const MAXC = 760;
    const cu = [], cl = [];
    for (let i = 0; i < MAXC; i++) {
      cu.push(s('circle', { fill: 'none', class: 's-m', 'stroke-width': 1, visibility: 'hidden' }, gUp));
      cl.push(s('circle', { fill: 'none', class: 's-m', 'stroke-width': 1, visibility: 'hidden' }, gLo));
    }
    const gEnv = s('g', null, svg);
    const incP = [], refP = [], traP = [];
    for (let i = 0; i < 14; i++) {
      incP.push(s('line', { class: 's-e', 'stroke-width': 3, 'stroke-linecap': 'round' }, gEnv));
      refP.push(s('line', { class: 's-e', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85 }, gEnv));
      traP.push(s('line', { class: 's-e', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85 }, gEnv));
    }
    gEnv.setAttribute('clip-path', 'url(#hy-all)');
    s('clipPath', { id: 'hy-all' }, defs).appendChild(LM.s('rect', { x: 0, y: 0, width: W, height: H }));
    s('line', { x1: 0, x2: W, y1: YI, y2: YI, class: 's-ink2', 'stroke-width': 1.2 }, svg);
    const gAt = s('g', null, svg);
    let atoms = [];
    const gOrd = s('g', null, svg);
    const ordEls = [];
    for (let i = 0; i < 8; i++) {
      const g = s('g', { visibility: 'hidden' }, gOrd);
      const ln = s('line', { class: 's-ink', 'stroke-width': 1.6, 'stroke-dasharray': '7 5' }, g);
      const tx = text(g, 0, 0, '', 't-s halo');
      ordEls.push({ g: g, ln: ln, tx: tx });
    }
    const note = text(svg, W - 16, 30, '', 't-s end halo');

    function buildAtoms() {
      gAt.textContent = '';
      atoms = [];
      const d = dRel * LAM;
      for (let x = XA; x <= XB + 0.1; x += d) atoms.push({ x: x, el: s('circle', { cx: x.toFixed(1), cy: YI, r: dRel < 0.5 ? 3 : 4.5, class: 'f-m' }, gAt) });
    }
    function readouts() {
      LM.setText('huy-r', LM.f(th / LM.DEG, 0) + '°');
      LM.setText('huy-t', LM.f(Math.asin(Math.sin(th) / N2) / LM.DEG, 1) + '°');
      const d = dRel * LAM, ords = [];
      for (let m = -3; m <= 3; m++) {
        if (!m) continue;
        const sa = Math.sin(th) - (m * LAM) / d;
        if (Math.abs(sa) <= 1) ords.push('m = ' + (m > 0 ? '+' : '−') + Math.abs(m) + '：' + LM.f(Math.asin(sa) / LM.DEG, 0) + '°');
      }
      LM.setText('huy-orders', ords.length ? ords.join('；') + (mode === 'pulse' ? '（切到“连续波”可见）' : '') : '没有：原子间距 d < λ/(1 + sin θ)，只剩镜面方向');
    }
    LM.range('huy-th', (v) => {
      th = v * LM.DEG;
      readouts();
      sc.render();
    }, (v) => v + '°');
    LM.range('huy-d', (v) => {
      dRel = v;
      buildAtoms();
      readouts();
      sc.render();
    }, (v) => LM.f(v, 2));
    LM.seg('huy-mode', (v) => {
      mode = v;
      sc.t = 0;
      readouts();
      sc.render();
    });
    const envCb = document.getElementById('huy-env');
    envCb.addEventListener('change', () => {
      env = envCb.checked;
      sc.render();
    });

    function seg(el, x1, y1, x2, y2) {
      LM.attr(el, { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), visibility: null });
    }
    function update(t) {
      const st = Math.sin(th), ct = Math.cos(th), s2 = st / N2, c2 = Math.sqrt(1 - s2 * s2);
      const span = (XB - XA) * st;
      const RMAX = mode === 'cw' ? (dRel < 0.5 ? 250 : 330) : 520;
      const cyc = (span + RMAX) / CV + 0.8;
      const tl = mode === 'pulse' ? mod(t, cyc) - 0.3 : t;
      const ctl = CV * tl;
      const crests = [];
      if (mode === 'pulse') crests.push(0);
      else {
        const mHi = Math.floor(ctl / LAM) + 3;
        for (let m = mHi; m >= mHi - 13; m--) crests.push(m);
      }
      let iu = 0, il = 0;
      for (const a of atoms) {
        const xr = a.x - XA;
        let lit = 0;
        for (const m of crests) {
          const age = ctl - (xr * st + m * LAM);
          if (age <= 0) continue;
          lit = Math.max(lit, Math.max(0, 1 - age / 60));
          const ru = age, rl = age / N2;
          if (ru < RMAX && iu < MAXC) {
            LM.attr(cu[iu++], { cx: a.x.toFixed(1), cy: YI, r: ru.toFixed(1), opacity: (0.75 * (1 - ru / RMAX)).toFixed(3), visibility: null });
          }
          if (rl < RMAX / N2 && il < MAXC) {
            LM.attr(cl[il++], { cx: a.x.toFixed(1), cy: YI, r: rl.toFixed(1), opacity: (0.75 * (1 - rl / (RMAX / N2))).toFixed(3), visibility: null });
          }
        }
        a.el.setAttribute('r', ((dRel < 0.5 ? 3 : 4.5) + 3 * lit).toFixed(1));
      }
      for (; iu < MAXC; iu++) cu[iu].setAttribute('visibility', 'hidden');
      for (; il < MAXC; il++) cl[il].setAttribute('visibility', 'hidden');

      /* envelopes: incident, reflected and refracted crests */
      let k = 0;
      for (const m of crests) {
        if (k >= incP.length) break;
        const D = ctl - m * LAM;
        const xm = D / st;
        if (xm < -800 || D > (XB - XA) * st + 900) continue;
        const ip = incP[k], rp = refP[k], tp = traP[k];
        k++;
        if (!env) {
          [ip, rp, tp].forEach((e) => e.setAttribute('visibility', 'hidden'));
          continue;
        }
        /* incident crest u_i·r = D (origin at the first atom): the part still above the interface */
        seg(ip, XA + xm, YI, XA + xm + 900 * ct, YI - 900 * st);
        if (xm > 0) {
          /* reflected crest u_r·r = D and refracted crest u_t·r = D/n, each bounded by the tangent
             points of the first atom's wavelet and of the last atom reached so far */
          const XE = XB - XA;
          const ex = XA + D * st, ey = YI - D * ct;
          const fx = XA + (D / N2) * s2, fy = YI + (D / N2) * c2;
          if (xm <= XE) {
            seg(rp, XA + xm, YI, ex, ey);
            seg(tp, XA + xm, YI, fx, fy);
          } else {
            const q = D - XE * st;
            seg(rp, XA + XE + q * st, YI - q * ct, ex, ey);
            seg(tp, XA + XE + (q / N2) * s2, YI + (q / N2) * c2, fx, fy);
          }
        } else {
          rp.setAttribute('visibility', 'hidden');
          tp.setAttribute('visibility', 'hidden');
        }
      }
      for (; k < incP.length; k++) [incP[k], refP[k], traP[k]].forEach((e) => e.setAttribute('visibility', 'hidden'));

      /* diffraction orders (continuous wave only) */
      let oi = 0;
      if (mode === 'cw') {
        const d = dRel * LAM;
        for (let m = -3; m <= 3; m++) {
          if (!m || oi >= ordEls.length) continue;
          const sa = st - (m * LAM) / d;
          if (Math.abs(sa) <= 1) {
            const ca = Math.sqrt(1 - sa * sa), o = ordEls[oi++];
            LM.attr(o.ln, { x1: 480, y1: YI, x2: 480 + 205 * sa, y2: YI - 205 * ca });
            LM.attr(o.tx, { x: 480 + 222 * sa - 18, y: YI - 222 * ca });
            LM.setText(o.tx, '反射 m=' + (m > 0 ? '+' : '−') + Math.abs(m));
            o.g.removeAttribute('visibility');
          }
          const sb = (st - (m * LAM) / d) / N2;
          if (Math.abs(sb) <= 1 && oi < ordEls.length) {
            const cb = Math.sqrt(1 - sb * sb), o = ordEls[oi++];
            LM.attr(o.ln, { x1: 480, y1: YI, x2: 480 + 170 * sb, y2: YI + 170 * cb });
            LM.attr(o.tx, { x: 480 + 184 * sb - 18, y: YI + 184 * cb + 12 });
            LM.setText(o.tx, '折射 m=' + (m > 0 ? '+' : '−') + Math.abs(m));
            o.g.removeAttribute('visibility');
          }
        }
      }
      for (; oi < ordEls.length; oi++) ordEls[oi].g.setAttribute('visibility', 'hidden');
      LM.setText(note, mode === 'cw' && dRel >= 0.5 ? '虚线：除镜面方向外，子波也能相长的方向（衍射级）' : '');
    }
    buildAtoms();
    readouts();
    return { update: update, t0: 2.2 };
  });

  /* ================= Brewster ================= */
  LM.scene('fig-brewster', function (fig, sc) {
    const svg = document.getElementById('brew-svg');
    const chart = document.getElementById('brew-chart');
    const YI = 205, P0 = [250, YI], RL = 188;
    let th = 40 * LM.DEG, n2 = 1.333, pol = 'p';
    s('rect', { x: 0, y: YI, width: 560, height: 420 - YI, class: 'f-med2' }, svg);
    s('line', { x1: 0, x2: 560, y1: YI, y2: YI, class: 's-ink2', 'stroke-width': 1.5 }, svg);
    s('line', { x1: P0[0], x2: P0[0], y1: 22, y2: 400, class: 's-mut', 'stroke-width': 1.1, 'stroke-dasharray': '6 5' }, svg);
    const matT = text(svg, 14, 408, '', 't-b');
    text(svg, 14, 26, '空气 n = 1.00', 't-b');
    const lobe = s('path', { class: 'f-m s-m', 'fill-opacity': 0.13, 'stroke-width': 1.6 }, svg);
    const rayI = LM.arrow(svg, 'var(--ink)', 2.4, 13);
    const rayR = LM.arrow(svg, 'var(--ink)', 2.4, 13);
    const rayT = LM.arrow(svg, 'var(--ink)', 2.4, 13);
    const marks = s('g', null, svg);
    const probe = s('line', { class: 's-m', 'stroke-width': 1.6, 'stroke-dasharray': '4 4' }, svg);
    const probeDot = s('circle', { r: 5, class: 'f-m', stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    const axis = s('line', { class: 's-m', 'stroke-width': 1.2, opacity: 0.7 }, svg);
    const elec = s('circle', { r: 6.5, class: 'f-m' }, svg);
    const sDip = s('g', null, svg);
    s('circle', { r: 9, fill: 'none', class: 's-m', 'stroke-width': 2 }, sDip);
    const sDot = s('circle', { r: 3, class: 'f-m' }, sDip);
    const lI = text(svg, 0, 0, '入射', 't-s halo'), lR = text(svg, 0, 0, '', 't-s halo'), lT = text(svg, 0, 0, '折射', 't-s halo');
    const sumT = text(svg, 540, 50, '', 't-b end halo');
    const prT = text(svg, 540, 72, '', 't-s end halo');
    const dipT = text(svg, 0, 0, '', 't-s t-mat halo');

    /* chart */
    const X = LM.lin(0, 90, 54, 380), Y = LM.lin(0, 1, 360, 40);
    for (let v = 0; v <= 1.001; v += 0.2) {
      s('line', { x1: 54, x2: 380, y1: Y(v), y2: Y(v), class: v === 0 ? 's-axis' : 's-grid', 'stroke-width': 1 }, chart);
      text(chart, 46, Y(v) + 4, LM.f(v * 100, 0) + '%', 't-mono end', { 'font-size': 11.5 });
    }
    for (let a = 0; a <= 90; a += 15) {
      s('line', { x1: X(a), x2: X(a), y1: 360, y2: 365, class: 's-axis', 'stroke-width': 1 }, chart);
      text(chart, X(a), 380, a + '°', 't-mono mid', { 'font-size': 11.5 });
    }
    text(chart, 217, 404, '入射角 θ₁', 't-s mid');
    const cS = s('polyline', { class: 'ln', stroke: 'var(--s2)', 'stroke-width': 2 }, chart);
    const cP = s('polyline', { class: 'ln', stroke: 'var(--s1)', 'stroke-width': 2 }, chart);
    const bLine = s('line', { y1: 40, y2: 360, class: 's-mut', 'stroke-width': 1 }, chart);
    const bTxt = text(chart, 0, 0, '', 't-s halo');
    const lS = text(chart, 0, 0, 'Rₛ', 't-m'), lP = text(chart, 0, 0, 'Rₚ', 't-m');
    const lg = s('g', { transform: 'translate(56 20)' }, chart);
    s('line', { x1: 0, x2: 16, y1: 0, y2: 0, stroke: 'var(--s2)', 'stroke-width': 2.5 }, lg);
    text(lg, 22, 4, 's 偏振', 't-s', { fill: 'var(--ink-2)' });
    s('line', { x1: 86, x2: 102, y1: 0, y2: 0, stroke: 'var(--s1)', 'stroke-width': 2.5 }, lg);
    text(lg, 108, 4, 'p 偏振', 't-s', { fill: 'var(--ink-2)' });
    const mk = s('line', { y1: 40, y2: 360, class: 's-ink', 'stroke-width': 1.2 }, chart);
    const dS = s('circle', { r: 5, fill: 'var(--s2)', stroke: 'var(--surface)', 'stroke-width': 2 }, chart);
    const dP = s('circle', { r: 5, fill: 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2 }, chart);
    const tip = LM.tip(chart.parentNode);

    function drawCurves() {
      const ps = [], pp = [];
      for (let a = 0; a <= 89.9; a += 0.5) {
        const f = LM.fresnel(1, n2, a * LM.DEG);
        ps.push([X(a), Y(f.Rs)]);
        pp.push([X(a), Y(f.Rp)]);
      }
      const f90 = LM.fresnel(1, n2, 89.99 * LM.DEG);
      ps.push([X(90), Y(f90.Rs)]);
      pp.push([X(90), Y(f90.Rp)]);
      cS.setAttribute('points', LM.pts(ps));
      cP.setAttribute('points', LM.pts(pp));
      const tb = Math.atan(n2) / LM.DEG;
      LM.attr(bLine, { x1: X(tb), x2: X(tb) });
      LM.attr(bTxt, { x: X(tb) - 6, y: 120 });
      bTxt.setAttribute('class', 't-s halo end');
      LM.setText(bTxt, 'θB = ' + LM.f(tb, 1) + '°');
      /* direct labels where the curves are well separated: Rs left of its curve at R = 0.5, Rp right of its curve at R = 0.3 */
      let aS = 89, aP = 89;
      for (let a = 0; a < 89.9; a += 0.25) {
        const f = LM.fresnel(1, n2, a * LM.DEG);
        if (aS === 89 && f.Rs >= 0.5) aS = a;
        if (aP === 89 && a > tb && f.Rp >= 0.3) aP = a;
      }
      LM.attr(lS, { x: X(aS) - 30, y: Y(0.5) + 5 });
      LM.attr(lP, { x: X(aP) + 9, y: Y(0.3) + 5 });
    }
    function readouts() {
      const f = LM.fresnel(1, n2, th);
      const th2 = f.th2;
      LM.attr(mk, { x1: X(th / LM.DEG), x2: X(th / LM.DEG) });
      LM.attr(dS, { cx: X(th / LM.DEG), cy: Y(f.Rs) });
      LM.attr(dP, { cx: X(th / LM.DEG), cy: Y(f.Rp) });
      LM.setText('brew-th2', LM.f(th2 / LM.DEG, 1) + '°');
      LM.setText('brew-sum', LM.f((th + th2) / LM.DEG, 1) + '°');
      LM.setText('brew-rs', LM.f(f.Rs * 100, 2) + '%');
      LM.setText('brew-rp', LM.f(f.Rp * 100, 2) + '%');
      LM.setText('brew-tb', LM.f(Math.atan(n2) / LM.DEG, 1) + '°');
      const dop = f.Rs + f.Rp > 0 ? (f.Rs - f.Rp) / (f.Rs + f.Rp) : 0;
      LM.setText('brew-dop', LM.f(dop * 100, 0) + '%');
      LM.setText(matT, (n2 < 1.4 ? '水' : n2 < 2 ? '玻璃' : '钻石') + ' n = ' + LM.f(n2, 3));
      const near = Math.abs((th + th2) / LM.DEG - 90) < 0.75;
      LM.setText(sumT, 'θ₁ + θ₂ = ' + LM.f((th + th2) / LM.DEG, 1) + '°' + (near ? '  ← 布儒斯特角' : ''));
      LM.setText(prT, pol === 'p' ? '反射率 Rₚ = ' + LM.f(f.Rp * 100, 2) + '%' : '反射率 Rₛ = ' + LM.f(f.Rs * 100, 2) + '%');
    }
    const slider = LM.range('brew-th', (v) => {
      th = v * LM.DEG;
      readouts();
      sc.render();
    }, (v) => LM.f(v, 1).replace('.0', '') + '°');
    LM.seg('brew-mat', (v) => {
      n2 = parseFloat(v);
      drawCurves();
      readouts();
      sc.render();
    });
    LM.seg('brew-pol', (v) => {
      pol = v;
      readouts();
      sc.render();
    });
    document.getElementById('brew-jump').addEventListener('click', () => slider.set((Math.atan(n2) / LM.DEG).toFixed(1)));
    LM.drag(chart, (x, y, kind) => {
      if (kind === 'leave') {
        tip.hide();
        return;
      }
      const a = clamp(X.inv(x), 0, 89);
      if (kind === 'down' || kind === 'drag') slider.set(a.toFixed(1));
      const f = LM.fresnel(1, n2, a * LM.DEG);
      const pp = LM.toPanel(chart, X(a), Y(Math.max(f.Rs, f.Rp)));
      tip.show(pp[0], pp[1], 'θ₁ = ' + LM.f(a, 1) + '°', [
        { color: 'var(--s2)', value: LM.f(f.Rs * 100, 2) + '%', label: 's 偏振' },
        { color: 'var(--s1)', value: LM.f(f.Rp * 100, 2) + '%', label: 'p 偏振' },
      ]);
    });

    function polMarks(x1, y1, ux, uy, kind, t, op) {
      for (let i = 1; i <= 3; i++) {
        const f = i / 4, cx = x1 + ux * RL * f, cy = y1 + uy * RL * f;
        if (kind === 'p') {
          const px = -uy, py = ux, L = 11;
          const g = s('g', { opacity: op }, marks);
          LM.arrowAt(g, cx, cy, cx + px * L, cy + py * L, 'var(--efield)', 1.8, 5);
          LM.arrowAt(g, cx, cy, cx - px * L, cy - py * L, 'var(--efield)', 1.8, 5);
        } else {
          s('circle', { cx: cx, cy: cy, r: 5.5, fill: 'none', class: 's-e', 'stroke-width': 1.6, opacity: op }, marks);
          s('circle', { cx: cx, cy: cy, r: 1.8, class: 'f-e', opacity: op }, marks);
        }
      }
    }
    function update(t) {
      const f = LM.fresnel(1, n2, th);
      const st = Math.sin(th), ct = Math.cos(th), s2 = f.s2, c2 = Math.sqrt(1 - s2 * s2);
      const ui = [st, ct], ur = [st, -ct], ut = [s2, c2];
      const R = pol === 'p' ? f.Rp : f.Rs;
      rayI.set(P0[0] - RL * ui[0], P0[1] - RL * ui[1], P0[0] - 2 * ui[0], P0[1] - 2 * ui[1], 13);
      rayR.set(P0[0], P0[1], P0[0] + RL * ur[0], P0[1] + RL * ur[1], 13).opacity((0.08 + 0.92 * Math.min(1, Math.sqrt(R) * 2.2)).toFixed(3));
      rayT.set(P0[0], P0[1], P0[0] + RL * ut[0], P0[1] + RL * ut[1], 13);
      LM.attr(lI, { x: P0[0] - RL * ui[0] - 4, y: P0[1] - RL * ui[1] - 12 });
      LM.attr(lR, { x: P0[0] + RL * ur[0] - 10, y: P0[1] + RL * ur[1] - 12 });
      LM.setText(lR, R < 0.002 ? '反射 ≈ 0' : '反射');
      LM.attr(lT, { x: P0[0] + RL * ut[0] + 8, y: P0[1] + RL * ut[1] + 4 });
      marks.textContent = '';
      polMarks(P0[0] - RL * ui[0], P0[1] - RL * ui[1], ui[0], ui[1], pol, t, 1);
      polMarks(P0[0], P0[1], ut[0], ut[1], pol, t, 0.9);
      if (R > 0.002) polMarks(P0[0], P0[1], ur[0], ur[1], pol, t, Math.min(1, 0.2 + Math.sqrt(R) * 2));
      const Q = [P0[0] + 92 * ut[0], P0[1] + 92 * ut[1]];
      const osc = Math.sin(t * 5.5);
      const LR = 86;
      if (pol === 'p') {
        const e = [c2, -s2];
        const aAx = Math.atan2(e[1], e[0]);
        const pts = [];
        for (let i = 0; i <= 180; i++) {
          const a = (i / 180) * TAU;
          const r = LR * Math.pow(Math.sin(a - aAx), 2);
          pts.push([Q[0] + r * Math.cos(a), Q[1] + r * Math.sin(a)]);
        }
        lobe.setAttribute('d', LM.pathOf(pts, true));
        LM.attr(axis, { x1: Q[0] - 30 * e[0], y1: Q[1] - 30 * e[1], x2: Q[0] + 30 * e[0], y2: Q[1] + 30 * e[1], visibility: null });
        LM.attr(elec, { cx: Q[0] + 18 * osc * e[0], cy: Q[1] + 18 * osc * e[1], visibility: null });
        sDip.setAttribute('visibility', 'hidden');
        const cosA = e[0] * ur[0] + e[1] * ur[1];
        const s2a = 1 - cosA * cosA;
        LM.attr(probe, { x1: Q[0], y1: Q[1], x2: Q[0] + 120 * ur[0], y2: Q[1] + 120 * ur[1] });
        LM.attr(probeDot, { cx: Q[0] + LR * s2a * ur[0], cy: Q[1] + LR * s2a * ur[1] });
        LM.attr(dipT, { x: Q[0] + 14, y: Q[1] + 52 });
        LM.setText(dipT, '沿反射方向的辐射 ∝ sin²α = ' + LM.f(s2a, 2));
      } else {
        lobe.setAttribute('d', 'M' + (Q[0] + LR) + ' ' + Q[1] + ' A' + LR + ' ' + LR + ' 0 1 1 ' + (Q[0] - LR) + ' ' + Q[1] + ' A' + LR + ' ' + LR + ' 0 1 1 ' + (Q[0] + LR) + ' ' + Q[1] + 'Z');
        axis.setAttribute('visibility', 'hidden');
        elec.setAttribute('visibility', 'hidden');
        sDip.setAttribute('transform', 'translate(' + Q[0].toFixed(1) + ' ' + Q[1].toFixed(1) + ')');
        sDip.removeAttribute('visibility');
        sDot.setAttribute('r', (2 + 2.2 * Math.abs(osc)).toFixed(2));
        LM.attr(probe, { x1: Q[0], y1: Q[1], x2: Q[0] + 120 * ur[0], y2: Q[1] + 120 * ur[1] });
        LM.attr(probeDot, { cx: Q[0] + LR * ur[0], cy: Q[1] + LR * ur[1] });
        LM.attr(dipT, { x: Q[0] + 14, y: Q[1] + 52 });
        LM.setText(dipT, '电子垂直纸面振动：纸面内各方向都辐射');
      }
    }
    drawCurves();
    readouts();
    return { update: update, t0: 0.3 };
  });
})();
