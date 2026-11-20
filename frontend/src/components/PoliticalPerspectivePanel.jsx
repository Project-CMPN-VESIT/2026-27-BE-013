import { useRef, useEffect } from "react";
import Plotly from "plotly.js/dist/plotly";

const PERSPECTIVE_COLORS = {
  left:    { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8", accent: "#3B82F6" },
  centre:  { bg: "#F0FDF4", border: "#22C55E", text: "#15803D", accent: "#22C55E" },
  right:   { bg: "#FFF7ED", border: "#F97316", text: "#C2410C", accent: "#F97316" },
  unknown: { bg: "#F8FAFC", border: "#94A3B8", text: "#64748B", accent: "#94A3B8" },
};
const PERSPECTIVE_LABEL = { left: "Left", centre: "Centre", right: "Right", unknown: "Unknown" };
const PERSPECTIVE_ICONS = { left: "⬅️", centre: "⚖️", right: "➡️" };

function PerspectiveTimeChart({ yearlyDistribution }) {
  const divRef = useRef(null);
  useEffect(() => {
    if (!divRef.current) return;
    const rows = Array.isArray(yearlyDistribution) ? yearlyDistribution : [];
    const years = rows.map((r) => r.year);
    if (years.length === 0) { Plotly.purge(divRef.current); return; }
    const traces = [
      { name: "Left",   x: years, y: rows.map((r) => r.left_count),   type: "bar", marker: { color: "#3B82F6" } },
      { name: "Centre", x: years, y: rows.map((r) => r.centre_count), type: "bar", marker: { color: "#22C55E" } },
      { name: "Right",  x: years, y: rows.map((r) => r.right_count),  type: "bar", marker: { color: "#F97316" } },
    ];
    Plotly.react(divRef.current, traces, {
      barmode: "stack", margin: { l: 45, r: 20, t: 15, b: 50 },
      paper_bgcolor: "transparent", plot_bgcolor: "transparent",
      font: { family: "Inter, sans-serif", size: 12 },
      xaxis: { title: "Year", fixedrange: true, dtick: 1 },
      yaxis: { title: "Article Count", fixedrange: true, rangemode: "tozero" },
      legend: { orientation: "h", y: -0.35, x: 0.5, xanchor: "center" },
    }, { displayModeBar: false, responsive: true });
  }, [yearlyDistribution]);
  return <div ref={divRef} style={{ width: "100%", height: "260px" }} />;
}

function SentimentComparisonChart({ sentimentByPerspective }) {
  const divRef = useRef(null);
  useEffect(() => {
    if (!divRef.current) return;
    const s = sentimentByPerspective || {};
    const perspectives = ["left", "centre", "right"].filter((p) => s[p]?.available);
    if (perspectives.length === 0) { Plotly.purge(divRef.current); return; }
    const labels = perspectives.map((p) => PERSPECTIVE_LABEL[p]);
    const traces = [
      { name: "Positive", x: labels, y: perspectives.map((p) => s[p].positive_pct), type: "bar", marker: { color: "#22C55E" } },
      { name: "Neutral",  x: labels, y: perspectives.map((p) => s[p].neutral_pct),  type: "bar", marker: { color: "#94A3B8" } },
      { name: "Negative", x: labels, y: perspectives.map((p) => s[p].negative_pct), type: "bar", marker: { color: "#EF4444" } },
    ];
    Plotly.react(divRef.current, traces, {
      barmode: "group", margin: { l: 45, r: 20, t: 15, b: 50 },
      paper_bgcolor: "transparent", plot_bgcolor: "transparent",
      font: { family: "Inter, sans-serif", size: 12 },
      yaxis: { title: "Percentage (%)", fixedrange: true, rangemode: "tozero" },
      xaxis: { fixedrange: true },
      legend: { orientation: "h", y: -0.35, x: 0.5, xanchor: "center" },
    }, { displayModeBar: false, responsive: true });
  }, [sentimentByPerspective]);
  return <div ref={divRef} style={{ width: "100%", height: "220px" }} />;
}

export default function PoliticalPerspectivePanel({ perspectiveAnalysis }) {
  if (!perspectiveAnalysis) {
    return <div style={{ color: "var(--muted)", padding: "2rem 0", textAlign: "center", fontSize: "0.9rem" }}>Perspective data loading...</div>;
  }
  const {
    is_sufficient, sufficiency_message, epistemic_disclaimer,
    overall_distribution, yearly_distribution, sources_by_perspective,
    sentiment_by_perspective, narrative_differences, source_composition_shifts,
  } = perspectiveAnalysis;
  const orderedPerspectives = ["left", "centre", "right"];
  const sourcesByP = { left: [], centre: [], right: [], unknown: [] };
  (sources_by_perspective || []).forEach((s) => {
    if (s.perspective && sourcesByP[s.perspective]) sourcesByP[s.perspective].push(s);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>ℹ️</span>
        <div style={{ fontSize: "0.83rem", color: "#64748B", lineHeight: "1.6" }}>
          <strong style={{ color: "#334155" }}>Analytical Metadata: </strong>
          {epistemic_disclaimer || "Source orientation classifications are metadata used for comparative analysis and should not be interpreted as objective judgments."}
        </div>
      </div>

      {!is_sufficient && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: "0.88rem", color: "#92400E", lineHeight: "1.6" }}>
            <strong>Insufficient Cross-Perspective Data: </strong>{sufficiency_message}
          </div>
        </div>
      )}

      <div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 1rem 0" }}>Perspective Distribution</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {orderedPerspectives.map((p) => {
            const d = overall_distribution?.[p] || {};
            const count = d.article_count || 0;
            const pct = d.percentage || 0;
            const sources = d.sources || [];
            const cols = PERSPECTIVE_COLORS[p];
            return (
              <div key={p} style={{ border: `1.5px solid ${cols.border}`, borderRadius: "12px", padding: "1.25rem", background: cols.bg }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 800, color: cols.text, textTransform: "uppercase" }}>
                    {PERSPECTIVE_ICONS[p]} {PERSPECTIVE_LABEL[p]}
                  </div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: cols.text }}>
                    {count > 0 ? `${pct.toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div style={{ height: "6px", background: "rgba(0,0,0,0.08)", borderRadius: "3px", marginBottom: "0.85rem", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(pct, count > 0 ? 4 : 0)}%`, background: cols.accent, borderRadius: "3px" }} />
                </div>
                <div style={{ fontSize: "0.82rem", color: cols.text, fontWeight: 700 }}>
                  {count === 0 ? "0 articles found" : `${count} article${count !== 1 ? "s" : ""}`}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "0.2rem" }}>
                  {(d.source_count || 0) === 0 ? "No classified sources" : `${d.source_count} source${d.source_count !== 1 ? "s" : ""}`}
                </div>
                {sources.length > 0 && (
                  <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {sources.slice(0, 4).map((s, i) => (
                      <span key={i} style={{ fontSize: "0.68rem", background: "rgba(0,0,0,0.06)", color: cols.text, padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: 600 }}>{s}</span>
                    ))}
                    {sources.length > 4 && <span style={{ fontSize: "0.68rem", color: "#94A3B8" }}>+{sources.length - 4} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(overall_distribution?.unknown?.article_count || 0) > 0 && (
          <div style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: "0.6rem" }}>
            {overall_distribution.unknown.article_count} article{overall_distribution.unknown.article_count !== 1 ? "s" : ""} from sources without available orientation classification.
          </div>
        )}
      </div>

      {(yearly_distribution || []).some((r) => r.total > 0) && (
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>Perspective Distribution Over Time</h3>
          <p style={{ fontSize: "0.83rem", color: "#64748B", margin: "0 0 1rem 0" }}>Stacked article counts by orientation, year by year.</p>
          <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "1rem", background: "white" }}>
            <PerspectiveTimeChart yearlyDistribution={yearly_distribution} />
          </div>
        </div>
      )}

      {orderedPerspectives.some((p) => sourcesByP[p].length > 0) && (
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.75rem 0" }}>Source → Perspective Mapping</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {orderedPerspectives.filter((p) => sourcesByP[p].length > 0).map((p) => {
              const srcs = sourcesByP[p];
              const cols = PERSPECTIVE_COLORS[p];
              return (
                <div key={p} style={{ border: `1px solid ${cols.border}`, borderRadius: "10px", padding: "0.85rem", background: cols.bg }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: cols.text, textTransform: "uppercase", marginBottom: "0.5rem" }}>{PERSPECTIVE_LABEL[p]}</div>
                  {srcs.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0", borderBottom: i < srcs.length - 1 ? `1px solid ${cols.border}40` : "none" }}>
                      <div style={{ fontSize: "0.8rem", color: "#1E293B", fontWeight: 600 }}>{s.source_name}</div>
                      <div style={{ fontSize: "0.75rem", color: cols.text, fontWeight: 700 }}>{s.article_count}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {is_sufficient && narrative_differences && orderedPerspectives.some((p) => narrative_differences[p]?.available) && (
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>Narrative Differences Across Perspectives</h3>
          <p style={{ fontSize: "0.83rem", color: "#64748B", margin: "0 0 1rem 0" }}>Recurring framing themes in headline corpus — not claims of editorial bias.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {orderedPerspectives.filter((p) => narrative_differences[p]?.available).map((p) => {
              const nd = narrative_differences[p];
              const cols = PERSPECTIVE_COLORS[p];
              return (
                <div key={p} style={{ border: `1px solid ${cols.border}`, borderRadius: "10px", padding: "1rem", background: "white" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: cols.text, textTransform: "uppercase", marginBottom: "0.6rem" }}>{PERSPECTIVE_LABEL[p]} — {nd.sample_size} articles</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.75rem" }}>
                    {nd.top_themes.map((t, i) => (<span key={i} style={{ fontSize: "0.72rem", background: cols.bg, color: cols.text, border: `1px solid ${cols.border}`, padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: 600 }}>{t}</span>))}
                  </div>
                  {nd.sample_quotes.slice(0, 2).map((q, i) => (
                    <div key={i} style={{ fontSize: "0.75rem", color: "#475569", lineHeight: "1.4", marginBottom: "0.3rem", fontStyle: "italic", borderLeft: `2px solid ${cols.border}`, paddingLeft: "0.5rem" }}>"{q}"</div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {is_sufficient && sentiment_by_perspective && orderedPerspectives.some((p) => sentiment_by_perspective[p]?.available) && (
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>Sentiment Differences Across Perspectives</h3>
          <p style={{ fontSize: "0.83rem", color: "#64748B", margin: "0 0 1rem 0" }}>Comparative tone breakdown per orientation.</p>
          <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "1rem", background: "white" }}>
            <SentimentComparisonChart sentimentByPerspective={sentiment_by_perspective} />
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              {orderedPerspectives.filter((p) => sentiment_by_perspective[p]?.available).map((p) => {
                const s = sentiment_by_perspective[p];
                const cols = PERSPECTIVE_COLORS[p];
                return (
                  <div key={p} style={{ fontSize: "0.78rem", color: "#475569" }}>
                    <strong style={{ color: cols.text }}>{PERSPECTIVE_LABEL[p]}</strong>
                    {" "}— {s.positive_pct.toFixed(1)}% pos · {s.neutral_pct.toFixed(1)}% neu · {s.negative_pct.toFixed(1)}% neg
                    <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}> (n={s.sample_size})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(source_composition_shifts || []).length > 0 && (
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.75rem 0" }}>Source Composition Shifts</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>Period</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Left Δ</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Centre Δ</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Right Δ</th>
              </tr>
            </thead>
            <tbody>
              {source_composition_shifts.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{r.period}</td>
                  {["left_shift", "centre_shift", "right_shift"].map((key) => {
                    const val = r[key];
                    return (<td key={key} style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: val === 0 ? "#94A3B8" : val > 0 ? "#16A34A" : "#DC2626" }}>{val === 0 ? "—" : `${val > 0 ? "+" : ""}${val.toFixed(1)}%`}</td>);
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}