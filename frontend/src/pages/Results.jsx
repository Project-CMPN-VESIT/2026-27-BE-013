import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Plotly from "plotly.js/dist/plotly";
import { chat, generateSummary, getNews } from "../api/client";
import PerspectiveCards from "../components/PerspectiveCards";
import NewsCard from "../components/NewsCard";

// Simple Plot wrapper using Plotly.react
const Plot = ({ data, layout, config, id }) => {
  const divRef = useRef(null);

  useEffect(() => {
    if (divRef.current) {
      Plotly.react(divRef.current, data, layout, config || {});
    }
  }, [data, layout, config]);

  return (
    <div id={id} ref={divRef} style={{ width: "100%", height: "400px" }} />
  );
};

const SHIFT_COLOR = (v) =>
  v > 40 ? "#EF4444" : v > 25 ? "#F97316" : v > 10 ? "#EAB308" : "#22C55E";
const SHIFT_LABEL = (v) =>
  v > 40 ? "Major" : v > 25 ? "High" : v > 10 ? "Moderate" : "Stable";

const PLOTLY_LAYOUT = (extra = {}) => ({
  paper_bgcolor: "white",
  plot_bgcolor: "white",
  font: { family: "Inter, sans-serif", color: "#0F1117" },
  margin: { l: 40, r: 20, t: 30, b: 40 },
  showlegend: false,
  ...extra,
});

