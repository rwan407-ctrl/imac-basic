/* hero.js — opening zoom: satellite pixel → leaf → chlorophyll → atom */
(function () {
  'use strict';
  const { s, text, TAU, lerp, ease, smooth, mod } = LM;

  /* a sinusoid running along a straight segment */
  function wavePts(x1, y1, x2, y2, phase, amp, wl) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const out = [];
    for (let d = 0; d <= L; d += 3) {
      const taper = Math.min(1, d / 24, (L - d) / 24);
      const a = amp * taper * Math.sin((TAU * d) / wl - phase);
      out.push([x1 + ux * d + nx * a, y1 + uy * d + ny * a]);
    }
    return LM.pts(out);
  }

  LM.scene('fig-hero', function () {
    const svg = document.getElementById('hero-svg');
    const CX = 480, CY = 205, Z = 7;
    const defs = s('defs', null, svg);
    const dip = s('linearGradient', { id: 'hero-dip', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      s('stop', { offset: u, class: 'sc-m', 'stop-opacity': (4 * u * (1 - u)).toFixed(3) }, dip);
    }
    const cloud = s('radialGradient', { id: 'hero-cloud' }, defs);
    s('stop', { offset: 0, class: 'sc-m', 'stop-opacity': 0.7 }, cloud);
    s('stop', { offset: 0.55, class: 'sc-m', 'stop-opacity': 0.28 }, cloud);
    s('stop', { offset: 1, class: 'sc-m', 'stop-opacity': 0 }, cloud);

    const world = s('g', null, svg);
    const stages = [];

    /* ---------- A: satellite & pixel ---------- */
    (function () {
      const g = s('g', null, world);
      const st = { g: g, focus: [608, 322] };
      s('circle', { cx: 480, cy: 1650, r: 1378, class: 'f-med' }, g);
      s('circle', { cx: 480, cy: 1650, r: 1330, class: 'f-veg s-veg', 'stroke-width': 1.5 }, g);
      text(g, 196, 300, '大气层', 't-s');
      const surfY = (x) => 1650 - Math.sqrt(1330 * 1330 - (x - 480) * (x - 480));
      for (let i = 0; i < 9; i++) {
        const x = 536 + i * 16;
        const y = surfY(x + 8) - 5;
        s('rect', { x: x, y: y, width: 15, height: 10, class: i % 3 === 1 ? 'f-ground' : 'f-veg', stroke: 'var(--veg)', 'stroke-width': 0.6, opacity: 0.9 }, g);
      }
      s('rect', { x: 600, y: surfY(608) - 6, width: 16, height: 12, fill: 'none', class: 's-p', 'stroke-width': 2.2 }, g);
      /* sun */
      const sun = s('g', { transform: 'translate(110 96)' }, g);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        s('line', { x1: Math.cos(a) * 36, y1: Math.sin(a) * 36, x2: Math.cos(a) * 46, y2: Math.sin(a) * 46, class: 's-p ln', 'stroke-width': 2 }, sun);
      }
      s('circle', { r: 28, class: 'f-p' }, sun);
      text(g, 110, 166, '太阳', 't mid');
      /* satellite */
      const sat = s('g', { transform: 'translate(800 84)' }, g);
      s('rect', { x: -66, y: -7, width: 44, height: 14, class: 'f-med2 s-b', 'stroke-width': 1.2 }, sat);
      s('rect', { x: 22, y: -7, width: 44, height: 14, class: 'f-med2 s-b', 'stroke-width': 1.2 }, sat);
      for (let i = 1; i < 4; i++) {
        s('line', { x1: -66 + i * 11, y1: -7, x2: -66 + i * 11, y2: 7, class: 's-b', 'stroke-width': 0.8 }, sat);
        s('line', { x1: 22 + i * 11, y1: -7, x2: 22 + i * 11, y2: 7, class: 's-b', 'stroke-width': 0.8 }, sat);
      }
      s('rect', { x: -17, y: -13, width: 34, height: 26, rx: 3, class: 'f-surf s-ink2', 'stroke-width': 1.5 }, sat);
      s('circle', { cx: 0, cy: 17, r: 5, class: 'f-ink2' }, sat);
      text(g, 850, 128, '卫星传感器', 't');
      s('line', { x1: 800, y1: 102, x2: 600, y2: surfY(600) - 6, class: 's-mut', 'stroke-dasharray': '3 5', 'stroke-width': 1 }, g);
      s('line', { x1: 800, y1: 102, x2: 616, y2: surfY(616) - 6, class: 's-mut', 'stroke-dasharray': '3 5', 'stroke-width': 1 }, g);
      const inc = s('polyline', { class: 'ln s-e', 'stroke-width': 2 }, g);
      const out = s('polyline', { class: 'ln s-e', 'stroke-width': 1.6, opacity: 0.75 }, g);
      text(g, 640, 352, '一个像素 ≈ 10 m × 10 m', 't-b');
      s('line', { x1: 636, y1: 346, x2: 614, y2: 330, class: 's-ink2', 'stroke-width': 1 }, g);
      text(g, 330, 176, '入射阳光', 't-s t-e');
      text(g, 668, 236, '地面送回的光', 't-s t-e end');
      st.update = function (t) {
        const ph = t * 7;
        inc.setAttribute('points', wavePts(132, 116, 604, 314, ph, 7, 26));
        out.setAttribute('points', wavePts(612, 314, 792, 104, ph, 5, 26));
      };
      stages.push(st);
    })();

    /* ---------- B: leaf cross-section ---------- */
    (function () {
      const g = s('g', null, world);
      const st = { g: g, focus: [452, 172] };
      const rng = LM.rng(7);
      for (let x = 150; x < 806; x += 44) s('rect', { x: x + 1, y: 95, width: 42, height: 28, rx: 7, class: 'f-med s-veg', 'stroke-width': 1 }, g);
      for (let x = 152; x < 800; x += 34) {
        s('rect', { x: x, y: 128, width: 30, height: 90, rx: 13, class: 'f-veg s-veg', 'stroke-width': 1 }, g);
        for (let j = 0; j < 4; j++) {
          s('ellipse', { cx: x + 6, cy: 142 + j * 20, rx: 2.6, ry: 4.4, class: 'f-m', opacity: 0.85 }, g);
          s('ellipse', { cx: x + 24, cy: 150 + j * 20, rx: 2.6, ry: 4.4, class: 'f-m', opacity: 0.85 }, g);
        }
      }
      for (let row = 0; row < 3; row++) {
        for (let x = 168 + (row % 2) * 24; x < 800; x += 50) {
          const r = 15 + rng() * 6;
          s('circle', { cx: x + rng() * 8, cy: 238 + row * 26 + rng() * 6, r: r, class: 'f-veg s-veg', 'stroke-width': 1 }, g);
        }
      }
      for (let x = 150; x < 806; x += 44) s('rect', { x: x + 1, y: 304, width: 42, height: 26, rx: 7, class: 'f-med s-veg', 'stroke-width': 1 }, g);
      const labels = [
        [109, '上表皮'],
        [172, '栅栏组织 · 叶绿体'],
        [262, '海绵组织（含气腔）'],
        [318, '下表皮'],
      ];
      for (const [y, l] of labels) {
        text(g, 822, y + 5, l, 't-s');
        s('line', { x1: 806, y1: y, x2: 818, y2: y, class: 's-mut', 'stroke-width': 1 }, g);
      }
      const path1 = [[430, 22], [432, 95], [440, 160], [472, 232], [420, 272], [378, 240], [402, 180], [432, 122], [456, 95], [474, 22]];
      const path2 = [[540, 22], [542, 95], [550, 152]];
      s('polyline', { points: LM.pts(path1), class: 'ln s-nir', stroke: 'var(--nir)', 'stroke-width': 1.6, 'stroke-dasharray': '2 4', opacity: 0.7 }, g);
      s('polyline', { points: LM.pts(path2), class: 'ln', stroke: 'rgb(220,40,30)', 'stroke-width': 1.6, 'stroke-dasharray': '2 4', opacity: 0.7 }, g);
      const ph1 = s('circle', { r: 5, fill: 'var(--nir)' }, g);
      const ph2 = s('circle', { r: 5, fill: 'rgb(220,40,30)' }, g);
      const burst = s('circle', { cx: 550, cy: 152, r: 10, fill: 'none', stroke: 'rgb(220,40,30)', 'stroke-width': 1.5 }, g);
      text(g, 486, 44, '近红外光子：多次折射后从上表面逃出', 't-s');
      text(g, 556, 74, '红光光子：被叶绿体吸收', 't-s');
      text(g, 150, 360, '细胞壁 n ≈ 1.4，胞间空气 n = 1.0：每个界面都会折射、反射一次', 't-s');
      const segLen = [];
      let tot = 0;
      for (let i = 1; i < path1.length; i++) {
        const l = Math.hypot(path1[i][0] - path1[i - 1][0], path1[i][1] - path1[i - 1][1]);
        segLen.push(l);
        tot += l;
      }
      function along(path, lens, d) {
        for (let i = 0; i < lens.length; i++) {
          if (d <= lens[i]) {
            const f = d / lens[i];
            return [lerp(path[i][0], path[i + 1][0], f), lerp(path[i][1], path[i + 1][1], f)];
          }
          d -= lens[i];
        }
        return path[path.length - 1];
      }
      const lens2 = [73, 57.6];
      st.update = function (t) {
        const d = mod(t * 170, tot + 120);
        const p = along(path1, segLen, Math.min(d, tot));
        LM.attr(ph1, { cx: p[0], cy: p[1], opacity: d > tot ? 0 : 1 });
        const d2 = mod(t * 120, 260);
        const q = along(path2, lens2, Math.min(d2, 130.6));
        LM.attr(ph2, { cx: q[0], cy: q[1], opacity: d2 > 130.6 ? 0 : 1 });
        const b = d2 > 130.6 ? (d2 - 130.6) / 60 : 0;
        LM.attr(burst, { r: 5 + b * 16, opacity: d2 > 130.6 ? Math.max(0, 1 - b) : 0 });
      };
      stages.push(st);
    })();

    /* ---------- C: chlorophyll porphyrin ---------- */
    (function () {
      const g = s('g', null, world);
      const st = { g: g, focus: [480, 147] };
      const cx = 480, cy = 200;
      const piRing = s('circle', { cx: cx, cy: cy, r: 74, fill: 'none', class: 's-m', 'stroke-width': 30, opacity: 0.16 }, g);
      const bonds = s('g', { class: 's-ink2', 'stroke-width': 2, fill: 'none' }, g);
      const atoms = s('g', null, g);
      const pyr = [];
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 4 - Math.PI / 2;
        const pc = [cx + 82 * Math.cos(a), cy + 82 * Math.sin(a)];
        const v = [];
        for (let j = 0; j < 5; j++) {
          const b = a + Math.PI + (j * TAU) / 5;
          v.push([pc[0] + 27 * Math.cos(b), pc[1] + 27 * Math.sin(b)]);
        }
        pyr.push(v);
        s('polygon', { points: LM.pts(v) }, bonds);
        s('line', { x1: cx, y1: cy, x2: v[0][0], y2: v[0][1], 'stroke-dasharray': '3 3' }, bonds);
        s('circle', { cx: v[0][0], cy: v[0][1], r: 8, class: 'f-surf s-b', 'stroke-width': 1.5 }, atoms);
        text(atoms, v[0][0], v[0][1] + 4, 'N', 't-s mid t-bf');
      }
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 4 - Math.PI / 2 + Math.PI / 4;
        const m = [cx + 104 * Math.cos(a), cy + 104 * Math.sin(a)];
        const A = pyr[k][2], B = pyr[(k + 1) % 4][3];
        s('polyline', { points: LM.pts([A, m, B]) }, bonds);
        s('circle', { cx: m[0], cy: m[1], r: 3.5, class: 'f-ink2' }, atoms);
      }
      const tail = [];
      for (let i = 0; i <= 12; i++) tail.push([pyr[1][2][0] + 18 + i * 17, pyr[1][2][1] + 24 + i * 7 + (i % 2 ? 9 : -2)]);
      s('polyline', { points: LM.pts([pyr[1][2]].concat(tail)), class: 'ln s-mut', 'stroke-width': 2 }, g);
      text(g, 700, 372, '植醇尾链', 't-s');
      s('circle', { cx: cx, cy: cy, r: 14, class: 'f-m' }, atoms);
      text(atoms, cx, cy + 5, 'Mg', 't-s mid', { fill: 'var(--surface)', 'font-weight': 700 });
      text(g, cx, 60, '叶绿素 a 的卟啉环 · 约 1 nm', 't-b mid');
      /* incoming wave */
      const wave = s('polyline', { class: 'ln s-e', 'stroke-width': 2 }, g);
      const ticks = [];
      for (let i = 0; i < 14; i++) ticks.push(s('line', { class: 's-e', 'stroke-width': 1.2, opacity: 0.5 }, g));
      text(g, 60, 128, '入射光的电场 E', 't-s t-e');
      text(g, 54, 300, '离域 π 电子（绿色环）被电场来回推动', 't-s');
      /* energy levels */
      const lv = s('g', { transform: 'translate(780 0)' }, g);
      const y0 = 300, k = 46;
      s('line', { x1: 0, y1: y0, x2: 160, y2: y0, class: 's-ink', 'stroke-width': 2 }, lv);
      s('line', { x1: 0, y1: y0 - 1.85 * k, x2: 160, y2: y0 - 1.85 * k, class: 's-ink', 'stroke-width': 2 }, lv);
      s('line', { x1: 0, y1: y0 - 2.9 * k, x2: 160, y2: y0 - 2.9 * k, class: 's-ink', 'stroke-width': 2 }, lv);
      text(lv, 164, y0 + 4, 'S₀', 't-m', { 'font-size': 14 });
      text(lv, 164, y0 - 1.85 * k + 4, 'S₁', 't-m', { 'font-size': 14 });
      text(lv, 164, y0 - 2.9 * k + 4, 'S₂', 't-m', { 'font-size': 14 });
      LM.arrowAt(lv, 26, y0, 26, y0 - 1.85 * k + 1, 'rgb(220,40,30)', 2.2, 8);
      LM.arrowAt(lv, 70, y0, 70, y0 - 2.9 * k + 1, 'rgb(40,90,230)', 2.2, 8);
      const nirLen = 1.46 * k;
      s('line', { x1: 114, y1: y0, x2: 114, y2: y0 - nirLen, stroke: 'var(--nir)', 'stroke-width': 2.2, 'stroke-dasharray': '4 3' }, lv);
      text(lv, 114, y0 - nirLen - 8, '✕', 't-b mid', { fill: 'var(--nir)' });
      text(lv, 26, y0 + 22, '红 1.9 eV', 't-s mid');
      text(lv, 70, y0 + 38, '蓝 2.8 eV', 't-s mid');
      text(lv, 114, y0 + 22, '近红外 1.46 eV', 't-s mid');
      text(lv, 80, 104, '光子能量必须等于能级差', 't-s mid');
      st.update = function (t) {
        const w = 5.2;
        const pts = [];
        for (let x = 40; x <= 300; x += 4) pts.push([x, 200 - 42 * Math.cos(0.045 * x - w * t)]);
        wave.setAttribute('points', LM.pts(pts));
        ticks.forEach((ln, i) => {
          const x = 46 + i * 19;
          LM.attr(ln, { x1: x, y1: 200, x2: x, y2: 200 - 42 * Math.cos(0.045 * x - w * t) });
        });
        const e = Math.cos(0.045 * 370 - w * t);
        piRing.setAttribute('cy', (cy + 9 * e).toFixed(1));
      };
      stages.push(st);
    })();

    /* ---------- D: atom ---------- */
    (function () {
      const g = s('g', null, world);
      const st = { g: g, focus: [480, 205] };
      const ax = 480, ay = 214;
      const rings = [];
      for (let i = 0; i < 5; i++) rings.push(s('circle', { cx: ax, cy: ay, fill: 'none', stroke: 'url(#hero-dip)', 'stroke-width': 3 }, g));
      const ticks = [];
      for (let i = 0; i < 12; i++) ticks.push(s('line', { class: 's-e', 'stroke-width': 1.4, opacity: 0.55 }, g));
      const wave = s('polyline', { class: 'ln s-e', 'stroke-width': 1.6, opacity: 0.8 }, g);
      const cl = s('circle', { cx: ax, cy: ay, r: 48, fill: 'url(#hero-cloud)' }, g);
      s('circle', { cx: ax, cy: ay, r: 6, class: 'f-ink' }, g);
      text(g, ax + 10, ay - 8, '+', 't-b');
      const pArr = LM.arrow(g, 'var(--matter)', 3, 10);
      text(g, ax + 88, ay - 52, '偶极矩 p', 't-s t-mat');
      text(g, ax, 60, '原子 · 约 0.1 nm', 't-b mid');
      text(g, 60, 128, '入射光的电场 E', 't-s t-e');
      text(g, 700, 330, '新的电磁波：水平方向最强，', 't-s');
      text(g, 700, 348, '沿振动方向（上下）为零', 't-s');
      const W = 4.2;
      st.update = function (t) {
        const pts = [];
        for (let x = 40; x <= 330; x += 4) pts.push([x, ay - 46 * Math.cos(0.032 * x - W * t)]);
        wave.setAttribute('points', LM.pts(pts));
        ticks.forEach((ln, i) => {
          const x = 46 + i * 24;
          LM.attr(ln, { x1: x, y1: ay, x2: x, y2: ay - 46 * Math.cos(0.032 * x - W * t) });
        });
        const e = Math.cos(0.032 * ax - W * t);
        cl.setAttribute('cy', (ay + 18 * e).toFixed(1));
        pArr.set(ax + 80, ay, ax + 80, ay - 40 * e, 9);
        const per = TAU / W, speed = 95;
        const ph = (W * t - 0.032 * ax) / TAU;
        const m0 = Math.floor(ph);
        rings.forEach((r, i) => {
          const age = (ph - (m0 - i)) * per;
          const rad = age * speed;
          if (rad < 30 || rad > 470) {
            r.setAttribute('visibility', 'hidden');
            return;
          }
          LM.attr(r, { r: rad.toFixed(1), opacity: Math.max(0, 1 - rad / 470).toFixed(3), visibility: null });
        });
      };
      stages.push(st);
    })();

    /* ---------- scale ladder & caption ---------- */
    const lad = s('g', null, svg);
    const steps = ['像素 · 10 m', '叶片 · 0.2 mm', '分子 · 1 nm', '原子 · 0.1 nm'];
    const lx = [190, 400, 610, 820];
    const ladT = steps.map((str, i) => text(lad, lx[i], 26, str, 't mid'));
    for (let i = 0; i < 3; i++) text(lad, (lx[i] + lx[i + 1]) / 2, 26, '→', 't-s mid');
    const ladLine = s('line', { y1: 34, y2: 34, class: 's-e', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, lad);
    const caps = [
      '卫星记录的亮度，取决于地面把多少阳光送回来',
      '进入叶片的光，在细胞壁与空气之间反复折射、反射',
      '色素分子只吸收能量恰好对上能级差的光子',
      '电子被光的电场推着振动，再向四周辐射：一切反射与折射从这里开始',
    ];
    const cap = text(svg, 480, 390, caps[0], 't mid halo');

    const HOLD = 4.4, ZOOM = 1.7, SEG = HOLD + ZOOM, N = 4;
    function zoomIn(st, p) {
      const F = st.focus, sc = Math.pow(Z, p);
      const Lx = F[0] - ((1 - p) * (F[0] - CX)) / sc, Ly = F[1] - ((1 - p) * (F[1] - CY)) / sc;
      return 'translate(' + CX + ' ' + CY + ') scale(' + sc.toFixed(4) + ') translate(' + (-Lx).toFixed(2) + ' ' + (-Ly).toFixed(2) + ')';
    }
    function emerge(F, p) {
      const sx = F[0] + p * (CX - F[0]), sy = F[1] + p * (CY - F[1]), sc = Math.pow(Z, p - 1);
      return 'translate(' + sx.toFixed(2) + ' ' + sy.toFixed(2) + ') scale(' + sc.toFixed(4) + ') translate(' + -CX + ' ' + -CY + ')';
    }
    function show(st, tr, op) {
      LM.attr(st.g, { visibility: null, transform: tr, opacity: op.toFixed(3) });
    }
    function update(t) {
      const T = mod(t, SEG * N);
      const k = Math.floor(T / SEG), u = T - k * SEG;
      stages.forEach((st) => st.g.setAttribute('visibility', 'hidden'));
      let active = k;
      if (u < HOLD) {
        show(stages[k], '', 1);
        stages[k].update(t);
      } else {
        const p = ease((u - HOLD) / ZOOM);
        const nx = (k + 1) % N;
        if (k < N - 1) {
          show(stages[k], zoomIn(stages[k], p), 1 - smooth((p - 0.35) / 0.5));
          show(stages[nx], emerge(stages[k].focus, p), smooth((p - 0.15) / 0.55));
        } else {
          const q = 1 - p;
          show(stages[0], zoomIn(stages[0], q), 1 - smooth((q - 0.35) / 0.5));
          show(stages[k], emerge(stages[0].focus, q), smooth((q - 0.15) / 0.55));
        }
        stages[k].update(t);
        stages[nx].update(t);
        if (p > 0.5) active = nx;
      }
      ladT.forEach((tx, i) => tx.setAttribute('class', i === active ? 't-b mid' : 't mid'));
      const w = steps[active].length * 15 + 10;
      LM.attr(ladLine, { x1: lx[active] - w / 2, x2: lx[active] + w / 2 });
      LM.setText(cap, caps[active]);
    }
    return { update: update, t0: 1.2 };
  });
})();
