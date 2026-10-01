/* ch7_spectra.js — typical reflectance spectra, Sentinel-2 bands, indices, and a synthetic false-colour image */
(function () {
  'use strict';
  const { s, text, clamp } = LM;

  /* typical reflectance (%) — literature-magnitude approximations */
  const SPEC = (LM.SPEC = {
    veg: [[400, 4], [430, 4.2], [450, 4.5], [480, 5], [500, 6], [520, 9], [550, 12.5], [570, 11], [600, 7.5], [630, 5.5], [650, 4.6], [670, 3.8], [680, 4], [690, 5.5], [700, 9.5], [710, 16], [720, 24], [730, 32], [740, 39], [750, 44], [770, 47], [800, 48.5], [850, 49], [900, 49], [950, 47.5], [970, 46.5], [1000, 47], [1050, 47.5], [1100, 47], [1150, 44], [1200, 42.5], [1250, 44], [1300, 43], [1350, 38], [1400, 28], [1450, 20], [1500, 23], [1550, 29], [1600, 33], [1650, 35], [1700, 34], [1750, 32], [1800, 28.5], [1850, 22], [1900, 12], [1950, 7.5], [2000, 9], [2050, 12.5], [2100, 16], [2150, 19], [2200, 20.5], [2250, 19], [2300, 17], [2350, 15], [2400, 12.5], [2450, 10], [2500, 8.5]],
    soil: [[400, 9], [450, 12], [500, 15], [550, 18.5], [600, 22.5], [650, 25.5], [700, 27.5], [750, 29], [800, 30.5], [850, 31.5], [900, 32], [950, 32.5], [1000, 34], [1100, 36], [1200, 37.5], [1300, 38.5], [1400, 36.5], [1450, 35], [1500, 37.5], [1600, 40], [1700, 41.5], [1800, 41.5], [1850, 40], [1900, 36], [1950, 35.5], [2000, 37.5], [2100, 40], [2150, 39], [2200, 36], [2250, 37.5], [2300, 37], [2350, 36], [2400, 34.5], [2500, 32]],
    water: [[400, 6.5], [450, 6.8], [500, 5.8], [550, 4.6], [580, 3.6], [600, 2.8], [650, 1.9], [700, 1.3], [750, 0.8], [800, 0.5], [850, 0.4], [900, 0.3], [1000, 0.25], [1200, 0.2], [1500, 0.15], [2000, 0.1], [2500, 0.1]],
    snow: [[400, 96], [450, 97], [500, 97.5], [550, 97], [600, 96], [650, 95], [700, 93.5], [750, 91], [800, 88.5], [850, 85], [900, 80.5], [950, 74], [1000, 67], [1030, 64], [1050, 66], [1100, 63], [1150, 55], [1200, 50], [1250, 49], [1300, 45], [1350, 32], [1400, 16], [1450, 8], [1500, 6.5], [1550, 6.5], [1600, 8.5], [1650, 10], [1700, 11], [1750, 10], [1800, 8], [1850, 5.5], [1900, 2.5], [1950, 1.5], [2000, 1.5], [2050, 2.5], [2100, 4], [2150, 5], [2200, 5.5], [2250, 5], [2300, 4], [2350, 3], [2400, 2], [2500, 1.5]],
    urban: [[400, 10], [500, 13], [600, 16], [700, 18], [800, 20], [900, 21], [1000, 22], [1600, 26], [2200, 24], [2500, 22]],
  });
  const refl = (k, nm) => Math.max(0, LM.spline(SPEC[k], nm)) / 100;
  const S2 = [['B1', 443, 21], ['B2', 490, 66], ['B3', 560, 36], ['B4', 665, 31], ['B5', 705, 15], ['B6', 740, 15], ['B7', 783, 20], ['B8', 842, 106], ['B8A', 865, 21], ['B9', 945, 20], ['B10', 1375, 31], ['B11', 1610, 91], ['B12', 2190, 175]];
  const SERIES = [['water', '水体', 'var(--s1)'], ['soil', '土壤', 'var(--s2)'], ['veg', '植被', 'var(--s3)'], ['snow', '雪', 'var(--s4)']];

  /* ================= spectra chart ================= */
  LM.scene('fig-spectra', function () {
    const svg = document.getElementById('spec-svg');
    const X = LM.lin(400, 2500, 66, 936), Y = LM.lin(0, 100, 372, 52);
    for (const [a, b] of [[1340, 1460], [1790, 1960]]) {
      s('rect', { x: X(a), y: 52, width: X(b) - X(a), height: 320, class: 'f-mut', opacity: 0.14 }, svg);
    }
    S2.forEach(([n, c, w]) => s('rect', { x: X(c - w / 2), y: 52, width: Math.max(2, X(c + w / 2) - X(c - w / 2)), height: 320, class: 'f-med2' }, svg));
    const lab = [['B1', 443, 2], ['B2', 490, 1], ['B3', 560, 2], ['B4', 665, 1], ['B5–7', 742, 2], ['B8', 852, 1], ['B9', 945, 2], ['B10', 1375, 1], ['B11', 1610, 1], ['B12', 2190, 1]];
    lab.forEach(([n, c, row]) => text(svg, X(c), row === 1 ? 44 : 30, n, 't-mono mid', { 'font-size': 11 }));
    text(svg, 66, 16, 'Sentinel-2 波段（竖条）：', 't-s');
    for (let v = 0; v <= 100; v += 20) {
      s('line', { x1: 66, x2: 936, y1: Y(v), y2: Y(v), class: v === 0 ? 's-axis' : 's-grid', 'stroke-width': 1 }, svg);
      text(svg, 58, Y(v) + 4, v + '%', 't-mono end', { 'font-size': 11.5 });
    }
    for (let nm = 400; nm <= 2500; nm += 300) {
      s('line', { x1: X(nm), x2: X(nm), y1: 372, y2: 377, class: 's-axis', 'stroke-width': 1 }, svg);
      text(svg, X(nm), 392, LM.f(nm / 1000, 1) + ' µm', 't-mono mid', { 'font-size': 11.5 });
    }
    text(svg, 501, 414, '波长', 't-s mid');
    text(svg, X(1400), 66, '水汽', 't-s mid');
    text(svg, X(1875), 66, '水汽', 't-s mid');
    const ann = (tx, ty, str, targets, anchor) => {
      for (const [nm, k] of targets) s('line', { x1: X(nm), y1: Y(refl(k, nm) * 100) - 3, x2: tx, y2: ty + 4, class: 's-mut', 'stroke-width': 1 }, svg);
      text(svg, tx, ty, str, 't-s halo ' + (anchor || 'mid'));
    };
    ann(X(560), Y(42), '叶绿素吸收（蓝、红）', [[450, 'veg'], [670, 'veg']]);
    ann(X(540), Y(30), '绿峰', [[550, 'veg']]);
    ann(X(690), Y(64), '红边', [[722, 'veg']], 'end');
    ann(X(1010), Y(58), '叶肉多次散射：近红外平台', [[900, 'veg']]);
    ann(X(1620), Y(54), '叶片水分（O–H 振动）', [[1450, 'veg'], [1950, 'veg']]);
    ann(X(2210), Y(52), '黏土 Al–OH', [[2200, 'soil']]);
    ann(X(1235), Y(24), '冰的吸收', [[1500, 'snow']]);
    const gC = s('g', null, svg);
    const curveAt = {};
    SERIES.forEach(([k, name, col]) => {
      const p = [];
      for (let nm = 400; nm <= 2500; nm += 5) p.push([X(nm), Y(refl(k, nm) * 100)]);
      const pl = s('polyline', { points: LM.pts(p), class: 'ln', 'stroke-width': 2.2 }, gC);
      pl.style.stroke = col;
      curveAt[k] = pl;
    });
    const dl = [['veg', 935, 53, '植被'], ['soil', 2330, 41, '土壤'], ['water', 1160, 4.6, '水体'], ['snow', 1090, 70, '雪']];
    dl.forEach(([k, nm, v, name]) => text(svg, X(nm), Y(v), name, 't-b halo'));
    const lg = s('g', { transform: 'translate(640 18)' }, svg);
    SERIES.forEach(([k, name, col], i) => {
      const ln = s('line', { x1: i * 74, x2: i * 74 + 16, y1: 0, y2: 0, 'stroke-width': 2.5 }, lg);
      ln.style.stroke = col;
      text(lg, i * 74 + 22, 4, name, 't-s', { fill: 'var(--ink-2)' });
    });
    const cross = s('line', { y1: 52, y2: 372, class: 's-ink', 'stroke-width': 1, visibility: 'hidden' }, svg);
    const dots = SERIES.map(([k, n, col]) => {
      const d = s('circle', { r: 4.5, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
      d.style.fill = col;
      return d;
    });
    const tip = LM.tip(svg.parentNode);
    LM.drag(svg, (x, y, kind) => {
      if (kind === 'leave' || x === null) {
        cross.setAttribute('visibility', 'hidden');
        dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
        tip.hide();
        return;
      }
      const nm = clamp(Math.round(X.inv(x) / 5) * 5, 400, 2500);
      LM.attr(cross, { x1: X(nm), x2: X(nm), visibility: null });
      SERIES.forEach(([k], i) => LM.attr(dots[i], { cx: X(nm), cy: Y(refl(k, nm) * 100), visibility: null }));
      const b = S2.find(([n, c, w]) => Math.abs(nm - c) <= w / 2);
      const pp = LM.toPanel(svg, X(nm), Y(60));
      tip.show(pp[0], pp[1], (nm >= 1000 ? LM.f(nm / 1000, 3) + ' µm' : nm + ' nm') + (b ? ' · ' + b[0] : ''), SERIES.map(([k, name, col]) => ({ color: col, value: LM.f(refl(k, nm) * 100, 1) + '%', label: name })));
    });
    /* data table */
    const tb = document.querySelector('#spec-table tbody');
    const nd = (a, b) => (a - b) / (a + b);
    SERIES.forEach(([k, name, col]) => {
      const g = refl(k, 560), r = refl(k, 665), n = refl(k, 842), w = refl(k, 1610);
      const tr = LM.h('tr', null, tb);
      const th = LM.h('td', null, tr);
      const sw = LM.h('span', { class: 'key-sw' }, th);
      sw.style.background = col;
      th.appendChild(document.createTextNode(name));
      [g, r, n, w].forEach((v) => LM.h('td', null, tr, LM.f(v * 100, 1) + '%'));
      [nd(n, r), nd(g, n), nd(g, w)].forEach((v) => LM.h('td', null, tr, LM.f(v, 2)));
    });
    return { autoplay: false };
  });

  /* ================= synthetic Sentinel-2 scene ================= */
  LM.scene('fig-composite', function () {
    const svg = document.getElementById('comp-map');
    const key = document.getElementById('comp-key');
    const NX = 60, NY = 38, CS = 10;
    const BANDS = { B2: 490, B3: 560, B4: 665, B8: 842, B11: 1610, B12: 2190 };
    const KEYS = ['veg', 'soil', 'water', 'snow', 'urban'];
    const R = {};
    KEYS.forEach((k) => {
      R[k] = {};
      for (const b in BANDS) R[k][b] = refl(k, BANDS[b]);
    });
    const rng = LM.rng(2024);
    const cells = [];
    const parcels = {};
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const f = { veg: 0, soil: 0, water: 0, snow: 0, urban: 0 };
        let cls = '草地 / 林地';
        const yr = 5 + i * 0.42 + 3.2 * Math.sin(i / 5);
        const lake = Math.pow((i - 12) / 7.5, 2) + Math.pow((j - 30) / 4.6, 2) < 1;
        const elev = (i / (NX - 1)) * 0.62 + (1 - j / (NY - 1)) * 0.55 + 0.08 * Math.sin(i * 0.7) * Math.cos(j * 0.9) + 0.05 * rng();
        const town = Math.hypot(i - 36, (j - 23) * 1.2) < 5.2;
        if (Math.abs(j - yr) < 1.15 || lake) {
          f.water = 0.92 + 0.08 * rng();
          f.veg = 1 - f.water;
          cls = '水体';
        } else if (elev > 0.93) {
          f.snow = 0.75 + 0.25 * rng();
          f.soil = 1 - f.snow;
          cls = '雪';
        } else if (town) {
          f.urban = 0.65 + 0.2 * rng();
          f.veg = 1 - f.urban;
          cls = '城镇';
        } else if (i >= 2 && i <= 27 && j >= 9 && j <= 25) {
          const pk = Math.floor(i / 6) + ',' + Math.floor(j / 4);
          if (!(pk in parcels)) parcels[pk] = rng();
          const p = parcels[pk];
          if (p < 0.35) {
            f.soil = 0.85 + 0.1 * rng();
            f.veg = 1 - f.soil;
            cls = '裸土（翻耕地）';
          } else {
            f.veg = 0.55 + 0.4 * p + 0.05 * rng();
            f.soil = 1 - f.veg;
            cls = '农田';
          }
        } else if (elev > 0.66) {
          f.veg = 0.85 + 0.15 * rng();
          f.soil = 1 - f.veg;
          cls = '森林';
        } else {
          f.veg = 0.6 + 0.3 * rng();
          f.soil = 1 - f.veg;
        }
        const val = {};
        for (const b in BANDS) {
          let v = 0;
          KEYS.forEach((k) => (v += f[k] * R[k][b]));
          val[b] = Math.max(0, v * (1 + 0.04 * (rng() - 0.5)));
        }
        cells.push({ i: i, j: j, cls: cls, val: val, el: s('rect', { x: i * CS, y: j * CS, width: CS + 0.4, height: CS + 0.4 }, svg) });
      }
    }
    s('rect', { x: 0.5, y: 0.5, width: NX * CS - 1, height: NY * CS - 1, fill: 'none', class: 's-rule', 'stroke-width': 1 }, svg);
    const hl = s('rect', { width: CS, height: CS, fill: 'none', class: 's-ink', 'stroke-width': 1.5, visibility: 'hidden' }, svg);
    const enc = (v, gain) => Math.pow(clamp(v * gain, 0, 1), 1 / 2.2);
    const mix = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
    function ndviColor(v) {
      if (v < 0) return mix([0.91, 0.89, 0.85], [0.23, 0.43, 0.65], clamp(-v / 0.6, 0, 1));
      return mix([0.94, 0.91, 0.85], [0.1, 0.42, 0.18], clamp(v / 0.9, 0, 1));
    }
    const MODES = {
      true: { ch: ['B4', 'B3', 'B2'], gain: 3.2, name: ['红 665 nm', '绿 560 nm', '蓝 490 nm'], say: ['与肉眼所见接近。植被偏暗绿：', '叶绿素吸收了大部分红光和蓝光；', '水体深暗，雪和云洁白。'] },
      false: { ch: ['B8', 'B4', 'B3'], gain: 2.2, name: ['近红外 842 nm', '红 665 nm', '绿 560 nm'], say: ['近红外送进红色通道：叶肉的', '多次散射让植被呈鲜红色，长势越好', '越红；水几乎是黑的，城镇呈青灰色。'] },
      swir: { ch: ['B12', 'B8', 'B4'], gain: 2.2, name: ['短波红外 2190 nm', '近红外 842 nm', '红 665 nm'], say: ['雪在 2.2 µm 被冰吸收而变暗，', '因此显青色；裸土偏粉，植被绿色；', '这一组合常用于区分雪、云和火烧迹地。'] },
      ndvi: { ch: null, name: null, say: ['NDVI = (B8 − B4)/(B8 + B4)。', '植被 0.6–0.9；裸土 0.1–0.2；', '水体为负值。'] },
    };
    let mode = 'true';
    const ndvi = (c) => (c.val.B8 - c.val.B4) / (c.val.B8 + c.val.B4);
    function colorOf(c) {
      const m = MODES[mode];
      if (!m.ch) return ndviColor(ndvi(c));
      return m.ch.map((b) => enc(c.val[b], m.gain));
    }
    /* key panel */
    const kt = text(key, 20, 30, '', 't-h');
    const chRows = [0, 1, 2].map((k) => {
      const y = 62 + k * 34;
      const g = s('g', null, key);
      const sw = s('rect', { x: 20, y: y - 14, width: 18, height: 18, rx: 3 }, g);
      sw.style.fill = ['rgb(220,50,40)', 'rgb(40,160,70)', 'rgb(40,90,220)'][k];
      text(g, 46, y, ['R ←', 'G ←', 'B ←'][k], 't-mono');
      return { g: g, t: text(g, 84, y, '', 't') };
    });
    const ramp = s('g', { visibility: 'hidden' }, key);
    for (let k = 0; k < 60; k++) {
      const v = -0.6 + (1.5 * k) / 60;
      const r = s('rect', { x: 20 + k * 5, y: 50, width: 5.4, height: 16 }, ramp);
      r.style.fill = LM.rgbCss(ndviColor(v));
    }
    [[-0.5, '−0.5'], [0, '0'], [0.5, '0.5'], [0.9, '0.9']].forEach(([v, l]) => {
      const x = 20 + ((v + 0.6) / 1.5) * 300;
      s('line', { x1: x, x2: x, y1: 66, y2: 72, class: 's-ink2', 'stroke-width': 1 }, ramp);
      text(ramp, x, 86, l, 't-mono mid', { 'font-size': 11 });
    });
    const sayT = [0, 1, 2].map((k) => text(key, 20, 186 + k * 20, '', 't'));
    text(key, 20, 268, '各类地物在当前组合中的颜色：', 't-s');
    const covers = [['veg', '植被'], ['soil', '裸土'], ['water', '水体'], ['snow', '雪'], ['urban', '城镇']];
    const covSw = covers.map(([k, name], i) => {
      const x = 20 + (i % 3) * 104, y = 290 + Math.floor(i / 3) * 34;
      const r = s('rect', { x: x, y: y - 14, width: 22, height: 18, rx: 3, class: 's-rule', 'stroke-width': 1 }, key);
      text(key, x + 30, y, name, 't');
      return [k, r];
    });
    function render() {
      for (const c of cells) c.el.style.fill = LM.rgbCss(colorOf(c));
      const m = MODES[mode];
      LM.setText(kt, { true: '真彩色', false: '标准假彩色', swir: '短波红外合成', ndvi: '归一化植被指数' }[mode]);
      chRows.forEach((r, k) => {
        if (m.ch) LM.setText(r.t, m.ch[k] + '  ' + m.name[k]);
        r.g.setAttribute('visibility', m.ch ? 'visible' : 'hidden');
      });
      ramp.setAttribute('visibility', m.ch ? 'hidden' : 'visible');
      sayT.forEach((t, k) => LM.setText(t, m.say[k] || ''));
      covSw.forEach(([k, r]) => {
        const c = { val: R[k] };
        r.style.fill = LM.rgbCss(colorOf(c));
      });
    }
    LM.seg('comp-mode', (v) => {
      mode = v;
      render();
    });
    const tip = LM.tip(svg.parentNode);
    LM.drag(svg, (x, y, kind) => {
      if (kind === 'leave' || x === null) {
        hl.setAttribute('visibility', 'hidden');
        tip.hide();
        return;
      }
      const i = clamp(Math.floor(x / CS), 0, NX - 1), j = clamp(Math.floor(y / CS), 0, NY - 1);
      const c = cells[j * NX + i];
      LM.attr(hl, { x: i * CS, y: j * CS, visibility: null });
      const pp = LM.toPanel(svg, i * CS + CS, j * CS);
      tip.show(pp[0], pp[1], c.cls + ' · NDVI ' + LM.f(ndvi(c), 2), [
        { value: LM.f(c.val.B2 * 100, 1) + '%', label: 'B2 蓝' },
        { value: LM.f(c.val.B3 * 100, 1) + '%', label: 'B3 绿' },
        { value: LM.f(c.val.B4 * 100, 1) + '%', label: 'B4 红' },
        { value: LM.f(c.val.B8 * 100, 1) + '%', label: 'B8 近红外' },
        { value: LM.f(c.val.B11 * 100, 1) + '%', label: 'B11 短波红外' },
        { value: LM.f(c.val.B12 * 100, 1) + '%', label: 'B12 短波红外' },
      ]);
    });
    return { autoplay: false };
  });
})();
