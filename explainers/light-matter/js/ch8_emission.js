/* ch8_emission.js — IR activity of molecular vibrations; Planck curves and atmospheric windows */
(function () {
  'use strict';
  const { s, text, TAU, clamp } = LM;

  /* ================= molecular vibrations ================= */
  LM.scene('fig-vib', function () {
    const svg = document.getElementById('vib-svg');
    const CPK = { O: '#e0412f', C: '#5c6370', N: '#3557e8', H: '#f4f6f8' };
    const Q = { O: '−', C: '+', N: '', H: '+' };
    const fvis = (wn) => 0.75 * Math.pow(wn / 667, 0.6);
    const mols = [
      {
        name: 'N₂ / O₂ 伸缩', sub: '4.3 µm · 不吸收', active: false, wn: 2330,
        foot: ['占大气 99%，振动时', '偶极矩始终为零'],
        geo: (u) => [['N', -20 - 5 * u, 0, 0], ['N', 20 + 5 * u, 0, 0]],
      },
      {
        name: 'CO₂ 对称伸缩', sub: '7.2 µm · 不吸收', active: false, wn: 1388,
        foot: ['两端对称拉伸，', '两个键的偶极相互抵消'],
        geo: (u) => [['O', -38 - 6 * u, 0, -0.35], ['C', 0, 0, 0.7], ['O', 38 + 6 * u, 0, -0.35]],
      },
      {
        name: 'CO₂ 弯曲', sub: '15.0 µm · 吸收', active: true, wn: 667,
        foot: ['吸收地球热辐射：', '温室效应的主力'],
        geo: (u) => [['O', -38, 7 * u, -0.35], ['C', 0, -18.7 * u, 0.7], ['O', 38, 7 * u, -0.35]],
      },
      {
        name: 'CO₂ 反对称伸缩', sub: '4.26 µm · 吸收', active: true, wn: 2349,
        foot: ['4.3 µm 强吸收带，', '用于测温度与 CO₂'],
        geo: (u) => [['O', -38 + 3.2 * u, 0, -0.35], ['C', -8.5 * u, 0, 0.7], ['O', 38 + 3.2 * u, 0, -0.35]],
      },
      {
        name: 'H₂O 弯曲', sub: '6.27 µm · 吸收', active: true, wn: 1595,
        foot: ['水汽 6.3 µm 吸收带；', '固有偶极还让它吸收微波'],
        geo: (u) => {
          const b = (104.5 + 16 * u) * LM.DEG / 2;
          return [['O', 0, -10, -0.8], ['H', -30 * Math.sin(b), -10 + 30 * Math.cos(b), 0.4], ['H', 30 * Math.sin(b), -10 + 30 * Math.cos(b), 0.4]];
        },
      },
      {
        name: 'O₃ 反对称伸缩', sub: '9.6 µm · 吸收', active: true, wn: 1042,
        foot: ['落在 8–14 µm 热红外', '窗口中间的一道“缝”'],
        geo: (u) => {
          const p = 58.4 * LM.DEG, a = 7 * u;
          return [['O', 0, -12, 0.5], ['O', (30 + a) * Math.sin(p), -12 + (30 + a) * Math.cos(p), -0.25], ['O', -(30 - a) * Math.sin(p), -12 + (30 - a) * Math.cos(p), -0.25]];
        },
      },
    ];
    const cells = mols.map((m, k) => {
      const g = s('g', { transform: 'translate(' + k * 160 + ' 0)' }, svg);
      if (k) s('line', { x1: 0, x2: 0, y1: 14, y2: 300, class: 's-rule', 'stroke-width': 1 }, g);
      text(g, 80, 28, m.name, 't-b mid');
      text(g, 80, 47, m.sub, 't-s mid');
      const bonds = s('g', { class: 's-ink2', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      const atoms = m.geo(0).map(([el]) => {
        const c = s('circle', { r: el === 'H' ? 7 : 11.5, stroke: 'var(--ink-2)', 'stroke-width': 1.2 }, g);
        c.setAttribute('fill', CPK[el]);
        const t = text(g, 0, 0, el, 't-s mid', { 'font-weight': 700, 'font-size': el === 'H' ? 9 : 11 });
        t.setAttribute('fill', el === 'H' ? '#333' : '#fff');
        return { c: c, t: t };
      });
      const dip = LM.arrow(g, 'var(--matter)', 2.6, 9);
      const zero = text(g, 80, 152, '偶极矩 = 0', 't-s mid t-mut');
      s('line', { x1: 14, x2: 146, y1: 198, y2: 198, class: 's-grid', 'stroke-width': 1 }, g);
      text(g, 14, 178, '偶极矩 μ(t)', 't-s');
      const tr = s('polyline', { class: 'ln s-m', 'stroke-width': 2 }, g);
      text(g, 80, 244, m.active ? '红外活性 ✓' : '红外不活跃 ✗', m.active ? 't-b mid t-mat' : 't-b mid t-mut');
      text(g, 80, 268, m.foot[0], 't-s mid');
      text(g, 80, 286, m.foot[1], 't-s mid');
      /* normalise the trace of the changing part of μ */
      let mx = 0, mean = [0, 0];
      const samp = [];
      for (let i = 0; i < 64; i++) {
        const u = Math.sin((i / 64) * TAU);
        let mu = [0, 0];
        m.geo(u).forEach(([el, x, y, q]) => {
          mu[0] += q * x;
          mu[1] += q * y;
        });
        samp.push(mu);
        mean[0] += mu[0] / 64;
        mean[1] += mu[1] / 64;
      }
      let dir = [0, 0];
      samp.forEach((mu) => {
        const d = [mu[0] - mean[0], mu[1] - mean[1]];
        const L = Math.hypot(d[0], d[1]);
        if (L > mx) {
          mx = L;
          dir = [d[0] / L, d[1] / L];
        }
      });
      return { m: m, g: g, bonds: bonds, atoms: atoms, dip: dip, zero: zero, tr: tr, mx: mx, mean: mean, dir: dir };
    });
    function update(t) {
      for (const c of cells) {
        const m = c.m, f = fvis(m.wn);
        const pos = m.geo(Math.sin(TAU * f * t));
        const P = pos.map(([el, x, y]) => [80 + x, 112 + y]);
        c.bonds.textContent = '';
        if (P.length === 2) s('line', { x1: P[0][0], y1: P[0][1], x2: P[1][0], y2: P[1][1] }, c.bonds);
        else if (m.name.indexOf('O₃') === 0 || m.name.indexOf('H₂O') === 0) {
          s('line', { x1: P[0][0], y1: P[0][1], x2: P[1][0], y2: P[1][1] }, c.bonds);
          s('line', { x1: P[0][0], y1: P[0][1], x2: P[2][0], y2: P[2][1] }, c.bonds);
        } else {
          s('line', { x1: P[0][0], y1: P[0][1], x2: P[1][0], y2: P[1][1] }, c.bonds);
          s('line', { x1: P[1][0], y1: P[1][1], x2: P[2][0], y2: P[2][1] }, c.bonds);
        }
        c.atoms.forEach((a, i) => {
          LM.attr(a.c, { cx: P[i][0].toFixed(1), cy: P[i][1].toFixed(1) });
          LM.attr(a.t, { x: P[i][0].toFixed(1), y: (P[i][1] + 4).toFixed(1) });
        });
        let mu = [0, 0];
        pos.forEach(([el, x, y, q]) => {
          mu[0] += q * x;
          mu[1] += q * y;
        });
        const sc2 = 2.4, L = Math.hypot(mu[0], mu[1]);
        if (L > 0.3) {
          /* p = Σ q r, pointing from the negative toward the positive charge */
          c.dip.set(80, 140, 80 + mu[0] * sc2, 140 + mu[1] * sc2, 9);
          c.zero.setAttribute('visibility', 'hidden');
        } else {
          c.dip.hide();
          c.zero.removeAttribute('visibility');
        }
        const pts = [];
        for (let i = 0; i <= 60; i++) {
          const tt = t - (1 - i / 60) * 2.2;
          let v = 0;
          if (c.mx > 1e-6) {
            const pp = m.geo(Math.sin(TAU * f * tt));
            let q = [0, 0];
            pp.forEach(([el, x, y, qq]) => {
              q[0] += qq * x;
              q[1] += qq * y;
            });
            v = ((q[0] - c.mean[0]) * c.dir[0] + (q[1] - c.mean[1]) * c.dir[1]) / c.mx;
          }
          pts.push([14 + (132 * i) / 60, 198 - 16 * v]);
        }
        c.tr.setAttribute('points', LM.pts(pts));
      }
    }
    return { update: update, t0: 0.35 };
  });

  /* ================= Planck & atmospheric windows ================= */
  LM.scene('fig-planck', function () {
    const svg = document.getElementById('planck-svg');
    const X = LM.logScale(0.2, 100, 84, 930);
    const YT = LM.logScale(1e-3, 1e8, 262, 34);
    const YB = LM.lin(0, 1, 452, 312);
    const OMEGA = 6.794e-5, ALB = 0.3;
    let T = 1000, rj = false;
    const defs = s('defs', null, svg);
    s('clipPath', { id: 'pk-clip' }, defs).appendChild(LM.s('rect', { x: 84, y: 34, width: 846, height: 228 }));
    for (let e = -3; e <= 8; e++) {
      s('line', { x1: 84, x2: 930, y1: YT(Math.pow(10, e)), y2: YT(Math.pow(10, e)), class: e === -3 ? 's-axis' : 's-grid', 'stroke-width': 1 }, svg);
      if (e % 2 === 0) text(svg, 76, YT(Math.pow(10, e)) + 4, '10' + LM.sup(e), 't-mono end', { 'font-size': 11.5 });
    }
    text(svg, 84, 20, '光谱辐亮度 W·m⁻²·sr⁻¹·µm⁻¹（对数）', 't-s');
    const ticks = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    ticks.forEach((v) => {
      s('line', { x1: X(v), x2: X(v), y1: 34, y2: 452, class: 's-grid', 'stroke-width': 1 }, svg);
      text(svg, X(v), 472, String(v), 't-mono mid', { 'font-size': 11.5 });
    });
    text(svg, 507, 494, '波长（µm，对数）', 't-s mid');
    const gc = s('g', { 'clip-path': 'url(#pk-clip)' }, svg);
    const curve = (fn, col, w, dash) => {
      const el = s('polyline', { class: 'ln', 'stroke-width': w || 2, 'stroke-dasharray': dash || null }, gc);
      el.style.stroke = col;
      return { el: el, fn: fn };
    };
    const sun = curve((um) => ALB * LM.planck(um, 5778) * (OMEGA / Math.PI), 'var(--s1)');
    const earth = curve((um) => LM.planck(um, 288), 'var(--s2)');
    const user = curve((um) => LM.planck(um, T), 'var(--s3)', 2.2);
    const rjc = curve((um) => (1.191042e8 * T) / (14387.77 * Math.pow(um, 4)), 'var(--s3)', 1.6, '6 5');
    const draw = (c) => {
      const p = [];
      for (let i = 0; i <= 300; i++) {
        const um = 0.2 * Math.pow(500, i / 300);
        const v = c.fn(um);
        p.push([X(um), YT(clamp(v, 1e-4, 1e9))]);
      }
      c.el.setAttribute('points', LM.pts(p));
    };
    draw(sun);
    draw(earth);
    /* crossover between reflected sunlight and terrestrial emission */
    let cross = 4;
    for (let um = 2; um < 8; um += 0.01) if (earth.fn(um) > sun.fn(um)) { cross = um; break; }
    s('circle', { cx: X(cross), cy: YT(sun.fn(cross)), r: 5, class: 'f-ink', stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    text(svg, X(cross) + 8, YT(sun.fn(cross)) + 20, '≈ ' + LM.f(cross, 1) + ' µm：两者相当', 't-s halo');
    text(svg, X(0.55), YT(sun.fn(0.55)) - 10, '地表反射的阳光（反照率 0.3）', 't-s halo');
    text(svg, X(30), YT(earth.fn(30)) + 22, '地表热辐射 288 K', 't-s halo');
    const uLab = text(svg, 0, 0, '', 't-s halo');
    const peak = s('circle', { r: 4.5, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    peak.style.fill = 'var(--s3)';
    const rjLab = text(svg, 0, 0, '经典预言：短波处趋于无穷', 't-s halo');
    const lg = s('g', { transform: 'translate(560 20)' }, svg);
    [['var(--s1)', '反射的阳光'], ['var(--s2)', '288 K 地表'], ['var(--s3)', '温度 T 的黑体']].forEach(([col, name], i) => {
      const ln = s('line', { x1: i * 124, x2: i * 124 + 16, y1: 0, y2: 0, 'stroke-width': 2.5 }, lg);
      ln.style.stroke = col;
      text(lg, i * 124 + 22, 4, name, 't-s', { fill: 'var(--ink-2)' });
    });

    /* atmospheric transmittance (schematic, vertical path, mid-latitude) */
    const feat = [
      [0.762, 1.5, 0.004], [0.72, 0.15, 0.008], [0.82, 0.25, 0.01], [0.94, 1.0, 0.02], [1.13, 1.2, 0.025], [1.38, 6, 0.045], [1.87, 6, 0.06],
      [2.0, 0.45, 0.025], [2.7, 10, 0.12], [3.2, 0.6, 0.15], [3.3, 0.4, 0.05], [4.3, 10, 0.08], [4.5, 0.5, 0.06], [6.3, 12, 0.8], [7.7, 1.2, 0.25],
      [9.6, 1.2, 0.18], [15, 12, 1.5],
    ];
    const tau = (um) => {
      let t = 0.0088 * Math.pow(um, -4.05) + (um < 4 ? 0.12 * Math.pow(um / 0.55, -1.3) : 0);
      t += um < 0.29 ? 50 : 3 * Math.exp(-(um - 0.29) / 0.012);
      for (const [c, p, w] of feat) t += p * Math.exp(-0.5 * Math.pow((um - c) / w, 2));
      t += 0.12 + 0.1 * Math.exp(-Math.pow((um - 12) / 3, 2));
      t += 8 / (1 + Math.exp(-(um - 18) / 1.2));
      return t;
    };
    const trans = (um) => Math.exp(-tau(um));
    for (let v = 0; v <= 1; v += 0.5) {
      s('line', { x1: 84, x2: 930, y1: YB(v), y2: YB(v), class: v === 0 ? 's-axis' : 's-grid', 'stroke-width': 1 }, svg);
      text(svg, 76, YB(v) + 4, v * 100 + '%', 't-mono end', { 'font-size': 11.5 });
    }
    text(svg, 84, 300, '整层大气透过率（示意）', 't-s');
    const tp = [];
    for (let i = 0; i <= 900; i++) {
      const um = 0.2 * Math.pow(500, i / 900);
      tp.push([X(um), YB(trans(um))]);
    }
    s('path', { d: LM.pathOf([[84, YB(0)]].concat(tp, [[930, YB(0)]]), true), class: 'f-med2' }, svg);
    s('polyline', { points: LM.pts(tp), class: 'ln s-ink2', 'stroke-width': 1.5 }, svg);
    [[0.25, 'O₃'], [0.762, 'O₂'], [1.38, 'H₂O'], [1.87, 'H₂O'], [2.75, 'H₂O·CO₂'], [4.3, 'CO₂'], [6.3, 'H₂O'], [9.6, 'O₃'], [15, 'CO₂'], [40, 'H₂O 转动']].forEach(([um, l]) => text(svg, X(um), YB(0) - 6, l, 't-s mid halo', { 'font-size': 11.5 }));
    [[0.62, '可见–近红外窗口'], [3.8, '3–5 µm'], [10.8, '8–14 µm 热红外窗口']].forEach(([um, l]) => text(svg, X(um), YB(1) + 14, l, 't-s mid halo', { fill: 'var(--ink-2)' }));

    const cl = s('line', { y1: 34, y2: 452, class: 's-ink', 'stroke-width': 1, visibility: 'hidden' }, svg);
    const tip = LM.tip(svg.parentNode);
    LM.drag(svg, (x, y, kind) => {
      if (kind === 'leave' || x === null || x < 84 || x > 930) {
        cl.setAttribute('visibility', 'hidden');
        tip.hide();
        return;
      }
      const um = X.inv(x);
      LM.attr(cl, { x1: x, x2: x, visibility: null });
      const pp = LM.toPanel(svg, x, 120);
      tip.show(pp[0], pp[1], LM.sig(um, 3) + ' µm', [
        { color: 'var(--s1)', value: LM.sci(sun.fn(um), 1), label: '反射的阳光' },
        { color: 'var(--s2)', value: LM.sci(earth.fn(um), 1), label: '288 K 地表' },
        { color: 'var(--s3)', value: LM.sci(user.fn(um), 1), label: T + ' K 黑体' },
        { value: LM.f(trans(um) * 100, 0) + '%', label: '大气透过率' },
      ]);
    });

    function render() {
      draw(user);
      if (rj) {
        draw(rjc);
        rjc.el.removeAttribute('visibility');
        rjLab.removeAttribute('visibility');
        const um = 0.6;
        LM.attr(rjLab, { x: X(um) + 6, y: Math.max(48, YT(rjc.fn(um * 2.2))) });
      } else {
        rjc.el.setAttribute('visibility', 'hidden');
        rjLab.setAttribute('visibility', 'hidden');
      }
      const lm = 2897.8 / T;
      LM.attr(peak, { cx: X(clamp(lm, 0.2, 100)), cy: YT(clamp(LM.planck(lm, T), 1e-4, 1e9)) });
      LM.attr(uLab, { x: X(clamp(lm, 0.2, 100)) + 8, y: YT(clamp(LM.planck(lm, T), 1e-4, 1e9)) - 8 });
      LM.setText(uLab, T + ' K 黑体，峰值 ' + LM.sig(lm, 3) + ' µm');
      LM.setText('planck-peak', LM.sig(lm, 3) + ' µm');
      LM.setText('planck-tot', LM.sci(5.670374e-8 * Math.pow(T, 4), 2) + ' W/m²');
      LM.setText('planck-ratio', '≈ 4.97（与温度无关）');
    }
    const sl = LM.range('planck-T', (v) => {
      T = v;
      render();
    }, (v) => v + ' K');
    LM.chips('planck-pre', (b) => sl.set(b.getAttribute('data-v')));
    const cb = document.getElementById('planck-rj');
    cb.addEventListener('change', () => {
      rj = cb.checked;
      render();
    });
    return { autoplay: false };
  });
})();
