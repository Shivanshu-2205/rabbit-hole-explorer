import { useEffect, useRef, useCallback } from 'react';

// ─── colour helpers ────────────────────────────────────────────────────────
function hexRgb(hex = '#0ff') {
  const h = hex.replace('#', '').padEnd(6, '0');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgba(hex, a) { const { r, g, b } = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpPos(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }

const CAT_NEON = {
  science: '#00f5ff', technology: '#bf5fff', history: '#ffb700',
  philosophy: '#ff2d78', arts: '#ff6b2b', nature: '#39ff8f',
  society: '#ffb700', mathematics: '#00f5ff', other: '#bf5fff',
};

// ─── ring layout ───────────────────────────────────────────────────────────
// Places n nodes evenly on a ring, starting from the top.
// Optionally restricts to an arc (fromAngle..toAngle in radians).
function ringLayout(n, radius, cx = 0, cy = 0, fromAngle = null, toAngle = null) {
  if (!n) return [];
  if (n === 1 && fromAngle === null) return [{ x: cx, y: cy - radius }];

  if (fromAngle !== null && toAngle !== null) {
    // arc layout — spread nodes within the given angular range
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = fromAngle + t * (toAngle - fromAngle);
      return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
    });
  }

  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i / n) - Math.PI / 2;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  });
}

// ─── DFS layout calculator ─────────────────────────────────────────────────
//
// Layout philosophy:
//   • Current (active) node: dead center at (0, 0)
//   • Children: semicircle on the RIGHT side (arc from -100° to +100°)
//   • Path ancestors: chain extending to the LEFT
//     - Parent:      (-340, 0)  — full size, slightly dimmed
//     - Grandparent: (-620, 0)  — smaller, more dimmed
//     - Great-grand: (-860, 0)  — smallest, most dimmed (max 3 ancestors shown)
//   • No other nodes visible — zero clutter guaranteed
//
// This gives a clear left-to-right narrative: where you came from ← here → where you can go

const ANCESTOR_POSITIONS = [
  { x: -340, y: 0, scale: 0.88, opacity: 0.75 },  // parent (depth -1)
  { x: -640, y: 0, scale: 0.72, opacity: 0.45 },  // grandparent (depth -2)
  { x: -900, y: 0, scale: 0.58, opacity: 0.25 },  // great-grandparent (depth -3)
];

// Children are placed in a rightward semicircle
// We reserve a gap at the left (toward parent) so children don't overlap with parent edge
const CHILD_RADIUS  = 240;
const CHILD_FROM_ANGLE = -1.75;  // ~-100 degrees
const CHILD_TO_ANGLE   =  1.75;  // ~+100 degrees

function computeDFSLayout(nodes, edges, activeParentId, pathNodeIds) {
  // nodes/edges here are the FULL graph, not just visible layer
  // pathNodeIds is ordered [root, ..., currentNode] — same as path state in index.js

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const currentId = activeParentId;
  if (!currentId || !nodeMap.has(currentId)) return { layoutNodes: [], layoutEdges: [], nodeOpacity: {}, nodeScale: {} };

  // Determine ancestor chain from pathNodeIds
  // pathNodeIds = [root, node1, node2, ..., currentNode]
  const currentPathIdx = pathNodeIds.indexOf(currentId);
  const ancestors = currentPathIdx > 0
    ? pathNodeIds.slice(0, currentPathIdx).reverse()  // [parent, grandparent, ...]
    : [];
  const visibleAncestors = ancestors.slice(0, 3);  // show at most 3 ancestors

  // Direct children of current node (from edges)
  const childIds = edges
    .filter(e => e.source === currentId)
    .map(e => e.target)
    .filter(id => nodeMap.has(id));

  // Build visible node set
  const visibleIds = new Set([currentId, ...visibleAncestors, ...childIds]);
  const layoutNodes = nodes.filter(n => visibleIds.has(n.id));
  const layoutEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

  // Assign target positions
  const targetPos  = {};
  const nodeOpacity = {};
  const nodeScale  = {};

  // Current node — center
  targetPos[currentId]   = { x: 0, y: 0 };
  nodeOpacity[currentId] = 1.0;
  nodeScale[currentId]   = 1.0;

  // Ancestors — chain to the left
  visibleAncestors.forEach((id, i) => {
    const cfg = ANCESTOR_POSITIONS[i];
    targetPos[id]   = { x: cfg.x, y: cfg.y };
    nodeOpacity[id] = cfg.opacity;
    nodeScale[id]   = cfg.scale;
  });

  // Children — semicircle to the right
  if (childIds.length) {
    const positions = ringLayout(
      childIds.length, CHILD_RADIUS, 0, 0,
      CHILD_FROM_ANGLE, CHILD_TO_ANGLE
    );
    childIds.forEach((id, i) => {
      targetPos[id]   = positions[i];
      nodeOpacity[id] = 1.0;
      nodeScale[id]   = 1.0;
    });
  }

  return { layoutNodes, layoutEdges, targetPos, nodeOpacity, nodeScale };
}

