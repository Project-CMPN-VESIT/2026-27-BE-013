import { useRef, useEffect } from "react";
import Plotly from "plotly.js/dist/plotly";

export default function SourceDivergenceChart({ divergence }) {
  const divRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;

    // divergence = [{ year, perspective, divergence_score, sample_size, data_status }, ...]
    const rows = Array.isArray(divergence) ? divergence : [];
    if (rows.length === 0) {
      Plotly.purge(divRef.current);
      return;
    }

    // Check if all scores are 0 — happens when only one source/perspective is present
    const allZero = rows.every(d => d.divergence_score === 0 || d.divergence_score == null);
    if (allZero) {
      Plotly.purge(divRef.current);
      return; // parent will show the informational message
    }

    // Group by perspective (the field that exists — not 'source')
    const perspectives = [...new Set(rows.map(d => d.perspective))].filter(p => p && p !== 'unknown');

    const PERSPECTIVE_COLORS = {
      left: '#3B82F6',
      centre: '#8B5CF6',
      right: '#EF4444',
    };

    const traces = perspectives.map(p => {
      const pRows = rows.filter(d => d.perspective === p && d.divergence_score > 0);
      return {
        x: pRows.map(d => d.year),
        y: pRows.map(d => Number((d.divergence_score * 100).toFixed(2))),
        name: p.charAt(0).toUpperCase() + p.slice(1),
        mode: 'lines+markers',
        type: 'scatter',
        line: { color: PERSPECTIVE_COLORS[p] || '#94A3B8', width: 2 },
        marker: { size: 8 },
        hovertemplate: `<b>${p}</b><br>Year: %{x}<br>Divergence: %{y:.2f}%<br>Articles: %{customdata}<extra></extra>`,
        customdata: pRows.map(d => d.sample_size ?? 0),
      };
    });

    if (traces.length === 0 || traces.every(t => t.x.length === 0)) {
      Plotly.purge(divRef.current);
      return;
    }

    const layout = {
      margin: { l: 50, r: 20, t: 20, b: 50 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Inter, sans-serif', size: 13 },
      xaxis: { title: 'Year', fixedrange: true, dtick: 1 },
      yaxis: { title: 'Divergence %', fixedrange: true, rangemode: 'tozero' },
      showlegend: true,
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' },
    };

    Plotly.react(divRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [divergence]);

  // Show honest message when data doesn't support divergence analysis
  const rows = Array.isArray(divergence) ? divergence : [];
  const allZero = rows.length === 0 || rows.every(d => d.divergence_score === 0 || d.divergence_score == null);

  if (allZero) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center', gap: '0.5rem', padding: '1rem' }}>
        <div>📊 Insufficient cross-perspective data</div>
        <div style={{ fontSize: '0.8rem', maxWidth: '280px', lineHeight: '1.5' }}>
          Divergence analysis requires articles from multiple political perspectives. This investigation's sources did not provide sufficient perspective diversity.
        </div>
      </div>
    );
  }

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
}
