import { useState, useRef } from 'react';
import { Search, History, Trash2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

const SUGGESTIONS = [
  'Aurora Borealis', 'Artificial Intelligence', 'Quantum Computing',
  'Black Holes', 'Evolution', 'Consciousness', 'Chaos Theory',
  'Neuroscience', 'Silk Road', 'Ocean Ecosystems'
];

const NAV_ITEMS = [
  { icon: '⊞', label: 'Dashboard', active: false },
  { icon: '◎', label: 'Discover', active: true },
  { icon: '◈', label: 'Community', active: false },
  { icon: '◇', label: 'My Journeys', active: false },
  { icon: '⚙', label: 'Settings', active: false },
];

export default function Sidebar({ onSearch, isLoading, history, onClearHistory, isOpen, onToggle }) {
  const [q, setQ] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef(null);

  const submit = (v) => {
    const val = (v || q).trim();
    if (!val || isLoading) return;
    setQ(val);
    onSearch(val);
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  const filtered = q
    ? SUGGESTIONS.filter(t => t.toLowerCase().includes(q.toLowerCase()))
    : SUGGESTIONS;

  return (
    // Absolutely positioned — floats OVER the graph, never pushes it
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        zIndex: 30,
        display: 'flex',
        pointerEvents: 'none', // let clicks fall through to graph by default
      }}
    >
      {/* Icon rail — always visible, always interactive */}
      <div
        className="flex flex-col items-center py-6 gap-6 shrink-0"
        style={{
          width: 56,
          background: 'rgba(5, 15, 30, 0.82)',
          backdropFilter: 'blur(30px)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          pointerEvents: 'auto',
        }}
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{
          background: 'linear-gradient(135deg, rgba(77,255,195,0.2), rgba(56,189,248,0.1))',
          border: '1px solid rgba(77,255,195,0.3)',
          boxShadow: '0 0 20px rgba(77,255,195,0.15)',
        }}>
          <span style={{ fontSize: 18 }}>🐇</span>
        </div>

        {/* Nav icons */}
        {NAV_ITEMS.map((item, i) => (
          <button key={i} title={item.label}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{
              background: item.active ? 'rgba(77,255,195,0.12)' : 'transparent',
              border: item.active ? '1px solid rgba(77,255,195,0.2)' : '1px solid transparent',
              color: item.active ? '#4dffc3' : 'rgba(200,220,255,0.3)',
              fontSize: 16,
            }}
            onMouseEnter={e => { if (!item.active) { e.currentTarget.style.color = 'rgba(200,220,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; } }}
            onMouseLeave={e => { if (!item.active) { e.currentTarget.style.color = 'rgba(200,220,255,0.3)'; e.currentTarget.style.background = 'transparent'; } }}
          >
            {item.icon}
          </button>
        ))}

        {/* Toggle button pinned to bottom */}
        <div className="mt-auto">
          <button
            onClick={onToggle}
            title={isOpen ? 'Close sidebar' : 'Open sidebar'}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{
              background: 'rgba(77,255,195,0.06)',
              border: '1px solid rgba(77,255,195,0.15)',
              color: 'rgba(77,255,195,0.5)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(77,255,195,0.15)';
              e.currentTarget.style.color = '#4dffc3';
              e.currentTarget.style.borderColor = 'rgba(77,255,195,0.4)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(77,255,195,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(77,255,195,0.06)';
              e.currentTarget.style.color = 'rgba(77,255,195,0.5)';
              e.currentTarget.style.borderColor = 'rgba(77,255,195,0.15)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {isOpen
              ? <ChevronLeft style={{ width: 15, height: 15 }} />
              : <ChevronRight style={{ width: 15, height: 15 }} />
            }
          </button>
        </div>
      </div>

      {/* Expandable panel — slides in/out, overlays graph */}
      <div
        style={{
          width: 210,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'rgba(6, 16, 32, 0.82)',
          backdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          pointerEvents: isOpen ? 'auto' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4" style={{ color: '#4dffc3' }} />
            <h1 className="text-sm font-semibold tracking-wide whitespace-nowrap" style={{
              background: 'linear-gradient(90deg, #4dffc3, #38bdf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Rabbit Hole Explorer
            </h1>
          </div>

          {/* Search */}
          <div className="relative">
            <div className="flex items-start rounded-xl transition-all duration-300" style={{
              background: 'rgba(255,255,255,0.05)',
              border: dropdownOpen ? '1px solid rgba(77,255,195,0.4)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: dropdownOpen ? '0 0 20px rgba(77,255,195,0.08)' : 'none',
            }}>
              <div className="pl-3 pr-2 pt-3 shrink-0">
                {isLoading ? (
                  <div className="flex gap-0.5 items-center pt-0.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full" style={{
                        background: '#4dffc3',
                        animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                      }} />
                    ))}
                  </div>
                ) : (
                  <Search className="w-3.5 h-3.5" style={{ color: 'rgba(200,220,255,0.4)' }} />
                )}
              </div>
              <textarea
                ref={inputRef}
                value={q}
                rows={2}
                onChange={e => { setQ(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); submit(); }
                  if (e.key === 'Escape') { setDropdownOpen(false); inputRef.current.blur(); }
                }}
                placeholder="Search topics..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-xs py-2.5 pr-2 outline-none font-mono resize-none"
                style={{
                  color: '#f0f4ff',
                  caretColor: '#4dffc3',
                  minWidth: 0,
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  overflowY: 'auto',
                  maxHeight: '4.5rem',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(77,255,195,0.2) transparent',
                }}
              />
              {q.trim() && (
                <button onClick={() => submit()} disabled={isLoading}
                  className="mt-2 mr-1.5 mb-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all shrink-0 self-start"
                  style={{ background: 'rgba(77,255,195,0.15)', color: '#4dffc3', border: '1px solid rgba(77,255,195,0.2)' }}
                >
                  Go →
                </button>
              )}
            </div>

            {dropdownOpen && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50 py-1.5" style={{
                background: 'rgba(5, 15, 30, 0.97)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
              }}>
                <div className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest" style={{ color: 'rgba(200,220,255,0.3)' }}>
                  Suggested rabbit holes
                </div>
                {filtered.map(t => (
                  <button key={t} onMouseDown={() => submit(t)}
                    className="w-full text-left px-3 py-2 text-xs font-mono transition-all"
                    style={{ color: 'rgba(200,220,255,0.6)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(77,255,195,0.08)'; e.currentTarget.style.color = '#4dffc3'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(200,220,255,0.6)'; }}
                  >
                    <span style={{ color: 'rgba(77,255,195,0.4)', marginRight: 8 }}>→</span>{t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />

        {/* History */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'rgba(200,220,255,0.35)' }}>
              <History style={{ width: 10, height: 10 }} />
              Recent discoveries
            </span>
            {history.length > 0 && (
              <button onClick={onClearHistory} style={{ color: 'rgba(200,220,255,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,100,100,0.8)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,220,255,0.3)'}
              >
                <Trash2 style={{ width: 11, height: 11 }} />
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">🌌</div>
              <p className="text-[11px] font-mono" style={{ color: 'rgba(200,220,255,0.25)', lineHeight: 1.6 }}>
                Search a topic to start your journey through the knowledge universe
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...history].reverse().map((item, i) => (
                <button key={item.id} onClick={() => onSearch(item.name)}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-200"
                  style={{
                    background: i === 0 ? 'rgba(77,255,195,0.08)' : 'rgba(255,255,255,0.03)',
                    border: i === 0 ? '1px solid rgba(77,255,195,0.15)' : '1px solid rgba(255,255,255,0.05)',
                  }}
                  onMouseEnter={e => { if (i !== 0) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; } }}
                  onMouseLeave={e => { if (i !== 0) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; } }}
                >
                  <span style={{ fontSize: 14 }}>{item.icon || '🔵'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: i === 0 ? '#4dffc3' : '#f0f4ff' }}>
                      {item.name}
                    </div>
                    <div className="text-[9px] font-mono capitalize mt-0.5" style={{ color: 'rgba(200,220,255,0.35)' }}>
                      {item.category}
                    </div>
                  </div>
                  {i === 0 && (
                    <span className="text-[9px] font-mono shrink-0" style={{ color: 'rgba(77,255,195,0.6)' }}>current</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0);opacity:0}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
