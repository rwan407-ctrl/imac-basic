/* ch9_microwave.js — water's Debye relaxation, soil-moisture radiometry, SAR scattering mechanisms */
(function () {
  'use strict';
  const { s, text, TAU, clamp, mod } = LM;

  /* pure water at 20 °C, double-Debye model (Liebe, Hufford & Manabe 1991) */
  const TH = 300 / 293.15 - 1;
  const E0 = 77.66 + 103.3 * TH, E1 = 0.0671 * E0, E2 = 3.52;
  const FD1 = 20.2 - 146.4 * TH + 316 * TH * TH, FD2 = 39.8 * FD1;
  function epsWater(fGHz) {
    const f2 = fGHz * fGHz;
    const re = E0 - ((E0 - E1) * f2) / (f2 + FD1 * FD1) - ((E1 - E2) * f2) / (f2 + FD2 * FD2);
    const im = ((E0 - E1) * fGHz * FD1) / (f2 + FD1 * FD1) + ((E1 - E2) * fGHz * FD2) / (f2 + FD2 * FD2);
    return { re: re, im: im };
  }
  LM.epsWater = epsWater;
  const fmtF = (g) => (g >= 1000 ? LM.sig(g / 1000, 3) + ' THz' : g >= 1 ? LM.sig(g, 3) + ' GHz' : LM.sig(g * 1000, 3) + ' MHz');

  /* ================= Debye ================= */
  LM.scene('fig-debye', function (fig, sc) {
    const svg = document.getElementById('deb-svg');
    const ch = document.getElementById('deb-chart');
    let f = 1.41, a = 1, phi = 0;
    s('rect', { x: 20, y: 30, width: 410, height: 320, rx: 10, class: 'f-med s-med', 'stroke-width': 1 }, svg);
    const rng = LM.rng(8);
    const mols = [];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 6; i++) {
        const g = s('g', null, svg);
        const h1 = s('circle', { r: 6.5, fill: '#f4f6f8', stroke: 'var(--ink-2)', 'stroke-width': 1 }, g);
        const h2 = s('circle', { r: 6.5, fill: '#f4f6f8', stroke: 'var(--ink-2)', 'stroke-width': 1 }, g);
        const o = s('circle', { r: 11.5, fill: '#e0412f', stroke: 'var(--ink-2)', 'stroke-width': 1 }, g);
        const ar = LM.arrow(g, 'var(--matter)', 2.2, 7);
        mols.push({ cx: 66 + i * 66 + (j % 2) * 12, cy: 76 + j * 78, psi0: rng() * TAU, p1: rng() * TAU, p2: rng() * TAU, h1: h1, h2: h2, o: o, ar: ar });
      }
    }
    text(svg, 225, 372, '绿色箭头：分子的固有偶极矩（指向带正电的氢端）', 't-s mid');
    /* gauges */
    const GX = [468, 524], GY = 190, GL = 120;
    GX.forEach((x, k) => {
      s('rect', { x: x - 14, y: GY - GL, width: 28, height: 2 * GL, rx: 6, class: 'f-bg s-rule', 'stroke-width': 1 }, svg);
      text(svg, x, GY - GL - 12, k ? 'P' : 'E', 't-m mid' + (k ? ' t-mat' : ' t-e'));
    });
    text(svg, 496, GY + GL + 22, '电场 / 极化', 't-s mid');
    const gE = s('rect', { x: GX[0] - 9, width: 18, rx: 4, class: 'f-e' }, svg);
    const gP = s('rect', { x: GX[1] - 9, width: 18, rx: 4, class: 'f-m' }, svg);
    s('line', { x1: GX[0] - 18, x2: GX[1] + 18, y1: GY, y2: GY, class: 's-ink2', 'stroke-width': 1 }, svg);

    /* chart */
    const X = LM.logScale(0.1, 1000, 52, 380), Y = LM.lin(0, 90, 318, 66);
    for (let v = 0; v <= 90; v += 15) {
      s('line', { x1: 52, x2: 380, y1: Y(v), y2: Y(v), class: v === 0 ? 's-axis' : 's-grid', 'stroke-width': 1 }, ch);
      text(ch, 44, Y(v) + 4, String(v), 't-mono end', { 'font-size': 11.5 });
    }
    [[0.1, '0.1'], [1, '1'], [10, '10'], [100, '100'], [1000, '1000']].forEach(([v, l]) => {
      s('line', { x1: X(v), x2: X(v), y1: 318, y2: 323, class: 's-axis', 'stroke-width': 1 }, ch);
      text(ch, X(v), 338, l, 't-mono mid', { 'font-size': 11.5 });
    });
    text(ch, 216, 358, '频率（GHz，对数）', 't-s mid');
    const p1 = [], p2 = [];
    for (let i = 0; i <= 240; i++) {
      const fg = 0.1 * Math.pow(1e4, i / 240), e = epsWater(fg);
      p1.push([X(fg), Y(e.re)]);
      p2.push([X(fg), Y(e.im)]);
    }
    const c1 = s('polyline', { points: LM.pts(p1), class: 'ln', 'stroke-width': 2.2 }, ch);
    c1.style.stroke = 'var(--s1)';
    const c2 = s('polyline', { points: LM.pts(p2), class: 'ln', 'stroke-width': 2.2 }, ch);
    c2.style.stroke = 'var(--s2)';
    text(ch, X(0.25), Y(80) - 8, 'ε′', 't-m');
    text(ch, X(FD1) + 4, Y(epsWater(FD1).im) - 10, 'ε″', 't-m');
    [[1.41, 'L'], [2.45, '炉'], [5.4, 'C'], [9.6, 'X'], [36.5, 'Ka'], [89, 'W']].forEach(([fg, l], i) => {
      s('line', { x1: X(fg), x2: X(fg), y1: 58, y2: 66, class: 's-ink2', 'stroke-width': 1.2 }, ch);
      text(ch, X(fg), 54 - (i % 2) * 12, l, 't-mono mid', { 'font-size': 11 });
    });
    text(ch, 378, 262, '可见光：ε′ = 1.77 →', 't-s end halo');
    const lg = s('g', { transform: 'translate(60 14)' }, ch);
    [['var(--s1)', 'ε′ 储能（决定折射率）'], ['var(--s2)', 'ε″ 损耗（吸收、发热）']].forEach(([col, n], i) => {
      const ln = s('line', { x1: 0, x2: 16, y1: i * 0, y2: 0, 'stroke-width': 2.5, transform: 'translate(' + i * 160 + ' 0)' }, lg);
      ln.style.stroke = col;
      text(lg, i * 160 + 22, 4, n, 't-s', { fill: 'var(--ink-2)' });
    });
    const mk = s('line', { y1: 66, y2: 318, class: 's-ink', 'stroke-width': 1.2 }, ch);
    const d1 = s('circle', { r: 5, stroke: 'var(--surface)', 'stroke-width': 2 }, ch);
    d1.style.fill = 'var(--s1)';
    const d2 = s('circle', { r: 5, stroke: 'var(--surface)', 'stroke-width': 2 }, ch);
    d2.style.fill = 'var(--s2)';
    const tip = LM.tip(ch.parentNode);
    const vOf = (g) => ((Math.log10(g) + 1) / 4) * 1000;
    const slider = LM.range('deb-f', (v) => {
      f = Math.pow(10, -1 + (4 * v) / 1000);
      a = 1 / Math.sqrt(1 + Math.pow(f / FD1, 2));
      phi = Math.atan(f / FD1);
      const e = epsWater(f);
      const r = LM.C.sqrt(e);
      LM.setText('deb-e1', LM.f(e.re, 1));
      LM.setText('deb-e2', LM.f(e.im, 1));
      LM.setText('deb-n', LM.f(r.re, 2));
      const lam0 = 0.299792458 / f;
      LM.setText('deb-dp', LM.length(lam0 / (4 * Math.PI * Math.abs(r.im))));
      LM.setText('deb-say', f < 3 ? '转得过来：分子几乎完全跟随电场，极化强，ε′ ≈ 80，损耗小' : f < 70 ? '开始跟不上：转动滞后于电场，在分子间的“摩擦”中耗散能量（ε″ 大），这就是微波加热' : '基本转不动：取向极化逐渐消失，ε′ 迅速下降，只剩更快的分子间振动与电子响应');
      LM.attr(mk, { x1: X(f), x2: X(f) });
      LM.attr(d1, { cx: X(f), cy: Y(e.re) });
      LM.attr(d2, { cx: X(f), cy: Y(e.im) });
      sc.render();
    }, (v) => fmtF(Math.pow(10, -1 + (4 * v) / 1000)));
    LM.chips('deb-pre', (b) => slider.set(vOf(parseFloat(b.getAttribute('data-v')))));
    LM.drag(ch, (x, y, kind) => {
      if (kind === 'leave' || x === null) {
        tip.hide();
        return;
      }
      const fg = clamp(X.inv(x), 0.1, 1000);
      if (kind === 'down' || kind === 'drag') slider.set(vOf(fg));
      const e = epsWater(fg);
      const pp = LM.toPanel(ch, X(fg), Y(Math.max(e.re, e.im)));
      tip.show(pp[0], pp[1], fmtF(fg), [
        { color: 'var(--s1)', value: LM.f(e.re, 1), label: 'ε′' },
        { color: 'var(--s2)', value: LM.f(e.im, 1), label: 'ε″' },
      ]);
    });

    const OM = TAU * 0.42;
    function update(t) {
      const E = Math.cos(OM * t), P = a * Math.cos(OM * t - phi);
      const bar = (el, v) => LM.attr(el, { y: v >= 0 ? GY - GL * v : GY, height: Math.abs(GL * v) });
      bar(gE, E * 0.92);
      bar(gP, P * 0.92);
      for (const m of mols) {
        const jit = 0.32 * Math.sin(1.7 * t + m.p1) + 0.22 * Math.sin(2.9 * t + m.p2);
        const psi = m.psi0 + jit - 0.95 * P * Math.sin(m.psi0);
        const ux = Math.sin(psi), uy = -Math.cos(psi);
        const hb = 52.25 * LM.DEG;
        const hx1 = m.cx + 17 * Math.sin(psi - hb), hy1 = m.cy - 17 * Math.cos(psi - hb);
        const hx2 = m.cx + 17 * Math.sin(psi + hb), hy2 = m.cy - 17 * Math.cos(psi + hb);
        LM.attr(m.o, { cx: m.cx.toFixed(1), cy: m.cy.toFixed(1) });
        LM.attr(m.h1, { cx: hx1.toFixed(1), cy: hy1.toFixed(1) });
        LM.attr(m.h2, { cx: hx2.toFixed(1), cy: hy2.toFixed(1) });
        m.ar.set(m.cx, m.cy, m.cx + 30 * ux, m.cy + 30 * uy, 7);
      }
    }
    return { update: update, t0: 0.2 };
  });

  /* ================= soil moisture radiometry ================= */
  LM.scene('fig-soil', function (fig, sc) {
    const svg = document.getElementById('soil-svg');
    const ch = document.getElementById('soil-chart');
    const POR = 0.45, ES = 4.7, TS = 295, INC = 40 * LM.DEG;
    const EW = epsWater(1.41);
    const sqW = LM.C.sqrt(EW);
    function epsSoil(m) {
      const r = LM.C.add(LM.C.c(Math.sqrt(ES) * (1 - POR) + (POR - m)), LM.C.scale(sqW, m));
      return LM.C.mul(r, r);
    }
    function tb(m) {
      const e = epsSoil(m);
      const F = LM.fresnelEps(e, INC);
      return { eps: e, Rh: F.Rh, Rv: F.Rv, h: (1 - F.Rh) * TS, v: (1 - F.Rv) * TS };
    }
    let m = 0.1;
    /* scene */
    const SY = 186;
    s('rect', { x: 0, y: SY, width: 520, height: 194, class: 'f-surf' }, svg);
    const rng = LM.rng(21);
    const grains = [];
    let guard = 0;
    while (grains.length < 62 && guard++ < 4000) {
      const r = 10 + rng() * 9, x = 14 + rng() * 492, y = SY + 12 + rng() * 172;
      if (grains.every((g) => Math.hypot(g.x - x, g.y - y) > g.r + r + 3)) grains.push({ x: x, y: y, r: r });
    }
    const cand = [];
    for (let k = 0; k < 2600 && cand.length < 230; k++) {
      const x = 10 + rng() * 500, y = SY + 6 + rng() * 182;
      let dmin = 1e9;
      for (const g of grains) dmin = Math.min(dmin, Math.hypot(g.x - x, g.y - y) - g.r);
      if (dmin > 2 && dmin < 9) cand.push({ x: x, y: y, d: dmin });
    }
    cand.sort((p, q) => p.d - q.d);
    const gW = s('g', null, svg);
    const drops = cand.map((p) => s('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: (3 + p.d * 0.55).toFixed(1), opacity: 0.8, visibility: 'hidden' }, gW));
    drops.forEach((d) => (d.style.fill = 'var(--water)'));
    for (const g of grains) {
      const pts = [];
      const k0 = rng() * TAU;
      for (let i = 0; i < 9; i++) {
        const a = k0 + (i / 9) * TAU, rr = g.r * (0.82 + 0.3 * rng());
        pts.push([g.x + rr * Math.cos(a), g.y + rr * Math.sin(a)]);
      }
      s('polygon', { points: LM.pts(pts), class: 'f-ground2', stroke: 'var(--ground)', 'stroke-width': 1.2 }, svg);
    }
    s('line', { x1: 0, x2: 520, y1: SY, y2: SY, class: 's-ink2', 'stroke-width': 1.6 }, svg);
    text(svg, 12, 372, '土壤颗粒（棕）· 孔隙中的水（蓝）· 孔隙中的空气（浅色）', 't-s halo');
    /* radiometer */
    const sat = s('g', { transform: 'translate(392 54)' }, svg);
    s('rect', { x: -16, y: -12, width: 32, height: 24, rx: 3, class: 'f-surf s-ink2', 'stroke-width': 1.5 }, sat);
    s('rect', { x: -60, y: -6, width: 40, height: 12, class: 'f-med2 s-b', 'stroke-width': 1 }, sat);
    s('path', { d: 'M-34 18 Q0 46 34 18', fill: 'none', class: 's-ink2', 'stroke-width': 2.4 }, sat);
    s('line', { x1: 0, y1: 12, x2: 0, y2: 30, class: 's-ink2', 'stroke-width': 1.5 }, sat);
    text(svg, 326, 46, 'L 波段辐射计', 't-s end');
    text(svg, 326, 62, '（SMAP / SMOS）', 't-s end');
    const waves = [];
    for (let i = 0; i < 9; i++) waves.push(s('polyline', { class: 'ln s-mw', 'stroke-width': 2, stroke: 'var(--mw)' }, svg));
    const tbT = text(svg, 14, 30, '', 't-b');
    const tbT2 = text(svg, 14, 50, '', 't-s');

    /* chart */
    const X = LM.lin(0, 0.45, 56, 420), Y = LM.lin(120, 300, 318, 40);
    for (let v = 120; v <= 300; v += 30) {
      s('line', { x1: 56, x2: 420, y1: Y(v), y2: Y(v), class: v === 120 ? 's-axis' : 's-grid', 'stroke-width': 1 }, ch);
      text(ch, 48, Y(v) + 4, v + ' K', 't-mono end', { 'font-size': 11.5 });
    }
    for (let v = 0; v <= 0.45; v += 0.15) text(ch, X(v), 338, LM.f(v, 2), 't-mono mid', { 'font-size': 11.5 });
    text(ch, 238, 360, '体积含水量 θᵥ（m³/m³）', 't-s mid');
    const ph = [], pv = [];
    for (let i = 0; i <= 90; i++) {
      const mm = (0.45 * i) / 90, r = tb(mm);
      ph.push([X(mm), Y(r.h)]);
      pv.push([X(mm), Y(r.v)]);
    }
    const cv = s('polyline', { points: LM.pts(pv), class: 'ln', 'stroke-width': 2.2 }, ch);
    cv.style.stroke = 'var(--s1)';
    const chh = s('polyline', { points: LM.pts(ph), class: 'ln', 'stroke-width': 2.2 }, ch);
    chh.style.stroke = 'var(--s2)';
    text(ch, X(0.33), Y(tb(0.33).v) - 10, 'V 极化', 't-s halo');
    text(ch, X(0.2), Y(tb(0.2).h) + 22, 'H 极化', 't-s halo');
    text(ch, 238, 26, '亮温 T_B（40° 入射，1.41 GHz）', 't-s mid');
    const lg = s('g', { transform: 'translate(250 300)' }, ch);
    [['var(--s1)', 'V 极化'], ['var(--s2)', 'H 极化']].forEach(([col, n], i) => {
      const ln = s('line', { x1: i * 84, x2: i * 84 + 16, y1: 0, y2: 0, 'stroke-width': 2.5 }, lg);
      ln.style.stroke = col;
      text(lg, i * 84 + 22, 4, n, 't-s', { fill: 'var(--ink-2)' });
    });
    const mk = s('line', { y1: 40, y2: 318, class: 's-ink', 'stroke-width': 1.2 }, ch);
    const dh = s('circle', { r: 5, stroke: 'var(--surface)', 'stroke-width': 2 }, ch);
    dh.style.fill = 'var(--s2)';
    const dv = s('circle', { r: 5, stroke: 'var(--surface)', 'stroke-width': 2 }, ch);
    dv.style.fill = 'var(--s1)';
    const tip = LM.tip(ch.parentNode);
    let cur = tb(m);
    const slider = LM.range('soil-m', (v) => {
      m = v;
      cur = tb(m);
      const n = LM.C.sqrt(cur.eps).re;
      LM.setText('soil-eps', LM.f(cur.eps.re, 1));
      LM.setText('soil-n', LM.f(n, 2));
      LM.setText('soil-R', LM.f(cur.Rh * 100, 1) + '%');
      LM.setText('soil-e', LM.f(1 - cur.Rh, 3));
      LM.setText('soil-tb', LM.f(cur.h, 0) + ' K / ' + LM.f(cur.v, 0) + ' K');
      LM.setText(tbT, 'T_B(H) = ' + LM.f(cur.h, 0) + ' K');
      LM.setText(tbT2, '物理温度 295 K × 发射率 ' + LM.f(1 - cur.Rh, 2));
      const k = Math.round((m / 0.45) * drops.length);
      drops.forEach((d, i) => d.setAttribute('visibility', i < k ? 'visible' : 'hidden'));
      LM.attr(mk, { x1: X(m), x2: X(m) });
      LM.attr(dh, { cx: X(m), cy: Y(cur.h) });
      LM.attr(dv, { cx: X(m), cy: Y(cur.v) });
      sc.render();
    }, (v) => LM.f(v, 2) + ' m³/m³');
    LM.drag(ch, (x, y, kind) => {
      if (kind === 'leave' || x === null) {
        tip.hide();
        return;
      }
      const mm = clamp(X.inv(x), 0, 0.45);
      if (kind === 'down' || kind === 'drag') slider.set(mm.toFixed(3));
      const r = tb(mm);
      const pp = LM.toPanel(ch, X(mm), Y(r.v));
      tip.show(pp[0], pp[1], 'θᵥ = ' + LM.f(mm, 2), [
        { color: 'var(--s1)', value: LM.f(r.v, 0) + ' K', label: 'V 极化' },
        { color: 'var(--s2)', value: LM.f(r.h, 0) + ' K', label: 'H 极化' },
      ]);
    });
    function update(t) {
      const bright = (cur.h - 130) / 150;
      const nShow = Math.max(2, Math.round(3 + 6 * bright));
      waves.forEach((w, i) => {
        if (i >= nShow) {
          w.setAttribute('visibility', 'hidden');
          return;
        }
        const x0 = 40 + i * 42, y0 = SY - 4, x1 = 392 - 20 + i * 5, y1 = 92;
        const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
        const pts = [];
        for (let d = 0; d <= L; d += 4) {
          const amp = 5 * Math.sin((TAU * d) / 26 - t * 6);
          pts.push([x0 + ux * d - uy * amp, y0 + uy * d + ux * amp]);
        }
        LM.attr(w, { points: LM.pts(pts), opacity: (0.25 + 0.6 * bright).toFixed(2), visibility: null });
      });
    }
    return { update: update };
  });

  /* ================= SAR ================= */
  LM.scene('fig-sar', function (fig, sc) {
    const svg = document.getElementById('sar-svg');
    const SAT = [92, 64], GY = 330, V = 300;
    let pol = 'VV';
    const SIG = {
      VV: [-24, -11, -8, 5, -9],
      VH: [-32, -20, -13, -7, -24],
    };
    const T = [
      { name: '平静水面', mech: '镜面反射：能量射向远方', x0: 206, x1: 340, c: 273 },
      { name: '粗糙地表', mech: '面散射：部分返回', x0: 360, x1: 500, c: 430 },
      { name: '森林', mech: '冠层体散射', x0: 520, x1: 700, c: 610 },
      { name: '建筑', mech: '二面角：原路返回', x0: 720, x1: 836, c: 772 },
      { name: '有风海面', mech: '布拉格散射', x0: 852, x1: 948, c: 900 },
    ];
    /* satellite and beam */
    const satG = s('g', { transform: 'translate(' + SAT[0] + ' ' + SAT[1] + ') rotate(32)' }, svg);
    s('rect', { x: -18, y: -12, width: 36, height: 24, rx: 3, class: 'f-surf s-ink2', 'stroke-width': 1.5 }, satG);
    s('rect', { x: -64, y: -6, width: 42, height: 12, class: 'f-med2 s-b', 'stroke-width': 1 }, satG);
    s('rect', { x: 22, y: -3, width: 30, height: 22, class: 'f-ink2' }, satG);
    text(svg, 30, 26, '侧视雷达（Sentinel-1，C 波段 5.6 cm）', 't-b');
    s('line', { x1: SAT[0], y1: SAT[1], x2: 200, y2: GY, class: 's-mut', 'stroke-width': 1, 'stroke-dasharray': '4 5' }, svg);
    s('line', { x1: SAT[0], y1: SAT[1], x2: 950, y2: GY, class: 's-mut', 'stroke-width': 1, 'stroke-dasharray': '4 5' }, svg);
    /* ground & targets */
    s('rect', { x: 196, y: GY, width: 760, height: 24, class: 'f-ground', opacity: 0.5 }, svg);
    s('rect', { x: T[0].x0, y: GY - 2, width: T[0].x1 - T[0].x0, height: 26, class: 'f-water' }, svg);
    s('line', { x1: T[0].x0, x2: T[0].x1, y1: GY, y2: GY, class: 's-water', 'stroke-width': 2.2 }, svg);
    const fp = [];
    for (let x = T[1].x0; x <= T[1].x1; x += 7) fp.push([x, GY - 3 - 7 * Math.abs(Math.sin(x * 0.9)) - 2 * Math.sin(x * 2.3)]);
    s('polyline', { points: LM.pts(fp), class: 'ln', stroke: 'var(--ground-2)', 'stroke-width': 2.2 }, svg);
    for (let k = 0; k < 6; k++) {
      const x = 532 + k * 30;
      s('line', { x1: x, x2: x, y1: GY, y2: GY - 46, class: 's-ink2', 'stroke-width': 3 }, svg);
      s('ellipse', { cx: x, cy: GY - 66, rx: 18, ry: 28, class: 'f-veg s-veg', 'stroke-width': 1.4 }, svg);
      s('line', { x1: x, y1: GY - 50, x2: x - 10, y2: GY - 70, class: 's-veg', 'stroke-width': 1.2 }, svg);
      s('line', { x1: x, y1: GY - 58, x2: x + 9, y2: GY - 78, class: 's-veg', 'stroke-width': 1.2 }, svg);
    }
    s('rect', { x: 772, y: GY - 96, width: 54, height: 96, class: 'f-med2 s-ink2', 'stroke-width': 1.5 }, svg);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) s('rect', { x: 780 + c * 24, y: GY - 86 + r * 22, width: 14, height: 12, class: 'f-surf s-ink2', 'stroke-width': 0.8 }, svg);
    s('rect', { x: T[4].x0, y: GY - 2, width: T[4].x1 - T[4].x0, height: 26, class: 'f-water' }, svg);
    const sp = [];
    for (let x = T[4].x0; x <= T[4].x1; x += 3) sp.push([x, GY - 3 * Math.abs(Math.sin(x * 0.35))]);
    s('polyline', { points: LM.pts(sp), class: 'ln s-water', 'stroke-width': 2 }, svg);
    T.forEach((tg, i) => {
      const ly = [GY - 34, GY - 72, GY - 108, GY - 112, GY - 34][i];
      text(svg, i === 0 ? tg.c - 24 : tg.c, ly, tg.name, 't-b mid halo');
      tg.R = Math.hypot(tg.c - SAT[0], GY - SAT[1]);
    });
    /* scattering arrows per target */
    const gS = s('g', null, svg);
    const toSat = (x, y) => {
      const dx = SAT[0] - x, dy = SAT[1] - y, L = Math.hypot(dx, dy);
      return [dx / L, dy / L];
    };
    const mk = (pts, w, col) => {
      const g = s('g', { visibility: 'hidden' }, gS);
      for (let i = 0; i < pts.length - 1; i++) {
        const last = i === pts.length - 2;
        if (last) LM.arrowAt(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w, 10);
        else s('line', { x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1], 'stroke-width': w, stroke: col, 'stroke-linecap': 'round' }, g);
      }
      return g;
    };
    const P = 'var(--photon)';
    const scat = T.map(() => []);
    {
      const x = T[0].c, inc = [x - SAT[0], GY - SAT[1]], L = Math.hypot(inc[0], inc[1]);
      scat[0].push(mk([[x, GY], [x + (inc[0] / L) * 120, GY - (inc[1] / L) * 120]], 2.6, P));
      const b = toSat(T[1].c, GY - 6);
      scat[1].push(mk([[T[1].c, GY - 6], [T[1].c + b[0] * 52, GY - 6 + b[1] * 52]], 2.2, P));
      [[-0.2, -1], [0.6, -0.8], [0.95, -0.3]].forEach(([dx, dy]) => scat[1].push(mk([[T[1].c, GY - 6], [T[1].c + dx * 40, GY - 6 + dy * 40]], 1.6, P)));
      const f0 = [596, GY - 60];
      const fb = toSat(612, GY - 84);
      scat[2].push(mk([[588, GY - 92], f0, [622, GY - 70], [612, GY - 84], [612 + fb[0] * 60, GY - 84 + fb[1] * 60]], 2.2, P));
      scat[2].push(mk([[640, GY - 80], [656, GY - 50], [690, GY - 72]], 1.6, P));
      const bb = toSat(756, GY - 50);
      scat[3].push(mk([[748, GY], [772, GY - 50], [772 + bb[0] * 90, GY - 50 + bb[1] * 90]], 3.4, P));
      const wb = toSat(T[4].c, GY - 3);
      scat[4].push(mk([[T[4].c, GY - 3], [T[4].c + wb[0] * 46, GY - 3 + wb[1] * 46]], 2.2, P));
      scat[4].push(mk([[T[4].c, GY - 3], [T[4].c + 28, GY - 38]], 1.6, P));
    }
    T.forEach((tg, i) => text(svg, tg.c, GY + 40 - (i % 2 ? 0 : 0), tg.mech, 't-s mid halo'));
    /* pulse & echoes */
    const cdefs = s('defs', null, svg);
    s('clipPath', { id: 'sar-clip' }, cdefs).appendChild(LM.s('rect', { x: 0, y: 0, width: 960, height: GY + 24 }));
    const pulse = s('path', { class: 'ln s-e', 'stroke-width': 3, 'clip-path': 'url(#sar-clip)' }, svg);
    const echoes = T.map(() => s('path', { class: 'ln s-e', 'stroke-width': 2.4, visibility: 'hidden' }, svg));
    /* image strip */
    const IY = 382;
    text(svg, 30, IY + 20, '图像（距离向）：', 't-b');
    const cells = T.map((tg) => s('rect', { x: tg.x0, y: IY, width: tg.x1 - tg.x0, height: 34, class: 's-rule', 'stroke-width': 1 }, svg));
    const vals = T.map((tg) => text(svg, tg.c, IY + 52, '', 't-mono mid'));
    const a0 = Math.atan2(GY - SAT[1], 200 - SAT[0]), a1 = Math.atan2(GY - SAT[1], 950 - SAT[0]);
    function arcAt(c, r, aa, bb) {
      const x0 = c[0] + r * Math.cos(aa), y0 = c[1] + r * Math.sin(aa), x1 = c[0] + r * Math.cos(bb), y1 = c[1] + r * Math.sin(bb);
      return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 ' + (bb > aa ? 1 : 0) + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
    }
    function gray(db) {
      const g = clamp((db + 30) / 32, 0, 1);
      const v = Math.round(18 + 237 * Math.pow(g, 0.9));
      return 'rgb(' + v + ',' + v + ',' + v + ')';
    }
    LM.seg('sar-pol', (v) => {
      pol = v;
      sc.render();
    });
    const CYC = 8.2;
    function update(t) {
      const tl = mod(t, CYC);
      const r = V * tl;
      const Rmax = Math.hypot(950 - SAT[0], GY - SAT[1]);
      if (r < Rmax + 10 && r > 20) LM.attr(pulse, { d: arcAt(SAT, r, a1, a0), visibility: null });
      else pulse.setAttribute('visibility', 'hidden');
      T.forEach((tg, i) => {
        const th = tg.R / V, tr = (2 * tg.R) / V;
        const on = tl > th && tl < th + 1.6;
        scat[i].forEach((g) => g.setAttribute('visibility', on || (tl > th && LM.reduced) ? 'visible' : 'hidden'));
        const db = SIG[pol][i];
        const lin = Math.pow(10, db / 10);
        if (tl > th && tl < tr) {
          const back = (tl - th) * V;
          const u = toSat(tg.c, GY);
          const cx = tg.c + u[0] * back, cy = GY + u[1] * back;
          const ang = Math.atan2(u[1], u[0]);
          const op = clamp(0.15 + 0.85 * Math.sqrt(lin / 3), 0.08, 1);
          LM.attr(echoes[i], { d: arcAt([cx - u[0] * 40, cy - u[1] * 40], 40, ang - 0.32, ang + 0.32), opacity: op.toFixed(2), visibility: null });
        } else echoes[i].setAttribute('visibility', 'hidden');
        const done = tl >= tr;
        cells[i].style.fill = done ? gray(db) : 'transparent';
        LM.setText(vals[i], done ? 'σ⁰ ≈ ' + (db > 0 ? '+' : db < 0 ? '−' : '') + Math.abs(db) + ' dB' : '');
      });
    }
    return { update: update, t0: 7.6 };
  });
})();
