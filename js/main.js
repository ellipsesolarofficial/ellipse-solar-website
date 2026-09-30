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

  function sag(a, b, u, drop) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + drop };
    return quad(a, mid, b, u);
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

  function gridNodes() {
    const f = focal();
    const s = unit();
    return [
      { x: f.x - 170 * s, y: f.y, c: AMBER },
      { x: f.x - 40 * s, y: f.y - 8 * s, c: WHITE },
      { x: f.x + 80 * s, y: f.y - 78 * s, c: TEAL },
      { x: f.x + 168 * s, y: f.y + 8 * s, c: TEAL },
      { x: f.x + 96 * s, y: f.y + 86 * s, c: TEAL },
      { x: f.x + 210 * s, y: f.y - 28 * s, c: WHITE },
      { x: f.x + 30 * s, y: f.y + 36 * s, c: IRIS }
    ];
  }

  const EDGES = [[0, 1], [1, 2], [1, 3], [1, 4], [1, 6], [2, 5], [3, 5], [4, 6], [6, 3]];

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
      const f = focal();
      const s = unit();
      const bw = 220 * s;
      const bh = 130 * s;
      const x = f.x - bw / 2;
      const y = f.y - bh / 2 + 16 * s;
      const slot = i % 3;
      const win = {
        x: x + 28 * s + slot * 64 * s + 14 * s,
        y: y + 56 * s
      };
      const approach = { x: x - 80 * s, y: f.y };
      const k = smooth(t);
      const p = lerpPt(approach, win, k);
      return {
        x: p.x + (hash(i, 2) - 0.5) * 10,
        y: p.y + (hash(i, 4) - 0.5) * 16,
        rot: 0,
        size: 1.5,
        alpha: 0.35 + hash(i, 5) * 0.5,
        color: k > 0.65 ? WHITE : IRIS,
        shape: "dot"
      };
    }

    if (scene === "grid") {
      const nodes = gridNodes();
      const edge = EDGES[i % EDGES.length];
      const forward = i % 2 === 0;
      const u = forward ? (hash(i, 3) * 0.3 + t * 0.9) % 1 : 1 - ((hash(i, 3) * 0.3 + t * 0.9) % 1);
      const p = lerpPt(nodes[edge[0]], nodes[edge[1]], u);
      return {
        x: p.x,
        y: p.y,
        rot: 0,
        size: 1.6,
        alpha: 0.4 + hash(i, 5) * 0.5,
        color: forward ? TEAL : WHITE,
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

  function drawOrigin(t, alpha) {
    if (alpha < 0.02) return;
    const c = sunCenter();
    const g = smooth(t);
    ctx.save();
    ctx.globalAlpha = alpha * g;
    ctx.strokeStyle = rgb(AMBER, 0.35);
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 58 * ring * unit(), 34 * ring * unit(), -0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 90 * unit());
    glow.addColorStop(0, rgb(AMBER, 0.16 * g));
    glow.addColorStop(1, rgb(AMBER, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 90 * unit(), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPanel(t, alpha) {
    if (alpha < 0.02) return;
    const appear = smooth(Math.min(1, t * 1.2));
    ctx.save();
    ctx.globalAlpha = alpha * appear;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    const frame = [panelPoint(0, 0), panelPoint(1, 0), panelPoint(1, 1), panelPoint(0, 1)];
    ctx.moveTo(frame[0].x, frame[0].y);
    frame.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    const cols = 8;
    const rows = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
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
    ctx.strokeStyle = rgb(AMBER, 0.75);
    [0.33, 0.66].forEach((u) => {
      const a = panelPoint(u, 0.04);
      const b = panelPoint(u, 0.96);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    if (t > 0.4) {
      const pulse = (t * 3) % 1;
      const hit = cellFor(Math.floor(t * 17) % 40);
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, 3 + pulse * 14, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(WHITE, (1 - pulse) * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGenerate(t, alpha) {
    if (alpha < 0.02) return;
    const g = panelGeom();
    const exit = { x: g.cx + g.pw * 0.08, y: g.cy + g.ph * 0.78 };
    ctx.save();
    ctx.lineWidth = 1;
    for (let n = 0; n < 5; n++) {
      const cell = cellFor(n * 7);
      const mid = { x: mix(cell.x, exit.x, 0.5), y: mix(cell.y, exit.y, 0.4) };
      ctx.beginPath();
      for (let s = 0; s <= 16; s++) {
        const p = quad(cell, mid, exit, s / 16);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = rgb(IRIS, alpha * 0.35 * smooth(t));
      ctx.stroke();
    }
    ctx.restore();
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
    ctx.moveTo(x - 36 * s, f.y);
    ctx.lineTo(x, f.y);
    ctx.moveTo(x + bw, f.y);
    ctx.lineTo(x + bw + 42 * s, f.y);
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

  function drawProperty(t, alpha) {
    if (alpha < 0.02) return;
    const f = focal();
    const s = unit();
    const bw = 230 * s;
    const bh = 132 * s;
    const x = f.x - bw / 2;
    const y = f.y - bh / 2 + 18 * s;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.strokeRect(x, y, bw, bh);
    ctx.beginPath();
    ctx.moveTo(x - 14 * s, y);
    ctx.lineTo(x + bw + 14 * s, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 70 * s, f.y);
    ctx.lineTo(x, f.y);
    ctx.strokeStyle = rgb(IRIS, 0.8);
    ctx.stroke();
    const roofA = smooth(t);
    ctx.globalAlpha = alpha * (0.25 + roofA * 0.75);
    ctx.strokeStyle = rgb(AMBER, 0.9);
    const rx = x + 18 * s;
    const ry = y - 34 * s;
    const rw = bw - 36 * s;
    const rh = 26 * s;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.beginPath();
    for (let c = 1; c < 6; c++) {
      ctx.moveTo(rx + (rw / 6) * c, ry);
      ctx.lineTo(rx + (rw / 6) * c, ry + rh);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const wa = smooth((t - 0.22 - i * 0.16) / 0.28);
      ctx.fillStyle = rgb(WHITE, alpha * (0.04 + wa * 0.82));
      ctx.fillRect(x + 26 * s + i * 68 * s, y + 36 * s, 32 * s, 46 * s);
    }
    ctx.restore();
  }

  function drawGrid(t, alpha) {
    if (alpha < 0.02) return;
    const nodes = gridNodes();
    ctx.save();
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha * smooth(Math.min(1, t * 1.3));
    EDGES.forEach((edge) => {
      ctx.beginPath();
      ctx.moveTo(nodes[edge[0]].x, nodes[edge[0]].y);
      ctx.lineTo(nodes[edge[1]].x, nodes[edge[1]].y);
      ctx.strokeStyle = rgb(TEAL, 0.45);
      ctx.stroke();
    });
    nodes.forEach((node) => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3.2, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(node.c, 0.9);
      ctx.stroke();
    });
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
      drawOrigin(1 - t, alpha * (1 - t));
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
    if (scene === "origin") return t < 0.9 ? 1 : clamp((1 - t) / 0.1, 0, 1);
    const fadeIn = t < 0.08 ? Math.max(0.65, t / 0.08) : 1;
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

    const panelItem = layout.find((item) => item.scene === "panel");
    if (panelItem) {
      document.querySelectorAll("#panel-flow li").forEach((li, index) => {
        li.classList.toggle("is-hot", panelItem.t > [0.15, 0.42, 0.7][index]);
      });
    }

    const convertItem = layout.find((item) => item.scene === "convert");
    if (convertItem) {
      document.querySelectorAll("#convert-chain span").forEach((span, index) => {
        if (index % 2 === 1) return;
        const step = [0.15, 0.4, 0.7][index / 2];
        span.classList.toggle("is-hot", convertItem.t > step);
      });
    }

    const propertyItem = layout.find((item) => item.scene === "property");
    if (propertyItem) {
      document.querySelectorAll("#services li").forEach((li, index) => {
        li.classList.toggle("is-hot", propertyItem.t > 0.3 + index * 0.12);
      });
    }

    const gridItem = layout.find((item) => item.scene === "grid");
    if (gridItem) {
      document.querySelectorAll("#grid-chain span").forEach((span, index) => {
        if (index % 2 === 1) return;
        span.classList.toggle("is-hot", gridItem.t > 0.12 + (index / 2) * 0.12);
      });
    }

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
      const span = clamp((projects.t - 0.06) / 0.88, 0, 1);
      track.style.transform = "translate3d(" + (-span * max).toFixed(2) + "px,0,0)";
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

  function filmProgress() {
    const el = document.getElementById("film");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const travel = Math.max(1, el.offsetHeight - window.innerHeight);
    const cover = (Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / window.innerHeight;
    return { p: clamp(-rect.top / travel, 0, 1), cover: clamp(cover, 0, 1) };
  }

  function span(p, a, b) {
    const fade = 0.075;
    if (p >= b || (a > 0 && p <= a)) return 0;
    const inn = a <= 0 ? 1 : clamp((p - a) / fade, 0, 1);
    const out = clamp((b - p) / fade, 0, 1);
    return smooth(Math.min(inn, out));
  }

  function along(p, a, b) {
    return clamp((p - a) / Math.max(0.0001, b - a), 0, 1);
  }

  function filmLayout() {
    const wide = !narrow();
    const pw = w * (wide ? 0.46 : 0.8);
    const ph = pw * 0.56;
    const px = (wide ? w * 0.62 : w * 0.5) - pw / 2;
    const py = (wide ? h * 0.4 : h * 0.3) - ph / 2;
    const hw = w * (wide ? 0.32 : 0.58);
    const hh = hw * 0.72;
    return {
      sun: { x: w * (wide ? 0.58 : 0.5), y: h * (wide ? 0.36 : 0.3) },
      sunR: Math.min(w, h) * (wide ? 0.22 : 0.17),
      panel: { x: px, y: py, w: pw, h: ph },
      house: {
        x: wide ? w * 0.045 : (w - hw) / 2,
        y: wide ? h * 0.18 : h * 0.1,
        w: hw,
        h: hh
      }
    };
  }

  function panelCell(col, row, cols, rows) {
    const g = filmLayout().panel;
    return {
      x: g.x + ((col + 0.5) / cols) * g.w,
      y: g.y + ((row + 0.5) / rows) * g.h
    };
  }

  function routePoint(u) {
    const g = filmLayout();
    const panelTop = { x: g.panel.x + g.panel.w * 0.5, y: g.panel.y };
    const panelOut = { x: g.panel.x + g.panel.w * 0.72, y: g.panel.y + g.panel.h };
    const inlet = { x: g.house.x + g.house.w * 0.5, y: g.house.y + g.house.h * 0.55 };
    const core = { x: g.house.x + g.house.w * 0.35, y: g.house.y + g.house.h * 0.42 };
    const exit = { x: g.house.x + g.house.w, y: g.house.y + g.house.h * 0.48 };
    const far = { x: Math.min(w * 0.92, exit.x + w * 0.28), y: h * 0.24 };
    const pts = [g.sun, panelTop, panelOut, inlet, core, exit, far];
    const scaled = clamp(u, 0, 0.999) * (pts.length - 1);
    const seg = Math.floor(scaled);
    return lerpPt(pts[seg], pts[Math.min(pts.length - 1, seg + 1)], scaled - seg);
  }

  function headU(p) {
    if (p < 0.1) return 0.04 + p * 0.2;
    if (p < 0.24) return mix(0.06, 0.3, (p - 0.1) / 0.14);
    if (p < 0.4) return mix(0.3, 0.5, (p - 0.24) / 0.16);
    if (p < 0.56) return mix(0.5, 0.68, (p - 0.4) / 0.16);
    if (p < 0.74) return mix(0.68, 0.8, (p - 0.56) / 0.18);
    return mix(0.8, 1, clamp((p - 0.74) / 0.26, 0, 1));
  }

  function drawSunBody(p, alpha) {
    if (alpha < 0.02) return;
    const g = filmLayout();
    const zoom = 1 + along(p, 0, 0.22) * 0.22;
    const R = g.sunR * zoom;
    const c = g.sun;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(c.x, c.y, R * 0.2, c.x, c.y, R * 2.3);
    glow.addColorStop(0, rgb(AMBER, 0.35));
    glow.addColorStop(0.45, rgb(AMBER, 0.08));
    glow.addColorStop(1, rgb(AMBER, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R * 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb([255, 214, 120], 0.92);
    ctx.beginPath();
    ctx.arc(c.x, c.y, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgb(AMBER, 0.85);
    ctx.lineWidth = 1.6;
    const rays = narrow() ? 16 : 22;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + (reduce ? 0 : time * 0.06);
      const inner = R * 0.5;
      const outer = R * (1.15 + (i % 3) * 0.18);
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * inner, c.y + Math.sin(a) * inner);
      ctx.lineTo(c.x + Math.cos(a) * outer, c.y + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.45;
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 2; ring++) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, R * (1.15 + ring * 0.45), R * (0.42 + ring * 0.16), -0.4, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(AMBER, 0.35);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.2;
    ctx.beginPath();
    ctx.ellipse(c.x - R * 1.8, c.y + R * 0.2, R * 0.28, R * 0.1, 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawArray(p, alpha) {
    if (alpha < 0.02) return;
    const g = filmLayout().panel;
    const open = smooth(Math.min(1, 0.25 + along(p, 0.18, 0.4)));
    ctx.save();
    ctx.globalAlpha = alpha * open;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    const cols = 8;
    const rows = 5;
    for (let c = 1; c < cols; c++) {
      ctx.beginPath();
      ctx.moveTo(g.x + (g.w / cols) * c, g.y);
      ctx.lineTo(g.x + (g.w / cols) * c, g.y + g.h);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(g.x, g.y + (g.h / rows) * r);
      ctx.lineTo(g.x + g.w, g.y + (g.h / rows) * r);
      ctx.stroke();
    }
    ctx.strokeStyle = rgb(AMBER, 0.8);
    [0.34, 0.67].forEach((u) => {
      ctx.beginPath();
      ctx.moveTo(g.x + g.w * u, g.y + 6);
      ctx.lineTo(g.x + g.w * u, g.y + g.h - 6);
      ctx.stroke();
    });
    const hits = Math.floor(along(p, 0.18, 0.5) * 6);
    for (let n = 0; n < hits; n++) {
      const pulse = ((reduce ? 0 : time * 0.35) + n * 0.17) % 1;
      const cell = panelCell(n % cols, n % rows, cols, rows);
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, 3 + pulse * 14, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(pulse > 0.55 ? WHITE : IRIS, (1 - pulse) * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCable(p, alpha) {
    if (alpha < 0.02) return;
    const g = filmLayout();
    const from = { x: g.panel.x + g.panel.w * 0.72, y: g.panel.y + g.panel.h };
    const to = { x: g.house.x + g.house.w, y: g.house.y + g.house.h * 0.42 };
    const mid = { x: (from.x + to.x) / 2, y: Math.max(from.y, to.y) + 36 * unit() };
    const reach = smooth(along(p, 0.36, 0.62));
    ctx.save();
    ctx.strokeStyle = rgb(IRIS, 0.9 * alpha);
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = reduce ? 0 : -time * 52;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = (i / 24) * reach;
      const pt = quad(from, mid, to, u);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const head = quad(from, mid, to, reach);
    ctx.fillStyle = rgb(WHITE, alpha);
    ctx.beginPath();
    ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHome(p, alpha) {
    if (alpha < 0.02) return;
    const g = filmLayout().house;
    const t = clamp((p - 0.5) / 0.28, 0, 1);
    const s = unit();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    const roof = g.y + g.h * 0.28;
    ctx.beginPath();
    ctx.moveTo(g.x - 12, roof);
    ctx.lineTo(g.x + g.w / 2, g.y);
    ctx.lineTo(g.x + g.w + 12, roof);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(g.x, roof, g.w, g.h - (roof - g.y));
    const doorX = g.x + g.w * 0.42;
    const doorY = g.y + g.h * 0.62;
    ctx.strokeRect(doorX, doorY, g.w * 0.16, g.h - (doorY - g.y));
    const spots = [[0.12, 0.4], [0.62, 0.4], [0.12, 0.68], [0.62, 0.68]];
    spots.forEach((spot, index) => {
      const on = smooth((t - index * 0.14) / 0.18);
      const wx = g.x + g.w * spot[0];
      const wy = g.y + g.h * spot[1];
      const ww = g.w * 0.2;
      const wh = g.h * 0.16;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.fillStyle = rgb(on > 0.45 ? [255, 236, 196] : WHITE, 0.05 + on * 0.88);
      ctx.fillRect(wx, wy, ww, wh);
    });
    const porch = smooth((t - 0.72) / 0.2);
    if (porch > 0.05) {
      ctx.fillStyle = rgb(AMBER, porch * 0.85);
      ctx.beginPath();
      ctx.arc(g.x + g.w * 0.5, g.y + g.h + 8 * s, 4 + porch * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGridNet(p, alpha) {
    if (alpha < 0.02) return;
    const g = filmLayout().house;
    const s = unit();
    const start = { x: g.x + g.w, y: g.y + g.h * 0.48 };
    const towers = [
      { x: start.x + w * 0.12, y: h * 0.22 },
      { x: start.x + w * 0.24, y: h * 0.16 },
      { x: Math.min(w * 0.94, start.x + w * 0.36), y: h * 0.24 }
    ];
    const reveal = smooth(along(p, 0.7, 0.92));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rgb(TEAL, 0.9);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 9]);
    ctx.lineDashOffset = reduce ? 0 : -time * 40;
    let prev = start;
    towers.forEach((tower, index) => {
      if ((index + 1) / towers.length > reveal + 0.2) return;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const pt = sag(prev, tower, i / 16, 28 * s);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      prev = tower;
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.3;
    towers.forEach((tower, index) => {
      if (index / towers.length > reveal) return;
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y - 40 * s);
      ctx.lineTo(tower.x, tower.y + 48 * s);
      ctx.moveTo(tower.x - 16 * s, tower.y + 48 * s);
      ctx.lineTo(tower.x, tower.y + 28 * s);
      ctx.lineTo(tower.x + 16 * s, tower.y + 48 * s);
      ctx.moveTo(tower.x - 22 * s, tower.y - 22 * s);
      ctx.lineTo(tower.x + 22 * s, tower.y - 22 * s);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawStream(p) {
    const end = headU(p);
    const countDots = narrow() ? 36 : 70;
    for (let i = 0; i < countDots; i++) {
      const u = end - i * 0.012;
      if (u <= 0) continue;
      const pt = routePoint(u + (reduce ? 0 : Math.sin(time * 0.8 + i) * 0.002));
      const color = u < 0.32 ? AMBER : u < 0.55 ? IRIS : u < 0.8 ? WHITE : TEAL;
      ctx.fillStyle = rgb(color, 0.35 + (1 - i / countDots) * 0.6);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, i === 0 ? 5 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
      const a = hash(i, 2) * Math.PI * 2 + (reduce ? 0 : time * 0.04);
      const sun = filmLayout().sun;
      const rad = filmLayout().sunR * (1.2 + hash(i, 3));
      ctx.fillStyle = rgb(i % 4 === 0 ? WHITE : AMBER, 0.25);
      ctx.fillRect(sun.x + Math.cos(a) * rad, sun.y + Math.sin(a) * rad, 1.4, 1.4);
    }
  }

  function drawFilm(p, cover) {
    ctx.save();
    ctx.globalAlpha = cover;
    const sunA = Math.max(span(p, 0, 0.34), p < 0.08 ? 1 : 0);
    if (sunA > 0.02) drawSunBody(p, sunA);
    if (span(p, 0.16, 0.58) > 0.02) drawArray(p, span(p, 0.16, 0.58));
    if (span(p, 0.34, 0.72) > 0.02) drawCable(p, span(p, 0.34, 0.72));
    if (span(p, 0.44, 0.9) > 0.02) drawHome(p, span(p, 0.44, 0.9));
    if (span(p, 0.68, 1.05) > 0.02) drawGridNet(p, span(p, 0.68, 1.05));
    drawStream(p);
    ctx.restore();
  }

  function drawFilmIfVisible() {
    const state = filmProgress();
    if (!state || state.cover < 0.08) return false;
    drawFilm(state.p, state.cover);
    return state.cover > 0.72;
  }

  function writeFilm() {
    const state = filmProgress();
    if (!state) return;
    const p = state.p;
    document.querySelectorAll(".beat, .meter").forEach((node) => {
      const a = parseFloat(node.dataset.start);
      const b = parseFloat(node.dataset.end);
      const fade = 0.04;
      let opacity = 0;
      if (p >= a && p <= b) {
        const inn = a <= 0 ? 1 : clamp((p - a) / fade, 0, 1);
        const out = clamp((b - p) / fade, 0, 1);
        opacity = Math.min(inn, out);
      }
      node.style.opacity = String(opacity);
      node.style.visibility = opacity <= 0 ? "hidden" : "visible";
    });
    const homeT = clamp((p - 0.5) / 0.28, 0, 1);
    const amount = 8450 * (1 - smooth(homeT));
    const meter = document.getElementById("meter");
    const value = document.getElementById("meter-value");
    if (!meter || !value) return;
    const shown = amount < 12 ? 0 : Math.round(amount / 10) * 10;
    meter.classList.toggle("is-zero", shown === 0 && homeT > 0.9);
    const label = shown === 0 ? "₹0" : "₹" + shown.toLocaleString("en-IN");
    if (value.textContent !== label) value.textContent = label;
  }

  function paint(now) {
    try {
    if (!paint.last) paint.last = now;
    const dt = Math.min(0.05, (now - paint.last) / 1000);
    paint.last = now;
    if (!reduce) time += dt;

    const active = readLayout();
    const current = layout[active];
    let sceneB = current.scene;
    let tB = current.t;
    let blend = 0;
    if (current.t > 0.62 && active < layout.length - 1 && current.scene !== "drift") {
      blend = (current.t - 0.62) / 0.38;
      sceneB = layout[active + 1].scene;
      tB = 0.35;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);

    writeDom(active);
    writeFilm();
    const filmOn = drawFilmIfVisible();
    if (!filmOn) {
      if (drawers[current.scene]) drawers[current.scene](Math.max(current.t, 0.2), Math.max(0.55, 1 - blend * 0.4));
      if (blend > 0.02 && drawers[sceneB] && sceneB !== current.scene) drawers[sceneB](Math.max(tB, 0.25), Math.max(0.4, blend));
      renderParticles(current.scene, current.t, sceneB, tB, blend);
    }
    } catch (err) {
      window.__filmError = String(err && err.stack || err);
    }
  }

  function frame(now) {
    paint(now);
    requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", () => paint(performance.now()), { passive: true });

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
