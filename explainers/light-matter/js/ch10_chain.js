/* ch10_chain.js — the whole chain: sun → atmosphere → surface → atmosphere → sensor */
(function () {
  'use strict';
  const { s, text, TAU, clamp } = LM;

  const BANDS = {
    blue: {
      nm: 490, show: 462, name: '蓝 490 nm', mix: { path: 0.42, surf: 0.38, adj: 0.08, cirrus: 0.04, atmabs: 0.03, water: 0.05 },
      rho: { water: 0.06, veg: 0.05, soil: 0.14 },
      comp: [['大气程辐射', 60, 'var(--s1)'], ['地表信号', 40, 'var(--s2)']],
      say: ['瑞利散射 ∝ λ⁻⁴：暗的植被', '上空，大半信号来自大气本身。', '蓝波段最依赖大气校正；', '水体的离水信号也在这里。'],
    },
    red: {
      nm: 665, name: '红 665 nm', mix: { path: 0.2, surf: 0.6, adj: 0.08, cirrus: 0.04, atmabs: 0.05, water: 0.03 },
      rho: { water: 0.02, veg: 0.04, soil: 0.26 },
      comp: [['大气程辐射', 28, 'var(--s1)'], ['地表信号', 72, 'var(--s2)']],
      say: ['散射减弱。植被吸收红光', '（叶绿素），土壤反射较强：', '红波段是 NDVI 的“分母”', '一侧。'],
    },
    nir: {
      nm: 842, name: '近红外 842 nm', mix: { path: 0.07, surf: 0.76, adj: 0.08, cirrus: 0.04, atmabs: 0.05, water: 0 },
      rho: { water: 0.004, veg: 0.49, soil: 0.31 },
      comp: [['大气程辐射', 8, 'var(--s1)'], ['地表信号', 92, 'var(--s2)']],
      say: ['大气几乎透明。植被一半', '光子被反射回来，水体几乎', '全部吸收：水陆界线和植被', '长势在这里最清楚。'],
    },
    cirrus: {
      nm: 1375, name: '卷云 1375 nm', mix: { path: 0.04, surf: 0, adj: 0, cirrus: 0.26, atmabs: 0.7, water: 0 },
      rho: { water: 0, veg: 0.3, soil: 0.36 },
      comp: [['大气程辐射', 10, 'var(--s1)'], ['地表信号', 3, 'var(--s2)'], ['高空卷云', 87, 'var(--s3)']],
      say: ['低层水汽几乎吞掉了射向', '地面的光：地面“消失”，', '只有高空的卷云还亮着。', 'Sentinel-2 的 B10 专测卷云。'],
    },
    tir: {
      nm: 11000, name: '热红外 11 µm', mix: { emit: 0.64, emitAtm: 0.2, emitAbs: 0.16 },
      rho: {},
      comp: [['大气自身发射', 18, 'var(--s1)'], ['地表热发射', 82, 'var(--s2)']],
      say: ['不再看反射的阳光，而是看', '地物自己发出的热辐射。', '需要同时校正地表发射率', '与大气的吸收和发射。'],
    },
  };

  LM.scene('fig-chain', function (fig, sc) {
    const svg = document.getElementById('chain-svg');
    const bar = document.getElementById('chain-bar');
    const GY = 382, AT0 = 104, AT1 = 300, SUN = [62, 62], SEN = [610, 64];
    let band = 'blue', B = BANDS.blue;
    const rng = LM.rng(77);

    /* scene */
    s('rect', { x: 0, y: AT0, width: 680, height: AT1 - AT0, class: 'f-med' }, svg);
    for (let i = 0; i < 80; i++) s('circle', { cx: (rng() * 680).toFixed(1), cy: (AT0 + 6 + rng() * (AT1 - AT0 - 10)).toFixed(1), r: 1.4, class: 'f-mut', opacity: 0.55 }, svg);
    for (let i = 0; i < 16; i++) s('circle', { cx: (rng() * 680).toFixed(1), cy: (AT1 - 70 + rng() * 64).toFixed(1), r: 3.2, class: 'f-ground2', opacity: 0.7 }, svg);
    text(svg, 12, AT1 - 8, '大气：分子（小点）与气溶胶（大点）', 't-s halo');
    const cir = s('g', null, svg);
    [[318, 128, 46, 9], [366, 122, 52, 8], [418, 130, 40, 7], [350, 136, 36, 6]].forEach(([x, y, rx, ry]) => s('ellipse', { cx: x, cy: y, rx: rx, ry: ry, class: 'f-surf s-mut', 'stroke-width': 1, opacity: 0.9 }, cir));
    const cirT = text(svg, 368, 112, '卷云（约 10 km）', 't-s mid halo');
    s('rect', { x: 0, y: GY, width: 220, height: 78, class: 'f-water' }, svg);
    s('rect', { x: 220, y: GY, width: 230, height: 78, class: 'f-veg' }, svg);
    s('rect', { x: 450, y: GY, width: 230, height: 78, class: 'f-ground', opacity: 0.8 }, svg);
    s('line', { x1: 0, x2: 680, y1: GY, y2: GY, class: 's-ink2', 'stroke-width': 1.5 }, svg);
    for (let x = 236; x < 446; x += 26) {
      s('line', { x1: x, x2: x, y1: GY, y2: GY - 16, class: 's-ink2', 'stroke-width': 2 }, svg);
      s('circle', { cx: x, cy: GY - 24, r: 11, class: 'f-veg s-veg', 'stroke-width': 1.2 }, svg);
    }
    text(svg, 110, GY + 46, '水体', 't-b mid');
    text(svg, 335, GY + 46, '植被', 't-b mid');
    text(svg, 565, GY + 46, '土壤', 't-b mid');
    const sun = s('g', { transform: 'translate(' + SUN[0] + ' ' + SUN[1] + ')' }, svg);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      s('line', { x1: Math.cos(a) * 30, y1: Math.sin(a) * 30, x2: Math.cos(a) * 38, y2: Math.sin(a) * 38, class: 's-p', 'stroke-width': 2 }, sun);
    }
    s('circle', { r: 24, class: 'f-p' }, sun);
    const sunT = text(svg, SUN[0], SUN[1] + 56, '太阳', 't-s mid');
    const senG = s('g', { transform: 'translate(' + SEN[0] + ' ' + SEN[1] + ')' }, svg);
    const glow = s('circle', { r: 26, class: 'f-e', opacity: 0 }, senG);
    s('rect', { x: -16, y: -12, width: 32, height: 24, rx: 3, class: 'f-surf s-ink2', 'stroke-width': 1.5 }, senG);
    s('rect', { x: -56, y: -6, width: 36, height: 12, class: 'f-med2 s-b', 'stroke-width': 1 }, senG);
    s('rect', { x: 20, y: -6, width: 36, height: 12, class: 'f-med2 s-b', 'stroke-width': 1 }, senG);
    s('circle', { cy: 15, r: 4.5, class: 'f-ink2' }, senG);
    text(svg, SEN[0], SEN[1] + 40, '传感器', 't-s mid');
    const sAt = (x) => (x < 220 ? 'water' : x < 450 ? 'veg' : 'soil');

    /* photons */
    const N = 22;
    const gP = s('g', null, svg);
    const ph = [];
    for (let i = 0; i < N; i++) ph.push({ on: false, trail: s('polyline', { class: 'ln', 'stroke-width': 1.7, visibility: 'hidden' }, gP), dot: s('circle', { r: 3.8, visibility: 'hidden' }, gP), burst: s('circle', { r: 4, fill: 'none', 'stroke-width': 1.5, visibility: 'hidden' }, gP) });
    const sunPt = () => [SUN[0] + 16 + rng() * 14, SUN[1] + 16 + rng() * 10];
    const atmPt = (y0, y1) => [140 + rng() * 520, (y0 || AT0 + 14) + rng() * ((y1 || AT1 - 10) - (y0 || AT0 + 14))];
    function pick(mix) {
      let r = rng(), acc = 0;
      for (const k in mix) {
        acc += mix[k];
        if (r < acc) return k;
      }
      return Object.keys(mix)[0];
    }
    function makePath() {
      const kind = pick(B.mix);
      let pts, end = 'sensor';
      const g = [40 + rng() * 620, GY];
      if (kind === 'path') pts = [sunPt(), atmPt(), SEN];
      else if (kind === 'surf') {
        const rho = B.rho[sAt(g[0])];
        if (rng() < Math.min(0.92, rho * 1.5)) pts = [sunPt(), g, SEN];
        else {
          pts = [sunPt(), g];
          end = 'absorb';
        }
      } else if (kind === 'adj') {
        const g2 = [220 + rng() * 440, GY];
        if (rng() < Math.min(0.9, B.rho[sAt(g2[0])] * 1.6 + 0.1)) pts = [sunPt(), g2, atmPt(AT1 - 80, AT1 - 10), SEN];
        else {
          pts = [sunPt(), g2];
          end = 'absorb';
        }
      } else if (kind === 'cirrus') pts = [sunPt(), [300 + rng() * 120, 124 + rng() * 10], SEN];
      else if (kind === 'atmabs') {
        pts = [sunPt(), atmPt(AT1 - 90, AT1 - 6)];
        end = 'absorb';
      } else if (kind === 'water') {
        const x = 40 + rng() * 170;
        pts = [sunPt(), [x, GY], [x + 10 + rng() * 14, GY + 26 + rng() * 22], [x + 22, GY], SEN];
      } else if (kind === 'emit') pts = [[30 + rng() * 630, GY], SEN];
      else if (kind === 'emitAtm') pts = [atmPt(AT1 - 120, AT1 - 6), SEN];
      else {
        pts = [[30 + rng() * 630, GY], atmPt(AT1 - 110, AT1 - 20)];
        end = 'absorb';
      }
      return { pts: pts, end: end };
    }
    function launch(p, adv) {
      const P = makePath();
      const segs = [];
      let tot = 0;
      for (let i = 1; i < P.pts.length; i++) {
        const l = Math.hypot(P.pts[i][0] - P.pts[i - 1][0], P.pts[i][1] - P.pts[i - 1][1]);
        segs.push(l);
        tot += l;
      }
      Object.assign(p, { on: true, pts: P.pts, segs: segs, tot: tot, end: P.end, d: adv || 0, fade: 1 });
      const col = LM.specColor(B.show || B.nm);
      p.trail.style.stroke = col;
      p.dot.style.fill = col;
      p.burst.style.stroke = col;
      [p.trail, p.dot].forEach((e) => e.removeAttribute('visibility'));
      p.burst.setAttribute('visibility', 'hidden');
      LM.attr(p.trail, { opacity: 0.6 });
      LM.attr(p.dot, { opacity: 1 });
    }
    function posAt(p, d) {
      const out = [p.pts[0]];
      for (let i = 0; i < p.segs.length; i++) {
        if (d <= p.segs[i]) {
          const f = d / p.segs[i];
          const q = [p.pts[i][0] + (p.pts[i + 1][0] - p.pts[i][0]) * f, p.pts[i][1] + (p.pts[i + 1][1] - p.pts[i][1]) * f];
          out.push(q);
          return out;
        }
        d -= p.segs[i];
        out.push(p.pts[i + 1]);
      }
      return out;
    }
    let flash = 0;
    function drawPhoton(p) {
      const trail = posAt(p, Math.min(p.d, p.tot));
      const head = trail[trail.length - 1];
      p.trail.setAttribute('points', LM.pts(trail));
      LM.attr(p.dot, { cx: head[0].toFixed(1), cy: head[1].toFixed(1) });
    }

    /* composition panel */
    const bT = text(bar, 20, 30, '', 't-h');
    text(bar, 20, 50, '传感器入瞳信号的组成（示意）', 't-s');
    const BX = 22, BW = 52, BY0 = 70, BH = 250;
    s('rect', { x: BX, y: BY0, width: BW, height: BH, rx: 4, class: 'f-bg s-rule', 'stroke-width': 1 }, bar);
    const gB = s('g', null, bar);
    const sayT = [0, 1, 2, 3].map((k) => text(bar, 20, 356 + k * 22, '', 't'));
    function drawBar() {
      gB.textContent = '';
      let y = BY0 + BH;
      B.comp.forEach(([name, pct, col]) => {
        const h = (BH * pct) / 100;
        const r = s('rect', { x: BX, y: y - h + 1, width: BW, height: Math.max(0, h - 2), rx: 3 }, gB);
        r.style.fill = col;
        const ly = clamp(y - h / 2, BY0 + 10, BY0 + BH - 4);
        s('line', { x1: BX + BW + 3, x2: BX + BW + 14, y1: ly, y2: ly, class: 's-mut', 'stroke-width': 1 }, gB);
        text(gB, BX + BW + 18, ly - 2, name, 't');
        text(gB, BX + BW + 18, ly + 16, pct + '%', 't-mono');
        y -= h;
      });
      LM.setText(bT, B.name);
      B.say.forEach((l, k) => LM.setText(sayT[k], l));
    }
    function setBand(v) {
      band = v;
      B = BANDS[v];
      drawBar();
      cir.setAttribute('opacity', v === 'cirrus' ? 1 : 0.55);
      cirT.setAttribute('opacity', v === 'cirrus' ? 1 : 0.6);
      sun.setAttribute('opacity', v === 'tir' ? 0.35 : 1);
      LM.setText(sunT, v === 'tir' ? '太阳（此波段可忽略）' : '太阳');
      ph.forEach((p, i) => {
        launch(p, rng() * 600);
        if (p.d >= p.tot) p.d = p.tot * rng();
        if (i >= 14) {
          p.on = false;
          [p.trail, p.dot, p.burst].forEach((e) => e.setAttribute('visibility', 'hidden'));
        } else drawPhoton(p);
      });
      sc.render();
    }
    LM.seg('chain-band', setBand);
    LM.onTheme(() => setBand(band));
    let acc = 0;
    function update(t, dt) {
      if (dt > 0) {
        acc += dt;
        if (acc > 0.16) {
          acc = 0;
          const p = ph.find((q) => !q.on);
          if (p) launch(p, 0);
        }
        flash = Math.max(0, flash - dt * 2.5);
      }
      for (const p of ph) {
        if (!p.on) continue;
        if (p.d < p.tot) {
          p.d += 240 * dt;
          if (p.d >= p.tot) {
            p.d = p.tot;
            if (p.end === 'sensor') flash = 1;
            else {
              const e = p.pts[p.pts.length - 1];
              LM.attr(p.burst, { cx: e[0], cy: e[1], r: 3, visibility: null, opacity: 1 });
            }
          }
          drawPhoton(p);
        } else {
          p.fade -= dt * 1.6;
          LM.attr(p.trail, { opacity: Math.max(0, 0.6 * p.fade).toFixed(2) });
          LM.attr(p.dot, { opacity: Math.max(0, p.fade).toFixed(2) });
          if (p.end === 'absorb') LM.attr(p.burst, { r: (3 + (1 - p.fade) * 12).toFixed(1), opacity: Math.max(0, p.fade).toFixed(2) });
          if (p.fade <= 0) {
            p.on = false;
            [p.trail, p.dot, p.burst].forEach((e) => e.setAttribute('visibility', 'hidden'));
          }
        }
      }
      glow.setAttribute('opacity', (0.35 * flash).toFixed(2));
    }
    return { update: update };
  });
})();
