import { useRef, useEffect } from "react";
import Plotly from "plotly.js/dist/plotly";

export default function SentimentDistributionChart({ sentiment }) {
  const divRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;

    // sentiment = [{ year, positive_pct, negative_pct, neutral_pct, total_articles }, ...]
    const rows = Array.isArray(sentiment) ? sentiment : [];
    if (rows.length === 0) {
      Plotly.purge(divRef.current);
      return;
    }

    const years = rows.map(r => String(r.year));
    const pos   = rows.map(r => Number(r.positive_pct ?? 0));
    const neu   = rows.map(r => Number(r.neutral_pct  ?? 0));
    const neg   = rows.map(r => Number(r.negative_pct ?? 0));
    const total = rows.map(r => r.total_articles ?? 0);

    const makeTrace = (name, data, color) => ({
      name,
      x: years,
      y: data,
      type: 'bar',
      marker: { color },
      hovertemplate: `<b>${name}</b><br>Year: %{x}<br>%{y:.1f}%<br>Articles: %{customdata}<extra></extra>`,
      customdata: total,
    });

    const traces = [
      makeTrace('Positive', pos, '#22C55E'),
      makeTrace('Neutral',  neu, '#94A3B8'),
      makeTrace('Negative', neg, '#EF4444'),
    ];

    const layout = {
      barmode: 'stack',
      barnorm: 'percent',
      margin: { l: 50, r: 20, t: 20, b: 60 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Inter, sans-serif', size: 13 },
      xaxis: { title: 'Year', fixedrange: true },
      yaxis: { title: 'Distribution %', fixedrange: true, range: [0, 100] },
      showlegend: true,
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' },
    };

    Plotly.react(divRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [sentiment]);

  if (!sentiment || (Array.isArray(sentiment) && sentiment.length === 0)) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.9rem' }}>No sentiment data available.</div>;
  }

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
}
