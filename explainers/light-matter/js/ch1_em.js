/* ch1_em.js — the electromagnetic wave and the spectrum strip */
(function () {
  'use strict';
  const { s, text, TAU } = LM;

  LM.scene('fig-em', function () {
    const svg = document.getElementById('em-svg');
    const spec = document.getElementById('em-spec');

    /* ---------------- 3-D wave ---------------- */
    const O = [112, 178], A = 86, LZ = 780, N = 66;
    const D = [-0.55, 0.42]; // screen offset per unit of the depth (B) axis
    const P = (z, b, e) => [O[0] + z + b * D[0], O[1] - e + b * D[1]];
    s('polygon', { points: LM.pts([P(0, 0, A), P(LZ, 0, A), P(LZ, 0, -A), P(0, 0, -A)]), class: 'f-e', opacity: 0.045 }, svg);
    s('polygon', { points: LM.pts([P(0, A, 0), P(LZ, A, 0), P(LZ, -A, 0), P(0, -A, 0)]), class: 'f-b', opacity: 0.06 }, svg);
    const fenceE = [], fenceB = [], dots = [];
    const gB = s('g', null, svg);
    const gE = s('g', null, svg);
    for (let i = 0; i < N; i++) {
      fenceB.push(s('line', { class: 's-b', 'stroke-width': 1.3, opacity: 0.45 }, gB));
      fenceE.push(s('line', { class: 's-e', 'stroke-width': 1.3, opacity: 0.45 }, gE));
    }
    const curveB = s('polyline', { class: 'ln s-b', 'stroke-width': 2.6 }, gB);
    const curveE = s('polyline', { class: 'ln s-e', 'stroke-width': 2.6 }, gE);
    LM.arrowAt(svg, O[0] - 4, O[1], O[0] + LZ + 46, O[1], 'var(--ink-2)', 1.6, 10);
    LM.arrowAt(svg, O[0], O[1] + A + 8, O[0], O[1] - A - 30, 'var(--ink-2)', 1.4, 9);
    const bt = P(0, A + 34, 0);
    LM.arrowAt(svg, ...P(0, -A - 10, 0), bt[0], bt[1], 'var(--ink-2)', 1.4, 9);
    const gS = s('g', null, svg);
    for (let i = 0; i < N; i++) dots.push(s('circle', { cy: O[1], class: 'f-p' }, gS));
    text(svg, O[0] + LZ + 30, O[1] + 26, 'z', 't-m');
    text(svg, O[0] + LZ - 10, O[1] + 46, '传播方向', 't-s end');
    text(svg, O[0] + 12, O[1] - A - 22, '电场 E', 't-b t-e');
    text(svg, bt[0] - 6, bt[1] + 18, '磁场 B', 't-b t-bf');
    text(svg, 600, 316, '金色圆点：能流密度 S = E×B/μ₀ 始终沿 +z，以光速向前输运能量', 't-s mid');
    const lamTxt = text(svg, O[0] + LZ - 4, 36, '', 't-mono end');

    const WL = 252, PER = 2.4;
    function drawWave(t) {
      const ph = (TAU * t) / PER;
      const ptsE = [], ptsB = [];
      for (let z = 0; z <= LZ; z += 4) {
        const c = Math.cos((TAU * z) / WL - ph);
        ptsE.push(P(z, 0, A * c));
        ptsB.push(P(z, A * c, 0));
      }
      curveE.setAttribute('points', LM.pts(ptsE));
      curveB.setAttribute('points', LM.pts(ptsB));
      for (let i = 0; i < N; i++) {
        const z = (i / (N - 1)) * LZ;
        const c = Math.cos((TAU * z) / WL - ph);
        const a = P(z, 0, 0), e = P(z, 0, A * c), b = P(z, A * c, 0);
        LM.attr(fenceE[i], { x1: a[0], y1: a[1], x2: e[0].toFixed(1), y2: e[1].toFixed(1) });
        LM.attr(fenceB[i], { x1: a[0], y1: a[1], x2: b[0].toFixed(1), y2: b[1].toFixed(1) });
        LM.attr(dots[i], { cx: a[0].toFixed(1), r: (0.6 + 3.6 * c * c).toFixed(2) });
      }
    }

    /* ---------------- spectrum strip ---------------- */
    const X0 = 96, PX = 120;
    const xl = (m) => X0 + (Math.log10(m) + 7) * PX;
    const rowT = (y, str) => text(spec, 6, y, str, 't-s');
    rowT(18, '光子能量');
    rowT(48, '波段');
    rowT(82, '波长');
    rowT(122, '物质过程');
    rowT(190, '卫星传感器');
    [['10 eV', 10], ['1 eV', 1], ['0.1 eV', 0.1], ['10 meV', 0.01], ['1 meV', 1e-3], ['0.1 meV', 1e-4], ['10 µeV', 1e-5]].forEach(([l, ev]) => {
      const x = xl(1.23984e-6 / ev);
      s('line', { x1: x, y1: 22, x2: x, y2: 28, class: 's-axis', 'stroke-width': 1 }, spec);
      text(spec, x, 17, l, 't-mono mid', { 'font-size': 11.5 });
    });
    const defs = s('defs', null, spec);
    const vis = s('linearGradient', { id: 'em-vis', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    for (let nm = 400; nm <= 700; nm += 25) {
      const [r, g, b] = LM.waveRGB(nm);
      s('stop', { offset: (Math.log10(nm / 400) / Math.log10(700 / 400)).toFixed(3), 'stop-color': 'rgb(' + [r, g, b].map((c) => Math.round(c * 255)).join(',') + ')' }, vis);
    }
    const bands = [
      [1e-7, 4e-7, 'var(--uv)', 0.3, '紫外'],
      [4e-7, 7e-7, 'url(#em-vis)', 1, ''],
      [7e-7, 1.3e-6, 'var(--nir)', 0.3, 'NIR'],
      [1.3e-6, 3e-6, 'var(--swir)', 0.3, 'SWIR'],
      [3e-6, 8e-6, 'var(--tir)', 0.2, 'MWIR'],
      [8e-6, 1.5e-5, 'var(--tir)', 0.38, 'TIR'],
      [1.5e-5, 1e-3, 'var(--muted)', 0.16, '远红外 · 亚毫米'],
      [1e-3, 1, 'var(--mw)', 0.3, ''],
    ];
    for (const [a, b, fill, op, lab] of bands) {
      const x1 = xl(a), x2 = xl(b);
      const r = s('rect', { x: x1 + 0.5, y: 32, width: x2 - x1 - 1, height: 28, opacity: op }, spec);
      if (fill.indexOf('url') === 0) r.setAttribute('fill', fill);
      else r.style.fill = fill;
      if (lab) text(spec, (x1 + x2) / 2, 50, lab, 't mid', { 'font-size': lab.length > 4 ? 12.5 : 11.5, 'font-weight': 500 });
    }
    text(spec, xl(1.6e-3) + 6, 50, '微波', 't', { 'font-size': 12.5, 'font-weight': 500 });
    [['Ka', 0.009], ['Ku', 0.02], ['X', 0.03], ['C', 0.055], ['S', 0.1], ['L', 0.22], ['P', 0.6]].forEach(([l, m]) => text(spec, xl(m), 50, l, 't-mono mid', { 'font-size': 11.5, 'font-weight': 500 }));
    ['100 nm', '1 µm', '10 µm', '100 µm', '1 mm', '1 cm', '10 cm', '1 m'].forEach((l, i) => {
      const x = X0 + i * PX;
      s('line', { x1: x, y1: 60, x2: x, y2: 66, class: 's-axis', 'stroke-width': 1 }, spec);
      text(spec, x, 80, l, 't-mono mid', { 'font-size': 11.5 });
    });
    const procs = [
      [1e-7, 1e-6, 96, '电子跃迁'],
      [8e-7, 2.5e-5, 114, '分子振动（倍频 → 基频）'],
      [2.5e-5, 0.3, 132, '分子转动 · 水分子取向极化'],
      [0.01, 1, 150, '自由电荷'],
    ];
    for (const [a, b, y, lab] of procs) {
      s('rect', { x: xl(a), y: y, width: xl(b) - xl(a), height: 14, rx: 7, class: 'f-m', opacity: 0.16 }, spec);
      text(spec, xl(a) + 8, y + 11, lab, 't-s', { fill: 'var(--ink-2)' });
    }
    const sens = [
      [4.4e-7, 2.19e-6, 172, 'Sentinel-2'],
      [1.06e-5, 1.25e-5, 172, 'Landsat TIRS'],
      [3.4e-3, 4.3e-2, 198, 'AMSR2'],
      [0.0555, 0.0555, 172, 'Sentinel-1'],
      [0.212, 0.212, 172, 'SMAP'],
    ];
    for (const [a, b, y, lab] of sens) {
      const x1 = xl(a), x2 = xl(b);
      if (x2 - x1 > 2) s('path', { d: 'M' + x1 + ' ' + (y + 5) + 'V' + y + 'H' + x2 + 'V' + (y + 5), class: 'ln s-ink2', 'stroke-width': 1.3 }, spec);
      else s('path', { d: 'M' + (x1 - 4) + ' ' + y + 'L' + x1 + ' ' + (y + 6) + 'L' + (x1 + 4) + ' ' + y + 'Z', class: 'f-ink2' }, spec);
      text(spec, (x1 + x2) / 2, y + 19, lab, 't-s mid', { fill: 'var(--ink-2)' });
    }
    const mk = s('g', null, spec);
    s('line', { x1: 0, y1: 26, x2: 0, y2: 214, class: 's-e', 'stroke-width': 2 }, mk);
    s('path', { d: 'M-6 20L6 20L0 28Z', class: 'f-e' }, mk);

    /* ---------------- readouts ---------------- */
    const sizes = [
      [4e-7, '与大型病毒相当'],
      [7e-7, '约为头发直径的 1/150'],
      [3e-6, '与细菌大小相当'],
      [2e-5, '与红细胞（约 8 µm）相当'],
      [2e-4, '与头发直径（约 75 µm）相当'],
      [3e-3, '与沙粒相当'],
      [3e-2, '与雨滴、米粒相当'],
      [0.3, '与手掌、直尺相当'],
      [Infinity, '与人的身高同一量级'],
    ];
    const proc = [
      [3e-7, '电子跃迁，能量足以打断化学键；臭氧强烈吸收', '臭氧与痕量气体监测（如 TROPOMI 紫外通道）'],
      [4e-7, '外层电子跃迁的吸收边缘', '气溶胶、臭氧柱总量'],
      [7e-7, '色素（叶绿素、类胡萝卜素）与铁离子的电子跃迁；多数透明物质只折射', '真彩色影像、水色、叶绿素浓度'],
      [1.3e-6, '低于多数电子跃迁：以折射与多次散射为主；O–H 等振动的高次倍频很弱', '植被（NDVI）、水陆边界'],
      [3e-6, '分子振动的倍频与合频：O–H、Al–OH、Mg–OH、CO₃', '叶片含水量、矿物识别、雪与云区分'],
      [8e-6, '分子振动基频；反射的阳光与热辐射同时存在', '火点探测（约 4 µm）'],
      [1.5e-5, '晶格振动（Si–O 剩余射线带）；地表热辐射的峰值', '地表温度、海表温度、岩性识别'],
      [1e-3, '分子转动与振动，大气（水汽）强烈吸收', '大气探测（远红外 / 亚毫米）'],
      [1, '分子转动、水分子取向极化、自由电荷', 'SAR 成像、土壤水分、海面风、降水'],
      [Infinity, '自由电子（电离层）', '电离层探测'],
    ];
    let lam = 5.5e-7;
    const out = document.getElementById('em-lam-o');
    function readouts() {
      const nu = 299792458 / lam, ev = 1.23984e-6 / lam, r = ev / 0.025852;
      LM.setText(out, LM.length(lam));
      LM.setText('em-nu', LM.unit(nu, 'Hz'));
      LM.setText('em-ev', LM.unit(ev, 'eV'));
      LM.setText('em-kt', (r >= 1 ? LM.sig(r, 3) : LM.sci(r, 1)) + (r > 10 ? '（量子效应显著）' : r < 0.1 ? '（接近经典极限）' : ''));
      LM.setText('em-size', sizes.find((x) => lam < x[0])[1]);
      const p = proc.find((x) => lam < x[0]);
      LM.setText('em-proc', p[1]);
      LM.setText('em-app', p[2]);
      LM.setText(lamTxt, 'λ = ' + LM.length(lam) + '（示意：图中波长不按比例）');
      mk.setAttribute('transform', 'translate(' + xl(lam).toFixed(1) + ' 0)');
    }
    const slider = LM.range('em-lam', (v) => {
      lam = Math.pow(10, -7 + (7 * v) / 1000);
      readouts();
    });
    LM.chips('em-pre', (b) => slider.set(((Math.log10(parseFloat(b.getAttribute('data-v'))) + 7) / 7) * 1000));

    return { update: drawWave };
  });
})();
