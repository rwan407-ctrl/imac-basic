/* ch7_leaf.js — Monte Carlo photons in a leaf cross-section.
   Calibrated so that reflectance / transmittance / absorptance match typical broadleaf values. */
(function () {
  'use strict';
  const { s, text, TAU, clamp } = LM;

  const TOP = 58, E1 = 88, PAL = 208, SPO = 328, BOT = 356, XL = 20, XR = 470;
  const MUS = { E: 0.006, P: 0.018, S: 0.032 }, CP = 1, CS = 0.35, SURF = 0.045, SIN_C = 1 / 1.5, SIG = 0.9, DS = 1.5;
  const BANDS = {
    450: { chl: 0.017, water: 0.0001, ref: [5, 1], e: '2.76 eV', note: ['叶绿素 Soret 带与类胡萝卜素：', '电子跃迁，几乎全部吸收'] },
    550: { chl: 0.0055, water: 0.0001, ref: [12, 9], e: '2.25 eV', note: ['落在两个叶绿素吸收带之间，', '吸收较弱：所以叶子是绿色的'] },
    670: { chl: 0.014, water: 0.0001, ref: [5, 2], e: '1.85 eV', note: ['叶绿素 Qy 带（S₀→S₁）：', '光合作用的主力，几乎全部吸收'] },
    850: { chl: 0, water: 0.0001, ref: [48, 46], e: '1.46 eV', note: ['低于叶绿素最低激发能：不吸收，', '只在细胞–空气界面上反复散射'] },
    1450: { chl: 0, water: 0.0026, ref: [17, 10], e: '0.86 eV', note: ['O–H 伸缩振动的倍频：', '叶片中的水强烈吸收'] },
    1650: { chl: 0, water: 0.0006, ref: [34, 32], e: '0.75 eV', note: ['两个水吸收带之间的窗口：', '散射为主，亮度随含水量下降'] },
  };

  LM.scene('fig-leaf', function (fig, sc) {
    const svg = document.getElementById('leaf-svg');
    const bars = document.getElementById('leaf-bars');
    let band = 850, par = BANDS[850], tally = { R: 0, T: 0, A: 0, n: 0 };
    const rng = LM.rng(3);

    /* ---- leaf anatomy ---- */
    s('rect', { x: XL, y: TOP, width: XR - XL, height: BOT - TOP, class: 'f-veg', opacity: 0.35 }, svg);
    for (let x = XL; x < XR - 1; x += 45) s('rect', { x: x + 1, y: TOP + 2, width: 43, height: E1 - TOP - 4, rx: 7, class: 'f-med s-veg', 'stroke-width': 1 }, svg);
    for (let x = XL + 2; x < XR - 20; x += 30) {
      s('rect', { x: x, y: E1 + 3, width: 26, height: PAL - E1 - 6, rx: 11, class: 'f-veg s-veg', 'stroke-width': 1 }, svg);
      for (let j = 0; j < 6; j++) {
        s('ellipse', { cx: x + 5, cy: E1 + 14 + j * 19, rx: 2.4, ry: 4.2, class: 'f-m', opacity: 0.8 }, svg);
        s('ellipse', { cx: x + 21, cy: E1 + 22 + j * 19, rx: 2.4, ry: 4.2, class: 'f-m', opacity: 0.8 }, svg);
      }
    }
    for (let row = 0; row < 4; row++) {
      for (let x = XL + 18 + (row % 2) * 22; x < XR - 10; x += 46) {
        const r = 12 + rng() * 6;
        const cx = x + rng() * 8, cy = PAL + 16 + row * 28 + rng() * 6;
        s('circle', { cx: cx, cy: cy, r: r, class: 'f-veg s-veg', 'stroke-width': 1 }, svg);
        if (rng() < 0.6) s('ellipse', { cx: cx - r * 0.5, cy: cy, rx: 2.2, ry: 3.6, class: 'f-m', opacity: 0.7 }, svg);
      }
    }
    for (let x = XL; x < XR - 1; x += 45) {
      if (Math.abs(x + 22 - 245) < 20) continue;
      s('rect', { x: x + 1, y: SPO + 2, width: 43, height: BOT - SPO - 4, rx: 7, class: 'f-med s-veg', 'stroke-width': 1 }, svg);
    }
    s('ellipse', { cx: 236, cy: (SPO + BOT) / 2, rx: 8, ry: 11, class: 'f-veg s-veg', 'stroke-width': 1 }, svg);
    s('ellipse', { cx: 256, cy: (SPO + BOT) / 2, rx: 8, ry: 11, class: 'f-veg s-veg', 'stroke-width': 1 }, svg);
    s('line', { x1: XL, x2: XR, y1: TOP, y2: TOP, class: 's-veg', 'stroke-width': 2 }, svg);
    s('line', { x1: XL, x2: XR, y1: BOT, y2: BOT, class: 's-veg', 'stroke-width': 2 }, svg);
    const lab = [
      [(TOP + E1) / 2, ['上表皮 · 角质层']],
      [(E1 + PAL) / 2, ['栅栏组织', '叶绿体密集']],
      [(PAL + SPO) / 2, ['海绵组织', '细胞之间是空气']],
      [(SPO + BOT) / 2, ['下表皮 · 气孔']],
    ];
    for (const [y, ls] of lab) {
      s('line', { x1: XR + 2, x2: XR + 14, y1: y, y2: y, class: 's-mut', 'stroke-width': 1 }, svg);
      ls.forEach((l, i) => text(svg, XR + 18, y + 4 + (i - (ls.length - 1) / 2) * 17, l, i ? 't-s' : 't'));
    }
    text(svg, XL, 24, '阳光 ↓', 't-b');
    text(svg, XR - 4, 24, '↑ 从上表面逃出 = 反射', 't-s end');
    text(svg, XR - 4, 392, '↓ 从下表面穿出 = 透射', 't-s end');
    text(svg, XL, 412, '叶片厚约 0.2 mm；光子轨迹按真实比例示意', 't-s');

    /* ---- photons ---- */
    const NPH = 16, TRAIL = 46;
    const gP = s('g', null, svg);
    const phot = [];
    for (let i = 0; i < NPH; i++) {
      phot.push({
        on: false,
        trail: s('polyline', { class: 'ln', 'stroke-width': 1.6, opacity: 0.7, visibility: 'hidden' }, gP),
        dot: s('circle', { r: 3.6, visibility: 'hidden' }, gP),
        burst: s('circle', { r: 4, fill: 'none', 'stroke-width': 1.5, visibility: 'hidden' }, gP),
      });
    }
    const rr = LM.rng(42);
    function gauss() {
      let u = 0;
      while (u === 0) u = rr();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rr());
    }
    function stepPhoton(p) {
      /* one Monte-Carlo step of length DS; returns null or the outcome */
      p.x += p.dx * DS;
      p.y += p.dy * DS;
      if (p.x < XL) p.x += XR - XL;
      if (p.x > XR) p.x -= XR - XL;
      if (p.y < TOP) {
        if (Math.abs(p.dx) > SIN_C || rr() < 0.05) {
          p.y = 2 * TOP - p.y;
          p.dy = -p.dy;
        } else return 'R';
      } else if (p.y > BOT) {
        if (Math.abs(p.dx) > SIN_C || rr() < 0.05) {
          p.y = 2 * BOT - p.y;
          p.dy = -p.dy;
        } else return 'T';
      }
      let mus, mua;
      if (p.y < E1 || p.y > SPO) {
        mus = MUS.E;
        mua = par.water;
      } else if (p.y < PAL) {
        mus = MUS.P;
        mua = par.chl * CP + par.water;
      } else {
        mus = MUS.S;
        mua = par.chl * CS + par.water;
      }
      if (rr() < mua * DS) return 'A';
      if (rr() < mus * DS) {
        const da = gauss() * SIG, ca = Math.cos(da), sa = Math.sin(da);
        const nx = p.dx * ca - p.dy * sa, ny = p.dx * sa + p.dy * ca;
        p.dx = nx;
        p.dy = ny;
        p.kinks = (p.kinks || 0) + 1;
      }
      return null;
    }
    function launch(p) {
      const a = gauss() * 0.06;
      Object.assign(p, { on: true, x: 60 + rr() * 380, y: 8, dx: Math.sin(a), dy: Math.cos(a), pts: [], out: null, fade: 0, surf: false, entered: false });
      p.trail.style.stroke = LM.specColor(band);
      p.dot.style.fill = LM.specColor(band);
      p.burst.style.stroke = LM.specColor(band);
      LM.attr(p.trail, { visibility: null, opacity: 0.75 });
      LM.attr(p.dot, { visibility: null, opacity: 1 });
      p.burst.setAttribute('visibility', 'hidden');
    }
    function record(outcome) {
      tally[outcome]++;
      tally.n++;
    }
    function advance(p, dist) {
      let moved = 0;
      while (moved < dist && !p.out) {
        if (!p.entered) {
          p.y += p.dy * DS;
          p.x += p.dx * DS;
          moved += DS;
          if (p.y >= TOP) {
            p.entered = true;
            if (rr() < SURF) {
              p.out = 'R';
              p.surf = true;
              p.dy = -p.dy;
            }
          }
        } else {
          const r = stepPhoton(p);
          moved += DS;
          if (r) p.out = r;
        }
        const last = p.pts[p.pts.length - 1];
        if (!last || Math.hypot(last[0] - p.x, last[1] - p.y) > 5 || Math.abs(last[0] - p.x) > 200) {
          if (last && Math.abs(last[0] - p.x) > 200) p.pts = [];
          p.pts.push([p.x, p.y]);
          if (p.pts.length > TRAIL) p.pts.shift();
        }
      }
      if (p.out) {
        record(p.out);
        p.fade = 1;
        if (p.out === 'A') LM.attr(p.burst, { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 3, visibility: null, opacity: 1 });
      }
    }
    function fastSim(nPh) {
      const p = {};
      for (let i = 0; i < nPh; i++) {
        const a = gauss() * 0.06;
        Object.assign(p, { x: 60 + rr() * 380, y: TOP + 0.01, dx: Math.sin(a), dy: Math.cos(a) });
        if (rr() < SURF) {
          record('R');
          continue;
        }
        let out = null, guard = 0;
        while (!out && guard++ < 400000) out = stepPhoton(p);
        record(out || 'A');
      }
    }

    /* ---- tally panel ---- */
    const bandT = text(bars, 20, 30, '', 't-h');
    const eT = text(bars, 20, 52, '', 't-mono');
    const note1 = text(bars, 20, 82, '', 't');
    const note2 = text(bars, 20, 102, '', 't');
    const rows = [['R', '反射', 'var(--s1)'], ['T', '透射', 'var(--s2)'], ['A', '吸收', 'var(--s3)']];
    const BX = 66, BW = 250;
    const barEls = rows.map(([k, name, col], i) => {
      const y = 150 + i * 70;
      text(bars, 20, y + 15, name, 't-b');
      s('rect', { x: BX, y: y, width: BW, height: 20, rx: 4, class: 'f-bg' }, bars);
      const b = s('rect', { x: BX, y: y, width: 0, height: 20, rx: 4 }, bars);
      b.style.fill = col;
      const v = text(bars, BX, y + 40, '', 't-mono');
      const ref = s('line', { y1: y - 5, y2: y + 25, class: 's-ink', 'stroke-width': 2 }, bars);
      const refT = text(bars, 0, y - 9, '', 't-s mid');
      return { k: k, b: b, v: v, ref: ref, refT: refT };
    });
    const nT = text(bars, 20, 382, '', 't-mono');
    text(bars, 20, 404, '竖线：典型阔叶的实测量级', 't-s');

    function refresh() {
      const n = Math.max(1, tally.n);
      barEls.forEach((e) => {
        const f = tally[e.k] / n;
        e.b.setAttribute('width', (BW * f).toFixed(1));
        LM.setText(e.v, (tally.n ? LM.f(f * 100, 1) : '—') + '%');
        const refv = e.k === 'R' ? par.ref[0] : e.k === 'T' ? par.ref[1] : 100 - par.ref[0] - par.ref[1];
        const x = BX + (BW * refv) / 100;
        LM.attr(e.ref, { x1: x, x2: x });
        LM.attr(e.refT, { x: clamp(x, BX + 14, BX + BW - 14) });
        LM.setText(e.refT, '≈' + refv + '%');
      });
      LM.setText(nT, '已模拟 ' + tally.n + ' 个光子');
    }
    function setBand(b) {
      band = +b;
      par = BANDS[band];
      tally = { R: 0, T: 0, A: 0, n: 0 };
      const names = { 450: '蓝光 450 nm', 550: '绿光 550 nm', 670: '红光 670 nm', 850: '近红外 850 nm', 1450: '短波红外 1450 nm', 1650: '短波红外 1650 nm' };
      LM.setText(bandT, names[band]);
      LM.setText(eT, '光子能量 ' + par.e);
      LM.setText(note1, par.note[0]);
      LM.setText(note2, par.note[1]);
      phot.forEach((p) => {
        p.on = false;
        [p.trail, p.dot, p.burst].forEach((e) => e.setAttribute('visibility', 'hidden'));
      });
      fastSim(800);
      refresh();
      warm();
      sc.render();
    }
    LM.seg('leaf-band', setBand);
    LM.onTheme(() => {
      phot.forEach((p) => {
        p.trail.style.stroke = LM.specColor(band);
        p.dot.style.fill = LM.specColor(band);
        p.burst.style.stroke = LM.specColor(band);
      });
    });
    document.getElementById('leaf-fast').addEventListener('click', () => {
      fastSim(3000);
      refresh();
    });

    let acc = 0;
    function warm() {
      /* put a few photons mid-flight so a paused frame already tells the story */
      for (let i = 0; i < 9; i++) {
        launch(phot[i]);
        advance(phot[i], 60 + i * 55);
        if (phot[i].out) {
          phot[i].on = false;
          [phot[i].trail, phot[i].dot, phot[i].burst].forEach((e) => e.setAttribute('visibility', 'hidden'));
        }
      }
      draw();
    }
    function draw() {
      for (const p of phot) {
        if (!p.on) continue;
        if (p.pts.length > 1) p.trail.setAttribute('points', LM.pts(p.pts.concat([[p.x, p.y]])));
        LM.attr(p.dot, { cx: p.x.toFixed(1), cy: p.y.toFixed(1) });
      }
    }
    function update(t, dt) {
      if (dt > 0) {
        acc += dt;
        if (acc > 0.32) {
          acc = 0;
          const p = phot.find((q) => !q.on);
          if (p) launch(p);
        }
        for (const p of phot) {
          if (!p.on) continue;
          if (!p.out) advance(p, 230 * dt);
          else {
            if (p.out === 'R' || p.out === 'T') {
              for (let i = 0; i < 4; i++) {
                p.x += p.dx * 2;
                p.y += p.dy * 2;
              }
              p.pts.push([p.x, p.y]);
              if (p.pts.length > TRAIL) p.pts.shift();
            }
            p.fade -= dt * 1.4;
            if (p.out === 'A') LM.attr(p.burst, { r: (3 + (1 - p.fade) * 14).toFixed(1), opacity: Math.max(0, p.fade).toFixed(2) });
            LM.attr(p.trail, { opacity: Math.max(0, 0.75 * p.fade).toFixed(2) });
            LM.attr(p.dot, { opacity: Math.max(0, p.fade).toFixed(2) });
            if (p.fade <= 0) {
              p.on = false;
              [p.trail, p.dot, p.burst].forEach((e) => e.setAttribute('visibility', 'hidden'));
            }
          }
        }
        refresh();
      }
      draw();
    }
    return { update: update };
  });
})();
