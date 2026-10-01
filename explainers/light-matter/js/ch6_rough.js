/* ch6_rough.js — roughness relative to wavelength: specular vs diffuse, phasor random walk */
(function () {
  'use strict';
  const { s, text, TAU, clamp, mod } = LM;

  LM.scene('fig-rough', function (fig, sc) {
    const svg = document.getElementById('rough-svg');
    const side = document.getElementById('rough-side');
    const TH = 35 * LM.DEG, ST = Math.sin(TH), CT = Math.cos(TH);
    const YS = 296, XL = 20, XR = 580, K = 110, HMAX = 44;
    let lam = 5.5e-7, sig = 5e-4, g = 0, spec = 1;

    /* fixed random surface profile with unit RMS */
    const rng = LM.rng(11);
    const comps = [];
    for (let i = 1; i <= 14; i++) comps.push([1 / Math.pow(i, 0.75), 0.018 * i + 0.01 * rng(), rng() * TAU]);
    const prof = [];
    for (let x = XL; x <= XR; x += 2) {
      let v = 0;
      for (const [a, f, p] of comps) v += a * Math.sin(f * x + p);
      prof.push(v);
    }
    const rms = Math.sqrt(prof.reduce((a, v) => a + v * v, 0) / prof.length);
    for (let i = 0; i < prof.length; i++) prof[i] /= rms;
    const profAt = (x) => prof[clamp(Math.round((x - XL) / 2), 0, prof.length - 1)];

    const ground = s('path', { class: 'f-ground', opacity: 0.7 }, svg);
    const surf = s('polyline', { class: 'ln s-ink2', 'stroke-width': 1.8 }, svg);
    s('line', { x1: 300, y1: YS, x2: 300 + 250 * ST, y2: YS - 250 * CT, class: 's-mut', 'stroke-width': 1.2, 'stroke-dasharray': '6 5' }, svg);
    text(svg, 300 + 252 * ST + 6, YS - 252 * CT + 4, '镜面方向', 't-s');
    s('line', { x1: 300, y1: YS - 4, x2: 300, y2: 60, class: 's-mut', 'stroke-width': 1, 'stroke-dasharray': '2 4' }, svg);
    LM.arrowAt(svg, 300 - 250 * ST, YS - 250 * CT, 300 - 200 * ST, YS - 200 * CT, 'var(--ink-2)', 2, 10);
    text(svg, 300 - 252 * ST - 4, YS - 252 * CT - 8, '入射 35°', 't-s end');
    const gPh = s('g', null, svg);
    const NP = 46;
    const ph = [];
    for (let i = 0; i < NP; i++) ph.push({ el: s('line', { class: 's-p', 'stroke-width': 2.6, 'stroke-linecap': 'round', visibility: 'hidden' }, gPh), on: false });
    /* wavelength ruler */
    const ruler = s('polyline', { class: 'ln s-e', 'stroke-width': 2 }, svg);
    const rulerT = text(svg, 24, 34, '', 't-s');
    const squash = text(svg, XR, 380, '', 't-s end');
    text(svg, XL, 400, '纵向：表面起伏相对波长的比例', 't-s');

    /* side panel: polar lobe */
    const PC = [180, 200], PR = 150;
    for (const r of [50, 100, 150]) s('path', { d: 'M' + (PC[0] - r) + ' ' + PC[1] + ' A' + r + ' ' + r + ' 0 0 1 ' + (PC[0] + r) + ' ' + PC[1], class: 'ln s-grid', 'stroke-width': 1 }, side);
    for (const a of [-60, -30, 0, 30, 60]) {
      const b = (a - 90) * LM.DEG;
      s('line', { x1: PC[0], y1: PC[1], x2: PC[0] + PR * Math.cos(b), y2: PC[1] + PR * Math.sin(b), class: 's-grid', 'stroke-width': 1 }, side);
    }
    s('line', { x1: PC[0] - PR - 8, x2: PC[0] + PR + 8, y1: PC[1], y2: PC[1], class: 's-axis', 'stroke-width': 1.2 }, side);
    LM.arrowAt(side, PC[0] - 150 * ST, PC[1] - 150 * CT, PC[0] - 18 * ST, PC[1] - 18 * CT, 'var(--ink-2)', 1.6, 9);
    text(side, PC[0] - 150 * ST - 4, PC[1] - 150 * CT - 6, '入射', 't-s end');
    text(side, 180, 26, '散射强度的方向分布', 't-b mid');
    const lobe = s('path', { class: 'f-p s-p', 'fill-opacity': 0.16, 'stroke-width': 1.8 }, side);
    const specT = text(side, 0, 0, '', 't-s halo');
    const difT = text(side, 0, 0, '', 't-s halo');
    /* side panel: phasor random walk */
    text(side, 180, 236, '30 个面元回波的小箭头', 't-b mid');
    const NF = 30;
    const z = [];
    const r2 = LM.rng(5);
    for (let i = 0; i < NF; i++) z.push(LM.gauss(r2));
    const zr = Math.sqrt(z.reduce((a, v) => a + v * v, 0) / NF);
    for (let i = 0; i < NF; i++) z[i] /= zr;
    const fa = z.map(() => LM.arrow(side, 'var(--photon)', 1.5, 4));
    const fres = LM.arrow(side, 'var(--efield)', 3, 11);
    const fT = text(side, 180, 400, '', 't-mono mid');

    function recompute() {
      g = Math.pow((4 * Math.PI * sig * CT) / lam, 2);
      spec = Math.exp(-g);
      const ratio = sig / lam;
      LM.setText('rough-ratio', LM.sci(ratio, 2));
      LM.setText('rough-crit', LM.length(lam / (8 * CT)));
      LM.setText('rough-spec', LM.f(spec * 100, spec < 0.01 ? 2 : 1) + '%');
      LM.setText('rough-say', g < 0.154 ? '光滑：几乎全部镜面反射（满足夫琅禾费判据 σ < λ/(32 cos θ)）' : g < 2.47 ? '过渡：镜面分量与漫射分量并存' : '粗糙：几乎全部漫反射（超过瑞利判据 λ/(8 cos θ)）');
      /* surface */
      const hpx = Math.min(HMAX, ratio * K);
      const pts = [];
      for (let x = XL, i = 0; x <= XR; x += 2, i++) pts.push([x, YS - hpx * prof[i]]);
      surf.setAttribute('points', LM.pts(pts));
      ground.setAttribute('d', LM.pathOf(pts.concat([[XR, 410], [XL, 410]]), true));
      /* ruler: one wavelength at the same vertical scale */
      const rl = ratio * K > HMAX ? (K * HMAX) / (ratio * K) : K;
      const rp = [];
      for (let i = 0; i <= 60; i++) rp.push([24 + (rl * i) / 60, 52 - 9 * Math.sin((TAU * i) / 60)]);
      ruler.setAttribute('points', LM.pts(rp));
      LM.setText(rulerT, '一个波长 λ = ' + LM.length(lam) + (rl < 6 ? '（短到几乎看不见）' : ''));
      LM.setText(squash, ratio * K > HMAX ? '起伏远大于波长，图中已压缩到上限' : '');
      /* lobe */
      const lp = [];
      for (let i = 0; i <= 180; i++) {
        const a = -Math.PI / 2 + (i / 180) * Math.PI;
        const sp = spec * Math.exp(-Math.pow((a - TH) / (4.5 * LM.DEG), 2));
        const df = (1 - spec) * 0.55 * Math.cos(a);
        const r = PR * Math.max(sp, df, 0);
        lp.push([PC[0] + r * Math.sin(a), PC[1] - r * Math.cos(a)]);
      }
      lobe.setAttribute('d', LM.pathOf(lp, true));
      LM.attr(specT, { x: PC[0] + 150 * spec * ST + 8, y: PC[1] - 150 * spec * CT + 2 });
      LM.setText(specT, spec > 0.02 ? '镜面分量 ' + LM.f(spec * 100, 0) + '%' : '');
      LM.attr(difT, { x: PC[0] + 64, y: PC[1] - 88 });
      LM.setText(difT, 1 - spec > 0.02 ? '漫射分量 ' + LM.f((1 - spec) * 100, 0) + '%' : '');
      
      /* phasors */
      const L = 7.4;
      let x = 70, y = 322, sx = 0, sy = 0;
      const vecs = z.map((zz) => {
        const p = (4 * Math.PI * sig * zz * CT) / lam;
        return [Math.cos(p), Math.sin(p)];
      });
      vecs.forEach((v) => {
        sx += v[0];
        sy += v[1];
      });
      let minx = 0, maxx = 0, miny = 0, maxy = 0, cx = 0, cy = 0;
      vecs.forEach((v) => {
        cx += v[0];
        cy += v[1];
        minx = Math.min(minx, cx);
        maxx = Math.max(maxx, cx);
        miny = Math.min(miny, cy);
        maxy = Math.max(maxy, cy);
      });
      x = 180 - ((minx + maxx) / 2) * L;
      y = 318 - ((miny + maxy) / 2) * L;
      const x0 = x, y0 = y;
      vecs.forEach((v, i) => {
        fa[i].set(x, y, x + v[0] * L, y - v[1] * L, 3.5);
        x += v[0] * L;
        y -= v[1] * L;
      });
      fres.set(x0, y0, x, y, 10);
      LM.setText(fT, '相干程度 |ΣA|/N = ' + LM.f(Math.hypot(sx, sy) / NF, 2));
      sc.render();
    }
    const lamS = LM.range('rough-lam', (v) => {
      lam = Math.pow(10, -6.398 + (5.875 * v) / 1000);
      recompute();
    }, (v) => LM.length(Math.pow(10, -6.398 + (5.875 * v) / 1000)));
    const sigS = LM.range('rough-sig', (v) => {
      sig = Math.pow(10, -9 + (8 * v) / 1000);
      recompute();
    }, (v) => LM.length(Math.pow(10, -9 + (8 * v) / 1000)));
    const toL = (m) => Math.round(((Math.log10(m) + 6.398) / 5.875) * 1000);
    const toS = (m) => Math.round(((Math.log10(m) + 9) / 8) * 1000);
    LM.chips('rough-pre', (b) => {
      lamS.set(toL(parseFloat(b.getAttribute('data-l'))));
      sigS.set(toS(parseFloat(b.getAttribute('data-s'))));
    });
    lamS.set(toL(5.5e-7));
    sigS.set(toS(5e-4));

    let spawnAcc = 0;
    const r3 = LM.rng(99);
    function spawn(p) {
      const xh = 70 + r3() * 460;
      p.on = true;
      p.xh = xh;
      p.yh = YS - Math.min(HMAX, (sig / lam) * K) * profAt(xh);
      p.t = 0;
      p.hit = 230 / 250;
      if (r3() < spec) p.out = [ST, -CT];
      else {
        const a = Math.asin(2 * r3() - 1);
        p.out = [Math.sin(a), -Math.cos(a)];
      }
    }
    function update(t, dt) {
      if (dt > 0) {
        spawnAcc += dt;
        while (spawnAcc > 0.06) {
          spawnAcc -= 0.06;
          const p = ph.find((q) => !q.on);
          if (p) spawn(p);
        }
      }
      for (const p of ph) {
        if (!p.on) continue;
        p.t += dt;
        const v = 250;
        let x, y, dx, dy, op = 1;
        if (p.t < p.hit) {
          const rem = (p.hit - p.t) * v;
          x = p.xh - rem * ST;
          y = p.yh - rem * CT;
          dx = ST;
          dy = CT;
          op = 0.55;
        } else {
          const d = (p.t - p.hit) * v;
          x = p.xh + d * p.out[0];
          y = p.yh + d * p.out[1];
          dx = p.out[0];
          dy = p.out[1];
          op = Math.max(0, 1 - d / 230);
          if (op <= 0) {
            p.on = false;
            p.el.setAttribute('visibility', 'hidden');
            continue;
          }
        }
        LM.attr(p.el, { x1: (x - 12 * dx).toFixed(1), y1: (y - 12 * dy).toFixed(1), x2: x.toFixed(1), y2: y.toFixed(1), opacity: op.toFixed(2), visibility: null });
      }
    }
    /* pre-fill the picture so the still frame already shows scattered photons */
    for (let i = 0; i < 30; i++) {
      spawn(ph[i]);
      ph[i].t = (i / 30) * 1.8;
    }
    return { update: update };
  });
})();
