/* ch2_osc.js — driven Lorentz oscillator, dipole radiation, and the resulting n(ω), κ(ω) */
(function () {
  'use strict';
  const { s, text, TAU, clamp } = LM;
  const G = 0.15, WP2 = 1.25; // damping and plasma frequency² in units of ω0

  const amp = (w) => 1 / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(G * w, 2));
  const lag = (w) => Math.atan2(G * w, 1 - w * w);
  function nk(w) {
    const d = { re: 1 - w * w, im: -G * w };
    const eps = LM.C.add(LM.C.c(1), LM.C.div(LM.C.c(WP2), d));
    const r = LM.C.sqrt(eps);
    return { n: r.re, k: Math.abs(r.im), e1: eps.re, e2: eps.im };
  }

  LM.scene('fig-osc', function (fig, sc) {
    const svg = document.getElementById('osc-svg');
    const chart = document.getElementById('osc-chart');
    const C = [262, 170];
    const defs = s('defs', null, svg);
    const dip = s('linearGradient', { id: 'osc-dip', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      s('stop', { offset: u, class: 'sc-m', 'stop-opacity': (4 * u * (1 - u)).toFixed(3) }, dip);
    }
    const cg = s('radialGradient', { id: 'osc-cloud' }, defs);
    s('stop', { offset: 0, class: 'sc-m', 'stop-opacity': 0.75 }, cg);
    s('stop', { offset: 0.6, class: 'sc-m', 'stop-opacity': 0.3 }, cg);
    s('stop', { offset: 1, class: 'sc-m', 'stop-opacity': 0 }, cg);
    s('clipPath', { id: 'osc-clip' }, defs).appendChild(LM.s('rect', { x: 0, y: 0, width: 600, height: 300 }));

    const top = s('g', { 'clip-path': 'url(#osc-clip)' }, svg);
    const crests = [];
    for (let i = 0; i < 12; i++) crests.push(s('line', { y1: 24, y2: 296, class: 's-e', 'stroke-width': 1.2, opacity: 0.13 }, top));
    const rings = [];
    for (let i = 0; i < 7; i++) rings.push(s('circle', { cx: C[0], cy: C[1], fill: 'none', stroke: 'url(#osc-dip)', 'stroke-width': 3 }, top));
    text(top, 18, 36, '入射光（波峰）→', 't-s t-e');
    text(svg, C[0], 22, '沿振动方向：不辐射', 't-s mid');
    text(svg, 590, 165, '垂直方向：', 't-s end');
    text(svg, 590, 182, '辐射最强', 't-s end');
    const eArr = LM.arrow(svg, 'var(--efield)', 3, 11);
    text(svg, 106, 176, 'E', 't-m t-e end');
    const cloud = s('circle', { cx: C[0], cy: C[1], r: 36, fill: 'url(#osc-cloud)' }, svg);
    s('circle', { cx: C[0], cy: C[1], r: 6, class: 'f-ink' }, svg);
    text(svg, C[0] + 9, C[1] - 8, '+', 't-b');
    const pArr = LM.arrow(svg, 'var(--matter)', 3, 11);
    text(svg, C[0] + 98, 176, 'p', 't-m t-mat');
    text(svg, C[0] - 50, 262, '电子云（−）', 't-s t-mat end');
    text(svg, 360, 282, 'm ẍ + mγ ẋ + mω₀² x = −e E(t)', 't-m', { 'font-size': 15 });

    /* oscilloscope traces */
    const TY = 372, TA = 34, TX0 = 44, TX1 = 584;
    s('line', { x1: TX0, y1: TY, x2: TX1, y2: TY, class: 's-grid', 'stroke-width': 1 }, svg);
    s('line', { x1: TX0, y1: 314, x2: TX1, y2: 314, class: 's-rule', 'stroke-width': 1 }, svg);
    const trE = s('polyline', { class: 'ln s-e', 'stroke-width': 2 }, svg);
    const trP = s('polyline', { class: 'ln s-m', 'stroke-width': 2.4 }, svg);
    text(svg, TX0 - 6, TY - 22, 'E(t)', 't-s t-e end');
    text(svg, TX0 - 6, TY + 26, 'p(t)', 't-s t-mat end');
    text(svg, TX1, 330, '← 过去        现在 →', 't-s end');
    const lagTxt = text(svg, TX0, 330, '', 't-mono');

    /* ---------------- chart ---------------- */
    const X = LM.lin(0, 2.5, 48, 340), Y = LM.lin(0, 3, 360, 44);
    const shade = s('rect', { y: 44, height: 316, class: 'f-med2' }, chart);
    const shadeT = text(chart, 0, 60, 'ε′<0', 't-s mid');
    for (let v = 0; v <= 3; v += 0.5) {
      s('line', { x1: 48, x2: 340, y1: Y(v), y2: Y(v), class: v === 0 ? 's-axis' : 's-grid', 'stroke-width': 1 }, chart);
      text(chart, 40, Y(v) + 4, LM.f(v, 1), 't-mono end', { 'font-size': 11.5 });
    }
    s('line', { x1: 48, x2: 340, y1: Y(1), y2: Y(1), class: 's-axis', 'stroke-width': 1 }, chart);
    for (let w = 0; w <= 2.5; w += 0.5) {
      s('line', { x1: X(w), x2: X(w), y1: 360, y2: 365, class: 's-axis', 'stroke-width': 1 }, chart);
      text(chart, X(w), 380, LM.f(w, 1), 't-mono mid', { 'font-size': 11.5 });
    }
    text(chart, 194, 404, '驱动频率 ω / ω₀', 't-s mid');
    s('path', { d: 'M' + X(0.13) + ' 352V346H' + X(0.23) + 'V352', class: 'ln s-ink2', 'stroke-width': 1.2 }, chart);
    text(chart, X(0.18), 338, '可见光@玻璃', 't-s mid');
    const npts = [], kpts = [];
    let sa = null, sb = null;
    for (let i = 0; i <= 500; i++) {
      const w = (i / 500) * 2.5;
      const r = nk(w);
      npts.push([X(w), Y(Math.min(r.n, 3.05))]);
      kpts.push([X(w), Y(Math.min(r.k, 3.05))]);
      if (r.e1 < 0) {
        if (sa === null) sa = w;
        sb = w;
      }
    }
    LM.attr(shade, { x: X(sa), width: X(sb) - X(sa) });
    LM.attr(shadeT, { x: (X(sa) + X(sb)) / 2 });
    s('polyline', { points: LM.pts(kpts), class: 'ln', stroke: 'var(--s2)', 'stroke-width': 2 }, chart);
    s('polyline', { points: LM.pts(npts), class: 'ln', stroke: 'var(--s1)', 'stroke-width': 2 }, chart);
    text(chart, X(0.22), Y(1.53) - 10, 'n', 't-m');
    text(chart, X(1.32), Y(1.9), 'κ', 't-m');
    const lg = s('g', { transform: 'translate(48 22)' }, chart);
    s('line', { x1: 0, x2: 16, y1: 0, y2: 0, stroke: 'var(--s1)', 'stroke-width': 2.5 }, lg);
    text(lg, 22, 4, 'n 折射率', 't-s', { fill: 'var(--ink-2)' });
    s('line', { x1: 110, x2: 126, y1: 0, y2: 0, stroke: 'var(--s2)', 'stroke-width': 2.5 }, lg);
    text(lg, 132, 4, 'κ 消光系数（吸收）', 't-s', { fill: 'var(--ink-2)' });
    const mk = s('line', { y1: 44, y2: 360, class: 's-ink', 'stroke-width': 1.2 }, chart);
    const dn = s('circle', { r: 5, fill: 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2 }, chart);
    const dk = s('circle', { r: 5, fill: 'var(--s2)', stroke: 'var(--surface)', 'stroke-width': 2 }, chart);
    const hov = s('line', { y1: 44, y2: 360, class: 's-mut', 'stroke-width': 1, visibility: 'hidden' }, chart);
    const tip = LM.tip(chart.parentNode);

    /* ---------------- state ---------------- */
    let w = 0.45, A = amp(w), phi = lag(w), Avis = 0, R = nk(w);
    const T0 = 1.25, CV = 105;
    const relRad = (x) => (Math.pow(x, 4) * Math.pow(amp(x), 2)) / (Math.pow(0.5, 4) * Math.pow(amp(0.5), 2));
    const slider = LM.range('osc-w', (v) => {
      w = v;
      A = amp(w);
      phi = lag(w);
      Avis = Math.min(1, 0.28 * Math.pow(A, 0.75));
      R = nk(w);
      LM.attr(mk, { x1: X(w), x2: X(w) });
      LM.attr(dn, { cx: X(w), cy: Y(Math.min(R.n, 3.05)) });
      LM.attr(dk, { cx: X(w), cy: Y(Math.min(R.k, 3.05)) });
      LM.setText('osc-phi', LM.f(phi / LM.DEG, 1) + '°');
      LM.setText('osc-amp', '×' + LM.sig(A, 3));
      LM.setText('osc-rad', '×' + LM.sci(relRad(w), 1));
      LM.setText('osc-n', LM.f(R.n, 3));
      LM.setText('osc-k', LM.f(R.k, 3));
      let say;
      if (R.e1 < 0) say = 'ε′ < 0：电子反相且响应强烈，光几乎进不去而被强烈反射（剩余射线带，像金属一样有光泽）';
      else if (w < 0.6) say = '电子几乎与电场同步：物质透明，n > 1，且随频率升高而增大（正常色散）';
      else if (w < 0.9) say = '逐渐接近共振：n 迅速增大，吸收开始出现';
      else if (w < 1.04) say = '共振：电子振幅最大、落后约 90°，从光中持续吸收能量';
      else say = '远高于共振：电子跟不上、反相振动，振幅很小，n < 1（X 射线在玻璃中就是这样）';
      LM.setText('osc-say', say);
      LM.setText(lagTxt, 'p 落后 E：' + LM.f(phi / LM.DEG, 0) + '°');
      sc.render();
    }, (v) => LM.f(v, 2));
    LM.chips('osc-pre', (b) => slider.set(b.getAttribute('data-v')));
    LM.drag(chart, (x, y, kind) => {
      if (kind === 'leave') {
        hov.setAttribute('visibility', 'hidden');
        tip.hide();
        return;
      }
      const wv = clamp(X.inv(x), 0.1, 2.5);
      if (kind === 'down' || kind === 'drag') slider.set(wv.toFixed(2));
      const r = nk(wv);
      LM.attr(hov, { x1: X(wv), x2: X(wv), visibility: null });
      const pp = LM.toPanel(chart, X(wv), Math.min(Y(Math.min(r.n, 3)), Y(Math.min(r.k, 3))));
      tip.show(pp[0], pp[1], 'ω/ω₀ = ' + LM.f(wv, 2), [
        { color: 'var(--s1)', value: LM.f(r.n, 3), label: '折射率 n' },
        { color: 'var(--s2)', value: LM.f(r.k, 3), label: '消光系数 κ' },
      ]);
    });

    function update(t) {
      const Om = (w * TAU) / T0, k = Om / CV;
      const E = (x) => Math.cos(Om * t - k * (x - C[0]));
      /* crest positions: Ωt − k(x − x_atom) = 2πm; the first one at or right of x = 0 */
      const mTop = Math.floor((Om * t + k * C[0]) / TAU);
      const x0 = C[0] + (Om * t - TAU * mTop) / k;
      crests.forEach((ln, i) => {
        const pos = x0 + (i * TAU) / k;
        if (pos > 610) ln.setAttribute('visibility', 'hidden');
        else LM.attr(ln, { x1: pos.toFixed(1), x2: pos.toFixed(1), visibility: null });
      });
      const e0 = E(C[0]);
      eArr.set(128, C[1], 128, C[1] - 64 * e0, 11);
      const p = Avis * Math.cos(Om * t - phi);
      cloud.setAttribute('cy', (C[1] + 40 * p).toFixed(1));
      pArr.set(C[0] + 82, C[1], C[0] + 82, C[1] - 62 * p, 11);
      const op = clamp(0.3 + 0.6 * Math.sqrt(Math.min(relRad(w), 25)) / 2.2, 0.22, 0.95);
      const ph = (Om * t - phi) / TAU;
      const m0 = Math.floor(ph);
      rings.forEach((r, i) => {
        const age = ((ph - (m0 - i)) * TAU) / Om;
        const rad = age * CV;
        if (rad < 38 || rad > 420) {
          r.setAttribute('visibility', 'hidden');
          return;
        }
        LM.attr(r, { r: rad.toFixed(1), opacity: (op * (1 - rad / 440)).toFixed(3), visibility: null });
      });
      const span = (2.2 * TAU) / Math.max(Om, 0.5);
      const pe = [], pp = [];
      for (let i = 0; i <= 120; i++) {
        const tau = (1 - i / 120) * span;
        const x = TX0 + (i / 120) * (TX1 - TX0);
        pe.push([x, TY - TA * Math.cos(Om * (t - tau))]);
        pp.push([x, TY - TA * Avis * Math.cos(Om * (t - tau) - phi)]);
      }
      trE.setAttribute('points', LM.pts(pe));
      trP.setAttribute('points', LM.pts(pp));
    }
    return { update: update, t0: 0.6 };
  });
})();