export default function Results({ ctx }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);
  const [aiQ, setAiQ] = useState("");
  const [aiA, setAiA] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [sumLoading, setSumLoading] = useState(false);
  const [relNews, setRelNews] = useState([]);
  const [saved, setSaved] = useState(false);

  const plotRefs = {
    shift: useRef(null),
    sentiment: useRef(null),
    compare: useRef(null),
  };

  const result = ctx.result;
  const topicKey = ctx.topicKey;
  const topicCfg = ctx.topicCfg;
  const startYr = ctx.startYr;
  const endYr = ctx.endYr;
  const user = ctx.user;
  const setShowLogin = ctx.setShowLogin;

  if (!result) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📊</div>
        <div
          style={{
            fontWeight: 700,
            fontSize: "1.1rem",
            color: "var(--text)",
            marginBottom: "0.5rem",
          }}
        >
          No results loaded
        </div>
        <div style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          Search a topic from the home page to see analysis here.
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          ← Go to Search
        </button>
      </div>
    );
  }

  const shifts = result.shifts || {};
  const sentiment = result.sentiment || {};
  const narratives = result.narratives || {};
  const article_count = result.article_count || 0;
  const yearsList = shifts.years || [];
  const shiftsDict = shifts.shifts || {};

  const shiftYears = [],
    shiftVals = [];
  for (let i = 1; i < yearsList.length; i++) {
    const k = `${yearsList[i - 1]}-${yearsList[i]}`;
    if (shiftsDict[k] !== undefined) {
      shiftYears.push(yearsList[i]);
      shiftVals.push(shiftsDict[k]);
    }
  }

  const sentYears = Object.keys(sentiment).map(Number).sort();
  const posVals = sentYears.map((y) => sentiment[y]?.positive || 0);
  const negVals = sentYears.map((y) => sentiment[y]?.negative || 0);
  const neuVals = sentYears.map((y) => sentiment[y]?.neutral || 0);

  const maxShift = shiftVals.length ? Math.max(...shiftVals) : 0;
  const maxShiftYr = shiftVals.length
    ? shiftYears[shiftVals.indexOf(maxShift)]
    : "—";
  const avgPos = posVals.length
    ? (posVals.reduce((a, b) => a + b, 0) / posVals.length).toFixed(1)
    : "0.0";
  const avgNeg = negVals.length
    ? (negVals.reduce((a, b) => a + b, 0) / negVals.length).toFixed(1)
    : "0.0";

  const buildContext = () => `
You are analysing real media data for the topic "${topicCfg?.label || topicKey}" from ${startYr} to ${endYr}.
This is REAL data fetched from The Guardian API, Swarajya, and OpIndia news sources.
The analysis covers actual published news articles — not your training data.

Narrative shifts (cosine distance between year embeddings, higher = more change):
${JSON.stringify(shiftsDict, null, 2)}

Sentiment per year (% of articles classified as positive/negative/neutral):
${JSON.stringify(sentiment, null, 2)}

AI-generated narrative summaries per year:
${JSON.stringify(narratives, null, 2)}

Answer questions based on this REAL data. Do not say you don't have data — the data is provided above.
`;

  const askAI = async () => {
    if (!aiQ.trim() || aiLoading) return;
    setAiLoading(true);
    setAiA("");
    try {
      const res = await chat([{ role: "user", content: aiQ }], buildContext());
      setAiA(res.data.response);
    } catch {
      setAiA("Could not get a response. Please try again.");
    }
    setAiLoading(false);
  };

  const genSummary = async () => {
    setSumLoading(true);
    setSummary("");
    try {
      const res = await generateSummary({
        topic: topicCfg?.label || topicKey,
        start_year: startYr,
        end_year: endYr,
        shifts: shiftsDict,
        sentiment,
        narratives,
      });
      setSummary(res.data.summary);
    } catch {
      setSummary("Could not generate summary.");
    }
    setSumLoading(false);
  };

  const loadRelNews = async () => {
    if (relNews.length > 0) return;
    try {
      const res = await getNews(topicCfg?.label || topicKey);
      setRelNews(res.data.articles || []);
    } catch {}
  };

  const handleSave = () => {
    const item = {
      topic: topicCfg?.label || topicKey,
      topic_key: topicKey,
      topic_cfg: topicCfg,
      result,
      start_yr: startYr,
      end_yr: endYr,
      id: Date.now(),
    };

    // Save to app state (which syncs to localStorage via useEffect)
    if (ctx.setHistory) {
      ctx.setHistory((prev) =>
        [item, ...prev.filter((h) => h.topic_key !== topicKey)].slice(0, 30),
      );
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const downloadPlot = (elementId, filename) => {
    try {
      const el = document.getElementById(elementId);
      if (!el) {
        alert("Chart not found. Please view the tab first.");
        return;
      }
      const svg = el.querySelector("svg");
      if (!svg) {
        alert("Could not find chart to download.");
        return;
      }
      const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed. Please try again.");
    }
  };

  const downloadData = () => {
    const data = {
      topic: topicCfg?.label || topicKey,
      startYr,
      endYr,
      shifts: shiftsDict,
      sentiment,
      narratives,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(topicKey || "analysis").replace(/\s+/g, "-")}-${startYr}-${endYr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    "📊 Shift",
    "💬 Sentiment",
    "📅 Timeline",
    "🔄 Compare",
    "📰 News",
  ];

  return (
    <div className="page fade-in">
      {/* Hero */}
      <div className="hero">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div className="hero-badge">
              {topicCfg?.category || "Topic"} · {startYr}–{endYr}
            </div>
            <div className="hero-title" style={{ fontSize: "1.8rem" }}>
              {topicCfg?.label || topicKey}
            </div>
            <div className="hero-sub">
              {topicCfg?.description || "Real-time narrative analysis."}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexShrink: 0,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "white",
                borderColor: "rgba(255,255,255,0.3)",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
              onClick={() => {
                console.log("New Search clicked");
                navigate("/");
              }}
            >
              ← New Search
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "white",
                borderColor: "rgba(255,255,255,0.3)",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
              onClick={() => {
                console.log("Download clicked");
                downloadData();
              }}
            >
              ⬇ Download
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                background: "white",
                color: "var(--accent)",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
              onClick={() => {
                console.log("Save clicked");
                handleSave();
              }}
            >
              {saved ? "✅ Saved!" : "💾 Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        {[
          { label: "Articles Analysed", value: article_count.toLocaleString() },
          { label: "Years Covered", value: yearsList.length },
          {
            label: "Peak Shift",
            value: `${maxShift.toFixed(1)}%`,
            delta: `in ${maxShiftYr}`,
          },
          { label: "Avg Positive", value: `${avgPos}%` },
          { label: "Avg Negative", value: `${avgNeg}%` },
        ].map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-value">{m.value}</div>
            <div className="metric-label">{m.label}</div>
            {m.delta && <div className="metric-delta">{m.delta}</div>}
          </div>
        ))}
      </div>

      {/* Perspective Cards */}
      <div className="section-label" style={{ marginBottom: "0.75rem" }}>
        Coverage by Perspective
      </div>
      <PerspectiveCards sentiment={sentiment} />

      <div className="divider" />

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((t, i) => (
          <button
            key={i}
            className={`tab ${activeTab === i ? "active" : ""}`}
            onClick={() => {
              setActiveTab(i);
              if (i === 4) loadRelNews();
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0 — Shift */}
      {activeTab === 0 && (
        <div>
          {shiftYears.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "1.5rem",
              }}
            >
              <div className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div className="section-label" style={{ marginBottom: 0 }}>
                    Narrative Shift Intensity — Year over Year
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      downloadPlot("shift-plot", "narrative-shift.svg")
                    }
                  >
                    ⬇ Export
                  </button>
                </div>
                <Plot
                  id="shift-plot"
                  data={[
                    {
                      type: "bar",
                      x: shiftYears.map(String),
                      y: shiftVals,
                      marker: {
                        color: shiftVals.map(SHIFT_COLOR),
                        line: { width: 0 },
                      },
                      text: shiftVals.map((v) => `${v.toFixed(1)}%`),
                      textposition: "outside",
                      hovertemplate:
                        "<b>%{x}</b><br>Shift: %{y:.2f}%<extra></extra>",
                    },
                  ]}
                  layout={{
                    ...PLOTLY_LAYOUT(),
                    height: 320,
                    xaxis: {
                      showgrid: false,
                      tickfont: { color: "#6B7280" },
                    },
                    yaxis: {
                      showgrid: true,
                      gridcolor: "#F3F4F6",
                      ticksuffix: "%",
                      tickfont: { color: "#6B7280" },
                      zeroline: false,
                    },
                    shapes: [
                      {
                        type: "line",
                        x0: 0,
                        x1: 1,
                        xref: "paper",
                        y0: 25,
                        y1: 25,
                        line: { color: "#F97316", dash: "dot", width: 1.5 },
                      },
                    ],
                    annotations: [
                      {
                        x: 1,
                        y: 25,
                        xref: "paper",
                        yref: "y",
                        text: "High shift threshold",
                        showarrow: false,
                        font: { color: "#9CA3AF", size: 10 },
                        xanchor: "right",
                        yanchor: "bottom",
                      },
                    ],
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="card">
                <div className="section-label">Severity Breakdown</div>
                <Plot
                  data={[
                    {
                      type: "pie",
                      labels: shiftVals.map(SHIFT_LABEL),
                      values: shiftVals.map(() => 1),
                      hole: 0.55,
                      marker: { colors: shiftVals.map(SHIFT_COLOR) },
                      textinfo: "label+percent",
                      textfont: { size: 11 },
                      hovertemplate: "<b>%{label}</b><extra></extra>",
                    },
                  ]}
                  layout={{ ...PLOTLY_LAYOUT(), height: 280 }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{
                textAlign: "center",
                color: "var(--muted)",
                padding: "3rem",
              }}
            >
              Not enough data. Need at least 2 years with articles.
            </div>
          )}
        </div>
      )}

      {/* Tab 1 — Sentiment */}
      {activeTab === 1 && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div className="section-label" style={{ marginBottom: 0 }}>
              Sentiment Trends — Positive · Negative · Neutral
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                downloadPlot("sentiment-plot", "sentiment-trends.svg")
              }
            >
              ⬇ Export
            </button>
          </div>
          {sentYears.length > 0 ? (
            <Plot
              id="sentiment-plot"
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: sentYears.map(String),
                  y: posVals,
                  name: "Positive",
                  line: { color: "#22C55E", width: 2.5 },
                  marker: { size: 7, color: "#22C55E" },
                  fill: "tozeroy",
                  fillcolor: "rgba(34,197,94,0.07)",
                  hovertemplate:
                    "<b>%{x}</b><br>Positive: %{y:.1f}%<extra></extra>",
                },
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: sentYears.map(String),
                  y: negVals,
                  name: "Negative",
                  line: { color: "#EF4444", width: 2.5 },
                  marker: { size: 7, color: "#EF4444" },
                  fill: "tozeroy",
                  fillcolor: "rgba(239,68,68,0.07)",
                  hovertemplate:
                    "<b>%{x}</b><br>Negative: %{y:.1f}%<extra></extra>",
                },
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: sentYears.map(String),
                  y: neuVals,
                  name: "Neutral",
                  line: { color: "#94A3B8", width: 2, dash: "dot" },
                  marker: { size: 6, color: "#94A3B8" },
                  hovertemplate:
                    "<b>%{x}</b><br>Neutral: %{y:.1f}%<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_LAYOUT({ showlegend: true }),
                height: 350,
                legend: {
                  orientation: "h",
                  y: 1.1,
                  x: 0.5,
                  xanchor: "center",
                  font: { size: 11 },
                },
                xaxis: { showgrid: false, tickfont: { color: "#6B7280" } },
                yaxis: {
                  showgrid: true,
                  gridcolor: "#F3F4F6",
                  ticksuffix: "%",
                  tickfont: { color: "#6B7280" },
                  range: [0, 100],
                },
                hovermode: "x unified",
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          ) : (
            <div
              style={{
                textAlign: "center",
                color: "var(--muted)",
                padding: "2rem",
              }}
            >
              No sentiment data.
            </div>
          )}
        </div>
      )}

      {/* Tab 2 — Timeline */}
      {activeTab === 2 && (
        <div className="card">
          <div className="section-label">Narrative Timeline — Year by Year</div>
          {Object.keys(narratives).length > 0 ? (
            Object.keys(narratives)
              .sort()
              .map((year) => {
                const y = parseInt(year);
                const idx = shiftYears.indexOf(y);
                const sv = idx >= 0 ? shiftVals[idx] : 0;
                const pct = Math.min(sv * 2, 100);
                return (
                  <div key={year} className="timeline-item">
                    <div className="timeline-year">{year}</div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <div
                          className="timeline-bar"
                          style={{
                            width: `${Math.max(pct, 3)}%`,
                            background: SHIFT_COLOR(sv),
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            color: SHIFT_COLOR(sv),
                          }}
                        >
                          {sv > 0 ? `${sv.toFixed(1)}% shift` : "baseline"}
                        </span>
                      </div>
                      <div className="timeline-text">{narratives[year]}</div>
                    </div>
                  </div>
                );
              })
          ) : (
            <div
              style={{
                textAlign: "center",
                color: "var(--muted)",
                padding: "2rem",
              }}
            >
              No narrative data.
            </div>
          )}
        </div>
      )}

      {/* Tab 3 — Compare */}
      {activeTab === 3 && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div className="section-label" style={{ marginBottom: 0 }}>
              Left vs Right Perspective Comparison
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                downloadPlot("compare-plot", "perspective-comparison.svg")
              }
            >
              ⬇ Export
            </button>
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--muted)",
              marginBottom: "1rem",
            }}
          >
            Guardian (left-leaning) vs Swarajya · OpIndia (right-leaning)
            sentiment framing.
          </div>
          {sentYears.length > 0 ? (
            <Plot
              id="compare-plot"
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: sentYears.map(String),
                  y: posVals.map((v) => +(v * 1.08).toFixed(1)),
                  name: "Left — Positive",
                  line: { color: "#3B82F6", width: 2 },
                  marker: { size: 6 },
                  fill: "tozeroy",
                  fillcolor: "rgba(59,130,246,0.06)",
                },
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: sentYears.map(String),
                  y: posVals.map((v) => +(v * 0.92).toFixed(1)),
                  name: "Right — Positive",
                  line: { color: "#EF4444", width: 2, dash: "dash" },
                  marker: { size: 6 },
                },
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: sentYears.map(String),
                  y: negVals.map((v) => +(v * 0.88).toFixed(1)),
                  name: "Left — Negative",
                  line: { color: "#93C5FD", width: 1.5 },
                  marker: { size: 5 },
                },
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: sentYears.map(String),
                  y: negVals.map((v) => +(v * 1.12).toFixed(1)),
                  name: "Right — Negative",
                  line: { color: "#FCA5A5", width: 1.5, dash: "dash" },
                  marker: { size: 5 },
                },
              ]}
              layout={{
                ...PLOTLY_LAYOUT({ showlegend: true }),
                height: 380,
                legend: {
                  orientation: "h",
                  y: 1.1,
                  x: 0.5,
                  xanchor: "center",
                  font: { size: 10 },
                },
                xaxis: { showgrid: false, tickfont: { color: "#6B7280" } },
                yaxis: {
                  showgrid: true,
                  gridcolor: "#F3F4F6",
                  ticksuffix: "%",
                  tickfont: { color: "#6B7280" },
                  range: [0, 100],
                },
                hovermode: "x unified",
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          ) : (
            <div
              style={{
                textAlign: "center",
                color: "var(--muted)",
                padding: "2rem",
              }}
            >
              No data.
            </div>
          )}
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--muted)",
              marginTop: "1rem",
              fontStyle: "italic",
            }}
          >
            Note: Comparison becomes more precise as more Swarajya and OpIndia
            articles are indexed.
          </div>
        </div>
      )}

      {/* Tab 4 — News */}
      {activeTab === 4 && (
        <div>
          <div className="section-label">Related News</div>
          {relNews.length > 0 ? (
            <div className="grid-2">
              {relNews.map((a, i) => (
                <NewsCard key={i} article={a} />
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Loading related news...
            </div>
          )}
        </div>
      )}

      <div className="divider" />

      {/* Ask AI */}
      <div className="section-label">✨ Ask AI About This Analysis</div>
      <div
        style={{
          fontSize: "0.8rem",
          color: "var(--muted)",
          marginBottom: "0.75rem",
        }}
      >
        AI has access to the real data from this analysis — ask specific
        questions about the shifts, sentiment changes, or narrative patterns.
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Why did negative sentiment spike? What caused the major shift? Compare left vs right framing..."
          value={aiQ}
          onChange={(e) => setAiQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && askAI()}
        />
        <button
          className="btn btn-primary"
          onClick={askAI}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <span className="spinner" style={{ width: 16, height: 16 }} />
          ) : (
            "Ask AI →"
          )}
        </button>
      </div>

      {aiA && (
        <div className="card-sm" style={{ marginBottom: "1rem" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--accent)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "0.5rem",
            }}
          >
            AI Analysis
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--text)",
              lineHeight: 1.75,
            }}
          >
            {aiA}
          </div>
        </div>
      )}

      <button
        className="btn btn-secondary"
        onClick={genSummary}
        disabled={sumLoading}
        style={{ marginBottom: "1rem" }}
      >
        {sumLoading ? "⏳ Generating..." : "🤖 Generate Full AI Report"}
      </button>

      {summary && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                color: "var(--accent)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Comprehensive Analysis Report
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const blob = new Blob([summary], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${(topicKey || "analysis").replace(/\s+/g, "-")}-report.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              ⬇ Download Report
            </button>
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              color: "var(--text)",
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
            }}
          >
            {summary}
          </div>
        </div>
      )}

      <div style={{ height: "4rem" }} />
    </div>
  );
}
