import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTopics,
  getCached,
  analyse,
  getNews,
  summariseURL,
} from "../api/client";
import NewsCard from "../components/NewsCard";

export default function Home({ ctx }) {
  const { onSearchDone, setShowLogin, user } = ctx;
  const navigate = useNavigate();

  const [topics, setTopics] = useState({});
  const [cachedKeys, setCachedKeys] = useState([]);
  const [news, setNews] = useState({ world: [], india: [] });
  const [newsTab, setNewsTab] = useState("world");
  const [query, setQuery] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [urlSummary, setUrlSummary] = useState("");
  const [startYr, setStartYr] = useState(2021);
  const [endYr, setEndYr] = useState(2024);
  const [loading, setLoading] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showHotModal, setShowHotModal] = useState(false);

  const years = Array.from({ length: 12 }, (_, i) => 2015 + i);
  const futureYears = [2025, 2026];
  const selectedYears = [startYr, endYr];
  const hasFutureYears = selectedYears.some((y) => futureYears.includes(y));

  useEffect(() => {
    getTopics()
      .then((r) => {
        setTopics(r.data);
        const keys = Object.keys(r.data);
        Promise.all(
          keys.map((k) =>
            getCached(k, 2015, 2024)
              .then(() => k)
              .catch(() => null),
          ),
        ).then((res) => setCachedKeys(res.filter(Boolean)));
      })
      .catch(() => {});

    getNews("world")
      .then((r) => setNews((n) => ({ ...n, world: r.data.articles || [] })))
      .catch(() => {});
    getNews("India politics economy")
      .then((r) => setNews((n) => ({ ...n, india: r.data.articles || [] })))
      .catch(() => {});
  }, []);

  const doSearch = async (topicKey, topicCfg) => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    // Validate year range
    if (hasFutureYears) {
      setError(
        "⚠️ Cannot analyse 2025–2026: Guardian has not indexed these years. Please select 2015–2024.",
      );
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Checking cache...");
    try {
      // Try cache first
      try {
        const cached = await getCached(topicKey, startYr, endYr);
        // getCached returns axios response, cached.data is {shifts, sentiment, narratives, article_count}
        const resultData = cached.data;
        console.log("CACHED RESULT:", resultData);
        onSearchDone(resultData, topicKey, topicCfg, startYr, endYr);
        setLoading(false);
        setStatus("");
        return;
      } catch (cacheErr) {
        console.log("Not cached, fetching...");
      }
      setStatus("Fetching articles...");
      const res = await analyse(topicKey, startYr, endYr);
      // analyse returns {status, data: {shifts, sentiment, narratives, article_count}}
      const resultData = res.data.data || res.data;
      console.log("ANALYSE RESULT:", resultData);
      onSearchDone(resultData, topicKey, topicCfg, startYr, endYr);
      setLoading(false);
      setStatus("");
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || "Analysis failed. Please try again.";
      // Provide helpful message if it's a computation failure
      let displayMsg = errorMsg;
      if (errorMsg.includes("Not cached") || errorMsg.includes("computation")) {
        displayMsg = `Unable to fetch data for ${startYr}–${endYr}. Try a different year range (2015–2024) or check if Guardian has indexed this topic.`;
      }
      setError(displayMsg);
      setLoading(false);
      setStatus("");
    }
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    const key = query.toLowerCase().trim();
    const cfg = topics[key] || {
      label: query.trim(),
      description: `Analysis for "${query}"`,
      category: "Custom",
      color: "#5B5BD6",
    };
    doSearch(key, cfg);
  };

  const handleUrlAnalyse = async () => {
    if (!articleUrl.startsWith("http")) return;
    setLoadingUrl(true);
    setUrlSummary("");
    try {
      const res = await summariseURL(articleUrl);
      setUrlSummary(res.data.summary);
    } catch {
      setUrlSummary("Could not analyse this URL.");
    }
    setLoadingUrl(false);
  };

  // Group topics by category
  const cats = {};
  Object.entries(topics).forEach(([key, val]) => {
    if (!cats[val.category]) cats[val.category] = [];
    cats[val.category].push({ key, ...val });
  });

  return (
    <div className="page fade-in">
      {/* Hero */}
      <div className="hero">
        <div className="hero-badge">✦ AI-Powered Media Intelligence</div>
        <div className="hero-title">
          How does media narrative
          <br />
          shift over time?
        </div>
        <div className="hero-sub">
          Track any topic across thousands of real articles — detecting semantic
          drift, sentiment trends, and narrative turning points from 2015 to
          2026 across Left, Centre, and Right perspectives.
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: "1rem" }}>
        <div className="search-wrap">
          <span
            style={{ fontSize: "1.1rem", color: "var(--muted)", flexShrink: 0 }}
          >
            🔍
          </span>
          <input
            className="search-input"
            placeholder="Search any topic — India Politics, Climate Change, Adani controversy..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            className="btn btn-secondary"
            onClick={() => setShowHotModal(true)}
            style={{ flexShrink: 0 }}
          >
            🔥 Hot Topics
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={loading}
            style={{ flexShrink: 0 }}
          >
            {loading ? <span className="spinner" /> : "Analyse"}
          </button>
        </div>
      </div>

      {/* Year range */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.82rem",
            color: "var(--muted)",
            fontWeight: 500,
          }}
        >
          Year range:
        </span>
        <select
          className="input"
          style={{ width: "auto" }}
          value={startYr}
          onChange={(e) => {
            const newStart = Number(e.target.value);
            setStartYr(newStart);
            if (newStart > endYr) setEndYr(newStart);
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span style={{ color: "var(--muted)" }}>→</span>
        <select
          className="input"
          style={{ width: "auto" }}
          value={endYr}
          onChange={(e) => {
            const newEnd = Number(e.target.value);
            if (newEnd < startYr) {
              setError("End year must be after start year");
              setTimeout(() => setError(""), 3000);
              return;
            }
            setEndYr(newEnd);
          }}
        >
          {years.filter((y) => y >= startYr).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Future years warning */}
      {hasFutureYears && (
        <div
          className="status-banner"
          style={{
            background: "rgba(249, 115, 22, 0.15)",
            borderColor: "rgba(249, 115, 22, 0.3)",
            color: "#EA580C",
            marginBottom: "1rem",
          }}
        >
          ⚠️ Guardian has not yet indexed articles for 2025–2026. Computation
          may fail or return incomplete results. Select 2015–2024 for reliable
          analysis.
        </div>
      )}

      {/* Status / Error */}
      {status && (
        <div className="status-banner status-info">
          <span
            className="spinner"
            style={{ width: 16, height: 16, flexShrink: 0 }}
          />
          {status}
        </div>
      )}
      {error && (
        <div className="status-banner status-error">
          ❌ {error}
          <button
            onClick={() => setError("")}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "2rem",
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div>
          {/* Article URL analyser */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div className="section-label">Analyse any article URL</div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <input
                className="input"
                placeholder="Paste article URL here..."
                value={articleUrl}
                onChange={(e) => {
                  setArticleUrl(e.target.value);
                  if (!e.target.value) setUrlSummary("");
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleUrlAnalyse}
                disabled={loadingUrl}
                style={{ flexShrink: 0 }}
              >
                {loadingUrl ? <span className="spinner" /> : "📄 Analyse"}
              </button>
              {(articleUrl || urlSummary) && (
                <button
                  className="btn btn-ghost"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    setArticleUrl("");
                    setUrlSummary("");
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            {urlSummary && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  background: "var(--bg2)",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  color: "var(--text2)",
                  lineHeight: 1.7,
                  border: "1px solid var(--border)",
                }}
              >
                {urlSummary}
              </div>
            )}
          </div>

          {/* Sign in prompt if not logged in */}
          {!user && (
            <div
              className="card"
              style={{
                marginBottom: "1.5rem",
                textAlign: "center",
                padding: "2rem",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
                🔐
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--text)",
                  marginBottom: "0.5rem",
                }}
              >
                Sign in to start analysing
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  marginBottom: "1.25rem",
                }}
              >
                Free forever. No credit card required.
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowLogin(true)}
              >
                Sign in with Google →
              </button>
            </div>
          )}
        </div>

        {/* Right column — News */}
        <div className="card" style={{ position: "sticky", top: "80px" }}>
          <div className="section-label">Latest News</div>
          <div
            style={{
              display: "flex",
              gap: "4px",
              marginBottom: "1rem",
              background: "var(--bg2)",
              borderRadius: "8px",
              padding: "3px",
            }}
          >
            {["world", "india"].map((tab) => (
              <button
                key={tab}
                onClick={() => setNewsTab(tab)}
                style={{
                  flex: 1,
                  padding: "0.4rem",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  transition: "all 0.15s",
                  background: newsTab === tab ? "white" : "transparent",
                  color: newsTab === tab ? "var(--accent)" : "var(--muted)",
                  boxShadow: newsTab === tab ? "var(--shadow-sm)" : "none",
                }}
              >
                {tab === "world" ? "🌍 World" : "🇮🇳 India"}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: "420px", overflowY: "auto" }}>
            {(newsTab === "world" ? news.world : news.india).map((a, i) => (
              <NewsCard key={i} article={a} />
            ))}
            {(newsTab === "world" ? news.world : news.india).length === 0 && (
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.82rem",
                  textAlign: "center",
                  padding: "1rem",
                }}
              >
                Loading news...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hot Topics Modal */}
      {showHotModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHotModal(false);
          }}
        >
          <div className="modal fade-in">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: "var(--text)",
                  }}
                >
                  🔥 Hot Topics
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--muted)",
                    marginTop: "0.2rem",
                  }}
                >
                  Select a topic to analyse
                </div>
              </div>
              <button
                onClick={() => setShowHotModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  fontSize: "1.2rem",
                }}
              >
                ✕
              </button>
            </div>

            {Object.entries(cats)
              .sort()
              .map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "var(--muted)",
                      marginBottom: "0.6rem",
                    }}
                  >
                    {cat}
                  </div>
                  <div>
                    {items.map((item) => {
                      const isCached = cachedKeys.includes(item.key);
                      return (
                        <span
                          key={item.key}
                          className={`pill ${isCached ? "cached" : ""}`}
                          onClick={() => {
                            setShowHotModal(false);
                            setQuery(item.label);
                            doSearch(item.key, item);
                          }}
                        >
                          {isCached ? "✅" : "📊"} {item.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
