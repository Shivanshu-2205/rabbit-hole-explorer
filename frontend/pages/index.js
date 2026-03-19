import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Navbar from '../components/ui/Navbar';
import LeftSidebar from '../components/ui/LeftSidebar';
import RightPanel from '../components/ui/RightPanel';
import FavouritesView from '../components/ui/FavouritesView';
import ActiveNodeCard from '../components/graph/ActiveNodeCard';
import NodeTooltip from '../components/graph/NodeTooltip';
import { searchTopic, getRelatedTopics, apiSaveFavourite } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const KnowledgeGraph = dynamic(
  () => import('../components/graph/KnowledgeGraph'),
  { ssr: false, loading: () => <Loader /> }
);

// ── Loader ────────────────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#00f5ff', animation: 'spin 1s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#bf5fff', animation: 'spin 1.4s linear infinite reverse' }} />
        <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#39ff8f', animation: 'spin 1.8s linear infinite' }} />
      </div>
      <span style={{ fontSize: 11, color: '#2a3460', fontFamily: "'Space Mono',monospace", letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Mapping cosmos…</span>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────
function EmptyState({ onSearch }) {
  const examples = ['Artificial Intelligence', 'Black Holes', 'Consciousness', 'Chaos Theory', 'Evolution', 'String Theory'];
  const col = '#00f5ff';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 40px' }}>
      <div style={{ position: 'relative', marginBottom: 40 }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 35% 30%, rgba(0,245,255,0.15), rgba(191,95,255,0.08))',
          border: `1px solid ${col}30`,
          boxShadow: `0 0 60px ${col}15, 0 0 120px rgba(191,95,255,0.08)`,
          animation: 'float 4s ease-in-out infinite',
          overflow: 'hidden',
        }}>
          <img src="/rabbit_Hole.png" alt="Rabbit Hole" style={{ width: 64, height: 64, objectFit: 'contain' }} />
        </div>
        {[58, 80, 110].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: `${(90 - s) / 2}px`, left: `${(90 - s) / 2}px`,
            width: s, height: s, borderRadius: '50%',
            border: `1px solid rgba(0,245,255,${0.12 - i * 0.04})`,
            animation: `spin ${12 + i * 5}s linear infinite ${i % 2 ? 'reverse' : ''}`,
          }} />
        ))}
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e8f0ff', marginBottom: 12, fontFamily: "'Syne',sans-serif", letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        Internet<br /><span style={{ color: col, textShadow: `0 0 30px ${col}` }}>Rabbit Hole</span><br />Explorer
      </h1>
      <p style={{ fontSize: 13, color: '#3a4870', lineHeight: 1.8, maxWidth: 360, marginBottom: 32, fontFamily: "'Outfit',sans-serif", fontWeight: 600 }}>
        Search any topic. Click nodes to dive deeper. Each click opens a new branch of connected knowledge.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 420 }}>
        {examples.map(t => (
          <button key={t} onClick={() => onSearch(t)}
            style={{ padding: '7px 16px', borderRadius: 24, fontSize: 11, fontWeight: 700, background: `${col}08`, border: `1px solid ${col}20`, color: '#4a5880', cursor: 'pointer', transition: 'all 0.18s', fontFamily: "'Space Mono',monospace" }}
            onMouseEnter={e => { e.currentTarget.style.color = col; e.currentTarget.style.borderColor = `${col}50`; e.currentTarget.style.background = `${col}12`; e.currentTarget.style.boxShadow = `0 0 20px ${col}15`; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a5880'; e.currentTarget.style.borderColor = `${col}20`; e.currentTarget.style.background = `${col}08`; e.currentTarget.style.boxShadow = 'none'; }}
          >{t}</button>
        ))}
      </div>
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [graph, setGraph]         = useState({ nodes: [], edges: [] });
  const [activeParent, setParent] = useState(null);
  const [selectedNode, setSel]    = useState(null);
  const [hoveredNode, setHov]     = useState(null);
  const [tooltipPos, setTipPos]   = useState({ x: 0, y: 0 });
  const [path, setPath]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [error, setError]         = useState(null);
  const [sidebarOpen, setSidebar] = useState(true);
  const [view, setView]           = useState('explore');
  const expanded = useRef(new Set());
  const { token, isLoggedIn } = useAuth();

  const pathNodeIds = path.map(p => p.id);

  // Direct children of active parent — for right panel fallback
  const connectedNodes = activeParent
    ? graph.edges
        .filter(e => e.source === activeParent)
        .map(e => graph.nodes.find(n => n.id === e.target))
        .filter(Boolean)
    : [];

  // ── search ───────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (q) => {
    setLoading(true); setError(null); setSel(null);
    expanded.current = new Set();
    try {
      const d = await searchTopic(q);
      setGraph(d.graph);
      setParent(d.centralTopic.id);
      const root = { id: d.centralTopic.id, name: d.centralTopic.name, color: d.centralTopic.color || '#00f5ff' };
      setPath([root]);
    } catch { setError('Could not fetch data. Check your connection.'); }
    finally   { setLoading(false); }
  }, []);

  // ── node click — DFS expansion ───────────────────────────────────────────
  // If the node is already in the path (ancestor click), navigate back to it.
  // If it's a new node, append to path and expand.
  const handleNodeClick = useCallback(async (node) => {
    setSel(node);
    const entry = { id: node.id, name: node.name, color: node.color || '#00f5ff' };

    // Check if user clicked an ancestor — slice path back to that point
    setPath(prev => {
      const i = prev.findIndex(p => p.id === node.id);
      return i >= 0 ? prev.slice(0, i + 1) : [...prev, entry];
    });

    setParent(node.id);

    // Expand if not already done
    if (!expanded.current.has(node.id)) {
      expanded.current.add(node.id);
      setExpanding(true);
      try {
        const d = await getRelatedTopics(node.id);
        setGraph(prev => {
          const eIds  = new Set(prev.nodes.map(n => n.id));
          const eeIds = new Set(prev.edges.map(e => e.id));
          return {
            nodes: [...prev.nodes, ...d.nodes.filter(n => !eIds.has(n.id))],
            edges: [...prev.edges, ...d.edges.filter(e => !eeIds.has(e.id))],
          };
        });
      } catch { expanded.current.delete(node.id); }
      finally   { setExpanding(false); }
    }
  }, []);

  // ── right panel node click ───────────────────────────────────────────────
  // Nodes in the right panel (angles) may not exist in the graph yet.
  // We inject the node + a connecting edge before calling handleNodeClick
  // so the DFS layout has something to render immediately.
  const handlePanelNodeClick = useCallback((node) => {
    if (!node) return;
    setGraph(prev => {
      const alreadyHas = prev.nodes.find(n => n.id === node.id);
      if (alreadyHas) return prev;  // already in graph, no injection needed
      const edgeId = `${activeParent}→${node.id}`;
      const alreadyHasEdge = prev.edges.find(e => e.id === edgeId);
      return {
        nodes: [...prev.nodes, { ...node, depth: (prev.nodes.find(n => n.id === activeParent)?.depth ?? 0) + 1 }],
        edges: alreadyHasEdge ? prev.edges : [...prev.edges, { id: edgeId, source: activeParent, target: node.id }],
      };
    });
    // Small delay so setGraph flushes before handleNodeClick reads graph.nodes
    setTimeout(() => handleNodeClick(node), 0);
  }, [activeParent, handleNodeClick]);

  // ── sidebar path navigation ──────────────────────────────────────────────
  const handlePathNav = useCallback((item) => {
    if (!item) {
      // clicked root label — go back to root
      setPath(p => p.slice(0, 1));
      setParent(path[0]?.id || null);
      setSel(null);
      return;
    }
    const n = graph.nodes.find(n => n.id === item.id);
    if (n) handleNodeClick(n);
  }, [graph.nodes, handleNodeClick, path]);

  // ── save favourite ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!isLoggedIn || path.length === 0) return;
    try {
      const title = path[0]?.name || 'Untitled';
      const savePath = path.map(p => ({
        id: p.id, name: p.name,
        category: graph.nodes.find(n => n.id === p.id)?.category || 'other',
        color: p.color || '#4a9eff',
        icon:  graph.nodes.find(n => n.id === p.id)?.icon || '🔵',
      }));
      await apiSaveFavourite(token, { title, path: savePath });
    } catch (err) {
      setError(err.message || 'Could not save');
    }
  }, [isLoggedIn, path, graph.nodes, token]);

  // ── load favourite — replay the saved path ───────────────────────────────
  const handleLoadFavourite = useCallback(async (fav) => {
    if (!fav.path?.length) return;
    setView('explore');
    setLoading(true);
    setError(null);
    setSel(null);
    expanded.current = new Set();

    try {
      const restoredPath = fav.path.map(p => ({
        id: p.id, name: p.name, color: p.color || '#00f5ff',
      }));

      // Search root to get initial graph
      const d = await searchTopic(fav.path[0].name);
      let currentGraph = d.graph;

      // Replay each step — expand every node in the saved path
      for (let i = 1; i < fav.path.length; i++) {
        const nodeId = fav.path[i].id;
        expanded.current.add(nodeId);
        try {
          const { nodes: newNodes, edges: newEdges } = await getRelatedTopics(nodeId);
          currentGraph = {
            nodes: [
              ...currentGraph.nodes.filter(n => !newNodes.find(nn => nn.id === n.id)),
              ...newNodes,
            ],
            edges: [
              ...currentGraph.edges,
              ...newEdges.filter(e => !currentGraph.edges.find(ce => ce.id === e.id)),
            ],
          };
        } catch { /* continue with what we have */ }
      }

      setGraph(currentGraph);
      setPath(restoredPath);
      setParent(restoredPath[restoredPath.length - 1].id);
      setSel(currentGraph.nodes.find(n => n.id === restoredPath[restoredPath.length - 1].id) || null);
    } catch {
      setError('Could not restore this rabbit hole.');
    } finally {
      setLoading(false);
    }
  }, []);

  const hasGraph  = graph.nodes.length > 0;
  const activeNode = activeParent ? graph.nodes.find(n => n.id === activeParent) : null;

  return (
    <>
      <Head>
        <title>Rabbit Hole Explorer</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/rabbit_Hole.png" />
      </Head>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050508', overflow: 'hidden' }}>

        {/* navbar */}
        <Navbar
          view={view}
          onViewChange={setView}
          onSearch={handleSearch}
          isLoading={loading}
          onSave={handleSave}
          canSave={hasGraph && path.length > 0}
          error={error}
        />

        {/* body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {view === 'favourites' ? (
            <FavouritesView onLoadFavourite={handleLoadFavourite} />
          ) : (
            <>
              {/* left sidebar */}
              <LeftSidebar
                collapsed={!sidebarOpen}
                onToggle={() => setSidebar(x => !x)}
                path={path}
                onNavigate={handlePathNav}
                graphStats={hasGraph ? {
                  nodes: graph.nodes.length,
                  edges: graph.edges.length,
                  depth: Math.max(0, path.length - 1),
                } : null}
              />

              {/* graph canvas */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#050508' }}>
                {!hasGraph && !loading ? (
                  <EmptyState onSearch={handleSearch} />
                ) : loading ? (
                  <Loader />
                ) : (
                  <KnowledgeGraph
                    nodes={graph.nodes}
                    edges={graph.edges}
                    onNodeClick={handleNodeClick}
                    onNodeHover={(node, pos) => { setHov(node); if (pos) setTipPos(pos); }}
                    selectedNodeId={selectedNode?.id}
                    activeParentId={activeParent}
                    pathNodeIds={pathNodeIds}
                  />
                )}

                {/* expanding indicator */}
                {expanding && (
                  <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: 'rgba(5,5,8,0.95)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#00f5ff', fontFamily: "'Space Mono',monospace", backdropFilter: 'blur(12px)', zIndex: 20 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#00f5ff', animation: `ld 1.2s ${i * .2}s ease-in-out infinite` }} />
                    ))}
                    Fetching connections…
                  </div>
                )}

                {/* active node card */}
                {hasGraph && <ActiveNodeCard nodeData={activeNode} />}

                {/* legend — updated to reflect new layout */}
                {hasGraph && (
                  <div style={{ position: 'absolute', bottom: 20, left: 16, padding: '8px 12px', background: 'rgba(5,5,8,0.88)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 9, fontSize: 9, fontWeight: 700, color: '#2a3460', fontFamily: "'Space Mono',monospace", lineHeight: 2, pointerEvents: 'none', backdropFilter: 'blur(8px)' }}>
                    {[
                      { col: '#00f5ff',             label: 'path chain',   dash: true  },
                      { col: 'rgba(120,160,255,0.5)',label: 'connections',  dash: false },
                    ].map(({ col, label, dash }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 18, height: 2, borderRadius: 1, background: dash ? 'transparent' : '', borderTop: dash ? `2px dashed ${col}` : `2px solid ${col}` }} />
                        {label}
                      </div>
                    ))}
                    <div style={{ marginTop: 4, opacity: 0.6 }}>click ancestor to go back</div>
                  </div>
                )}
              </div>

              {/* right panel */}
              <RightPanel
                activeNode={activeNode}
                connectedNodes={connectedNodes}
                onNodeClick={handlePanelNodeClick}
              />
            </>
          )}
        </div>
      </div>

      <NodeTooltip nodeData={hoveredNode} position={tooltipPos} />
      <style>{`
        @keyframes ld { 0%,80%,100%{transform:scale(0);opacity:0} 40%{transform:scale(1);opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </>
  );
}