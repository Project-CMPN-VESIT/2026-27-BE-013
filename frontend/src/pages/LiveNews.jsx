import { useState, useEffect } from "react";
import { getNews } from "../api/client";

export default function LiveNews() {
  const [news, setNews] = useState({ world: [], india: [] });
  const [newsTab, setNewsTab] = useState("world");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getNews("world", 10).then((r) => setNews((n) => ({ ...n, world: r.data.articles || [] }))),
      getNews("India politics economy", 10).then((r) => setNews((n) => ({ ...n, india: r.data.articles || [] })))
    ]).finally(() => setLoading(false));
  }, []);

  const activeArticles = newsTab === "world" ? news.world : news.india;

  return (
    <div style={{ padding: "2.5rem 1.5rem", maxWidth: "960px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
            Real-Time Wire Feed
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Live News Monitor
          </h1>
          <p style={{ color: "#64748B", fontSize: "0.95rem", margin: "0.4rem 0 0 0" }}>
            Real-time reporting powered by The Guardian Content API and international press wires.
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: "0.35rem", background: "#F1F5F9", padding: "0.3rem", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
          <button
            onClick={() => setNewsTab("world")}
            style={{
              padding: "0.55rem 1.5rem",
              background: newsTab === "world" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.88rem",
              color: newsTab === "world" ? "#4F46E5" : "#64748B",
              cursor: "pointer",
              boxShadow: newsTab === "world" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease"
            }}
          >
            World News
          </button>
          <button
            onClick={() => setNewsTab("india")}
            style={{
              padding: "0.55rem 1.5rem",
              background: newsTab === "india" ? "#FFFFFF" : "transparent",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.88rem",
              color: newsTab === "india" ? "#4F46E5" : "#64748B",
              cursor: "pointer",
              boxShadow: newsTab === "india" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease"
            }}
          >
            India News
          </button>
        </div>
      </div>

      {/* Content list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {loading ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748B" }}>
            <div style={{ width: "24px", height: "24px", border: "2px solid #E2E8F0", borderTopColor: "#4F46E5", borderRadius: "50%", margin: "0 auto 1rem auto", animation: "spin 0.8s linear infinite" }} />
            Fetching live wire despatches...
          </div>
        ) : activeArticles.length === 0 ? (
          <div style={{ padding: "3rem", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", textAlign: "center", color: "#64748B" }}>
            No live articles returned for this category.
          </div>
        ) : (
          activeArticles.map((a, i) => (
            <div
              key={a.id || i}
              style={{
                padding: "1.5rem",
                border: "1px solid #E2E8F0",
                borderRadius: "14px",
                background: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
                transition: "border-color 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#CBD5E1";
                e.currentTarget.style.boxShadow = "0 6px 18px rgba(15, 23, 42, 0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.03)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {a.sectionName || "The Guardian"}
                </span>
                <span style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                  {a.webPublicationDate ? new Date(a.webPublicationDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : ""}
                </span>
              </div>

              <a
                href={a.webUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: "1.18rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  textDecoration: "none",
                  display: "block",
                  marginBottom: "0.6rem",
                  lineHeight: "1.4"
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#4F46E5"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#0F172A"}
              >
                {a.webTitle}
              </a>

              {a.fields?.headline && a.fields.headline !== a.webTitle && (
                <div style={{ fontSize: "0.92rem", color: "#475569", lineHeight: "1.55", marginBottom: "0.75rem" }}>
                  {a.fields.headline}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <a
                  href={a.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "#4F46E5",
                    textDecoration: "none"
                  }}
                >
                  Read Source Article &rarr;
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
