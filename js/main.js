(function () {
  "use strict";

  const AMBER = [255, 184, 41];
  const IRIS = [128, 82, 255];
  const WHITE = [255, 255, 255];
  const TEAL = [21, 132, 110];

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d", { alpha: true });
  const chapters = Array.from(document.querySelectorAll(".chapter"));
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-menu");

  let w = 1;
  let h = 1;
  let dpr = 1;
  let time = 0;
  let rail = { x: 0, y: 0, width: 1 };

  const layout = chapters.map((el) => ({
    el,
    scene: el.dataset.scene,
    t: 0,
    top: 0,
    bottom: 0
  }));

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function smooth(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function hash(i, k) {
    const n = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function rgb(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpPt(a, b, t) {
    return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) };
  }

  function quad(a, b, c, u) {
    return lerpPt(lerpPt(a, b, u), lerpPt(b, c, u), u);
  }

  function unit() {
    return Math.min(w, h) / 900;
  }

  function narrow() {
    return w < 860;
  }

  function sunCenter() {
    return { x: w * 0.5, y: h * (narrow() ? 0.22 : 0.26) };
  }

  function focal() {
    return {
      x: narrow() ? w * 0.5 : Math.min(w * 0.73, w - 220),
      y: narrow() ? h * 0.3 : h * 0.46
    };
  }

  function panelGeom() {
    const f = focal();
    const pw = Math.min(w * (narrow() ? 0.62 : 0.34), 440) * (0.92 + 0.08);
    const ph = pw * 0.58;
    return { cx: f.x, cy: f.y, pw: pw, ph: ph };
  }

  function panelPoint(u, v) {
    const g = panelGeom();
    const yaw = 0.16;
    return {
      x: g.cx - g.pw / 2 + u * g.pw + (v - 0.5) * g.pw * yaw,
      y: g.cy - g.ph / 2 + v * g.ph
    };
  }

  function cellFor(i) {
    const cols = 8;
    const rows = 5;
    const n = cols * rows;
    const cell = i % n;
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    return panelPoint((col + 0.5) / cols, (row + 0.5) / rows);
  }

  function orbitPoint(i, center) {
    const a = hash(i, 1) * Math.PI * 2;
    const ring = 0.28 + hash(i, 2) * 0.82;
    const rx = 168 * unit() * ring;
    const ry = rx * 0.58;
    return {
      x: center.x + Math.cos(a) * rx,
      y: center.y + Math.sin(a) * ry,
      rot: a,
      size: 1.5 + hash(i, 4) * 2.3
    };
  }

  function savingsPoint(u) {
    const f = focal();
    const s = unit();
    return {
      x: f.x - 190 * s + u * 380 * s,
      y: f.y + 80 * s - Math.pow(u, 1.32) * 190 * s
    };
  }

  function roofs() {
    return [
      { x: w * 0.12, y: h * 0.22 },
      { x: w * 0.32, y: h * 0.15 },
      { x: w * 0.52, y: h * 0.2 },
      { x: w * 0.72, y: h * 0.14 },
      { x: w * 0.9, y: h * 0.24 }
    ];
  }

  function houseGeom(shiftX) {
    const f = focal();
    const s = unit();
    const bw = 248 * s;
    const wall = 138 * s;
    const x = f.x - bw / 2 + (shiftX || 0);
    const y = f.y - wall / 2 + 28 * s;
    return { x: x, y: y, bw: bw, wall: wall, s: s, f: f };
  }

  function sag(a, b, u, drop) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + drop };
    return quad(a, mid, b, u);
  }

  function exportRoute() {
    const s = unit();
    const y = h * (narrow() ? 0.18 : 0.22);
    const anchor = narrow() ? w * 0.16 : Math.min(w * 0.56, w - 520 * s);
    return {
      s: s,
      home: { x: anchor + 170 * s, y: y },
      towers: [
        { x: anchor + 300 * s, y: y - 26 * s },
        { x: anchor + 440 * s, y: y - 44 * s },
        { x: anchor + 580 * s, y: y - 6 * s }
      ]
    };
  }

  function exportPoint(u) {
    const route = exportRoute();
    const pts = [route.home].concat(route.towers);
    const span = pts.length - 1;
    const scaled = clamp(u, 0, 0.999) * span;
    const seg = Math.min(span - 1, Math.floor(scaled));
    return sag(pts[seg], pts[seg + 1], scaled - seg, 30 * route.s);
  }

  function count() {
    return narrow() ? 72 : 156;
  }

  function particleAt(scene, i, t) {
    const sun = sunCenter();
    const orbit = orbitPoint(i, sun);
    const sparse = {
      x: hash(i, 8) * w,
      y: hash(i, 9) * h * 0.55,
      rot: hash(i, 3) * Math.PI,
      size: 1.4 + hash(i, 4) * 1.8
    };
    const base = {
      x: orbit.x,
      y: orbit.y,
      rot: orbit.rot,
      size: orbit.size,
      alpha: 0.35 + hash(i, 5) * 0.55,
      color: hash(i, 11) > 0.86 ? WHITE : AMBER,
      shape: "tri"
    };

    if (scene === "origin") {
      const g = smooth(t);
      const visible = i < 26 ? 1 : smooth(clamp((g - (i - 26) / 140) * 2.2, 0, 1));
      return {
        x: mix(sparse.x, orbit.x, g),
        y: mix(sparse.y, orbit.y, g),
        rot: mix(sparse.rot, orbit.rot, g) + (reduce ? 0 : time * 0.15 * (hash(i, 6) - 0.5)),
        size: mix(sparse.size, orbit.size, g),
        alpha: (0.2 + hash(i, 5) * 0.65) * visible,
        color: base.color,
        shape: "tri"
      };
    }

    if (scene === "capture") {
      const g = panelGeom();
      const leave = smooth(t);
      const along = clamp(hash(i, 6) * 0.35 + t * 1.05, 0, 1);
      const end = { x: g.cx + (hash(i, 7) - 0.5) * g.pw * 0.7, y: g.cy - g.ph * 0.62 };
      const mid = { x: mix(sun.x, end.x, 0.5) + (hash(i, 2) - 0.5) * 40, y: mix(sun.y, end.y, 0.45) };
      const p = quad(orbit, mid, end, along);
      return {
        x: mix(orbit.x, p.x, leave),
        y: mix(orbit.y, p.y, leave),
        rot: orbit.rot,
        size: mix(orbit.size, 1.7, leave),
        alpha: 0.45 + hash(i, 5) * 0.5,
        color: AMBER,
        shape: leave > 0.45 ? "dot" : "tri"
      };
    }

    if (scene === "panel") {
      const cell = cellFor(i);
      const g = panelGeom();
      const from = { x: cell.x, y: g.cy - g.ph * 0.62 - hash(i, 3) * h * 0.18 };
      const seat = smooth(t);
      const hit = hash(i, 12) > 0.72 && t > 0.35;
      return {
        x: mix(from.x, cell.x, seat),
        y: mix(from.y, cell.y, seat),
        rot: 0,
        size: hit ? 2.2 : 1.5,
        alpha: 0.35 + hash(i, 5) * 0.55,
        color: hit && seat > 0.7 ? WHITE : AMBER,
        shape: "dot"
      };
    }

    if (scene === "generate") {
      const cell = cellFor(i);
      const g = panelGeom();
      const exit = { x: g.cx + g.pw * 0.08, y: g.cy + g.ph * 0.78 };
      const bend = { x: cell.x + (exit.x - cell.x) * 0.45, y: cell.y + 30 * unit() };
      const k = smooth(t);
      const p = quad(cell, bend, exit, k);
      const color = k < 0.42 ? AMBER : k < 0.72 ? WHITE : IRIS;
      return {
        x: p.x,
        y: p.y,
        rot: 0,
        size: 1.6,
        alpha: 0.4 + hash(i, 5) * 0.5,
        color: color,
        shape: "dot"
      };
    }

    if (scene === "convert") {
      const f = focal();
      const s = unit();
      const bw = 340 * s;
      const left = { x: f.x - bw / 2 - 20 * s, y: f.y + (hash(i, 3) - 0.5) * 36 * s };
      const inside = {
        x: f.x - bw * 0.32 + hash(i, 4) * bw * 0.64,
        y: f.y + Math.sin(hash(i, 6) * Math.PI * 6 + t * 8) * (10 + t * 22) * s
      };
      const right = {
        x: f.x + bw / 2 + 16 * s + hash(i, 7) * 50 * s,
        y: f.y + Math.sin(t * 9 + i * 0.35) * 22 * s
      };
      const k = t;
      let p;
      let color;
      if (k < 0.45) {
        p = lerpPt(left, inside, smooth(k / 0.45));
        color = k < 0.25 ? AMBER : WHITE;
      } else {
        p = lerpPt(inside, right, smooth((k - 0.45) / 0.55));
        color = WHITE;
      }
      return { x: p.x, y: p.y, rot: 0, size: 1.5, alpha: 0.45 + hash(i, 5) * 0.45, color: color, shape: "dot" };
    }

    if (scene === "property") {
      const box = houseGeom();
      const slot = i % 4;
      const col = slot % 2;
      const row = Math.floor(slot / 2);
      const win = {
        x: box.x + box.bw * (0.22 + col * 0.42),
        y: box.y + box.wall * (0.28 + row * 0.38)
      };
      const approach = { x: box.x - 90 * box.s, y: box.y + box.wall * 0.55 };
      const k = smooth(Math.min(1, t * 1.15));
      const p = lerpPt(approach, win, k);
      return {
        x: p.x,
        y: p.y,
        rot: 0,
        size: k > 0.8 ? 2.1 : 1.6,
        alpha: 0.45 + hash(i, 5) * 0.5,
        color: k > 0.72 ? WHITE : IRIS,
        shape: "dot"
      };
    }

    if (scene === "grid") {
      const forward = i % 5 !== 0;
      const speed = forward ? t * 0.85 + hash(i, 3) * 0.2 : 1 - (t * 0.55 + hash(i, 4) * 0.25);
      const p = exportPoint(clamp(speed, 0, 1));
      return {
        x: p.x,
        y: p.y,
        rot: 0,
        size: forward ? 2 : 1.3,
        alpha: 0.5 + hash(i, 5) * 0.45,
        color: forward ? (hash(i, 6) > 0.55 ? TEAL : AMBER) : WHITE,
        shape: "dot"
      };
    }

    if (scene === "savings") {
      const u = clamp(hash(i, 2) * 0.15 + t * 0.95 * (0.45 + hash(i, 6) * 0.55), 0, 1);
      const p = savingsPoint(u);
      const color = u < 0.45 ? AMBER : u < 0.75 ? WHITE : TEAL;
      return {
        x: p.x,
        y: p.y + (hash(i, 4) - 0.5) * 10,
        rot: 0,
        size: 1.6,
        alpha: 0.4 + hash(i, 5) * 0.5,
        color: color,
        shape: "dot"
      };
    }

    if (scene === "process") {
      const u = clamp((i / count()) * 0.85 + (hash(i, 2) - 0.5) * 0.02, 0, 1);
      const pulse = t;
      const near = Math.abs(u - pulse) < 0.06;
      return {
        x: rail.x + u * rail.width,
        y: rail.y + Math.sin(u * 18 + t * 6) * (near ? 0 : 3),
        rot: 0,
        size: near ? 2.6 : 1.4,
        alpha: near ? 0.95 : 0.28,
        color: near ? IRIS : WHITE,
        shape: "dot"
      };
    }

    if (scene === "projects") {
      return {
        x: hash(i, 1) * w,
        y: hash(i, 2) * h,
        rot: hash(i, 3) * 6,
        size: 1.3,
        alpha: 0.12 + hash(i, 4) * 0.12,
        color: hash(i, 5) > 0.7 ? TEAL : AMBER,
        shape: i % 3 === 0 ? "tri" : "dot"
      };
    }

    if (scene === "why") {
      const f = focal();
      const a = hash(i, 1) * Math.PI * 2 + t * 0.6;
      const rad = (40 + hash(i, 2) * 120) * unit();
      return {
        x: f.x + Math.cos(a) * rad,
        y: f.y + Math.sin(a) * rad * 0.72,
        rot: a,
        size: 1.5,
        alpha: 0.2 + hash(i, 4) * 0.35,
        color: i % 4 === 0 ? TEAL : AMBER,
        shape: "tri"
      };
    }

    if (scene === "future") {
      const pts = roofs();
      const a = i % pts.length;
      const b = (a + 1) % pts.length;
      const u = (hash(i, 3) + t * 0.45) % 1;
      const p = lerpPt(pts[a], pts[b], u);
      const colors = [AMBER, IRIS, TEAL, WHITE];
      return {
        x: p.x + (hash(i, 6) - 0.5) * 16,
        y: p.y + (hash(i, 7) - 0.5) * 12,
        rot: hash(i, 1) * 4,
        size: 1.4 + hash(i, 4),
        alpha: 0.35 + hash(i, 5) * 0.5,
        color: colors[i % colors.length],
        shape: i % 4 === 0 ? "tri" : "dot"
      };
    }

    const driftA = hash(i, 1) * Math.PI * 2;
    return {
      x: hash(i, 2) * w + Math.sin(time * 0.15 + driftA) * (reduce ? 0 : 8),
      y: (hash(i, 3) * h + time * (8 + hash(i, 4) * 10)) % h,
      rot: driftA,
      size: 1.3,
      alpha: 0.15 + hash(i, 5) * 0.25,
      color: i % 5 === 0 ? TEAL : AMBER,
      shape: i % 2 === 0 ? "tri" : "dot"
    };
  }

  function roundRect(x, y, rw, rh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, r);
    ctx.arcTo(x + rw, y + rh, x, y + rh, r);
    ctx.arcTo(x, y + rh, x, y, r);
    ctx.arcTo(x, y, x + rw, y, r);
    ctx.closePath();
  }

  function strokeLine(points, color, alpha, width) {
    if (points.length < 2 || alpha < 0.02) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = rgb(color, alpha);
    ctx.lineWidth = width || 1;
    ctx.stroke();
  }

  function drawSun(t, alpha, reach) {
    if (alpha < 0.02) return;
    const c = sunCenter();
    const g = smooth(Math.max(t, 0.12));
    const s = unit();
    const rays = narrow() ? 12 : 18;
    ctx.save();
    ctx.lineWidth = 1.35;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 - 0.35 + (reduce ? 0 : time * 0.08);
      const inner = 20 * s;
      const len = (48 + (i % 4) * 18) * s * (0.3 + g * 0.9);
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * inner, c.y + Math.sin(a) * inner);
      ctx.lineTo(c.x + Math.cos(a) * (inner + len), c.y + Math.sin(a) * (inner + len));
      ctx.strokeStyle = rgb(AMBER, alpha * (0.35 + 0.5 * g));
      ctx.stroke();
    }
    if (reach > 0.02) {
      const panel = panelGeom();
      const aimY = panel.cy - panel.ph * 0.48;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const end = { x: panel.cx + (i - 3) * panel.pw * 0.12, y: aimY };
        const tip = lerpPt(c, end, 0.12 + reach * 0.88);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.strokeStyle = rgb(AMBER, alpha * 0.55);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, 16 * s, 0, Math.PI * 2);
    ctx.fillStyle = rgb([255, 214, 120], alpha * (0.35 + 0.5 * g));
    ctx.fill();
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 78 * s);
    glow.addColorStop(0, rgb(AMBER, alpha * 0.28 * (0.4 + g)));
    glow.addColorStop(1, rgb(AMBER, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 78 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * g * 0.4;
    ctx.strokeStyle = rgb(AMBER, 0.55);
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 2; ring++) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 46 * ring * s, 27 * ring * s, -0.45, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrigin(t, alpha) {
    drawSun(t, alpha, 0);
  }

  function drawPanel(t, alpha) {
    if (alpha < 0.02) return;
    const appear = smooth(Math.min(1, 0.35 + t * 1.1));
    const g = panelGeom();
    ctx.save();
    const source = { x: g.cx, y: g.cy - g.ph * 0.95 };
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 6; i++) {
      const hit = panelPoint((i + 0.5) / 6, 0.08);
      const tip = lerpPt(source, hit, 0.2 + appear * 0.8);
      ctx.beginPath();
      ctx.moveTo(source.x + (i - 2.5) * 10, source.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.strokeStyle = rgb(AMBER, alpha * 0.45 * appear);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * appear;
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.beginPath();
    const frame = [panelPoint(0, 0), panelPoint(1, 0), panelPoint(1, 1), panelPoint(0, 1)];
    ctx.moveTo(frame[0].x, frame[0].y);
    frame.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    const cols = 8;
    const rows = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    for (let c = 1; c < cols; c++) {
      const a = panelPoint(c / cols, 0);
      const b = panelPoint(c / cols, 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      const a = panelPoint(0, r / rows);
      const b = panelPoint(1, r / rows);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = rgb(AMBER, 0.85);
    [0.33, 0.66].forEach((u) => {
      const a = panelPoint(u, 0.04);
      const b = panelPoint(u, 0.96);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    for (let n = 0; n < 4; n++) {
      const pulse = (t * 2.2 + n * 0.23) % 1;
      if (pulse > 0.62) {
        const hit = cellFor((n * 9 + Math.floor(t * 8)) % 40);
        const k = (pulse - 0.62) / 0.38;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, 3 + k * 16, 0, Math.PI * 2);
        ctx.strokeStyle = rgb(WHITE, (1 - k) * 0.85 * alpha);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCables(t, alpha) {
    const g = panelGeom();
    const s = unit();
    const bus = { x: g.cx + g.pw * 0.02, y: g.cy + g.ph * 0.52 };
    const join = { x: bus.x + 36 * s, y: bus.y + 54 * s };
    const exit = { x: join.x + 120 * s, y: join.y + 10 * s };
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgb(IRIS, alpha * 0.85);
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = reduce ? 0 : -time * 42;
    for (let n = 0; n < 4; n++) {
      const cell = panelPoint(0.2 + n * 0.2, 0.92);
      ctx.beginPath();
      ctx.moveTo(cell.x, cell.y);
      ctx.quadraticCurveTo(cell.x, bus.y, join.x, join.y);
      ctx.stroke();
    }
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = rgb(WHITE, alpha * 0.9);
    ctx.beginPath();
    ctx.moveTo(join.x, join.y);
    ctx.lineTo(exit.x, exit.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = exportPulse(t);
    const head = lerpPt(join, exit, pulse);
    ctx.beginPath();
    ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = rgb(WHITE, alpha);
    ctx.fill();
    ctx.restore();
  }

  function exportPulse(t) {
    const base = reduce ? t : (t * 0.65 + time * 0.18) % 1;
    return base;
  }

  function drawGenerate(t, alpha) {
    if (alpha < 0.02) return;
    drawPanel(1, alpha * (0.72 + 0.28 * (1 - smooth(t))));
    drawCables(t, alpha);
  }

  function drawConvert(t, alpha) {
    if (alpha < 0.02) return;
    const f = focal();
    const s = unit();
    const bw = 340 * s;
    const bh = 116 * s;
    const x = f.x - bw / 2;
    const y = f.y - bh / 2;
    const show = smooth(Math.min(1, t * 1.5));
    ctx.save();
    ctx.globalAlpha = alpha * show;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    roundRect(x, y, bw, bh, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 70 * s, f.y);
    ctx.lineTo(x, f.y);
    ctx.strokeStyle = rgb(IRIS, 0.95);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = reduce ? 0 : -time * 46;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + bw, f.y);
    ctx.lineTo(x + bw + 64 * s, f.y);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rgb(WHITE, 0.9);
    ctx.beginPath();
    const amp = (6 + smooth(t) * 28) * s;
    const phase = t * 9 + (reduce ? 0 : time * 0.7);
    for (let i = 0; i <= 70; i++) {
      const u = i / 70;
      const px = x + 18 * s + u * (bw - 36 * s);
      const py = f.y + Math.sin(u * Math.PI * 4 + phase) * amp;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawHouse(box, t, alpha, compact) {
    const x = box.x;
    const y = box.y;
    const bw = box.bw * (compact ? 0.72 : 1);
    const wall = box.wall * (compact ? 0.72 : 1);
    const s = box.s;
    const roof = y - 52 * s * (compact ? 0.8 : 1);
    ctx.save();
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = "rgba(255,255,255,0.84)";
    ctx.beginPath();
    ctx.moveTo(x - 16 * s, y);
    ctx.lineTo(x + bw / 2, roof);
    ctx.lineTo(x + bw + 16 * s, y);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(x, y, bw, wall);
    ctx.beginPath();
    ctx.moveTo(x + bw * 0.42, y + wall);
    ctx.lineTo(x + bw * 0.42, y + wall * 0.42);
    ctx.lineTo(x + bw * 0.58, y + wall * 0.42);
    ctx.lineTo(x + bw * 0.58, y + wall);
    ctx.stroke();
    const feed = { x: x - 78 * s, y: y + wall * 0.62 };
    ctx.strokeStyle = rgb(IRIS, 0.95);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = reduce ? 0 : -time * 48;
    ctx.beginPath();
    ctx.moveTo(feed.x, feed.y);
    ctx.lineTo(x, feed.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const windows = [
      [0.16, 0.18],
      [0.62, 0.18],
      [0.16, 0.55],
      [0.62, 0.55]
    ];
    windows.forEach((spot, index) => {
      const on = smooth((t - index * 0.16) / 0.22);
      const wx = x + bw * spot[0];
      const wy = y + wall * spot[1];
      const ww = bw * 0.18;
      const wh = wall * 0.22;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.fillStyle = rgb(on > 0.5 ? [255, 236, 196] : WHITE, alpha * (0.05 + on * 0.9));
      ctx.fillRect(wx, wy, ww, wh);
      if (on > 0.4) {
        const glow = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 2, wx + ww / 2, wy + wh / 2, ww);
        glow.addColorStop(0, rgb(AMBER, alpha * on * 0.35));
        glow.addColorStop(1, rgb(AMBER, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(wx + ww / 2, wy + wh / 2, ww, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  function drawProperty(t, alpha) {
    if (alpha < 0.02) return;
    drawHouse(houseGeom(), t, alpha, false);
  }

  function drawPylon(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - 46 * s);
    ctx.lineTo(x, y + 58 * s);
    ctx.moveTo(x - 18 * s, y + 58 * s);
    ctx.lineTo(x, y + 34 * s);
    ctx.lineTo(x + 18 * s, y + 58 * s);
    ctx.moveTo(x - 24 * s, y - 28 * s);
    ctx.lineTo(x + 24 * s, y - 28 * s);
    ctx.moveTo(x - 16 * s, y - 6 * s);
    ctx.lineTo(x + 16 * s, y - 6 * s);
    ctx.moveTo(x - 24 * s, y - 28 * s);
    ctx.lineTo(x, y - 6 * s);
    ctx.lineTo(x + 24 * s, y - 28 * s);
    ctx.stroke();
  }

  function drawGrid(t, alpha) {
    if (alpha < 0.02) return;
    const route = exportRoute();
    const proto = houseGeom();
    const compactW = proto.bw * 0.72;
    const box = houseGeom(route.home.x - proto.f.x - compactW * 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawHouse(box, 1, alpha, true);
    ctx.strokeStyle = rgb(TEAL, 0.9);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 8]);
    ctx.lineDashOffset = reduce ? 0 : -time * 36 * (0.4 + t);
    const pts = [route.home].concat(route.towers);
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.beginPath();
      for (let s = 0; s <= 18; s++) {
        const p = sag(pts[i], pts[i + 1], s / 18, 30 * route.s);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.25;
    route.towers.forEach((tower) => drawPylon(tower.x, tower.y, route.s));
    for (let n = 0; n < 3; n++) {
      const u = (t * 0.7 + n * 0.28 + (reduce ? 0 : time * 0.12)) % 1;
      const p = exportPoint(u);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = rgb(n === 2 ? WHITE : TEAL, alpha);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSavings(t, alpha) {
    if (alpha < 0.02) return;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const p = savingsPoint(i / 40);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = rgb(IRIS, alpha * 0.55 * smooth(t));
    ctx.stroke();
    const tip = savingsPoint(smooth(t));
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = rgb(TEAL, alpha);
    ctx.fill();
    ctx.restore();
  }

  function drawProcess(t, alpha) {
    if (alpha < 0.02) return;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgb(WHITE, alpha * 0.35);
    ctx.beginPath();
    ctx.moveTo(rail.x, rail.y);
    ctx.lineTo(rail.x + rail.width, rail.y);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const x = rail.x + (i / 5) * rail.width;
      const on = t >= i / 6;
      ctx.beginPath();
      ctx.arc(x, rail.y, on ? 4 : 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = on ? rgb(IRIS, alpha) : rgb(WHITE, alpha * 0.35);
      ctx.stroke();
    }
    const px = rail.x + t * rail.width;
    const glow = ctx.createRadialGradient(px, rail.y, 0, px, rail.y, 22);
    glow.addColorStop(0, rgb(IRIS, 0.55 * alpha));
    glow.addColorStop(1, rgb(IRIS, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, rail.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWhy(t, alpha) {
    if (alpha < 0.02) return;
    const phase = Math.min(4, Math.floor(t * 5));
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    if (phase === 0) drawPanel(1, alpha * 0.45);
    else if (phase === 2) drawProperty(1, alpha * 0.4);
    else if (phase === 3) {
      const f = focal();
      strokeLine(
        [{ x: f.x - 120, y: f.y }, { x: f.x + 140, y: f.y - 40 }],
        IRIS,
        alpha * 0.6,
        1
      );
    } else if (phase === 4) {
      const f = focal();
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 70 * unit(), 44 * unit(), -0.4, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(TEAL, 0.7);
      ctx.stroke();
    } else {
      const f = focal();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(f.x - 80, f.y - 40 + i * 28);
        ctx.lineTo(f.x + 90, f.y - 40 + i * 28);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFuture(t, alpha) {
    if (alpha < 0.02) return;
    const pts = roofs();
    const s = unit();
    ctx.save();
    ctx.globalAlpha = alpha * smooth(Math.min(1, t * 1.2));
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.strokeStyle = rgb(i % 2 ? IRIS : TEAL, 0.4);
      ctx.stroke();
    }
    pts.forEach((p) => {
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.strokeRect(p.x - 18 * s, p.y, 36 * s, 16 * s);
      ctx.strokeStyle = rgb(AMBER, 0.8);
      ctx.strokeRect(p.x - 14 * s, p.y - 8 * s, 28 * s, 8 * s);
    });
    ctx.restore();
  }

  const drawers = {
    origin: drawOrigin,
    capture: function (t, alpha) {
      drawSun(1, alpha, smooth(t));
    },
    panel: drawPanel,
    generate: function (t, alpha) {
      drawPanel(1, alpha * (1 - smooth(t)));
      drawGenerate(t, alpha);
    },
    convert: drawConvert,
    property: drawProperty,
    grid: drawGrid,
    savings: drawSavings,
    process: drawProcess,
    why: drawWhy,
    future: drawFuture
  };

  function paintParticle(p, master) {
    const a = p.alpha * master;
    if (a < 0.015) return;
    if (p.shape === "tri") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.strokeStyle = rgb(p.color, a);
      ctx.lineWidth = 1;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.86, s * 0.5);
      ctx.lineTo(-s * 0.86, s * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = rgb(p.color, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, p.size * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 1.75);
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }

  function readLayout() {
    const viewH = window.innerHeight;
    layout.forEach((item) => {
      const rect = item.el.getBoundingClientRect();
      const travel = item.el.offsetHeight - viewH;
      item.top = rect.top;
      item.bottom = rect.bottom;
      item.t = travel <= 8 ? (rect.top < viewH * 0.66 ? 1 : 0) : clamp(-rect.top / travel, 0, 1);
    });
    let best = 0;
    let overlap = -1;
    layout.forEach((item, index) => {
      const amount = Math.min(item.bottom, viewH) - Math.max(item.top, 0);
      if (amount > overlap) {
        overlap = amount;
        best = index;
      }
    });
    const railEl = document.getElementById("rail");
    if (railEl) {
      const r = railEl.getBoundingClientRect();
      rail.x = r.left;
      rail.y = r.top - 16;
      rail.width = Math.max(1, r.width);
    }
    return best;
  }

  function textOpacity(scene, t) {
    if (scene === "drift" || scene === "projects") return 1;
    if (scene === "origin") return t < 0.88 ? 1 : clamp((1 - t) / 0.12, 0, 1);
    const fadeIn = t < 0.05 ? Math.max(0.45, t / 0.05) : 1;
    const fadeOut = t > 0.92 ? (1 - t) / 0.08 : 1;
    return clamp(Math.min(fadeIn, fadeOut), 0, 1);
  }

  function writeDom(activeIndex) {
    layout.forEach((item) => {
      const copy = item.el.querySelector(".copy");
      if (!copy) return;
      const opacity = textOpacity(item.scene, item.t);
      copy.style.opacity = String(opacity);
      copy.style.transform = reduce ? "none" : "translate3d(0," + ((0.4 - item.t) * 16).toFixed(2) + "px,0)";
    });

    const panelT = layout.find((item) => item.scene === "panel").t;
    document.querySelectorAll("#panel-flow li").forEach((li, index) => {
      li.classList.toggle("is-hot", panelT > [0.15, 0.42, 0.7][index]);
    });

    const convertT = layout.find((item) => item.scene === "convert").t;
    document.querySelectorAll("#convert-chain span").forEach((span, index) => {
      if (index % 2 === 1) return;
      const step = [0.15, 0.4, 0.7][index / 2];
      span.classList.toggle("is-hot", convertT > step);
    });

    const propertyT = layout.find((item) => item.scene === "property").t;
    document.querySelectorAll("#services li").forEach((li, index) => {
      li.classList.toggle("is-hot", propertyT > 0.3 + index * 0.12);
    });

    const gridT = layout.find((item) => item.scene === "grid").t;
    document.querySelectorAll("#grid-chain span").forEach((span, index) => {
      if (index % 2 === 1) return;
      span.classList.toggle("is-hot", gridT > 0.12 + (index / 2) * 0.12);
    });

    const processT = layout.find((item) => item.scene === "process").t;
    document.querySelectorAll("#rail li").forEach((li, index) => {
      li.classList.toggle("is-on", processT > index / 6);
      li.classList.toggle("is-hot", processT >= index / 6 && processT < (index + 1.15) / 6);
    });

    const why = layout.find((item) => item.scene === "why");
    const statements = document.querySelectorAll("#statements .statement");
    statements.forEach((el, index) => {
      const x = why.t * (statements.length - 1);
      el.style.opacity = String(clamp(1 - Math.abs(x - index) * 1.35, 0, 1));
    });

    const projects = layout.find((item) => item.scene === "projects");
    const track = document.getElementById("track");
    if (track && track.parentElement) {
      const max = Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
      const span = clamp((projects.t - 0.04) / 0.92, 0, 1);
      track.style.transform = "translate3d(" + (-span * max).toFixed(2) + "px,0,0)";
      const mid = window.innerWidth * 0.5;
      track.querySelectorAll(".project").forEach((fig) => {
        const rect = fig.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width * 0.5 - mid) / window.innerWidth;
        const scale = 1 - Math.min(0.35, dist) * 0.08;
        fig.style.transform = "scale(" + scale.toFixed(3) + ")";
      });
    }

    nav.classList.toggle("is-solid", window.scrollY > 24 || activeIndex > 0);
  }

  function renderParticles(sceneA, tA, sceneB, tB, blend) {
    const n = count();
    const lead = { x: 0, y: 0, color: AMBER };
    for (let i = 0; i < n; i++) {
      const a = particleAt(sceneA, i, tA);
      const b = blend > 0 ? particleAt(sceneB, i, tB) : a;
      const k = smooth(blend);
      const p = {
        x: mix(a.x, b.x, k),
        y: mix(a.y, b.y, k),
        size: mix(a.size, b.size, k),
        rot: mix(a.rot, b.rot || 0, k),
        alpha: mix(a.alpha, b.alpha, k),
        color: k < 0.5 ? a.color : b.color,
        shape: k < 0.5 ? a.shape : b.shape
      };
      if (!reduce) {
        p.x += Math.sin(time * 0.6 + i) * 0.6;
        p.y += Math.cos(time * 0.45 + i * 0.7) * 0.6;
      }
      paintParticle(p, 1);
      if (i === 0) lead.x = p.x, lead.y = p.y, lead.color = p.color;
    }
    const formed = sceneA === "origin" ? smooth(tA) : 1;
    const glowA = 0.22 * formed * (1 - blend * 0.4);
    if (glowA > 0.04) {
      const radius = 18 + 16 * formed;
      const glow = ctx.createRadialGradient(lead.x, lead.y, 0, lead.x, lead.y, radius);
      glow.addColorStop(0, rgb(lead.color, glowA));
      glow.addColorStop(1, rgb(lead.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lead.x, lead.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    const dt = Math.min(0.05, (now - frame.last) / 1000);
    frame.last = now;
    if (!reduce) time += dt;

    const active = readLayout();
    const current = layout[active];
    let sceneB = current.scene;
    let tB = current.t;
    let blend = 0;
    if (current.t > 0.8 && active < layout.length - 1 && current.scene !== "drift") {
      blend = (current.t - 0.8) / 0.2;
      sceneB = layout[active + 1].scene;
      tB = 0.28 + blend * 0.35;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);

    if (drawers[current.scene]) drawers[current.scene](current.t, Math.max(0.55, 1 - blend * 0.45));
    if (blend > 0.02 && drawers[sceneB] && sceneB !== current.scene) drawers[sceneB](tB, Math.max(0.4, blend));
    renderParticles(current.scene, current.t, sceneB, tB, blend);
    writeDom(active);

    requestAnimationFrame(frame);
  }

  function closeMenu() {
    menu.classList.remove("is-open");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("nav-open");
  }

  toggle.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
  });

  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  const tariffSlabs = [
    { uptoUnits: 50, ratePerUnit: 4.75, fixedCharge: 150 },
    { uptoUnits: 150, ratePerUnit: 6.0, fixedCharge: 150 },
    { uptoUnits: 300, ratePerUnit: 7.25, fixedCharge: 200 },
    { uptoUnits: 500, ratePerUnit: 7.95, fixedCharge: 250 },
    { uptoUnits: 99999, ratePerUnit: 8.5, fixedCharge: 300 }
  ];
  const unitsPerKWPerDay = 5.15;
  const calcBill = document.getElementById("calc-bill");
  const calcSlider = document.getElementById("calc-slider");
  let lastEstimate = null;

  function billFromUnits(totalUnits, freeUnits) {
    const billableUnits = freeUnits ? Math.max(0, totalUnits - 100) : totalUnits;
    let energyCharge = 0;
    let fixedCharge = 0;
    let remaining = billableUnits;
    let prevLimit = 0;
    for (const slab of tariffSlabs) {
      if (billableUnits <= slab.uptoUnits) {
        fixedCharge = slab.fixedCharge;
        break;
      }
    }
    for (const slab of tariffSlabs) {
      if (remaining <= 0) break;
      const slabUnits = Math.min(remaining, slab.uptoUnits - prevLimit);
      energyCharge += slabUnits * slab.ratePerUnit;
      remaining -= slabUnits;
      prevLimit = slab.uptoUnits;
    }
    return energyCharge + fixedCharge + billableUnits;
  }

  function unitsFromBill(billAmount, freeUnits) {
    for (let units = 1; units <= 20000; units++) {
      if (billFromUnits(units, freeUnits) >= billAmount) return units;
    }
    return 20000;
  }

  function centerSubsidy(kw) {
    if (kw <= 1) return 30000;
    if (kw === 2) return 60000;
    return 78000;
  }

  function formatUnits(n) {
    return Math.round(n).toLocaleString("en-IN");
  }

  function calculateSavings() {
    const bill = Math.min(100000, Math.max(500, parseInt(calcBill.value, 10) || 3000));
    const freeUnits = document.querySelector('input[name="free-units"]:checked').value === "yes";
    const monthlyUnits = unitsFromBill(bill, freeUnits);
    const dailyUnits = Math.round((monthlyUnits / 30) * 10) / 10;
    const exactKW = dailyUnits / unitsPerKWPerDay;
    const roundedKW = Math.min(50, Math.max(3, Math.ceil(exactKW)));
    const annualGeneration = Math.round(roundedKW * unitsPerKWPerDay * 365);
    document.getElementById("res-system").textContent = roundedKW + " kW";
    document.getElementById("res-annual").textContent = formatUnits(annualGeneration) + " units";
    document.getElementById("res-subsidy").textContent = "₹" + centerSubsidy(roundedKW).toLocaleString("en-IN");
    const note = document.getElementById("res-note");
    if (exactKW > 50) {
      note.textContent = "This bill is above a 50 kW system, the largest standard size we quote. Anything larger is designed after a site survey. Central subsidy applies to eligible residential DCR systems.";
    } else {
      note.textContent = "Standard sizes run from 3 kW to 50 kW. Central subsidy applies to eligible residential DCR systems. A site survey fixes brand, phase, and final price.";
    }
    lastEstimate = { kw: roundedKW, annual: annualGeneration, bill: bill };
  }

  function publishEstimate() {
    calculateSavings();
    const estimate = document.getElementById("estimate");
    if (estimate && lastEstimate) {
      estimate.textContent = "Estimated from your bill: " + lastEstimate.kw + " kW · " + formatUnits(lastEstimate.annual) + " units a year.";
    }
  }

  calcSlider.addEventListener("input", () => {
    calcBill.value = calcSlider.value;
    publishEstimate();
  });
  calcBill.addEventListener("input", () => {
    const value = parseInt(calcBill.value, 10);
    if (!Number.isNaN(value)) {
      calcSlider.value = String(Math.min(parseInt(calcSlider.max, 10), Math.max(parseInt(calcSlider.min, 10), value)));
    }
    publishEstimate();
  });
  document.querySelectorAll('input[name="free-units"]').forEach((input) => {
    input.addEventListener("change", publishEstimate);
  });

  document.getElementById("contact-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const size = lastEstimate ? "\nEstimated system: " + lastEstimate.kw + " kW" : "";
    const message = "Hi Ellipse Solar,\n\nI am interested in solar installation.\n\nName: " + form.name.value + "\nWhatsApp: " + form.phone.value + "\nPincode: " + form.pincode.value + "\nMonthly Bill: " + form.bill.value + size + "\n\nPlease share details and a quote.";
    window.open("https://wa.me/919216054155?text=" + encodeURIComponent(message), "_blank", "noopener");
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });

  resize();
  calculateSavings();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
})();
