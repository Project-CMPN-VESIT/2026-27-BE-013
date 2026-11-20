import { useRef, useEffect } from "react";
import Plotly from "plotly.js/dist/plotly";

const SHIFT_COLOR = (v) => v > 40 ? "#EF4444" : v > 25 ? "#F97316" : v > 10 ? "#EAB308" : "#22C55E";

export default function SemanticShiftChart({ transitions }) {
  const divRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;

    if (!transitions || transitions.length === 0) {
      Plotly.purge(divRef.current);
      return;
    }

    // transitions = [{ transition: "2021-2022", value: 17.19 }, ...]
    // value is already a percentage — do NOT multiply by 100
    const x      = transitions.map(t => t.transition);
    const y      = transitions.map(t => Number(t.value));
    const text   = transitions.map(t => `Shift: ${Number(t.value).toFixed(2)}%`);
    const colors = y.map(SHIFT_COLOR);

    const trace = {
      x, y, text,
      type: 'bar',
      marker: { color: colors },
      hovertemplate: '<b>%{x}</b><br>Shift: %{y:.2f}%<extra></extra>',
    };

    const layout = {
      margin: { l: 50, r: 20, t: 30, b: 50 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'Inter, sans-serif', size: 13 },
      xaxis: { title: 'Year Transition', fixedrange: true, tickfont: { size: 12 } },
      yaxis: { title: 'Shift %', fixedrange: true, rangemode: 'tozero' },
      bargap: 0.3,
      annotations: y.map((val, i) => ({
        x: x[i], y: val,
        text: `${val.toFixed(1)}%`,
        xanchor: 'center', yanchor: 'bottom',
        showarrow: false,
        font: { size: 12, color: colors[i], family: 'Inter, sans-serif', weight: 700 },
        yshift: 4,
      })),
    };

    Plotly.react(divRef.current, [trace], layout, { displayModeBar: false, responsive: true });
  }, [transitions]);

  if (!transitions || transitions.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.9rem' }}>No shift data available.</div>;
  }

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
}
