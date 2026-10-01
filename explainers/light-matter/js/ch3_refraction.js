/* ch3_refraction.js — why light "slows down" (slab, phasor chain, single layer) and Snell's law */
(function () {
  'use strict';
  const { s, text, TAU, clamp, mod } = LM;

  /* ================= slab + phasors ================= */
  LM.scene('fig-slab', function (fig, sc) {
    const svg = document.getElementById('slab-svg');
    const ph = document.getElementById('slab-phasor');
    const ly = document.getElementById('slab-layer');
    const X0 = 30, Z1 = 350, Z2 = 530, L = Z2 - Z1, ZMAX = 900, CY = 132, A = 56, LAM = 88, T = 1.6;
    let n = 1.5;

    s('rect', { x: X0 + Z1, y: 30, width: L, height: 200, class: 'f-med s-med', 'stroke-width': 1.2 }, svg);
    const nTxt = text(svg, X0 + Z1 + L / 2, 48, '', 't-b mid');
    const atoms = [];
    for (let i = 0; i < 7; i++) {
      for (let j = -2; j <= 2; j++) {
        const x = X0 + Z1 + 14 + i * 25.3, y = CY + j * 27;
        s('circle', { cx: x, cy: y, r: 2.2, class: 'f-mut' }, svg);
        atoms.push({ z: x - X0, y: y, el: s('circle', { cx: x, cy: y, r: 3.4, class: 'f-m', opacity: 0.9 }, svg) });
      }
    }
    s('line', { x1: X0, x2: X0 + ZMAX, y1: CY, y2: CY, class: 's-grid', 'stroke-width': 1 }, svg);
    const ghost = s('polyline', { class: 'ln s-mut', 'stroke-width': 1.6, 'stroke-dasharray': '5 5' }, svg);
    const wave = s('polyline', { class: 'ln s-e', 'stroke-width': 2.6 }, svg);
    const gDots = [], aDots = [];
    for (let i = 0; i < 14; i++) {
      gDots.push(s('circle', { r: 5, fill: 'none', class: 's-mut', 'stroke-width': 1.6 }, svg));
      aDots.push(s('circle', { r: 5, class: 'f-e' }, svg));
    }
    const brk = s('path', { class: 'ln s-ink', 'stroke-width': 1.3 }, svg);
    const brkT = text(svg, 0, 0, '', 't-s mid halo');
    const lg = s('g', { transform: 'translate(36 30)' }, svg);
    s('line', { x1: 0, x2: 22, y1: 0, y2: 0, class: 's-mut', 'stroke-width': 1.6, 'stroke-dasharray': '5 5' }, lg);
    text(lg, 28, 4, '参考波（假如没有玻璃）', 't-s');
    s('line', { x1: 0, x2: 22, y1: 20, y2: 20, class: 's-e', 'stroke-width': 2.6 }, lg);
    text(lg, 28, 24, '实际的波', 't-s');
    text(svg, X0 + Z1 + L / 2, 222, '每个绿点是一个被驱动的电子', 't-s mid');

    const zEff = (z) => (z < Z1 ? z : z < Z2 ? Z1 + n * (z - Z1) : z + (n - 1) * L);
    const zAct = (zg) => (zg < Z1 ? zg : zg < Z1 + n * L ? Z1 + (zg - Z1) / n : zg - (n - 1) * L);

    /* phasor chain */
    const O = [64, 58], R = 168, DEL = 7 * LM.DEG, NL = 13;
    s('path', { d: 'M' + (O[0] + R) + ' ' + O[1] + ' A' + R + ' ' + R + ' 0 0 1 ' + (O[0] + R * Math.cos(1.75)).toFixed(1) + ' ' + (O[1] + R * Math.sin(1.75)).toFixed(1), class: 'ln s-rule', 'stroke-width': 1.2, 'stroke-dasharray': '3 4' }, ph);
    LM.arrowAt(ph, O[0], O[1], O[0] + R, O[1], 'var(--muted)', 2, 11);
    text(ph, O[0] + R + 10, O[1] + 5, '入射波 E₀', 't-s');
    const chain = [];
    for (let i = 0; i < NL; i++) chain.push(LM.arrow(ph, 'var(--matter)', 2.2, 7));
    const tot = LM.arrow(ph, 'var(--efield)', 3.2, 13);
    const angArc = s('path', { class: 'ln s-ink2', 'stroke-width': 1.2 }, ph);
    const cntT = text(ph, 452, 252, '', 't-mono end');
    text(ph, 452, 272, '绿：每层原子的贡献　橙：总场', 't-s end');
    s('circle', { cx: O[0], cy: O[1], r: 3, class: 'f-ink' }, ph);

    /* single layer decomposition */
    const LX0 = 40, LX1 = 452, LL = 150, LA = 30, EPS = 0.38;
    const rowsY = [58, 142, 226];
    text(ly, LX0, 20, '入射波', 't-s');
    text(ly, LX0, 104, '这一层电子的辐射：很弱，落后 ¼ 周期（已放大）', 't-s t-mat');
    text(ly, LX0, 188, '两者之和：振幅几乎不变，相位略微落后', 't-s t-e');
    rowsY.forEach((y) => s('line', { x1: LX0, x2: LX1, y1: y, y2: y, class: 's-grid', 'stroke-width': 1 }, ly));
    const lw1 = s('polyline', { class: 'ln s-ink2', 'stroke-width': 1.8 }, ly);
    const lw2 = s('polyline', { class: 'ln s-m', 'stroke-width': 2 }, ly);
    const lw3r = s('polyline', { class: 'ln s-mut', 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }, ly);
    const lw3 = s('polyline', { class: 'ln s-e', 'stroke-width': 2.4 }, ly);
    const guide = s('line', { class: 's-mut', 'stroke-width': 1, 'stroke-dasharray': '2 3' }, ly);
    const shiftA = LM.arrow(ly, 'var(--ink)', 1.4, 6);
    const shiftT = text(ly, 0, 0, '落后', 't-s end halo');

    function readouts() {
      LM.setText(nTxt, '玻璃 n = ' + LM.f(n, 2));
      const lagCyc = ((n - 1) * L) / LAM;
      LM.setText('slab-lam', LM.f(500 / n, 0) + ' nm（λ₀ = 500 nm 时）');
      LM.setText('slab-lag', LM.f(lagCyc * 360, 0) + '°');
      LM.setText('slab-cyc', LM.f(lagCyc, 2) + ' 个波长');
    }
    LM.range('slab-n', (v) => {
      n = v;
      readouts();
      sc.render();
    }, (v) => LM.f(v, 2));

    function update(t) {
      const tt = t / T;
      const pg = [], pa = [];
      for (let z = 0; z <= ZMAX; z += 3) {
        pg.push([X0 + z, CY - A * Math.cos((TAU * z) / LAM - TAU * tt)]);
        pa.push([X0 + z, CY - A * Math.cos((TAU * zEff(z)) / LAM - TAU * tt)]);
      }
      ghost.setAttribute('points', LM.pts(pg));
      wave.setAttribute('points', LM.pts(pa));
      for (const a of atoms) {
        const e = Math.cos((TAU * zEff(a.z)) / LAM - TAU * tt);
        a.el.setAttribute('cy', (a.y + 7 * e).toFixed(1));
      }
      const mMax = Math.floor(tt);
      let pair = null;
      for (let i = 0; i < 14; i++) {
        const m = mMax - i;
        const zg = LAM * (tt - m), za = zAct(zg);
        if (zg <= ZMAX) LM.attr(gDots[i], { cx: (X0 + zg).toFixed(1), cy: CY - A, visibility: null });
        else gDots[i].setAttribute('visibility', 'hidden');
        if (za <= ZMAX) LM.attr(aDots[i], { cx: (X0 + za).toFixed(1), cy: CY - A, visibility: null });
        else aDots[i].setAttribute('visibility', 'hidden');
        if (za >= Z2 && za < Z2 + LAM && !pair) pair = [za, zg];
      }
      if (pair && pair[1] <= ZMAX) {
        const y = CY - A - 18, x1 = X0 + pair[0], x2 = X0 + pair[1];
        brk.setAttribute('d', 'M' + x1.toFixed(1) + ' ' + (y + 6) + 'V' + y + 'H' + x2.toFixed(1) + 'V' + (y + 6));
        LM.attr(brkT, { x: ((x1 + x2) / 2).toFixed(1), y: y - 6 });
        LM.setText(brkT, '同一个波峰：落后 (n−1)L = ' + LM.f(((n - 1) * L) / LAM, 2) + ' λ');
        brk.removeAttribute('visibility');
        brkT.removeAttribute('visibility');
      } else {
        brk.setAttribute('visibility', 'hidden');
        brkT.setAttribute('visibility', 'hidden');
      }

      /* phasor chain building up layer by layer */
      const cyc = NL * 0.55 + 2.6;
      const k = Math.min(NL, Math.floor(mod(t, cyc) / 0.55));
      const P = (j) => [O[0] + R * Math.cos(j * DEL), O[1] + R * Math.sin(j * DEL)];
      chain.forEach((a, j) => {
        if (j < k) {
          const p1 = P(j), p2 = P(j + 1);
          a.set(p1[0], p1[1], p2[0], p2[1], 7);
        } else a.hide();
      });
      const pk = P(k);
      tot.set(O[0], O[1], pk[0], pk[1], 13);
      if (k > 0) {
        const r = 46;
        angArc.setAttribute('d', 'M' + (O[0] + r) + ' ' + O[1] + ' A' + r + ' ' + r + ' 0 0 1 ' + (O[0] + r * Math.cos(k * DEL)).toFixed(1) + ' ' + (O[1] + r * Math.sin(k * DEL)).toFixed(1));
        angArc.removeAttribute('visibility');
      } else angArc.setAttribute('visibility', 'hidden');
      LM.setText(cntT, '已穿过 ' + k + ' 层原子 · 总场落后 ' + k * 7 + '°');

      /* one layer */
      const p1 = [], p2 = [], p3 = [], p3r = [];
      const amp3 = Math.hypot(1, EPS), lagL = Math.atan(EPS);
      for (let x = LX0; x <= LX1; x += 3) {
        const a = (TAU * (x - LX0)) / LL - TAU * tt;
        p1.push([x, rowsY[0] - LA * Math.cos(a)]);
        p2.push([x, rowsY[1] - LA * EPS * Math.cos(a + Math.PI / 2)]);
        p3.push([x, rowsY[2] - LA * amp3 * 0.82 * Math.cos(a + lagL)]);
        p3r.push([x, rowsY[2] - LA * 0.82 * Math.cos(a)]);
      }
      lw1.setAttribute('points', LM.pts(p1));
      lw2.setAttribute('points', LM.pts(p2));
      lw3.setAttribute('points', LM.pts(p3));
      lw3r.setAttribute('points', LM.pts(p3r));
      const xc = LX0 + LL * (mod(tt, 1) + 1);
      LM.attr(guide, { x1: xc, x2: xc, y1: rowsY[0] - LA - 6, y2: rowsY[2] + LA + 8 });
      /* a lag puts the crest behind (to the left of) the incident crest, since the wave travels right */
      const xs = xc - (LL * lagL) / TAU;
      const yA = rowsY[2] + LA * amp3 * 0.82 + 14;
      shiftA.set(xc, yA, xs - 2, yA, 6);
      LM.attr(shiftT, { x: xs - 6, y: yA + 4 });
    }
    readouts();
    return { update: update, t0: 7.75 };
  });

  /* ================= Snell's law ================= */
  LM.scene('fig-snell', function (fig, sc) {
    const svg = document.getElementById('snell-svg');
    const W = 960, H = 470, YI = 235, P0 = [480, YI], LAM0 = 62, T = 1.7;
    let th = 40 * LM.DEG, n1 = 1, n2 = 1.333, pol = 's';
    const defs = s('defs', null, svg);
    s('clipPath', { id: 'sn-up' }, defs).appendChild(LM.s('rect', { x: 0, y: 0, width: W, height: YI }));
    s('clipPath', { id: 'sn-lo' }, defs).appendChild(LM.s('rect', { x: 0, y: YI, width: W, height: H - YI }));
    const eg = s('linearGradient', { id: 'sn-ev', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: YI, y2: YI + 60 }, defs);
    s('stop', { offset: 0, class: 'sc-e', 'stop-opacity': 0.9 }, eg);
    s('stop', { offset: 1, class: 'sc-e', 'stop-opacity': 0 }, eg);

    const medUp = s('rect', { x: 0, y: 0, width: W, height: YI, class: 'f-med' }, svg);
    const medLo = s('rect', { x: 0, y: YI, width: W, height: H - YI, class: 'f-med' }, svg);
    const gUp = s('g', { 'clip-path': 'url(#sn-up)' }, svg);
    const gLo = s('g', { 'clip-path': 'url(#sn-lo)' }, svg);
    const pool = (g, nEl, w) => {
      const a = [];
      for (let i = 0; i < nEl; i++) a.push(s('line', { class: 's-e', 'stroke-width': w, 'stroke-linecap': 'round' }, g));
      return a;
    };
    const incL = pool(gUp, 34, 2.2), refL = pool(gUp, 34, 2), traL = pool(gLo, 40, 2.2), evL = pool(gLo, 60, 2.4);
    evL.forEach((l) => l.setAttribute('stroke', 'url(#sn-ev)'));
    s('line', { x1: 0, x2: W, y1: YI, y2: YI, class: 's-ink2', 'stroke-width': 1.5 }, svg);
    s('line', { x1: P0[0], x2: P0[0], y1: 30, y2: H - 20, class: 's-mut', 'stroke-width': 1.2, 'stroke-dasharray': '6 5' }, svg);
    text(svg, P0[0] + 6, 44, '法线', 't-s');
    const rayI = LM.arrow(svg, 'var(--ink)', 2.2, 12);
    const rayR = LM.arrow(svg, 'var(--ink)', 2.2, 12);
    const rayT = LM.arrow(svg, 'var(--ink)', 2.2, 12);
    const arcI = s('path', { class: 'ln s-ink', 'stroke-width': 1.3 }, svg);
    const arcR = s('path', { class: 'ln s-ink', 'stroke-width': 1.3 }, svg);
    const arcT = s('path', { class: 'ln s-ink', 'stroke-width': 1.3 }, svg);
    const lI = text(svg, 0, 0, 'θ₁', 't-m halo'), lR = text(svg, 0, 0, 'θ₁', 't-m halo'), lT = text(svg, 0, 0, 'θ₂', 't-m halo');
    const foot = [];
    for (let i = 0; i < 40; i++) foot.push(s('circle', { r: 4.2, class: 'f-p', stroke: 'var(--surface)', 'stroke-width': 1.5 }, svg));
    const brk = s('path', { class: 'ln s-ink', 'stroke-width': 1.4 }, svg);
    const brkT = text(svg, 0, 0, 'Λ', 't-m halo mid');
    const n1T = text(svg, 22, 34, '', 't-b halo'), n2T = text(svg, 22, H - 18, '', 't-b halo');
    const tirT = text(svg, P0[0] + 30, YI + 92, '', 't-b halo');
    const tirT2 = text(svg, P0[0] + 30, YI + 114, '', 't-s halo');
    const lblI = text(svg, 0, 0, '入射', 't-s halo'), lblR = text(svg, 0, 0, '反射', 't-s halo'), lblT = text(svg, 0, 0, '折射', 't-s halo');

    function setLines(pool, u, lam, phi0, t, region, opacity) {
      const v = [-u[1], u[0]];
      const corners = region === 'up' ? [[0, 0], [W, 0], [0, YI], [W, YI]] : [[0, YI], [W, YI], [0, H], [W, H]];
      let dmin = Infinity, dmax = -Infinity;
      for (const c of corners) {
        const d = u[0] * (c[0] - P0[0]) + u[1] * (c[1] - P0[1]);
        dmin = Math.min(dmin, d);
        dmax = Math.max(dmax, d);
      }
      const d0 = lam * (t / T - phi0 / TAU);
      const j0 = Math.ceil((dmin - d0) / lam), j1 = Math.floor((dmax - d0) / lam);
      let i = 0;
      for (let j = j0; j <= j1 && i < pool.length && opacity > 0.004; j++, i++) {
        const d = d0 + j * lam, cx = P0[0] + d * u[0], cy = P0[1] + d * u[1];
        LM.attr(pool[i], { x1: (cx - 1400 * v[0]).toFixed(1), y1: (cy - 1400 * v[1]).toFixed(1), x2: (cx + 1400 * v[0]).toFixed(1), y2: (cy + 1400 * v[1]).toFixed(1), opacity: opacity.toFixed(3), visibility: null });
      }
      for (; i < pool.length; i++) pool[i].setAttribute('visibility', 'hidden');
    }
    function arc(el, a0, a1, r) {
      const x0 = P0[0] + r * Math.cos(a0), y0 = P0[1] + r * Math.sin(a0), x1 = P0[0] + r * Math.cos(a1), y1 = P0[1] + r * Math.sin(a1);
      const sweep = a1 > a0 ? 1 : 0;
      el.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1));
    }
    let F = null;
    function recompute() {
      F = LM.fresnel(n1, n2, th);
      const R = pol === 's' ? F.Rs : F.Rp;
      LM.setText('snell-th2', F.tir ? '无（全反射）' : LM.f(F.th2 / LM.DEG, 1) + '°');
      LM.setText('snell-R', LM.f(R * 100, 1) + '%');
      LM.setText('snell-T', LM.f((1 - R) * 100, 1) + '%');
      LM.setText('snell-thc', n1 > n2 ? LM.f(Math.asin(n2 / n1) / LM.DEG, 1) + '°' : '无（n₁ < n₂）');
      LM.setText('snell-thb', LM.f(Math.atan(n2 / n1) / LM.DEG, 1) + '°');
      const name = (n) => (n === 1 ? '空气' : n < 1.4 ? '水' : n < 2 ? '玻璃' : '钻石');
      LM.setText(n1T, 'n₁ = ' + LM.f(n1, 3) + ' ' + name(n1));
      LM.setText(n2T, 'n₂ = ' + LM.f(n2, 3) + ' ' + name(n2));
      medUp.setAttribute('class', n1 > 1 ? 'f-med2' : 'f-none');
      medLo.setAttribute('class', n2 > 1 ? 'f-med2' : 'f-none');
      sc.render();
    }
    LM.range('snell-th', (v) => {
      th = v * LM.DEG;
      recompute();
    }, (v) => LM.f(v, 1).replace('.0', '') + '°');
    LM.seg('snell-med', (v) => {
      const p = v.split(',').map(Number);
      n1 = p[0];
      n2 = p[1];
      recompute();
    });
    LM.seg('snell-pol', (v) => {
      pol = v;
      recompute();
    });

    function update(t) {
      if (!F) return;
      const st = Math.sin(th), ct = Math.cos(th);
      const lam1 = LAM0 / n1, lam2 = LAM0 / n2;
      const ui = [st, ct], ur = [st, -ct];
      const r = pol === 's' ? F.rs : LM.C.scale(F.rp, -1);
      const rA = LM.C.abs(r), rPh = LM.C.arg(r);
      setLines(incL, ui, lam1, 0, t, 'up', 0.9);
      setLines(refL, ur, lam1, rPh, t, 'up', Math.min(0.9, rA * 0.9 + (rA > 0.01 ? 0.04 : 0)));
      if (!F.tir) {
        const s2 = F.s2, c2 = Math.sqrt(1 - s2 * s2);
        const tc = pol === 's' ? (2 * n1 * ct) / (n1 * ct + n2 * c2) : (2 * n1 * ct) / (n2 * ct + n1 * c2);
        setLines(traL, [s2, c2], lam2, 0, t, 'lo', Math.min(0.9, Math.abs(tc) * 0.75));
        evL.forEach((l) => l.setAttribute('visibility', 'hidden'));
        LM.setText(tirT, '');
        LM.setText(tirT2, '');
      } else {
        traL.forEach((l) => l.setAttribute('visibility', 'hidden'));
        const kap = (TAU / LAM0) * Math.sqrt(n1 * n1 * st * st - n2 * n2);
        const depth = 1 / kap;
        const g = svg.querySelector('#sn-ev');
        g.setAttribute('y2', (YI + 3.2 * depth).toFixed(1));
        const trace = lam1 / st;
        const x0 = P0[0] + (lam1 * (t / T)) / st;
        const j0 = Math.ceil((0 - x0) / trace), j1 = Math.floor((W - x0) / trace);
        let i = 0;
        for (let j = j0; j <= j1 && i < evL.length; j++, i++) {
          const x = x0 + j * trace;
          LM.attr(evL[i], { x1: x.toFixed(1), x2: x.toFixed(1), y1: YI, y2: (YI + 3.4 * depth).toFixed(1), visibility: null });
        }
        for (; i < evL.length; i++) evL[i].setAttribute('visibility', 'hidden');
        LM.setText(tirT, '全反射：没有折射波，只有沿界面跑的倏逝波');
        LM.setText(tirT2, '场强衰减到 1/e 的深度 ≈ ' + LM.f(depth / LAM0, 2) + ' λ₀');
      }
      /* footprints & trace wavelength */
      if (st > 0.02) {
        const trace = lam1 / st;
        const x0 = P0[0] + (lam1 * (t / T)) / st;
        const j0 = Math.ceil((0 - x0) / trace), j1 = Math.floor((W - x0) / trace);
        let i = 0, bx = null;
        for (let j = j0; j <= j1 && i < foot.length; j++, i++) {
          const x = x0 + j * trace;
          LM.attr(foot[i], { cx: x.toFixed(1), cy: YI, visibility: null });
          if (bx === null && x > 640) bx = x;
        }
        for (; i < foot.length; i++) foot[i].setAttribute('visibility', 'hidden');
        if (bx !== null && trace < 300 && bx + trace < W - 4) {
          const y = YI - 16;
          brk.setAttribute('d', 'M' + bx.toFixed(1) + ' ' + (y + 6) + 'V' + y + 'H' + (bx + trace).toFixed(1) + 'V' + (y + 6));
          LM.attr(brkT, { x: (bx + trace / 2).toFixed(1), y: y - 6 });
          brk.removeAttribute('visibility');
          brkT.removeAttribute('visibility');
        } else {
          brk.setAttribute('visibility', 'hidden');
          brkT.setAttribute('visibility', 'hidden');
        }
      } else {
        foot.forEach((f) => f.setAttribute('visibility', 'hidden'));
        brk.setAttribute('visibility', 'hidden');
        brkT.setAttribute('visibility', 'hidden');
      }
      /* rays and angles */
      const RL = 205;
      rayI.set(P0[0] - RL * ui[0], P0[1] - RL * ui[1], P0[0] - 3 * ui[0], P0[1] - 3 * ui[1], 13);
      const R = pol === 's' ? F.Rs : F.Rp;
      rayR.set(P0[0], P0[1], P0[0] + RL * ur[0], P0[1] + RL * ur[1], 13).opacity((0.12 + 0.88 * Math.sqrt(R)).toFixed(3));
      LM.attr(lblI, { x: P0[0] - RL * ui[0] - 10, y: P0[1] - RL * ui[1] - 10 });
      LM.attr(lblR, { x: P0[0] + RL * ur[0] - 6, y: P0[1] + RL * ur[1] - 12 });
      const up = -Math.PI / 2;
      if (th > 0.03) {
        arc(arcI, Math.atan2(-ct, -st), up, 54);
        arc(arcR, up, Math.atan2(-ct, st), 62);
        const mi = (Math.atan2(-ct, -st) + up) / 2, mr = (up + Math.atan2(-ct, st)) / 2;
        LM.attr(lI, { x: (P0[0] + 74 * Math.cos(mi) - 8).toFixed(1), y: (P0[1] + 74 * Math.sin(mi) + 6).toFixed(1) });
        LM.attr(lR, { x: (P0[0] + 80 * Math.cos(mr) - 4).toFixed(1), y: (P0[1] + 80 * Math.sin(mr) + 6).toFixed(1) });
        [arcI, arcR, lI, lR].forEach((e) => e.removeAttribute('visibility'));
      } else [arcI, arcR, lI, lR].forEach((e) => e.setAttribute('visibility', 'hidden'));
      if (!F.tir) {
        const s2 = F.s2, c2 = Math.sqrt(1 - s2 * s2);
        rayT.set(P0[0], P0[1], P0[0] + RL * s2, P0[1] + RL * c2, 13);
        LM.attr(lblT, { x: P0[0] + RL * s2 + 8, y: P0[1] + RL * c2 + 4, visibility: null });
        if (s2 > 0.03) {
          const a = Math.atan2(c2, s2);
          arc(arcT, Math.PI / 2, a, 58);
          const m = (Math.PI / 2 + a) / 2;
          LM.attr(lT, { x: (P0[0] + 78 * Math.cos(m) - 6).toFixed(1), y: (P0[1] + 78 * Math.sin(m) + 8).toFixed(1), visibility: null });
          arcT.removeAttribute('visibility');
        } else {
          arcT.setAttribute('visibility', 'hidden');
          lT.setAttribute('visibility', 'hidden');
        }
      } else {
        rayT.hide();
        arcT.setAttribute('visibility', 'hidden');
        lT.setAttribute('visibility', 'hidden');
        lblT.setAttribute('visibility', 'hidden');
      }
    }
    return { update: update, t0: 0.3 };
  });
})();
