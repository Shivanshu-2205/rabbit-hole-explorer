import { useState, useEffect, useRef } from 'react';
import { getTopicById } from '../../utils/api';

const CAT_NEON = {
  science:'#00f5ff', technology:'#bf5fff', history:'#ffb700',
  philosophy:'#ff2d78', arts:'#ff6b2b', nature:'#39ff8f',
  society:'#ffb700', mathematics:'#00f5ff', other:'#bf5fff',
};

export default function ActiveNodeCard({ nodeData }) {
  const [full, setFull]    = useState(null);
  const [visible, setVis]  = useState(false);
  const [expanded, setExp] = useState(false);
  const prevId = useRef(null);

  useEffect(() => {
    if (!nodeData) { setVis(false); return; }
    if (nodeData.id !== prevId.current) {
      setVis(false); setFull(null); setExp(false);
      prevId.current = nodeData.id;
      setTimeout(() => setVis(true), 60);
      getTopicById(nodeData.id).then(d => setFull(d.topic)).catch(() => {});
    }
  }, [nodeData?.id]);

  if (!nodeData) return null;
  const col    = nodeData.color || CAT_NEON[nodeData.category] || '#00f5ff';
  const topic  = full || nodeData;
  const ytQuery  = encodeURIComponent(nodeData.name + ' explained');
  const wikiUrl  = topic.wikiUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(nodeData.name.replace(/ /g, '_'))}`;
  const text     = topic.fullDescription || topic.description || 'Loading…';

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: '50%',
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(24px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
      // wider when expanded so text is comfortable to read
      width: expanded ? 720 : 580,
      maxWidth: 'calc(100vw - 40px)',
      zIndex: 20, pointerEvents: 'auto',
      transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease, width 0.3s ease',
    }}>
      <div style={{
        background: 'rgba(8,9,16,0.94)',
        border: `1px solid ${col}40`,
        borderTop: `2px solid ${col}`,
        borderRadius: 16,
        backdropFilter: 'blur(24px)',
        boxShadow: `0 0 60px ${col}18, 0 20px 60px rgba(0,0,0,0.7), inset 0 0 40px rgba(0,0,0,0.3)`,
        overflow: 'hidden',
      }}>
        {/* top glow */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${col}60, transparent)` }} />

        <div style={{ display: 'flex', gap: 0 }}>
          {/* thumbnail */}
          {topic.thumbnail && (
            <div style={{ width: expanded ? 140 : 100, flexShrink: 0, overflow: 'hidden', position: 'relative', transition: 'width 0.3s ease' }}>
              <img src={topic.thumbnail} alt={topic.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.55) saturate(0.7)' }} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, rgba(8,9,16,0.6))` }} />
              <div style={{
                position: 'absolute', top: 10, left: 10,
                width: 8, height: 8, borderRadius: '50%',
                background: col, boxShadow: `0 0 10px ${col}`,
                animation: 'pulse 2s ease-in-out infinite',
              }} />
            </div>
          )}

          {/* content */}
          <div style={{ flex: 1, padding: '14px 18px', minWidth: 0 }}>
            {/* header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: col, textTransform: 'uppercase', letterSpacing: '0.16em', fontFamily: "'Space Mono',monospace", marginBottom: 4, opacity: 0.8 }}>
                  {nodeData.category || 'topic'} · active node
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#e8f0ff', fontFamily: "'Syne',sans-serif", lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  {nodeData.name}
                </h3>
              </div>

              {/* action buttons */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a href={wikiUrl} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8,
                    background: `${col}15`, border: `1px solid ${col}35`,
                    color: col, fontSize: 10, textDecoration: 'none',
                    fontFamily: "'Space Mono',monospace", whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${col}28`; e.currentTarget.style.boxShadow = `0 0 16px ${col}30`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${col}15`; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                  </svg>
                  Wiki
                </a>
                <a href={`https://www.youtube.com/results?search_query=${ytQuery}`} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8,
                    background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,60,60,0.3)',
                    color: '#ff4444', fontSize: 10, textDecoration: 'none',
                    fontFamily: "'Space Mono',monospace", whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,0,0,0.22)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,0,0,0.25)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,0,0,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
                  </svg>
                  YouTube
                </a>

                {/* expand/collapse toggle button */}
                <button
                  onClick={() => setExp(x => !x)}
                  title={expanded ? 'Collapse' : 'Expand'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: expanded ? `${col}20` : 'rgba(255,255,255,0.04)',
                    border: expanded ? `1px solid ${col}50` : '1px solid rgba(255,255,255,0.08)',
                    color: expanded ? col : '#4a5880',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${col}20`; e.currentTarget.style.color = col; e.currentTarget.style.borderColor = `${col}50`; }}
                  onMouseLeave={e => {
                    if (!expanded) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.color = '#4a5880';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    {expanded
                      ? <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
                      : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {/* description — bigger font, more lines visible */}
            <p style={{
              fontSize: expanded ? 13 : 12,
              color: expanded ? '#8090b8' : '#6070a0',
              lineHeight: expanded ? 1.85 : 1.7,
              fontFamily: "'Outfit',sans-serif",
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 3,
              WebkitBoxOrient: 'vertical',
              transition: 'all 0.3s',
              marginBottom: expanded ? 12 : 6,
              maxHeight: expanded ? 400 : 'none',
              overflowY: expanded ? 'auto' : 'hidden',
            }}>
              {text}
            </p>

            {/* read more / show less inline link — only shown when not expanded */}
            {!expanded && text.length > 180 && (
              <button onClick={() => setExp(true)}
                style={{
                  background: 'none', border: 'none', color: `${col}80`,
                  fontSize: 9, fontFamily: "'Space Mono',monospace",
                  cursor: 'pointer', padding: 0, letterSpacing: '0.1em',
                  textTransform: 'uppercase', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = col}
                onMouseLeave={e => e.currentTarget.style.color = `${col}80`}
              >
                ▼ read more
              </button>
            )}
          </div>
        </div>

        {/* bottom glow */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${col}30, transparent)` }} />
      </div>
    </div>
  );
}