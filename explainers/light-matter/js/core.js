/* core.js — shared helpers: SVG builders, scene loop, colour science, complex maths, physics formulas */
(function () {
  'use strict';
  const LM = (window.LM = window.LM || {});
  const NS = 'http://www.w3.org/2000/svg';
  LM.TAU = Math.PI * 2;
  LM.DEG = Math.PI / 180;

  /* ---------------- DOM / SVG helpers ---------------- */
  /* CSS custom properties are applied through style so they resolve reliably on SVG paint properties */
  const STYLE_PAINT = { fill: 1, stroke: 1, 'stop-color': 1 };
  LM.attr = function (el, attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) el.removeAttribute(k);
      else if (STYLE_PAINT[k] && typeof v === 'string' && v.indexOf('var(') >= 0) el.style.setProperty(k, v);
      else el.setAttribute(k, v);
    }
    return el;
  };
  LM.s = function (tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    if (attrs) LM.attr(el, attrs);
    if (parent) parent.appendChild(el);
    return el;
  };
  LM.text = function (parent, x, y, str, cls, attrs) {
    const t = LM.s('text', Object.assign({ x: x, y: y, class: cls || 't' }, attrs || {}), parent);
    t.textContent = str;
    return t;
  };
  LM.h = function (tag, attrs, parent, text) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text !== undefined) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };
  LM.$ = (id) => document.getElementById(id);
  LM.setText = function (id, str) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el && el.textContent !== str) el.textContent = str;
  };

  /* ---------------- maths ---------------- */
  LM.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  LM.lerp = (a, b, t) => a + (b - a) * t;
  LM.smooth = (t) => {
    t = LM.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  LM.ease = (t) => {
    t = LM.clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  LM.mod = (a, n) => ((a % n) + n) % n;
  LM.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  LM.gauss = function (rng) {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(LM.TAU * rng());
  };
  LM.pts = function (arr) {
    let s = '';
    for (let i = 0; i < arr.length; i++) s += (i ? ' ' : '') + arr[i][0].toFixed(1) + ',' + arr[i][1].toFixed(1);
    return s;
  };
  LM.pathOf = function (arr, close) {
    if (!arr.length) return '';
    let s = 'M' + arr[0][0].toFixed(1) + ' ' + arr[0][1].toFixed(1);
    for (let i = 1; i < arr.length; i++) s += 'L' + arr[i][0].toFixed(1) + ' ' + arr[i][1].toFixed(1);
    return close ? s + 'Z' : s;
  };
  /* Catmull–Rom spline through points -> smooth path data */
  LM.smoothPath = function (p) {
    if (p.length < 3) return LM.pathOf(p);
    let d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  };
  /* monotone piecewise-linear interpolation in a sorted table [[x,y],...] */
  LM.interp = function (table, x) {
    if (x <= table[0][0]) return table[0][1];
    const n = table.length;
    if (x >= table[n - 1][0]) return table[n - 1][1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (table[m][0] <= x) lo = m;
      else hi = m;
    }
    const a = table[lo], b = table[hi];
    return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  };
  /* smooth (cubic Hermite, Catmull–Rom tangents) interpolation in a sorted table */
  LM.spline = function (table, x) {
    const n = table.length;
    if (x <= table[0][0]) return table[0][1];
    if (x >= table[n - 1][0]) return table[n - 1][1];
    let i = 0;
    while (i < n - 2 && table[i + 1][0] < x) i++;
    const x0 = table[i][0], x1 = table[i + 1][0], y0 = table[i][1], y1 = table[i + 1][1];
    const h = x1 - x0, t = (x - x0) / h;
    const m0 = i > 0 ? (y1 - table[i - 1][1]) / (x1 - table[i - 1][0]) : (y1 - y0) / h;
    const m1 = i < n - 2 ? (table[i + 2][1] - y0) / (table[i + 2][0] - x0) : (y1 - y0) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
  };
  LM.lin = function (d0, d1, r0, r1) {
    const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
    f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
    return f;
  };
  LM.logScale = function (d0, d1, r0, r1) {
    const l0 = Math.log10(d0), l1 = Math.log10(d1);
    const f = (v) => r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0);
    f.inv = (p) => Math.pow(10, l0 + ((p - r0) / (r1 - r0)) * (l1 - l0));
    return f;
  };

  /* ---------------- number formatting (Chinese typography uses a real minus) ---------------- */
  LM.f = function (x, d) {
    if (!isFinite(x)) return '—';
    const s = x.toFixed(d === undefined ? 2 : d);
    return s.charAt(0) === '-' ? (/^-0(\.0+)?$/.test(s) ? s.slice(1) : '−' + s.slice(1)) : s;
  };
  LM.sig = function (x, n) {
    if (!isFinite(x) || x === 0) return x === 0 ? '0' : '—';
    const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x))));
    return LM.f(x, Math.min(d, 6));
  };
  LM.unit = function (x, u, n) {
    /* x in base unit (m, Hz, eV …) → SI-prefixed string */
    const pre = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    const ax = Math.abs(x);
    for (const [k, p] of pre) if (ax >= k * 0.9999) return LM.sig(x / k, n || 3) + ' ' + p + u;
    return LM.sig(x / 1e-12, n || 3) + ' p' + u;
  };
  LM.length = function (m, n) {
    if (m >= 1) return LM.sig(m, n || 3) + ' m';
    if (m >= 0.01) return LM.sig(m * 100, n || 3) + ' cm';
    if (m >= 1e-3) return LM.sig(m * 1e3, n || 3) + ' mm';
    if (m >= 1e-6) return LM.sig(m * 1e6, n || 3) + ' µm';
    return LM.sig(m * 1e9, n || 3) + ' nm';
  };
  LM.sup = function (n) {
    const map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    return String(n).split('').map((c) => map[c] || c).join('');
  };
  LM.sci = function (x, d) {
    if (x === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(x)));
    const m = x / Math.pow(10, e);
    if (e >= -2 && e <= 3) return LM.sig(x, (d || 2) + 1);
    return LM.f(m, d === undefined ? 2 : d) + '×10' + LM.sup(e);
  };

  /* ---------------- arrows (line + filled head, coloured through --c) ---------------- */
  LM.arrow = function (parent, color, width, head) {
    const g = LM.s('g', { class: 'arr' }, parent);
    if (color) g.style.setProperty('--c', color);
    const line = LM.s('line', { 'stroke-width': width || 2 }, g);
    const tip = LM.s('polygon', {}, g);
    const hs0 = head || 9;
    const api = {
      g: g,
      set: function (x1, y1, x2, y2, hs) {
        hs = hs === undefined ? hs0 : hs;
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
        if (L < 0.6) {
          g.setAttribute('visibility', 'hidden');
          return api;
        }
        g.removeAttribute('visibility');
        const ux = dx / L, uy = dy / L;
        const h = Math.min(hs, L * 0.55);
        const bx = x2 - ux * h, by = y2 - uy * h, w = h * 0.52;
        line.setAttribute('x1', x1.toFixed(1));
        line.setAttribute('y1', y1.toFixed(1));
        line.setAttribute('x2', (bx + ux * 0.5).toFixed(1));
        line.setAttribute('y2', (by + uy * 0.5).toFixed(1));
        tip.setAttribute('points', x2.toFixed(1) + ',' + y2.toFixed(1) + ' ' + (bx - uy * w).toFixed(1) + ',' + (by + ux * w).toFixed(1) + ' ' + (bx + uy * w).toFixed(1) + ',' + (by - ux * w).toFixed(1));
        return api;
      },
      color: function (c) {
        g.style.setProperty('--c', c);
        return api;
      },
      opacity: function (o) {
        g.setAttribute('opacity', o);
        return api;
      },
      hide: function () {
        g.setAttribute('visibility', 'hidden');
        return api;
      },
    };
    return api;
  };
  /* static arrow: returns the group */
  LM.arrowAt = function (parent, x1, y1, x2, y2, color, width, head) {
    return LM.arrow(parent, color, width, head).set(x1, y1, x2, y2).g;
  };

  /* ---------------- scenes & the animation loop ---------------- */
  LM.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const scenes = [];
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const sc = e.target.__scene;
          if (sc) sc.visible = e.isIntersecting;
        }
      },
      { rootMargin: '160px 0px' }
    );
  }
  LM.scene = function (figId, setup) {
    const fig = document.getElementById(figId);
    if (!fig) return null;
    const sc = { fig: fig, t: 0, playing: false, visible: !io, update: null };
    sc.render = function () {
      if (sc.update) {
        try {
          sc.update(sc.t, 0);
        } catch (err) {
          console.error(figId, err);
        }
      }
    };
    let api;
    try {
      api = setup(fig, sc) || {};
    } catch (err) {
      console.error('scene setup failed: ' + figId, err);
      return null;
    }
    sc.update = api.update || null;
    if (api.t0) sc.t = api.t0;
    const btn = fig.querySelector('.play');
    sc.setPlaying = function (p) {
      sc.playing = !!p && !!sc.update;
      if (btn) {
        btn.setAttribute('aria-pressed', sc.playing ? 'true' : 'false');
        const l = btn.querySelector('.lbl');
        if (l) l.textContent = sc.playing ? '暂停' : '播放';
      }
      fig.classList.toggle('is-paused', !sc.playing);
    };
    if (btn) btn.addEventListener('click', () => sc.setPlaying(!sc.playing));
    sc.setPlaying(api.autoplay !== false && !LM.reduced);
    fig.__scene = sc;
    if (io) io.observe(fig);
    scenes.push(sc);
    sc.render();
    return sc;
  };
  let last = 0;
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!document.hidden) {
      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        if (sc.visible && sc.playing && sc.update) {
          sc.t += dt;
          try {
            sc.update(sc.t, dt);
          } catch (err) {
            console.error(sc.fig.id, err);
            sc.setPlaying(false);
          }
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------- theme ---------------- */
  LM.isDark = function () {
    const th = document.documentElement.getAttribute('data-theme');
    if (th === 'dark') return true;
    if (th === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const themeCbs = [];
  LM.onTheme = function (cb) {
    themeCbs.push(cb);
  };
  function fireTheme() {
    for (const cb of themeCbs) {
      try {
        cb(LM.isDark());
      } catch (err) {
        console.error(err);
      }
    }
  }
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', fireTheme);
    else if (mq.addListener) mq.addListener(fireTheme);
  }
  new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------------- colour science ---------------- */
  /* approximate visible-spectrum colour (Bruton), components 0..1 */
  LM.waveRGB = function (nm) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm >= 645 && nm <= 780) { r = 1; }
    let f = 1;
    if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
    else if (nm > 700) f = 0.3 + (0.7 * (780 - nm)) / 80;
    return [r, g, b].map((c) => Math.pow(Math.max(0, c * f), 0.8));
  };
  /* colour for drawing a wavelength on the current theme's surface (invisible bands get pseudo-colours) */
  LM.specColor = function (nm) {
    if (nm < 380) return 'var(--uv)';
    if (nm > 780) return nm < 1400 ? 'var(--nir)' : nm < 3000 ? 'var(--swir)' : nm < 30000 ? 'var(--tir)' : 'var(--mw)';
    let [r, g, b] = LM.waveRGB(nm);
    if (LM.isDark()) {
      const k = 0.18;
      r = r + (1 - r) * k; g = g + (1 - g) * k; b = b + (1 - b) * k;
    } else {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const s = lum > 0.42 ? 0.42 / lum : 1;
      r *= s * 0.95; g *= s * 0.95; b *= s * 0.95;
    }
    return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')';
  };
  /* CIE 1931 2° colour-matching functions, multi-lobe Gaussian fit (Wyman, Sloan & Shirley 2013) */
  function g3(x, mu, s1, s2) {
    const t = (x - mu) / (x < mu ? s1 : s2);
    return Math.exp(-0.5 * t * t);
  }
  LM.cmf = function (nm) {
    return [
      1.056 * g3(nm, 599.8, 37.9, 31.0) + 0.362 * g3(nm, 442.0, 16.0, 26.7) - 0.065 * g3(nm, 501.1, 20.4, 26.2),
      0.821 * g3(nm, 568.8, 46.9, 40.5) + 0.286 * g3(nm, 530.9, 16.3, 31.1),
      1.217 * g3(nm, 437.0, 11.8, 36.0) + 0.681 * g3(nm, 459.0, 26.0, 13.8),
    ];
  };
  LM.xyzToLinear = (X, Y, Z) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  LM.gammaEnc = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  /* colour of light reflected with spectral reflectance refl(nm) under daylight; normalised so a perfect white is (1,1,1) */
  let whiteLin = null;
  function illum(nm) {
    return LM.planckNm(nm, 6504);
  }
  function integrate(refl) {
    let X = 0, Y = 0, Z = 0;
    for (let nm = 380; nm <= 780; nm += 5) {
      const s = illum(nm) * refl(nm);
      const c = LM.cmf(nm);
      X += s * c[0]; Y += s * c[1]; Z += s * c[2];
    }
    return LM.xyzToLinear(X, Y, Z);
  }
  LM.reflColor = function (refl, gain) {
    if (!whiteLin) whiteLin = integrate(() => 1);
    const lin = integrate(refl).map((c, i) => Math.max(0, (c / whiteLin[i]) * (gain || 1)));
    const m = Math.max(1, lin[0], lin[1], lin[2]);
    return lin.map((c) => LM.gammaEnc(c / m));
  };
  LM.rgbCss = (rgb) => 'rgb(' + rgb.map((c) => Math.round(LM.clamp(c, 0, 1) * 255)).join(',') + ')';

  /* ---------------- complex numbers ---------------- */
  const C = (LM.C = {
    c: (re, im) => ({ re: re, im: im || 0 }),
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
    div: (a, b) => {
      const d = b.re * b.re + b.im * b.im;
      return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
    },
    scale: (a, k) => ({ re: a.re * k, im: a.im * k }),
    abs: (a) => Math.hypot(a.re, a.im),
    arg: (a) => Math.atan2(a.im, a.re),
    sqrt: (a) => {
      const r = Math.hypot(a.re, a.im);
      const re = Math.sqrt(Math.max(0, (r + a.re) / 2));
      let im = Math.sqrt(Math.max(0, (r - a.re) / 2));
      if (a.im < 0) im = -im;
      return { re: re, im: im };
    },
    polar: (r, th) => ({ re: r * Math.cos(th), im: r * Math.sin(th) }),
  });

  /* ---------------- physics ---------------- */
  /* Fresnel amplitude coefficients for real indices; handles total internal reflection.
     rp uses the convention rp = (n2 cosθ1 − n1 cosθ2)/(n2 cosθ1 + n1 cosθ2). */
  LM.fresnel = function (n1, n2, th1) {
    const s1 = Math.sin(th1), c1 = Math.cos(th1);
    const s2 = (n1 / n2) * s1;
    const tir = s2 > 1;
    const c2 = tir ? C.c(0, Math.sqrt(s2 * s2 - 1)) : C.c(Math.sqrt(Math.max(0, 1 - s2 * s2)), 0);
    const a = C.c(n1 * c1), b = C.scale(c2, n2);
    const rs = C.div(C.sub(a, b), C.add(a, b));
    const p1 = C.c(n2 * c1), p2 = C.scale(c2, n1);
    const rp = C.div(C.sub(p1, p2), C.add(p1, p2));
    const Rs = Math.pow(C.abs(rs), 2), Rp = Math.pow(C.abs(rp), 2);
    return { rs: rs, rp: rp, Rs: Math.min(1, Rs), Rp: Math.min(1, Rp), tir: tir, th2: tir ? null : Math.asin(s2), s2: s2 };
  };
  /* Fresnel for a complex relative permittivity (medium 1 = vacuum/air) */
  LM.fresnelEps = function (eps, th1) {
    const s1 = Math.sin(th1), c1 = Math.cos(th1);
    const root = C.sqrt(C.sub(eps, C.c(s1 * s1)));
    const rh = C.div(C.sub(C.c(c1), root), C.add(C.c(c1), root));
    const ec = C.scale(eps, c1);
    const rv = C.div(C.sub(ec, root), C.add(ec, root));
    return { Rh: Math.pow(C.abs(rh), 2), Rv: Math.pow(C.abs(rv), 2) };
  };
  /* Planck spectral radiance, W m^-2 sr^-1 µm^-1 (λ in µm) */
  LM.planck = function (um, T) {
    const x = 14387.77 / (um * T);
    if (x > 700) return 0;
    return 1.191042e8 / (Math.pow(um, 5) * Math.expm1(x));
  };
  LM.planckNm = (nm, T) => LM.planck(nm / 1000, T);

  /* ---------------- UI helpers ---------------- */
  LM.range = function (id, fn, fmt) {
    const el = document.getElementById(id);
    if (!el) return null;
    const out = document.getElementById(id + '-o');
    const upd = function () {
      const v = parseFloat(el.value);
      if (out && fmt) out.textContent = fmt(v);
      fn(v);
    };
    el.addEventListener('input', upd);
    upd();
    return {
      el: el,
      set: function (v) {
        el.value = v;
        upd();
      },
    };
  };
  LM.seg = function (id, fn) {
    const g = document.getElementById(id);
    if (!g) return null;
    const btns = Array.prototype.slice.call(g.querySelectorAll('button'));
    function select(b, fire) {
      btns.forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      if (fire) fn(b.getAttribute('data-v'), b);
    }
    btns.forEach((b) => b.addEventListener('click', () => select(b, true)));
    const init = btns.filter((b) => b.getAttribute('aria-pressed') === 'true')[0] || btns[0];
    select(init, true);
    return {
      set: function (v) {
        const b = btns.filter((x) => x.getAttribute('data-v') === v)[0];
        if (b) select(b, true);
      },
    };
  };
  LM.chips = function (id, fn) {
    const g = document.getElementById(id);
    if (!g) return;
    Array.prototype.forEach.call(g.querySelectorAll('button'), (b) => b.addEventListener('click', () => fn(b)));
  };
  /* drag/click on a chart: calls fn(xInViewBoxUnits, yInViewBoxUnits) */
  LM.drag = function (svg, fn) {
    let down = false;
    function pos(ev) {
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      return [((ev.clientX - r.left) / r.width) * vb.width + vb.x, ((ev.clientY - r.top) / r.height) * vb.height + vb.y];
    }
    svg.addEventListener('pointerdown', (ev) => {
      down = true;
      try {
        svg.setPointerCapture(ev.pointerId);
      } catch (e) {
        /* ignore */
      }
      const p = pos(ev);
      fn(p[0], p[1], 'down');
    });
    svg.addEventListener('pointermove', (ev) => {
      const p = pos(ev);
      fn(p[0], p[1], down ? 'drag' : 'hover');
    });
    const up = () => (down = false);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', () => fn(null, null, 'leave'));
  };
  /* simple tooltip anchored inside a .panel */
  LM.tip = function (panel) {
    const el = LM.h('div', { class: 'tip', role: 'status' }, panel);
    el.hidden = true;
    return {
      show: function (px, py, head, rows) {
        el.textContent = '';
        if (head) LM.h('div', { class: 'tip-h' }, el, head);
        for (const r of rows) {
          const row = LM.h('div', { class: 'row' }, el);
          if (r.color) {
            const k = LM.h('span', { class: 'k' }, row);
            k.style.background = r.color;
          }
          LM.h('span', { class: 'v' }, row, r.value);
          LM.h('span', {}, row, r.label);
        }
        el.hidden = false;
        const pw = panel.clientWidth, ew = el.offsetWidth, eh = el.offsetHeight;
        let x = px + 14, y = py - eh - 10;
        if (x + ew > pw - 6) x = px - ew - 14;
        if (x < 6) x = 6;
        if (y < 6) y = py + 16;
        el.style.left = x + panel.scrollLeft + 'px';
        el.style.top = y + 'px';
      },
      hide: function () {
        el.hidden = true;
      },
    };
  };
  /* map viewBox coords to pixel coords inside the svg's panel */
  LM.toPanel = function (svg, x, y) {
    const r = svg.getBoundingClientRect();
    const pr = svg.parentNode.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return [((x - vb.x) / vb.width) * r.width + (r.left - pr.left), ((y - vb.y) / vb.height) * r.height + (r.top - pr.top)];
  };

  /* reading progress bar */
  const bar = document.getElementById('progress-bar');
  if (bar) {
    const upd = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? LM.clamp(window.scrollY / h, 0, 1) : 0) + ')';
    };
    window.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  }
})();
