import React from "react";

const TYPE_META = {
  persistent:    { color: '#3B82F6', bg: '#EFF6FF', label: 'Persistent',    icon: '→' },
  emerging:      { color: '#10B981', bg: '#ECFDF5', label: 'Emerging',       icon: '↑' },
  disappearing:  { color: '#EF4444', bg: '#FEF2F2', label: 'Disappearing',   icon: '↓' },
  strengthened:  { color: '#8B5CF6', bg: '#F5F3FF', label: 'Strengthened',   icon: '▲' },
  weakened:      { color: '#F59E0B', bg: '#FFFBEB', label: 'Weakened',       icon: '▼' },
  reframed:      { color: '#6366F1', bg: '#EEF2FF', label: 'Reframed',       icon: '↺' },
};

const DEFAULT_META = { color: '#6B7280', bg: '#F9FAFB', label: 'Changed', icon: '•' };

export default function NarrativeEvolutionFlow({ flows, narratives }) {
  const activeFlows = flows || narratives || [];
  // flows = [{ year, narrative_summary, shift_delta, transition_type }, ...]
  if (!activeFlows || activeFlows.length === 0) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)', textAlign: 'center', fontSize: '0.95rem' }}>
        No narrative evolution data available.
      </div>
    );
  }

  const sorted = [...activeFlows].sort((a, b) => a.year - b.year);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {sorted.map((f, i) => {
        const type = (f.transition_type || 'persistent').toLowerCase();
        const meta = TYPE_META[type] || DEFAULT_META;
        const shiftPct = f.shift_delta ? `${(f.shift_delta).toFixed(1)}%` : null;

        return (
          <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'stretch' }}>
            {/* Timeline spine */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '48px', flexShrink: 0 }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                backgroundColor: meta.color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', fontWeight: 700, flexShrink: 0,
              }}>
                {f.year ? String(f.year).slice(-2) : '?'}
              </div>
              {i < sorted.length - 1 && (
                <div style={{ width: '2px', flex: 1, minHeight: '24px', backgroundColor: '#E2E8F0', marginTop: '4px' }} />
              )}
            </div>

            {/* Content card */}
            <div style={{
              flex: 1,
              backgroundColor: meta.bg,
              border: `1px solid ${meta.color}30`,
              borderRadius: '10px',
              padding: '1rem 1.25rem',
              marginBottom: i < sorted.length - 1 ? '0.75rem' : '0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B' }}>{f.year}</span>
                <span style={{
                  backgroundColor: meta.color, color: 'white',
                  padding: '0.2rem 0.6rem', borderRadius: '999px',
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}>
                  {meta.icon} {meta.label}
                </span>
                {shiftPct && (
                  <span style={{ fontSize: '0.8rem', color: meta.color, fontWeight: 600 }}>
                    Δ {shiftPct} shift
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', lineHeight: '1.55' }}>
                {f.narrative_summary}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