// ─── component ─────────────────────────────────────────────────────────────
export default function KnowledgeGraph({
  nodes = [],
  edges = [],
  onNodeClick,
  onNodeHover,
  selectedNodeId,
  activeParentId,
  pathNodeIds = [],
}) {
  const cvs = useRef(null);
  const raf = useRef(null);

  const st = useRef({
    ox: 0, oy: 0, scale: 1,
    targetOx: 0, targetOy: 0, targetScale: 1,
    drag: false, dsx: 0, dsy: 0, dox: 0, doy: 0,
    pos: {}, targetPos: {}, spawnTime: {}, data: {},
    nodeOpacity: {}, nodeScale: {},
    hov: null, tick: 0, stars: null, nebula: null,
    particles: [],
    layoutNodes: [], layoutEdges: [],
  });

  // ── recompute DFS layout ──────────────────────────────────────────────────
  const computeTargets = useCallback((allNodes, allEdges, pid, pids) => {
    const s = st.current;
    const { layoutNodes, layoutEdges, targetPos, nodeOpacity, nodeScale } =
      computeDFSLayout(allNodes, allEdges, pid, pids);

    const d = {};
    layoutNodes.forEach(n => { d[n.id] = n; });

    // New nodes spawn from current center so they fly outward cleanly
    const parentPos = s.pos[pid] || { x: 0, y: 0 };
    layoutNodes.forEach(n => {
      if (!s.pos[n.id]) {
        s.pos[n.id] = { ...parentPos };
        s.spawnTime[n.id] = s.tick;
      }
    });

    s.targetPos   = targetPos || {};
    s.nodeOpacity = nodeOpacity || {};
    s.nodeScale   = nodeScale || {};
    s.data        = d;
    s.layoutNodes = layoutNodes;
    s.layoutEdges = layoutEdges;
  }, []);

  // ── update on prop change ─────────────────────────────────────────────────
  useEffect(() => {
    if (!nodes.length) return;
    computeTargets(nodes, edges, activeParentId, pathNodeIds);
  }, [nodes, edges, activeParentId, pathNodeIds, computeTargets]);

  // ── re-centre camera when active node changes ────────────────────────────
  useEffect(() => {
    if (activeParentId) {
      st.current.targetOx    = 0;
      st.current.targetOy    = 0;
      st.current.targetScale = 1;
    }
  }, [activeParentId]);

  // ── path particles ────────────────────────────────────────────────────────
  useEffect(() => {
    const s = st.current;
    s.particles = s.particles.filter(
      p => pathNodeIds.includes(p.src) || pathNodeIds.includes(p.dst)
    );
    if (pathNodeIds.length >= 2) {
      for (let i = 0; i < pathNodeIds.length - 1; i++) {
        const src = pathNodeIds[i], dst = pathNodeIds[i + 1];
        const existing = s.particles.filter(p => p.src === src && p.dst === dst).length;
        for (let j = existing; j < 5; j++) {
          s.particles.push({
            src, dst,
            t: Math.random(),
            speed: 0.002 + Math.random() * 0.004,
            size: Math.random() * 2 + 1.5,
          });
        }
      }
    }
  }, [pathNodeIds]);

  // ── draw loop ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c = cvs.current; if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height, s = st.current, tick = s.tick++;

    // smooth camera
    s.ox    = lerp(s.ox,    s.targetOx,    0.07);
    s.oy    = lerp(s.oy,    s.targetOy,    0.07);
    s.scale = lerp(s.scale, s.targetScale, 0.07);

    // smooth node positions
    Object.keys(s.targetPos).forEach(id => {
      if (!s.pos[id]) s.pos[id] = { ...s.targetPos[id] };
      s.pos[id] = lerpPos(s.pos[id], s.targetPos[id], 0.065);
    });

    s.particles.forEach(p => { p.t += p.speed; if (p.t > 1) p.t -= 1; });

    ctx.clearRect(0, 0, W, H);

    // ── background ───────────────────────────────────────────────────────────
    const bg = ctx.createRadialGradient(W * .45, H * .4, 0, W * .5, H * .5, Math.max(W, H) * .8);
    bg.addColorStop(0, '#0a0b18');
    bg.addColorStop(.5, '#060710');
    bg.addColorStop(1, '#030305');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // nebula blobs
    if (!s.nebula) s.nebula = [
      { wx: -180, wy: -100, r: 320, r2: 80,  g: 80,  b: 140 },
      { wx: 220,  wy: 150,  r: 260, r2: 20,  g: 0,   b: 120 },
      { wx: -50,  wy: 280,  r: 200, r2: 120, g: 100, b: 30  },
      { wx: 350,  wy: -180, r: 240, r2: 0,   g: 80,  b: 100 },
    ];
    s.nebula.forEach(nb => {
      const nx = (nb.wx + s.ox) * s.scale + W / 2;
      const ny = (nb.wy + s.oy) * s.scale + H / 2;
      const nr = nb.r * s.scale;
      const g  = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      g.addColorStop(0, `rgba(${nb.r2},${nb.g},${nb.b},0.06)`);
      g.addColorStop(1, `rgba(${nb.r2},${nb.g},${nb.b},0)`);
      ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    });

    // stars
    if (!s.stars) s.stars = Array.from({ length: 200 }, () => ({
      x: (Math.random() - .5) * 3500, y: (Math.random() - .5) * 3500,
      r: Math.random() * 1.5 + .2, b: Math.random(),
      col: ['#ffffff', '#b0c8ff', '#ffd0a0', '#c0e0ff'][Math.floor(Math.random() * 4)],
    }));
    s.stars.forEach(star => {
      const sx = (star.x + s.ox) * s.scale + W / 2;
      const sy = (star.y + s.oy) * s.scale + H / 2;
      if (sx < -2 || sx > W + 2 || sy < -2 || sy > H + 2) return;
      const a = .12 + .15 * Math.sin(tick * .007 + star.b * 8);
      const { r, g, b } = hexRgb(star.col);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.beginPath(); ctx.arc(sx, sy, star.r * Math.min(s.scale, 1.6), 0, Math.PI * 2);
      ctx.fill();
    });

    const toS = (wx, wy) => ({
      x: (wx + s.ox) * s.scale + W / 2,
      y: (wy + s.oy) * s.scale + H / 2,
    });

    // path edge set — for glowing path lines
    const pset = new Set();
    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      pset.add(`${pathNodeIds[i]}>${pathNodeIds[i + 1]}`);
    }
    const isPE = (a, b) => pset.has(`${a}>${b}`) || pset.has(`${b}>${a}`);

    // ── edges ────────────────────────────────────────────────────────────────
    s.layoutEdges.forEach(e => {
      const sp = s.pos[e.source], tp = s.pos[e.target];
      if (!sp || !tp) return;
      const ss = toS(sp.x, sp.y), ts = toS(tp.x, tp.y);
      const isPath  = isPE(e.source, e.target);
      const isLocal = e.source === activeParentId || e.target === activeParentId;
      const nd = s.data[e.target];
      const nc = nd?.color || '#00f5ff';

      // Curve control point — gentle arc
      const mx = (ss.x + ts.x) / 2 + (sp.y - tp.y) * .12;
      const my = (ss.y + ts.y) / 2 + (tp.x - sp.x) * .12;

      // Ancestor edges (path edges going left) — dashed dimmed style
      const isAncestorEdge = pathNodeIds.includes(e.source) && pathNodeIds.includes(e.target);

      if (isPath && isAncestorEdge) {
        // Glowing path tube for the chain of visited nodes
        [[8, .06, '#ffffff'], [4, .18, nc], [2, .55, nc]].forEach(([lw, alpha, col]) => {
          const pulse = alpha * (0.7 + 0.3 * Math.sin(tick * .05));
          ctx.save();
          ctx.strokeStyle = rgba(col, pulse);
          ctx.lineWidth = lw * s.scale; ctx.lineCap = 'round';
          ctx.shadowColor = nc; ctx.shadowBlur = lw * 3;
          ctx.beginPath(); ctx.moveTo(ss.x, ss.y);
          ctx.quadraticCurveTo(mx, my, ts.x, ts.y);
          ctx.stroke(); ctx.restore();
        });

        // Arrow on path edge
        const si = pathNodeIds.indexOf(e.source), ti = pathNodeIds.indexOf(e.target);
        const [fx, fy, tx2, ty2] = si < ti
          ? [ss.x, ss.y, ts.x, ts.y]
          : [ts.x, ts.y, ss.x, ss.y];
        const ang = Math.atan2(ty2 - fy, tx2 - fx), sz = 7 * s.scale;
        ctx.save(); ctx.fillStyle = nc; ctx.shadowColor = nc; ctx.shadowBlur = 10;
        ctx.translate(tx2, ty2); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(-sz, -sz * .5); ctx.lineTo(-sz, sz * .5);
        ctx.closePath(); ctx.fill(); ctx.restore();

      } else if (isLocal) {
        // Current node → child edges
        [[5, .04, nc], [2, .18, nc]].forEach(([lw, alpha, col]) => {
          ctx.save();
          ctx.strokeStyle = rgba(col, alpha);
          ctx.lineWidth = lw * s.scale; ctx.lineCap = 'round';
          ctx.shadowColor = nc; ctx.shadowBlur = lw * 2;
          ctx.beginPath(); ctx.moveTo(ss.x, ss.y);
          ctx.quadraticCurveTo(mx, my, ts.x, ts.y);
          ctx.stroke(); ctx.restore();
        });
      } else {
        ctx.save();
        ctx.strokeStyle = 'rgba(80,90,140,0.10)';
        ctx.lineWidth   = 1 * s.scale;
        ctx.beginPath(); ctx.moveTo(ss.x, ss.y);
        ctx.quadraticCurveTo(mx, my, ts.x, ts.y);
        ctx.stroke(); ctx.restore();
      }

      // Particles on active edges
      if (isPath || isLocal) {
        s.particles
          .filter(p =>
            (p.src === e.source && p.dst === e.target) ||
            (p.src === e.target && p.dst === e.source)
          )
          .forEach(p => {
            const pt = p.t;
            const px = (1 - pt) * (1 - pt) * ss.x + 2 * (1 - pt) * pt * mx + pt * pt * ts.x;
            const py = (1 - pt) * (1 - pt) * ss.y + 2 * (1 - pt) * pt * my + pt * pt * ts.y;
            ctx.save();
            ctx.fillStyle   = isPath ? nc : 'rgba(255,255,255,0.5)';
            ctx.shadowColor = nc; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(px, py, p.size * s.scale, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
          });
      }
    });

    // ── nodes ────────────────────────────────────────────────────────────────
    s.layoutNodes.forEach(node => {
      const wp = s.pos[node.id]; if (!wp) return;
      const { x, y } = toS(wp.x, wp.y);

      const isRoot    = node.id === activeParentId;
      const isSel     = node.id === selectedNodeId;
      const isHov     = s.hov === node.id;
      const isPath    = pathNodeIds.includes(node.id);
      const isAnc     = isPath && node.id !== activeParentId;  // ancestor node

      const col       = node.color || CAT_NEON[node.category] || '#00f5ff';
      const spawnAge  = s.spawnTime[node.id] !== undefined ? tick - s.spawnTime[node.id] : 999;
      const spawnSc   = Math.min(1, spawnAge / 45);

      // Per-node scale and opacity from layout (ancestors are smaller/dimmer)
      const layoutSc  = s.nodeScale[node.id]   ?? 1.0;
      const layoutOp  = s.nodeOpacity[node.id] ?? 1.0;

      const { r, g, b } = hexRgb(col);

      const cardW = (isRoot ? 160 : 130) * s.scale * spawnSc * layoutSc;
      const cardH = (isRoot ? 90  : 72)  * s.scale * spawnSc * layoutSc;
      if (cardW < 4) return;
      const cr = 10 * s.scale * layoutSc;
      const cx = x - cardW / 2, cy = y - cardH / 2;

      ctx.globalAlpha = layoutOp;

      // glow halo
      const glowR = Math.max(cardW, cardH) * (isRoot ? 1.8 : isHov ? 1.5 : 1.2);
      const glow  = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      const ga    = isRoot ? .18 : isHov ? .12 : isPath ? .08 : .04;
      glow.addColorStop(0, `rgba(${r},${g},${b},${ga})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow; ctx.fill();

      // root pulse rings
      if (isRoot) {
        [1.3, 1.6, 2.0].forEach((mult, ri) => {
          const pr = Math.max(cardW, cardH) * mult * 0.5;
          const a  = (0.4 - ri * .1) * (0.5 + 0.5 * Math.sin(tick * .05 - ri * 1.3));
          ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
          ctx.lineWidth   = (2 - ri * .4) * s.scale;
          ctx.shadowColor = col; ctx.shadowBlur = 6;
          ctx.stroke(); ctx.shadowBlur = 0;
        });
      }

      // ancestor indicator — small breadcrumb dot above the card
      if (isAnc) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, cy - 10 * s.scale * layoutSc, 3 * s.scale * layoutSc, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.fill(); ctx.restore();
      }

      // card body
      const roundRect = () => {
        ctx.beginPath();
        ctx.moveTo(cx + cr, cy); ctx.lineTo(cx + cardW - cr, cy);
        ctx.arcTo(cx + cardW, cy, cx + cardW, cy + cr, cr);
        ctx.lineTo(cx + cardW, cy + cardH - cr);
        ctx.arcTo(cx + cardW, cy + cardH, cx + cardW - cr, cy + cardH, cr);
        ctx.lineTo(cx + cr, cy + cardH);
        ctx.arcTo(cx, cy + cardH, cx, cy + cardH - cr, cr);
        ctx.lineTo(cx, cy + cr);
        ctx.arcTo(cx, cy, cx + cr, cy, cr);
        ctx.closePath();
      };

      ctx.save(); roundRect();
      const bodyGrad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      bodyGrad.addColorStop(0, 'rgba(14,15,25,0.95)');
      bodyGrad.addColorStop(1, 'rgba(8,9,16,0.98)');
      ctx.fillStyle = bodyGrad; ctx.fill();

      const borderAlpha = isRoot ? .8 : isSel ? .7 : isHov ? .55 : isPath ? .30 : .15;
      ctx.strokeStyle = `rgba(${r},${g},${b},${borderAlpha})`;
      ctx.lineWidth   = (isRoot ? 2.2 : isSel || isHov ? 1.8 : isAnc ? 1.0 : 1) * s.scale * layoutSc;
      if (isRoot || isSel || isHov) { ctx.shadowColor = col; ctx.shadowBlur = isRoot ? 18 : 12; }
      ctx.stroke(); ctx.restore();

      // inner top highlight
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx + cr, cy); ctx.lineTo(cx + cardW - cr, cy);
      ctx.arcTo(cx + cardW, cy, cx + cardW, cy + cr, cr);
      ctx.lineTo(cx + cardW, cy + Math.min(cardH * .35, 20 * s.scale * layoutSc));
      ctx.lineTo(cx, cy + Math.min(cardH * .35, 20 * s.scale * layoutSc));
      ctx.lineTo(cx, cy + cr);
      ctx.arcTo(cx, cy, cx + cr, cy, cr);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},0.05)`; ctx.fill(); ctx.restore();

      // icon
      if (node.icon) {
        const iconSz = Math.round((isRoot ? 20 : 16) * s.scale * layoutSc);
        ctx.font = `${iconSz}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.9 * layoutOp;
        ctx.fillText(node.icon, x, cy + 18 * s.scale * layoutSc);
        ctx.globalAlpha = layoutOp;
      }

      // title
      const tfs = Math.max(7, Math.min(13, (isRoot ? 13 : 10.5) * s.scale * layoutSc));
      ctx.font  = `800 ${tfs}px 'Syne',sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      // Dynamic truncation — measure actual pixel width and trim until it fits
      let name = node.name;
      ctx.font = `800 ${tfs}px 'Syne',sans-serif`;  // set font before measuring
      const maxNameW = cardW * 0.88;
      if (ctx.measureText(name).width > maxNameW) {
        while (name.length > 1 && ctx.measureText(name + '…').width > maxNameW) {
          name = name.slice(0, -1);
        }
        name = name.trimEnd() + '…';
      }
      // Ancestors show their name in a muted color to signal "past"
      ctx.fillStyle = isRoot
        ? col
        : isAnc
          ? `rgba(${r},${g},${b},0.6)`
          : isPath
            ? `rgba(${r},${g},${b},0.9)`
            : isSel || isHov
              ? '#d0d8f0'
              : '#8090b0';
      if (isRoot) { ctx.shadowColor = col; ctx.shadowBlur = 6; }
      const titleY = cy + (node.icon ? 32 : 14) * s.scale * layoutSc;
      ctx.fillText(name, x, titleY); ctx.shadowBlur = 0;

      // short description — only on root, hovered, or selected
      if (node.short_description && (isRoot || isHov || isSel) && cardW > 80) {
        const dfs = Math.max(6, Math.min(9, (isRoot ? 8.5 : 7.5) * s.scale * layoutSc));
        ctx.font  = `700 ${dfs}px 'Outfit',sans-serif`;
        ctx.fillStyle = `rgba(${r},${g},${b},${isAnc ? 0.25 : 0.4})`;
        let desc = node.short_description;
        const maxDescW = cardW * 0.88;
        if (ctx.measureText(desc).width > maxDescW) {
          while (desc.length > 1 && ctx.measureText(desc + '…').width > maxDescW) {
            desc = desc.slice(0, -1);
          }
          desc = desc.trimEnd() + '…';
        }
        const descY = titleY + tfs + 4 * s.scale * layoutSc;
        if (descY + dfs < cy + cardH - 3 * s.scale * layoutSc) ctx.fillText(desc, x, descY);
      }

      // tags — only on root and hovered
      if ((isRoot || isHov || isSel) && !isAnc && node.tags?.length) {
        const kfs = Math.max(7, 8 * s.scale * layoutSc);
        ctx.font  = `700 ${kfs}px 'Space Mono',monospace`;
        const kwStr = node.tags.slice(0, 2).map(t => `#${t}`).join('  ');
        ctx.fillStyle    = `rgba(${r},${g},${b},0.45)`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(kwStr, x, cy + cardH + 5 * s.scale * layoutSc);
      }

      ctx.globalAlpha = 1;
    });

    raf.current = requestAnimationFrame(draw);
  }, [nodes, edges, selectedNodeId, activeParentId, pathNodeIds]);

  useEffect(() => {
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [draw]);

  // canvas resize
  useEffect(() => {
    const resize = () => {
      const c = cvs.current; if (!c) return;
      c.width  = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (cvs.current?.parentElement) ro.observe(cvs.current.parentElement);
    return () => ro.disconnect();
  }, []);

  // ── hit test — against layout nodes only ─────────────────────────────────
  const hit = useCallback((cx, cy) => {
    const c = cvs.current; if (!c) return null;
    const rect = c.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top;
    const s  = st.current, W = c.width, H = c.height;
    for (const node of [...s.layoutNodes].reverse()) {
      const wp = s.pos[node.id]; if (!wp) continue;
      const sx = (wp.x + s.ox) * s.scale + W / 2;
      const sy = (wp.y + s.oy) * s.scale + H / 2;
      const isRoot = node.id === activeParentId;
      const ls   = s.nodeScale[node.id] ?? 1.0;
      const cw   = (isRoot ? 160 : 130) * s.scale * ls * 0.5;
      const ch   = (isRoot ? 90  : 72)  * s.scale * ls * 0.5;
      if (mx >= sx - cw && mx <= sx + cw && my >= sy - ch && my <= sy + ch) return node;
    }
    return null;
  }, [activeParentId]);

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
    if (!moved) {
      const n = hit(e.clientX, e.clientY);
      if (n) onNodeClick && onNodeClick(n);
    }
  }, [hit, onNodeClick]);

  const onWheel = useCallback(e => {
    e.preventDefault();
    const s = st.current, f = e.deltaY > 0 ? .87 : 1.15;
    const c = cvs.current, rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left - c.width / 2;
    const my = e.clientY - rect.top  - c.height / 2;
    const ns = Math.max(.15, Math.min(5, s.targetScale * f));
    s.targetOx = s.targetOx - mx / s.targetScale + mx / ns;
    s.targetOy = s.targetOy - my / s.targetScale + my / ns;
    s.targetScale = ns;
  }, []);

  useEffect(() => {
    const el = cvs.current; if (!el) return;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup',   onUp);
    el.addEventListener('wheel',     onWheel, { passive: false });
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup',   onUp);
      el.removeEventListener('wheel',     onWheel);
    };
  }, [onMove, onDown, onUp, onWheel]);

  return <canvas ref={cvs} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
}