/* ch5_qed.js — Feynman's arrows: sum over mirror paths, and partial reflection by a glass sheet */
(function () {
  'use strict';
  const { s, text, TAU, clamp, mod } = LM;

  /* ================= sum over paths ================= */
  LM.scene('fig-qed', function (fig, sc) {
    const svg = document.getElementById('qed-svg');
    const sumSvg = document.getElementById('qed-sum');
    const MY = 250, N = 53, S = [150, 66], P = [450, 66];
    const xs = [];
    for (let i = 0; i < N; i++) xs.push(40 + 10 * i);
    const len = xs.map((x) => Math.hypot(x - S[0], MY - S[1]) + Math.hypot(P[0] - x, MY - P[1]));
    const Lmin = Math.min.apply(null, len), Lmax = Math.max.apply(null, len);
    let lam = 44, mode = 'full', active = [], phi = [];

    /* geometry */
    const gPaths = s('g', null, svg);
    const paths = xs.map((x) => s('polyline', { points: LM.pts([S, [x, MY], P]), class: 'ln s-rule', 'stroke-width': 1 }, gPaths));
    const hi = s('polyline', { class: 'ln s-p', 'stroke-width': 2.4 }, svg);
    s('line', { x1: 300, y1: 30, x2: 300, y2: 116, class: 's-ink', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    text(svg, 308, 34, '挡板', 't-s');
    s('circle', { cx: S[0], cy: S[1], r: 7, class: 'f-p' }, svg);
    s('rect', { x: P[0] - 8, y: P[1] - 8, width: 16, height: 16, rx: 3, class: 'f-ink' }, svg);
    text(svg, S[0] - 14, S[1] + 4, 'S 光源', 't-b end');
    text(svg, P[0] + 14, P[1] + 4, 'P 探测器', 't-b');
    const strips = xs.map((x) => s('rect', { x: x - 4.6, y: MY, width: 9.2, height: 7, class: 'f-ink2' }, svg));
    text(svg, 566, MY + 22, '镜面', 't-s end');
    const dial = s('g', null, svg);
    s('circle', { r: 13, class: 'f-surf s-p', 'stroke-width': 2 }, dial);
    const dialHand = s('line', { x1: 0, y1: 0, class: 's-p', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, dial);
    /* time curve */
    const TY0 = 296, TY1 = 372;
    s('line', { x1: 36, x2: 566, y1: TY1 + 4, y2: TY1 + 4, class: 's-axis', 'stroke-width': 1 }, svg);
    text(svg, 36, TY0 - 8, '每条路径的耗时（最短处在镜面反射点）', 't-s');
    const tcurve = s('polyline', { class: 'ln s-ink2', 'stroke-width': 1.6 }, svg);
    const tY = (L) => TY1 - ((L - Lmin) / (Lmax - Lmin)) * (TY1 - TY0);
    tcurve.setAttribute('points', LM.pts(xs.map((x, i) => [x, tY(len[i])])));
    const tdot = s('circle', { r: 4.5, class: 'f-p', stroke: 'var(--surface)', 'stroke-width': 1.5 }, svg);
    s('line', { x1: 300, x2: 300, y1: TY0, y2: TY1 + 4, class: 's-mut', 'stroke-width': 1, 'stroke-dasharray': '3 4' }, svg);
    /* arrow row */
    const AY = 432;
    text(svg, 36, 404, '每条路径的“秒表指针”（箭头）', 't-s');
    const arrs = xs.map(() => LM.arrow(svg, 'var(--photon)', 1.6, 4));

    /* sum panel */
    text(sumSvg, 180, 30, '把所有箭头首尾相接', 't-b mid');
    const gChain = s('g', null, sumSvg);
    const chain = xs.map(() => LM.arrow(gChain, 'var(--photon)', 1.6, 4));
    const res = LM.arrow(sumSvg, 'var(--efield)', 3.4, 13);
    const startDot = s('circle', { r: 4, class: 'f-ink' }, sumSvg);
    const resT = text(sumSvg, 180, 446, '', 't-mono mid');
    text(sumSvg, 180, 466, '橙色：最终箭头，长度² ∝ 概率', 't-s mid');

    let scale = 11, origin = [180, 240], fullAmp = 1, sumV = [0, 0];
    function recompute() {
      phi = len.map((L) => (TAU * (L - Lmin)) / lam);
      const vec = (i) => [Math.sin(phi[i]), -Math.cos(phi[i])];
      let full = [0, 0];
      for (let i = 0; i < N; i++) {
        const v = vec(i);
        full[0] += v[0];
        full[1] += v[1];
      }
      fullAmp = Math.hypot(full[0], full[1]);
      const left = xs.map((x, i) => i < 18);
      if (mode === 'full') active = xs.map(() => true);
      else if (mode === 'left') active = left.slice();
      else {
        let best = -1, bestSet = null;
        for (let k = 0; k < 36; k++) {
          const ref = (k / 36) * TAU;
          const set = xs.map((x, i) => left[i] && Math.cos(phi[i] - ref) > 0);
          let a = [0, 0];
          set.forEach((on, i) => {
            if (on) {
              const v = vec(i);
              a[0] += v[0];
              a[1] += v[1];
            }
          });
          const m = Math.hypot(a[0], a[1]);
          if (m > best) {
            best = m;
            bestSet = set;
          }
        }
        active = bestSet;
      }
      /* fit chain into the panel */
      let x = 0, y = 0, minx = 0, maxx = 0, miny = 0, maxy = 0;
      sumV = [0, 0];
      for (let i = 0; i < N; i++) {
        if (!active[i]) continue;
        const v = vec(i);
        x += v[0];
        y += v[1];
        sumV[0] += v[0];
        sumV[1] += v[1];
        minx = Math.min(minx, x);
        maxx = Math.max(maxx, x);
        miny = Math.min(miny, y);
        maxy = Math.max(maxy, y);
      }
      const bw = Math.max(1e-6, maxx - minx), bh = Math.max(1e-6, maxy - miny);
      scale = Math.min(12, 300 / bw, 360 / bh);
      origin = [180 - ((minx + maxx) / 2) * scale, 236 - ((miny + maxy) / 2) * scale];
      strips.forEach((r, i) => {
        r.setAttribute('class', active[i] ? 'f-ink2' : 'f-none');
        LM.attr(r, { stroke: active[i] ? null : 'var(--muted)', 'stroke-dasharray': active[i] ? null : '2 2', 'stroke-width': active[i] ? null : 1 });
      });
      paths.forEach((p, i) => p.setAttribute('opacity', active[i] ? 1 : 0.25));
      const rel = Math.pow(Math.hypot(sumV[0], sumV[1]) / fullAmp, 2);
      LM.setText('qed-p', LM.f(rel * 100, rel < 0.1 ? 1 : 0) + '%');
      LM.setText('qed-n', active.filter(Boolean).length + ' / ' + N);
      LM.setText('qed-say', mode === 'full' ? '中间一段路径耗时几乎相同，箭头同向相加，贡献了绝大部分；两端的箭头打转、彼此抵消。' : mode === 'left' ? '这一段远离镜面反射点，耗时变化快，箭头转圈抵消：几乎没有光到达 P。' : '只保留指向相近的条带（相当于刻了一个光栅），抵消被破坏，光从“不该反射”的地方到达了 P。');
      sc.render();
    }
    LM.range('qed-lam', (v) => {
      lam = v;
      recompute();
    }, (v) => String(v));
    LM.seg('qed-mode', (v) => {
      mode = v;
      sc.t = 0;
      recompute();
    });

    const STEP = 0.12;
    function update(t) {
      const cyc = N * STEP + 2.6;
      const k = Math.min(N - 1, Math.floor(mod(t, cyc) / STEP));
      const done = mod(t, cyc) >= N * STEP;
      for (let i = 0; i < N; i++) {
        const v = [Math.sin(phi[i]), -Math.cos(phi[i])];
        arrs[i].set(xs[i] - 4.5 * v[0], AY - 4.5 * v[1], xs[i] + 4.5 * v[0], AY + 4.5 * v[1], 4).opacity(active[i] ? (i <= k || done ? 1 : 0.28) : 0.08);
      }
      let x = origin[0], y = origin[1];
      for (let i = 0; i < N; i++) {
        if (!active[i] || (i > k && !done)) {
          chain[i].hide();
          continue;
        }
        const v = [Math.sin(phi[i]) * scale, -Math.cos(phi[i]) * scale];
        chain[i].set(x, y, x + v[0], y + v[1], Math.min(4, scale * 0.45));
        x += v[0];
        y += v[1];
      }
      LM.attr(startDot, { cx: origin[0].toFixed(1), cy: origin[1].toFixed(1) });
      res.set(origin[0], origin[1], x, y, 13);
      const amp = Math.hypot(x - origin[0], y - origin[1]) / scale;
      LM.setText(resT, '|最终箭头|² = ' + LM.f(Math.pow(amp / fullAmp, 2) * 100, 1) + '%（相对整面镜子）');
      if (active[k] && !done) {
        hi.setAttribute('points', LM.pts([S, [xs[k], MY], P]));
        hi.removeAttribute('visibility');
        const v = [Math.sin(phi[k]), -Math.cos(phi[k])];
        dial.setAttribute('transform', 'translate(' + xs[k] + ' ' + (MY - 26) + ')');
        LM.attr(dialHand, { x2: (10 * v[0]).toFixed(1), y2: (10 * v[1]).toFixed(1) });
        dial.removeAttribute('visibility');
        LM.attr(tdot, { cx: xs[k], cy: tY(len[k]), visibility: null });
      } else {
        hi.setAttribute('visibility', 'hidden');
        dial.setAttribute('visibility', 'hidden');
        tdot.setAttribute('visibility', 'hidden');
      }
    }
    return { update: update, t0: 6.7 };
  });

  /* ================= glass sheet: 0 – 16 % ================= */
  LM.scene('fig-film', function (fig, sc) {
    const sl = document.getElementById('film-slab');
    const arcS = document.getElementById('film-arc');
    const ch = document.getElementById('film-chart');
    const NG = 1.5, LREF = 500, PXNM = 0.2, TOP = 128;
    let d = 120, manual = false, autoT = 0;
    const R = (dd, lam) => 0.16 * Math.pow(Math.sin((TAU * NG * dd) / lam), 2);

    /* slab */
    text(sl, 14, 24, '空气', 't-s');
    const slab = s('rect', { x: 30, y: TOP, width: 240, class: 'f-med2 s-med', 'stroke-width': 1.2 }, sl);
    const dT = text(sl, 276, TOP + 20, '', 't-mono end');
    const thI = 22 * LM.DEG, thT = Math.asin(Math.sin(thI) / NG);
    const rayI = LM.arrow(sl, 'var(--ink)', 2, 9);
    const ray1 = LM.arrow(sl, 'var(--ink)', 2, 9);
    const ray2 = LM.arrow(sl, 'var(--ink)', 2, 9);
    const inside = s('polyline', { class: 'ln s-ink2', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, sl);
    const l1 = text(sl, 0, 0, '前表面', 't-s halo'), l2 = text(sl, 0, 0, '后表面', 't-s halo');
    const sw = s('rect', { x: 196, y: 16, width: 74, height: 42, rx: 6, class: 's-rule', 'stroke-width': 1 }, sl);
    text(sl, 192, 34, '白光下的', 't-s end');
    text(sl, 192, 52, '反射色', 't-s end');

    /* arc */
    const C = [165, 140], RHO = 88;
    s('circle', { cx: C[0], cy: C[1], r: RHO, fill: 'none', class: 's-rule', 'stroke-width': 1, 'stroke-dasharray': '3 4' }, arcS);
    const gArc = s('g', null, arcS);
    const lay = [];
    for (let i = 0; i < 64; i++) lay.push(LM.arrow(gArc, 'var(--matter)', 1.6, 5));
    const rf = LM.arrow(arcS, 'var(--photon)', 2, 9), rb = LM.arrow(arcS, 'var(--photon)', 2, 9);
    rf.g.querySelector('line').setAttribute('stroke-dasharray', '5 4');
    rb.g.querySelector('line').setAttribute('stroke-dasharray', '5 4');
    const chord = LM.arrow(arcS, 'var(--efield)', 3.2, 12);
    s('circle', { cx: C[0], cy: C[1], r: 3, class: 'f-ink2' }, arcS);
    const tF = text(arcS, 0, 0, '前表面箭头', 't-s t-pho halo'), tB = text(arcS, 0, 0, '后表面箭头', 't-s t-pho halo');
    text(arcS, 165, 266, '绿：各层电子的回波　橙：总箭头（弦）', 't-s mid');
    const chT = text(arcS, 165, 288, '', 't-mono mid');

    /* chart */
    const X = LM.lin(0, 600, 46, 344), Y = LM.lin(0, 0.17, 248, 30);
    for (let v = 0; v <= 0.16; v += 0.04) {
      s('line', { x1: 46, x2: 344, y1: Y(v), y2: Y(v), class: v === 0 ? 's-axis' : 's-grid', 'stroke-width': 1 }, ch);
      text(ch, 40, Y(v) + 4, LM.f(v * 100, 0) + '%', 't-mono end', { 'font-size': 11 });
    }
    for (let v = 0; v <= 600; v += 100) text(ch, X(v), 266, String(v), 't-mono mid', { 'font-size': 11 });
    text(ch, 195, 288, '玻璃厚度 d（nm）', 't-s mid');
    [[450, 'var(--s1)'], [650, 'var(--s2)']].forEach(([lam, col]) => {
      const p = [];
      for (let dd = 0; dd <= 600; dd += 2) p.push([X(dd), Y(R(dd, lam))]);
      s('polyline', { points: LM.pts(p), class: 'ln', stroke: col, 'stroke-width': 2 }, ch);
    });
    const lg = s('g', { transform: 'translate(52 16)' }, ch);
    s('line', { x1: 0, x2: 16, y1: 0, y2: 0, stroke: 'var(--s1)', 'stroke-width': 2.5 }, lg);
    text(lg, 22, 4, '蓝光 450 nm', 't-s', { fill: 'var(--ink-2)' });
    s('line', { x1: 120, x2: 136, y1: 0, y2: 0, stroke: 'var(--s2)', 'stroke-width': 2.5 }, lg);
    text(lg, 142, 4, '红光 650 nm', 't-s', { fill: 'var(--ink-2)' });
    const mk = s('line', { y1: 30, y2: 248, class: 's-ink', 'stroke-width': 1.2 }, ch);
    const tip = LM.tip(ch.parentNode);

    function setD(v) {
      d = v;
      const out = document.getElementById('film-d-o');
      if (out) out.textContent = Math.round(d) + ' nm';
      const el = document.getElementById('film-d');
      if (el && Math.abs(parseFloat(el.value) - d) > 0.5) el.value = Math.round(d);
      const delta = (4 * Math.PI * NG * d) / LREF;
      LM.setText('film-ph', LM.f(delta / Math.PI, 2) + 'π');
      LM.setText('film-r', LM.f(R(d, LREF) * 100, 2) + '%');
      const q = d / (LREF / (4 * NG));
      let say;
      if (d < 15) say = '玻璃极薄：两个箭头几乎正好相反，反射趋于 0。';
      else if (Math.abs(q - Math.round(q)) < 0.08 && Math.round(q) % 2 === 1) say = '厚度 ≈ λ/(4n) 的奇数倍：两箭头同向，500 nm 的反射最强（约 16%）。';
      else if (Math.abs(q - Math.round(q)) < 0.08 && Math.round(q) % 2 === 0) say = '厚度 ≈ λ/(2n) 的整数倍：两箭头反向抵消，500 nm 几乎不反射。';
      else say = '两个表面箭头的夹角随厚度变化；不同波长的最强点位置不同，于是出现颜色。';
      LM.setText('film-say', say);
      LM.attr(mk, { x1: X(d), x2: X(d) });
      const col = LM.reflColor((nm) => R(d, nm), 5.2);
      sw.style.fill = LM.rgbCss(col);
      sc.render();
    }
    const dEl = document.getElementById('film-d');
    dEl.addEventListener('input', () => {
      manual = true;
      setD(parseFloat(dEl.value));
    });
    setD(parseFloat(dEl.value));
    document.getElementById('film-q').addEventListener('click', () => {
      manual = true;
      setD(LREF / (4 * NG));
    });
    const half = document.getElementById('film-h');
    if (half) half.addEventListener('click', () => {
      manual = true;
      setD(LREF / (2 * NG));
    });
    LM.drag(ch, (x, y, kind) => {
      if (kind === 'leave') {
        tip.hide();
        return;
      }
      const dd = clamp(X.inv(x), 0, 600);
      if (kind === 'down' || kind === 'drag') {
        manual = true;
        setD(Math.round(dd));
      }
      const pp = LM.toPanel(ch, X(dd), Y(Math.max(R(dd, 450), R(dd, 650))));
      tip.show(pp[0], pp[1], 'd = ' + Math.round(dd) + ' nm', [
        { color: 'var(--s1)', value: LM.f(R(dd, 450) * 100, 1) + '%', label: '450 nm' },
        { color: 'var(--s2)', value: LM.f(R(dd, 650) * 100, 1) + '%', label: '650 nm' },
      ]);
    });

    function draw() {
      const dp = d * PXNM;
      slab.setAttribute('height', Math.max(1.5, dp).toFixed(1));
      LM.setText(dT, 'd = ' + Math.round(d) + ' nm');
      LM.attr(dT, { y: TOP + Math.max(dp, 0) + 18 });
      const hx = 110, ti = Math.tan(thI), tt = Math.tan(thT);
      rayI.set(hx - 92 * ti, TOP - 92, hx, TOP, 9);
      ray1.set(hx, TOP, hx + 92 * ti, TOP - 92, 9);
      const bx = hx + dp * tt, ex = hx + 2 * dp * tt;
      inside.setAttribute('points', LM.pts([[hx, TOP], [bx, TOP + dp], [ex, TOP]]));
      ray2.set(ex, TOP, ex + 92 * ti, TOP - 92, 9);
      LM.attr(l1, { x: hx - 70, y: TOP - 6 });
      LM.attr(l2, { x: bx - 20, y: TOP + dp + 16 });
      /* arc of layer arrows */
      const delta = (4 * Math.PI * NG * d) / LREF;
      const nl = clamp(Math.round(d / 9), 4, 64);
      const P = (a) => [C[0] + RHO * Math.cos(Math.PI / 2 - a), C[1] + RHO * Math.sin(Math.PI / 2 - a)];
      for (let i = 0; i < 64; i++) {
        if (i < nl && d > 0.5) {
          const a = P((i * delta) / nl), b = P(((i + 1) * delta) / nl);
          lay[i].set(a[0], a[1], b[0], b[1], 5);
        } else lay[i].hide();
      }
      const p0 = P(0), pN = P(delta);
      rf.set(p0[0], p0[1], C[0], C[1], 9);
      rb.set(C[0], C[1], pN[0], pN[1], 9);
      chord.set(p0[0], p0[1], pN[0], pN[1], 12);
      LM.attr(tF, { x: p0[0] + 8, y: (p0[1] + C[1]) / 2 + 20 });
      const mx = (C[0] + pN[0]) / 2, my = (C[1] + pN[1]) / 2;
      LM.attr(tB, { x: mx + 8, y: my - 6 });
      LM.setText(chT, '|弦|² = ' + LM.f(R(d, LREF) * 100, 1) + '%（λ = 500 nm）');
    }
    function update(t, dt) {
      if (!manual && dt > 0) {
        autoT += dt;
        const v = 300 - 290 * Math.cos((autoT / 16) * TAU);
        setD(Math.round(v * 10) / 10);
        return;
      }
      draw();
    }
    sc.render = function () {
      draw();
    };
    return { update: update };
  });
})();
