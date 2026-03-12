import { useEffect, useRef, useCallback } from 'react';

// ─── colour helpers ────────────────────────────────────────────────────────
function hexRgb(hex = '#4af') {
  const h = hex.replace('#', '').padEnd(6, '0');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgba(hex, a) { const { r, g, b } = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpPos(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }

// ─── ring layout ──────────────────────────────────────────────────────────
function ringLayout(n, radius, cx = 0, cy = 0) {
  if (n === 0) return [];
  if (n === 1) return [{ x: cx, y: cy - radius }];
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i / n) - Math.PI / 2;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  });
}

function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── keyword extraction ───────────────────────────────────────────────────
function getKeywords(node) {
  // Use tags if available, else first 2 words of name
  if (node.tags && node.tags.length > 0) return node.tags.slice(0, 2);
  const words = node.name.split(' ');
  return words.length > 2 ? [words[0], words[words.length - 1]] : words;
}

// ─── main component ────────────────────────────────────────────────────────
export default function KnowledgeGraph({
  nodes = [], edges = [],
  onNodeClick, onNodeHover,
  selectedNodeId, activeParentId, pathNodeIds = [],
}) {
  const cvs = useRef(null);
  const raf = useRef(null);
  const st = useRef({
    // pan/zoom
    ox: 0, oy: 0, scale: 1,
    targetOx: 0, targetOy: 0, targetScale: 1,
    // drag
    drag: false, dsx: 0, dsy: 0, dox: 0, doy: 0,
    // nodes
    pos: {},        // id → {x,y}        current (animated)
    targetPos: {},  // id → {x,y}        where they're heading
    spawnTime: {},  // id → tick when spawned (for scale-in)
    data: {},       // id → node object
    hov: null,
    tick: 0,
    stars: null,
    // particles on path edges
    particles: [],
  });

  // ─── compute target positions ───────────────────────────────────────────
  const computeTargets = useCallback((nodes, parentId) => {
    const s = st.current;
    const newTargets = { ...s.targetPos };
    const data = {};
    nodes.forEach(n => data[n.id] = n);

    const center = nodes.find(n => n.id === parentId)
      || nodes.find(n => n.depth === 0)
      || nodes[0];
    if (!center) return;

    // centre node always at 0,0
    newTargets[center.id] = { x: 0, y: 0 };

    // direct children via edges
    const childIds = edges
      .filter(e => e.source === center.id)
      .map(e => e.target)
      .filter(id => data[id]);

    if (childIds.length) {
      const ring = ringLayout(childIds.length, 210, 0, 0);
      childIds.forEach((id, i) => { newTargets[id] = ring[i]; });
    }

    // anything without a target yet — outer ring
    const unplaced = nodes.filter(n => !newTargets[n.id]);
    if (unplaced.length) {
      const ring = ringLayout(unplaced.length, 380, 0, 0);
      unplaced.forEach((n, i) => { newTargets[n.id] = ring[i]; });
    }

    // initialise current pos for brand-new nodes (spawn at parent pos)
    const parentPos = s.pos[center.id] || newTargets[center.id] || { x: 0, y: 0 };
    nodes.forEach(n => {
      if (!s.pos[n.id]) {
        s.pos[n.id] = { ...parentPos };
        s.spawnTime[n.id] = s.tick;
      }
    });

    s.targetPos = newTargets;
    s.data = data;
  }, [edges]);

  useEffect(() => {
    if (nodes.length) computeTargets(nodes, activeParentId);
  }, [nodes, activeParentId, computeTargets]);

  // smooth camera pan to new parent
  useEffect(() => {
    if (!activeParentId) return;
    st.current.targetOx = 0;
    st.current.targetOy = 0;
  }, [activeParentId]);

  // spawn particles on path edges
  useEffect(() => {
    const s = st.current;
    // refresh path particles
    s.particles = s.particles.filter(p => pathNodeIds.includes(p.src) || pathNodeIds.includes(p.dst));
    if (pathNodeIds.length >= 2) {
      for (let i = 0; i < pathNodeIds.length - 1; i++) {
        const src = pathNodeIds[i], dst = pathNodeIds[i + 1];
        const already = s.particles.filter(p => p.src === src && p.dst === dst).length;
        for (let j = already; j < 3; j++) {
          s.particles.push({ src, dst, t: Math.random(), speed: 0.003 + Math.random() * 0.004 });
        }
      }
    }
  }, [pathNodeIds]);

  // ─── draw loop ──────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c = cvs.current; if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height, s = st.current;
    const tick = s.tick++;

    // lerp camera
    s.ox = lerp(s.ox, s.targetOx, 0.07);
    s.oy = lerp(s.oy, s.targetOy, 0.07);
    s.scale = lerp(s.scale, s.targetScale, 0.07);

    // lerp node positions
    Object.keys(s.targetPos).forEach(id => {
      if (!s.pos[id]) s.pos[id] = { ...s.targetPos[id] };
      s.pos[id] = lerpPos(s.pos[id], s.targetPos[id], 0.06);
    });

    // advance particles
    s.particles.forEach(p => { p.t += p.speed; if (p.t > 1) p.t -= 1; });

    ctx.clearRect(0, 0, W, H);

    // background
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#0e1020');
    bg.addColorStop(0.5, '#080a12');
    bg.addColorStop(1, '#050508');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // stars
    if (!s.stars) s.stars = Array.from({ length: 160 }, () => ({
      x: (Math.random() - 0.5) * 3000, y: (Math.random() - 0.5) * 3000,
      r: Math.random() * 1.4 + 0.2, b: Math.random(),
      twinkle: Math.random() * Math.PI * 2,
    }));
    s.stars.forEach(star => {
      const sx = (star.x + s.ox) * s.scale + W / 2;
      const sy = (star.y + s.oy) * s.scale + H / 2;
      if (sx < -2 || sx > W + 2 || sy < -2 || sy > H + 2) return;
      const alpha = 0.15 + 0.2 * Math.sin(tick * 0.007 + star.twinkle);
      ctx.fillStyle = `rgba(180,190,230,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, star.r * Math.min(s.scale, 1.5), 0, Math.PI * 2);
      ctx.fill();
    });

    // nebula glow blobs (static decoration)
    [
      { x: -300, y: -200, r: 350, c: '30,40,120' },
      { x: 400, y: 200, r: 280, c: '60,20,100' },
      { x: 100, y: 300, r: 220, c: '20,70,80' },
    ].forEach(blob => {
      const bx = (blob.x + s.ox) * s.scale + W / 2;
      const by = (blob.y + s.oy) * s.scale + H / 2;
      const br = blob.r * s.scale;
      const ng = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      ng.addColorStop(0, `rgba(${blob.c},0.045)`);
      ng.addColorStop(1, `rgba(${blob.c},0)`);
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = ng; ctx.fill();
    });

    const toS = (wx, wy) => ({
      x: (wx + s.ox) * s.scale + W / 2,
      y: (wy + s.oy) * s.scale + H / 2,
    });

    // path edge set
    const pathSet = new Set();
    for (let i = 0; i < pathNodeIds.length - 1; i++)
      pathSet.add(`${pathNodeIds[i]}>${pathNodeIds[i + 1]}`);
    const isPE = (a, b) => pathSet.has(`${a}>${b}`) || pathSet.has(`${b}>${a}`);

    // ── draw edges ──────────────────────────────────────────────────────────
    edges.forEach(e => {
      const sp = s.pos[e.source], tp = s.pos[e.target];
      if (!sp || !tp) return;
      const ss = toS(sp.x, sp.y), ts = toS(tp.x, tp.y);
      const isPath = isPE(e.source, e.target);
      const isLocal = e.source === activeParentId || e.target === activeParentId;

      // curved control point
      const mx = (ss.x + ts.x) / 2 + (sp.y - tp.y) * 0.15;
      const my = (ss.y + ts.y) / 2 + (tp.x - sp.x) * 0.15;

      ctx.save();
      if (isPath) {
        const p = 0.45 + 0.35 * Math.sin(tick * 0.05);
        ctx.strokeStyle = `rgba(120,210,255,${p})`;
        ctx.lineWidth = 2 * s.scale;
        ctx.shadowColor = '#78d2ff'; ctx.shadowBlur = 12;
        ctx.setLineDash([10, 6]); ctx.lineDashOffset = -(tick * 0.6);
      } else if (isLocal) {
        const nd = s.data[e.target];
        const nc = nd?.color || '#4af';
        ctx.strokeStyle = rgba(nc, 0.35);
        ctx.lineWidth = 1.4 * s.scale;
      } else {
        ctx.strokeStyle = 'rgba(100,120,180,0.1)';
        ctx.lineWidth = 0.8 * s.scale;
      }
      ctx.beginPath(); ctx.moveTo(ss.x, ss.y);
      ctx.quadraticCurveTo(mx, my, ts.x, ts.y);
      ctx.stroke(); ctx.restore();

      // arrow on path edges
      if (isPath) {
        const si = pathNodeIds.indexOf(e.source), ti = pathNodeIds.indexOf(e.target);
        const [fx, fy, tx2, ty2] = si < ti
          ? [ss.x, ss.y, ts.x, ts.y]
          : [ts.x, ts.y, ss.x, ss.y];
        const ang = Math.atan2(ty2 - fy, tx2 - fx), sz = 7 * s.scale;
        ctx.save();
        ctx.fillStyle = `rgba(120,210,255,${0.7 + 0.25 * Math.sin(tick * 0.05)})`;
        ctx.shadowColor = '#78d2ff'; ctx.shadowBlur = 8;
        ctx.translate(tx2, ty2); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-sz, -sz * 0.5); ctx.lineTo(-sz, sz * 0.5);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }

      // particles on path edges
      if (isPath) {
        s.particles
          .filter(p => (p.src === e.source && p.dst === e.target) || (p.src === e.target && p.dst === e.source))
          .forEach(p => {
            const t = p.t;
            const px = (1 - t) * (1 - t) * ss.x + 2 * (1 - t) * t * mx + t * t * ts.x;
            const py = (1 - t) * (1 - t) * ss.y + 2 * (1 - t) * t * my + t * t * ts.y;
            ctx.save();
            ctx.fillStyle = 'rgba(160,230,255,0.9)';
            ctx.shadowColor = '#a0e6ff'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(px, py, 2.5 * s.scale, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
          });
      }
    });

    // ── draw nodes ──────────────────────────────────────────────────────────
    nodes.forEach(node => {
      const wp = s.pos[node.id]; if (!wp) return;
      const { x, y } = toS(wp.x, wp.y);

      const isRoot = node.id === activeParentId;
      const isSel = node.id === selectedNodeId;
      const isHov = s.hov === node.id;
      const isPath = pathNodeIds.includes(node.id);
      const col = node.color || '#4af';

      // scale-in animation for newly spawned nodes
      const spawnAge = s.spawnTime[node.id] !== undefined ? tick - s.spawnTime[node.id] : 999;
      const spawnScale = spawnAge < 40 ? Math.min(1, spawnAge / 40) : 1;
      const baseR = (isRoot ? 34 : isPath ? 22 : 18) * s.scale * spawnScale;
      if (baseR < 1) return;

      const { r, g, b } = hexRgb(col);

      // ── outer atmospheric glow ──
      const glowR = baseR * (isRoot ? 3.5 : isHov ? 2.8 : 2.2);
      const glow = ctx.createRadialGradient(x, y, baseR * 0.3, x, y, glowR);
      const ga = isRoot ? 0.18 : isHov || isSel ? 0.12 : isPath ? 0.1 : 0.05;
      glow.addColorStop(0, `rgba(${r},${g},${b},${ga})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow; ctx.fill();

      // ── animated pulse rings (root only) ──
      if (isRoot) {
        [1.6, 2.2, 3.0].forEach((mult, ri) => {
          const pr = baseR * mult;
          const alpha = (0.4 - ri * 0.12) * (0.6 + 0.4 * Math.sin(tick * 0.05 - ri * 1.2));
          ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = (1.8 - ri * 0.4) * s.scale;
          ctx.stroke();
        });
      }

      // ── selection / hover ring ──
      if (isSel || isHov) {
        ctx.beginPath(); ctx.arc(x, y, baseR + 6 * s.scale * spawnScale, 0, Math.PI * 2);
        ctx.strokeStyle = isSel ? rgba(col, 0.9) : rgba(col, 0.5);
        ctx.lineWidth = 2 * s.scale;
        ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      // ── path ring ──
      if (isPath && !isRoot) {
        ctx.beginPath(); ctx.arc(x, y, baseR + 5 * s.scale * spawnScale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(120,210,255,0.6)';
        ctx.lineWidth = 1.5 * s.scale; ctx.stroke();
      }

      // ── main node body ──
      const bodyGrad = ctx.createRadialGradient(
        x - baseR * 0.3, y - baseR * 0.35, 0, x, y, baseR
      );
      bodyGrad.addColorStop(0, `rgba(${Math.min(r + 70, 255)},${Math.min(g + 70, 255)},${Math.min(b + 80, 255)},0.95)`);
      bodyGrad.addColorStop(0.55, `rgba(${r},${g},${b},0.85)`);
      bodyGrad.addColorStop(1, `rgba(${Math.max(r - 40, 0)},${Math.max(g - 40, 0)},${Math.max(b - 40, 0)},0.9)`);
      ctx.beginPath(); ctx.arc(x, y, baseR, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad; ctx.fill();

      // border
      ctx.strokeStyle = rgba(col, isRoot ? 0.95 : 0.6);
      ctx.lineWidth = (isRoot ? 2 : 1.3) * s.scale;
      if (isRoot) { ctx.shadowColor = col; ctx.shadowBlur = 16; }
      ctx.stroke(); ctx.shadowBlur = 0;

      // inner shine
      const shine = ctx.createRadialGradient(x - baseR * 0.35, y - baseR * 0.38, 0, x, y, baseR * 0.75);
      shine.addColorStop(0, 'rgba(255,255,255,0.22)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.arc(x, y, baseR, 0, Math.PI * 2);
      ctx.fillStyle = shine; ctx.fill();

      // ── icon (inside root node) ──
      if (node.icon && (isRoot || isPath)) {
        const iconSize = Math.round(baseR * (isRoot ? 0.6 : 0.5));
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.85;
        ctx.fillText(node.icon, x, isRoot ? y - 4 * s.scale : y);
        ctx.globalAlpha = 1;
      }

      // ── node name (below node) ──
      const nameSize = Math.max(9, Math.min(13, (isRoot ? 13 : 10) * s.scale));
      ctx.font = `${isRoot ? 600 : 500} ${nameSize}px 'IBM Plex Sans', system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const name = node.name.length > 22 ? node.name.slice(0, 20) + '…' : node.name;
      const nw = ctx.measureText(name).width;
      const ny = y + baseR + 8 * s.scale * spawnScale;

      // name pill background
      ctx.fillStyle = 'rgba(8,10,18,0.88)';
      rrPath(ctx, x - nw / 2 - 7, ny - 2, nw + 14, nameSize + 5, 4);
      ctx.fill();

      ctx.fillStyle = isRoot ? '#e8f4ff'
        : isPath ? '#78d2ff'
          : isSel || isHov ? '#c8d8f0'
            : '#7a88a0';
      ctx.fillText(name, x, ny);

      // ── keywords / tags (below name, only for root + nearby nodes) ──
      if (isRoot || isHov || isSel) {
        const kws = getKeywords(node);
        if (kws.length > 0) {
          const kwY = ny + nameSize + 6 * s.scale;
          const kwSize = Math.max(8, Math.min(10, 9 * s.scale));
          ctx.font = `400 ${kwSize}px 'IBM Plex Mono', monospace`;
          kws.forEach((kw, ki) => {
            const kwLabel = `#${kw}`;
            const kwW = ctx.measureText(kwLabel).width;
            const kwX = ki === 0
              ? x - (kws.length > 1 ? (kwW / 2 + 4) : 0)
              : x + (kwW / 2 + 4);
            const xOff = kws.length === 1 ? x : kwX;
            ctx.fillStyle = rgba(col, 0.18);
            rrPath(ctx, xOff - kwW / 2 - 5, kwY - 1, kwW + 10, kwSize + 4, 3);
            ctx.fill();
            ctx.fillStyle = rgba(col, 0.75);
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(kwLabel, xOff, kwY);
          });
        }
      }
    });

    raf.current = requestAnimationFrame(draw);
  }, [nodes, edges, selectedNodeId, activeParentId, pathNodeIds]);

  useEffect(() => {
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [draw]);

  // ── resize ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const c = cvs.current; if (!c) return;
      c.width = c.offsetWidth; c.height = c.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (cvs.current?.parentElement) ro.observe(cvs.current.parentElement);
    return () => ro.disconnect();
  }, []);

  // ── hit test ──────────────────────────────────────────────────────────────
  const hit = useCallback((cx, cy) => {
    const c = cvs.current; if (!c) return null;
    const rect = c.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top;
    const s = st.current, W = c.width, H = c.height;
    // test in reverse order so topmost (root) wins
    for (const node of [...nodes].reverse()) {
      const wp = s.pos[node.id]; if (!wp) continue;
      const sx = (wp.x + s.ox) * s.scale + W / 2;
      const sy = (wp.y + s.oy) * s.scale + H / 2;
      const r = (node.id === activeParentId ? 34 : 18) * s.scale;
      if ((mx - sx) ** 2 + (my - sy) ** 2 <= r * r) return node;
    }
    return null;
  }, [nodes, activeParentId]);

  // ── pointer handlers ──────────────────────────────────────────────────────
  const onMove = useCallback(e => {
    const s = st.current;
    if (s.drag) {
      s.targetOx = s.dox + (e.clientX - s.dsx) / s.scale;
      s.targetOy = s.doy + (e.clientY - s.dsy) / s.scale;
      cvs.current.style.cursor = 'grabbing';
    } else {
      const node = hit(e.clientX, e.clientY), id = node?.id || null;
      if (id !== s.hov) {
        s.hov = id;
        cvs.current.style.cursor = id ? 'pointer' : 'grab';
        onNodeHover && onNodeHover(node, { x: e.clientX, y: e.clientY });
      }
    }
  }, [hit, onNodeHover]);

  const onDown = useCallback(e => {
    const s = st.current;
    s.drag = true; s.dsx = e.clientX; s.dsy = e.clientY;
    s.dox = s.targetOx; s.doy = s.targetOy;
  }, []);

  const onUp = useCallback(e => {
    const s = st.current;
    const moved = Math.abs(e.clientX - s.dsx) > 5 || Math.abs(e.clientY - s.dsy) > 5;
    s.drag = false;
    cvs.current.style.cursor = s.hov ? 'pointer' : 'grab';
    if (!moved) { const n = hit(e.clientX, e.clientY); if (n) onNodeClick && onNodeClick(n); }
  }, [hit, onNodeClick]);

  const onWheel = useCallback(e => {
    e.preventDefault();
    const s = st.current, f = e.deltaY > 0 ? 0.87 : 1.15;
    // zoom towards cursor
    const c = cvs.current, rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left - c.width / 2;
    const my = e.clientY - rect.top - c.height / 2;
    const newScale = Math.max(0.15, Math.min(5, s.targetScale * f));
    s.targetOx = s.targetOx - mx / s.targetScale + mx / newScale;
    s.targetOy = s.targetOy - my / s.targetScale + my / newScale;
    s.targetScale = newScale;
  }, []);

  useEffect(() => {
    const el = cvs.current; if (!el) return;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [onMove, onDown, onUp, onWheel]);

  return <canvas ref={cvs} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
}
