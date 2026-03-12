import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import AuroraBackground from '../components/AuroraBackground';
import Sidebar from '../components/Sidebar';
import InfoPanel from '../components/InfoPanel';
import { searchTopic, getRelatedTopics } from '../utils/api';

const KnowledgeGraph = dynamic(
  () => import('../components/graph/KnowledgeGraph'),
  { ssr: false, loading: () => <GraphLoader /> }
);

function GraphLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(77,255,195,0.12)', borderTopColor: '#4dffc3', animation: 'spin 1s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', border: '2px solid rgba(192,132,252,0.08)', borderBottomColor: '#c084fc', animation: 'spin 1.6s linear infinite reverse' }} />
      </div>
      <span style={{ fontSize: 11, letterSpacing: '0.1em', fontFamily: "'IBM Plex Mono',monospace", color: 'rgba(77,255,195,0.4)' }}>INITIALISING CANVAS</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function EmptyState({ onSearch }) {
  const examples = ['Aurora Borealis', 'Artificial Intelligence', 'Black Holes', 'Consciousness', 'Chaos Theory', 'Ocean Ecosystems'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 60px', gap: 0 }}>
      {/* Animated orb */}
      <div style={{ position: 'relative', marginBottom: 40 }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          background: 'radial-gradient(circle at 35% 35%, rgba(77,255,195,0.18), rgba(56,189,248,0.06) 60%)',
          border: '1px solid rgba(77,255,195,0.18)',
          boxShadow: '0 0 60px rgba(77,255,195,0.12), 0 0 120px rgba(56,189,248,0.06)',
          animation: 'float 5s ease-in-out infinite',
        }}>🌌</div>
        {[1.6, 2.3, 3.1].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', inset: `${-(s - 1) * 45}px`, borderRadius: '50%',
            border: `1px solid rgba(77,255,195,${0.08 - i * 0.025})`,
            animation: `spin ${12 + i * 5}s linear infinite ${i % 2 ? 'reverse' : ''}`,
          }} />
        ))}
      </div>

      <h1 style={{
        fontSize: 24, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif',
        background: 'linear-gradient(135deg, #4dffc3, #38bdf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        Knowledge Universe
      </h1>
      <p style={{ fontSize: 13, color: 'rgba(200,220,255,0.45)', lineHeight: 1.8, maxWidth: 360, marginBottom: 36, fontFamily: 'Inter, sans-serif' }}>
        Search any topic to begin. Watch as a constellation of interconnected ideas unfolds across the cosmos.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 440 }}>
        {examples.map(t => (
          <button key={t} onClick={() => onSearch(t)}
            style={{
              padding: '7px 16px', borderRadius: 24, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace",
              background: 'rgba(77,255,195,0.06)', border: '1px solid rgba(77,255,195,0.12)',
              color: 'rgba(200,220,255,0.5)', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#4dffc3'; e.currentTarget.style.borderColor = 'rgba(77,255,195,0.4)'; e.currentTarget.style.background = 'rgba(77,255,195,0.1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(77,255,195,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(200,220,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(77,255,195,0.12)'; e.currentTarget.style.background = 'rgba(77,255,195,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
          >{t}</button>
        ))}
      </div>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

function BackButton({ history, onBack }) {
  if (history.length < 2) return null;
  const prev = history[history.length - 2];
  return (
    <button onClick={onBack}
      style={{
        position: 'absolute', top: 14, left: 70, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px 8px 10px', borderRadius: 12,
        background: 'rgba(5,15,30,0.88)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(77,255,195,0.2)', color: '#4dffc3',
        fontSize: 11, cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace",
        boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 20px rgba(77,255,195,0.06)',
        transition: 'all 0.2s', letterSpacing: '0.04em',
        animation: 'slideDown 0.3s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(77,255,195,0.1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.6), 0 0 28px rgba(77,255,195,0.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(5,15,30,0.88)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5), 0 0 20px rgba(77,255,195,0.06)'; }}
    >
      ← <div>
        <div style={{ fontSize: 8, color: 'rgba(77,255,195,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>Retrieve</div>
        <div style={{ color: 'rgba(200,220,255,0.8)', fontWeight: 500 }}>{prev.name.length > 20 ? prev.name.slice(0, 18) + '…' : prev.name}</div>
      </div>
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}`}</style>
    </button>
  );
}

function BreadcrumbPath({ path }) {
  if (!path.length) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '7px 16px',
      background: 'rgba(5,15,30,0.82)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, whiteSpace: 'nowrap',
    }}>
      {path.map((p, i) => (
        <span key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && <span style={{ color: 'rgba(77,255,195,0.25)', margin: '0 6px' }}>→</span>}
          <span style={{ color: i === path.length - 1 ? (p.color || '#4dffc3') : 'rgba(200,220,255,0.3)', fontWeight: i === path.length - 1 ? 600 : 400 }}>
            {p.icon && <span style={{ marginRight: 5 }}>{p.icon}</span>}
            {p.name.length > 22 ? p.name.slice(0, 20) + '…' : p.name}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSel] = useState(null);
  const [path, setPath] = useState([]);
  const [navHistory, setHistory] = useState([]);
  const [activeParent, setParent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState(null);
  const [panelOpen, setPanel] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredNode, setHov] = useState(null);
  const [tooltipPos, setTipPos] = useState({ x: 0, y: 0 });
  const expanded = useRef(new Set());
  const pathNodeIds = path.map(p => p.id);

  const handleSearch = useCallback(async (q) => {
    setLoading(true); setError(null); setSel(null); setPanel(false);
    expanded.current = new Set(); setHistory([]);
    try {
      const d = await searchTopic(q);
      setGraph(d.graph);
      setParent(d.centralTopic.id);
      const root = { id: d.centralTopic.id, name: d.centralTopic.name, color: d.centralTopic.color, icon: d.centralTopic.icon, category: d.centralTopic.category };
      setPath([root]); setHistory([root]);
    } catch { setError('Could not find that topic. Please try another search.'); }
    finally { setLoading(false); }
  }, []);

  const handleNodeClick = useCallback(async (node) => {
    setSel(node); setPanel(true);
    const entry = { id: node.id, name: node.name, color: node.color || '#4dffc3', icon: node.icon || '🔵', category: node.category };
    setPath(prev => { const idx = prev.findIndex(p => p.id === node.id); return idx >= 0 ? prev.slice(0, idx + 1) : [...prev, entry]; });
    setHistory(prev => { const idx = prev.findIndex(p => p.id === node.id); return idx >= 0 ? prev.slice(0, idx + 1) : [...prev, entry]; });
    setParent(node.id);
    if (!expanded.current.has(node.id)) {
      expanded.current.add(node.id); setExpanding(true);
      try {
        const d = await getRelatedTopics(node.id);
        setGraph(prev => {
          const eIds = new Set(prev.nodes.map(n => n.id));
          const eeIds = new Set(prev.edges.map(e => e.id));
          return { nodes: [...prev.nodes, ...d.nodes.filter(n => !eIds.has(n.id))], edges: [...prev.edges, ...d.edges.filter(e => !eeIds.has(e.id))] };
        });
      } catch { expanded.current.delete(node.id); }
      finally { setExpanding(false); }
    }
  }, []);

  const handleBack = useCallback(() => {
    if (navHistory.length < 2) return;
    const prev = navHistory[navHistory.length - 2];
    const node = graph.nodes.find(n => n.id === prev.id);
    if (!node) return;
    setHistory(h => h.slice(0, -1));
    setPath(p => { const idx = p.findIndex(x => x.id === prev.id); return idx >= 0 ? p.slice(0, idx + 1) : p; });
    setParent(prev.id); setSel(node); setPanel(true);
  }, [navHistory, graph.nodes]);

  const handleHover = useCallback((node, pos) => { setHov(node); if (pos) setTipPos(pos); }, []);
  const handleExpand = useCallback(async (nodeId) => { const n = graph.nodes.find(n => n.id === nodeId); if (n) handleNodeClick(n); }, [graph.nodes, handleNodeClick]);
  const hasGraph = graph.nodes.length > 0;

  return (
    <>
      <Head>
        <title>Rabbit Hole Explorer — Aurora</title>
        <meta name="description" content="Explore knowledge through a constellation of connected ideas" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* Aurora night sky background */}
      <AuroraBackground />

      {/* App layout */}
      <div className="relative z-10 h-screen w-screen overflow-hidden">
        <Sidebar
          onSearch={handleSearch}
          isLoading={loading}
          history={navHistory}
          onClearHistory={() => { setHistory([]); setSel(null); setPanel(false); setGraph({ nodes: [], edges: [] }); setPath([]); }}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
        />

        {/* Main area — always full width, sidebar floats over it */}
        <div className="flex flex-col w-full h-full p-4 gap-3">
          {/* Status bar */}
          {(expanding || error) && (
            <div className="shrink-0 px-4 py-2 rounded-xl text-xs font-mono flex items-center gap-2" style={{
              background: error ? 'rgba(248,113,113,0.06)' : 'rgba(77,255,195,0.05)',
              border: `1px solid ${error ? 'rgba(248,113,113,0.2)' : 'rgba(77,255,195,0.12)'}`,
              color: error ? 'rgba(248,113,113,0.7)' : 'rgba(77,255,195,0.6)',
              backdropFilter: 'blur(20px)',
            }}>
              {expanding && <span className="flex gap-1">{[0, 1, 2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#4dffc3', animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}</span>}
              {expanding ? 'Fetching connected topics from Wikipedia…' : `⚠ ${error}`}
            </div>
          )}

          {/* Graph canvas */}
          <div className="flex-1 relative rounded-2xl overflow-hidden" style={{
            background: 'rgba(3,8,15,0.45)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: 'inset 0 0 120px rgba(0,0,0,0.4)',
          }}>
            {!hasGraph && !loading ? (
              <EmptyState onSearch={handleSearch} />
            ) : loading ? (
              <GraphLoader />
            ) : (
              <KnowledgeGraph
                nodes={graph.nodes}
                edges={graph.edges}
                onNodeClick={handleNodeClick}
                onNodeHover={handleHover}
                selectedNodeId={selectedNode?.id}
                activeParentId={activeParent}
                pathNodeIds={pathNodeIds}
              />
            )}

            {hasGraph && <BackButton history={navHistory} onBack={handleBack} />}

            {/* Stats badge */}
            {hasGraph && (
              <div style={{
                position: 'absolute', bottom: 14, left: 70, display: 'flex', gap: 14,
                padding: '8px 16px', borderRadius: 12,
                background: 'rgba(3,8,15,0.80)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.07)',
                fontFamily: "'IBM Plex Mono',monospace", pointerEvents: 'none',
              }}>
                {[
                  { val: graph.nodes.length, label: 'nodes', col: '#4dffc3' },
                  { val: graph.edges.length, label: 'edges', col: '#38bdf8' },
                  { val: Math.max(0, path.length - 1), label: 'depth', col: '#c084fc' },
                ].map(({ val, label, col }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: col, lineHeight: 1, textShadow: `0 0 10px ${col}60` }}>{val}</span>
                    <span style={{ fontSize: 8, color: 'rgba(200,220,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            {hasGraph && (
              <div style={{
                position: 'absolute', bottom: 14, right: panelOpen ? 296 : 14, transition: 'right 0.3s ease',
                padding: '7px 12px', borderRadius: 10,
                background: 'rgba(3,8,15,0.80)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
                color: 'rgba(200,220,255,0.3)', lineHeight: 2, pointerEvents: 'none',
              }}>
                drag · scroll to zoom · click to explore
              </div>
            )}

            {/* InfoPanel */}
            {panelOpen && selectedNode && (
              <InfoPanel nodeData={selectedNode} onExpandNode={handleExpand} onClose={() => setPanel(false)} />
            )}
          </div>

          {/* Breadcrumb */}
          {path.length > 0 && (
            <div className="shrink-0" style={{ paddingLeft: 70 }}>
              <BreadcrumbPath path={path} />
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0);opacity:0}40%{transform:scale(1);opacity:1}}`}</style>
    </>
  );
}
