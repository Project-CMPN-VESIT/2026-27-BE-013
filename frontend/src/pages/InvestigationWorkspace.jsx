import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getInvestigationDetails,
  getInvestigationJobs,
  getInvestigationShift,
  getInvestigationSentiment,
  getInvestigationNarratives,
  getInvestigationClaims,
  getInvestigationEvidence,
  getInvestigationDocuments,
  getInvestigationDivergence,
  getInvestigationPerspectives,
  getInvestigationWhyShift,
  updateInvestigation,
} from "../api/client";
import SemanticShiftChart from "../components/charts/SemanticShiftChart";
import SentimentDistributionChart from "../components/charts/SentimentDistributionChart";
import SourceDivergenceChart from "../components/charts/SourceDivergenceChart";
import NarrativeEvolutionFlow from "../components/charts/NarrativeEvolutionFlow";
import JobProgressOverlay from "../components/JobProgressOverlay";
import AIAssistantPanel from "../components/AIAssistantPanel";
import UserOpinionsPanel from "../components/UserOpinionsPanel";
import PoliticalPerspectivePanel from "../components/PoliticalPerspectivePanel";

export default function InvestigationWorkspace({ ctx }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inv, setInv] = useState(null);
  const [shift, setShift] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [narratives, setNarratives] = useState(null);
  const [claims, setClaims] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [divergence, setDivergence] = useState(null);
  const [whyShift, setWhyShift] = useState(null);
  const [perspectiveData, setPerspectiveData] = useState(null);

  const [jobStatus, setJobStatus] = useState("QUEUED");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStage, setJobStage] = useState("queued");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Interactive UI states
  const [savedNotification, setSavedNotification] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [expandedClaimId, setExpandedClaimId] = useState(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const currentUser = ctx?.user;

  useEffect(() => {
    let pollInterval;

    const fetchAllData = async () => {
      try {
        const [
          invRes,
          shiftRes,
          sentRes,
          narrRes,
          claimsRes,
          evRes,
          docRes,
          divRes,
          whyRes,
          perspRes,
        ] = await Promise.allSettled([
          getInvestigationDetails(id),
          getInvestigationShift(id),
          getInvestigationSentiment(id),
          getInvestigationNarratives(id),
          getInvestigationClaims(id),
          getInvestigationEvidence(id),
          getInvestigationDocuments(id),
          getInvestigationDivergence(id),
          getInvestigationWhyShift(id),
          getInvestigationPerspectives(id),
        ]);

        if (invRes.status === "fulfilled") {
          setInv(invRes.value.data);
          setTopicInput(invRes.value.data.topic || "");
        }
        if (shiftRes.status === "fulfilled") setShift(shiftRes.value.data);
        if (sentRes.status === "fulfilled") setSentiment(sentRes.value.data);
        if (narrRes.status === "fulfilled") setNarratives(narrRes.value.data);
        if (claimsRes.status === "fulfilled") setClaims(claimsRes.value.data);
        if (evRes.status === "fulfilled") setEvidenceList(evRes.value.data?.evidence || []);
        if (docRes.status === "fulfilled") setDocumentsList(docRes.value.data || []);
        if (divRes.status === "fulfilled") setDivergence(divRes.value.data);
        if (whyRes.status === "fulfilled") setWhyShift(whyRes.value.data);
        if (perspRes.status === "fulfilled") setPerspectiveData(perspRes.value.data?.perspective_analysis || null);
      } catch (err) {
        console.error("Error loading investigation workspace data:", err);
      } finally {
        setLoading(false);
      }
    };

    const checkStatus = async () => {
      try {
        const res = await getInvestigationJobs(id);
        const rawStatus = res.data.job_status || res.data.status || "";
        const status = rawStatus.toUpperCase();
        setJobStatus(status);
        if (res.data.progress !== undefined) setJobProgress(res.data.progress);
        if (res.data.stage) setJobStage(res.data.stage);
        if (res.data.topic && !topicInput) setTopicInput(res.data.topic);

        if (status === "COMPLETED" || status === "PARTIAL") {
          clearInterval(pollInterval);
          fetchAllData();
        } else if (status === "FAILED") {
          clearInterval(pollInterval);
          setError("Investigation pipeline encountered an issue. Try running again.");
          setLoading(false);
        }
      } catch (e) {
        // If status endpoint returns error, attempt loading direct data
        clearInterval(pollInterval);
        fetchAllData();
      }
    };

    checkStatus();
    pollInterval = setInterval(checkStatus, 2500);

    return () => clearInterval(pollInterval);
  }, [id]);

  const handleSaveInvestigation = async () => {
    try {
      await updateInvestigation(id, { topic: topicInput });
      setSavedNotification(true);
      setTimeout(() => setSavedNotification(false), 3000);
    } catch {
      alert("Failed to save investigation changes.");
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    try {
      await updateInvestigation(id, { topic: topicInput.trim() });
      setInv((prev) => (prev ? { ...prev, topic: topicInput.trim() } : prev));
      setEditingTitle(false);
    } catch {
      alert("Failed to rename topic.");
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Investigation link copied to clipboard!");
  };

  const isFinished = ["COMPLETED", "PARTIAL"].includes((jobStatus || "").toUpperCase());
  if (loading && !isFinished) {
    return <JobProgressOverlay status={jobStatus} topic={inv?.topic || topicInput || "Investigation"} progress={jobProgress} stage={jobStage} error={error} metadata={inv?.metadata} />;
  }

  if (error && !inv) {
    return (
      <div style={{ padding: "4rem 2rem", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h2 style={{ fontSize: "1.8rem", color: "#0F172A", marginBottom: "0.5rem" }}>Investigation Unavailable</h2>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>{error}</p>
        <button
          onClick={() => navigate("/")}
          style={{ padding: "0.75rem 1.5rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
        >
          &larr; Start New Search
        </button>
      </div>
    );
  }

  if (!inv) return <div style={{ padding: "3rem", textAlign: "center" }}>No data found.</div>;

  // Extract real backend response fields
  const meta = inv.metadata || {};
  const usableCount = meta.total_usable_articles ?? meta.counts?.usable ?? documentsList.length ?? 0;
  const sparseYears = meta.sparse_years || [];

  // Shifts
  const shiftEntries = shift?.shifts?.shifts || meta.shifts?.shifts || {};
  const transitions = Object.entries(shiftEntries).map(([k, v]) => ({ transition: k, value: v }));
  const peakShift = transitions.length ? Math.max(...transitions.map((t) => Number(t.value))) : null;
  const peakTransition = transitions.find((t) => Number(t.value) === peakShift)?.transition || "N/A";

  // Sentiment
  const sentimentDist = sentiment?.yearly_distributions || [];

  // Narratives
  const narrativeList = narratives?.narratives || [];

  // Claims
  const clusterList = claims?.clusters || [];

  // Divergence
  const divergenceList = divergence?.divergences || [];

  // Shift drivers
  const drivers = whyShift?.drivers || [];

  const DIMENSION_LABELS = {
    semantic_centroid_movement: "Semantic Centroid Movement",
    narrative_theme_composition_change: "Narrative Theme Composition",
    claim_cluster_composition_change: "Claim Cluster Composition",
    source_composition_shift: "Source Composition Shift",
    sentiment_distribution_shift: "Sentiment Distribution Shift",
    temporal_coverage_variance: "Temporal Coverage Variance",
  };

  // Map document id to document object for evidence citation
  const docMap = {};
  documentsList.forEach((d) => {
    docMap[d.id] = d;
  });

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* 1. Header & Investigation Metadata */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <button
              onClick={() => navigate("/history")}
              style={{
                background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
                fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", padding: 0
              }}
            >
              &larr; Saved Investigations
            </button>
            <span style={{ color: "var(--border)" }}>|</span>
            <span style={{
              background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0",
              fontSize: "0.75rem", fontWeight: 700, padding: "0.15rem 0.6rem", borderRadius: "999px", textTransform: "uppercase"
            }}>
              {inv.status || "COMPLETED"}
            </span>
          </div>

          {editingTitle ? (
            <form onSubmit={handleRenameSubmit} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                style={{ fontSize: "1.8rem", fontWeight: 800, padding: "0.3rem 0.6rem", borderRadius: "8px", border: "1px solid var(--accent)" }}
              />
              <button type="submit" style={{ padding: "0.5rem 1rem", background: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Save</button>
              <button type="button" onClick={() => setEditingTitle(false)} style={{ padding: "0.5rem 1rem", background: "#F1F5F9", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            </form>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
                {inv.topic}
              </h1>
              <button
                onClick={() => setEditingTitle(true)}
                title="Rename investigation"
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✏️
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: "1.25rem", color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <span>🗓 <strong>{inv.start_year} &ndash; {inv.end_year}</strong> ({inv.end_year - inv.start_year + 1} Years)</span>
            <span>📰 <strong>{usableCount}</strong> usable source articles</span>
            {meta.latest_source_date && (
              <span>🗓 Freshness: <strong>{meta.latest_source_date.slice(0, 10)}</strong></span>
            )}
            {meta.source_breakdown && Object.keys(meta.source_breakdown).length > 0 ? (
              <span>🗞 <strong>{Object.keys(meta.source_breakdown).length}</strong> source{Object.keys(meta.source_breakdown).length !== 1 ? "s" : ""} across {[...new Set(Object.values(meta.source_breakdown).map(v => v.discovery_method || "unknown"))].length} adapter{[...new Set(Object.values(meta.source_breakdown).map(v => v.discovery_method || "unknown"))].length !== 1 ? "s" : ""}</span>
            ) : (
              <span>🗞 Multi-Source Dataset</span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleSaveInvestigation}
            style={{
              background: savedNotification ? "#ECFDF5" : "#F8FAFC",
              border: `1px solid ${savedNotification ? "#A7F3D0" : "var(--border)"}`,
              color: savedNotification ? "#047857" : "#334155",
              padding: "0.65rem 1.1rem",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {savedNotification ? "✓ Saved to Database" : "💾 Save Investigation"}
          </button>

          <button
            onClick={() => navigate(`/article/new?investigationId=${id}`)}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              padding: "0.65rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)"
            }}
          >
            ✍️ Write Research Article
          </button>

          <button
            onClick={handleShare}
            style={{
              background: "#F8FAFC",
              border: "1px solid var(--border)",
              color: "#475569",
              padding: "0.65rem 1rem",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            🔗 Share
          </button>
        </div>
      </header>

      {/* Sparse Year Notice */}
      {sparseYears.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "1rem", color: "#92400E", fontSize: "0.9rem", display: "flex", gap: "0.5rem" }}>
          <span>⚠️</span>
          <div>
            <strong>Sparse Coverage Advisory:</strong> Years with insufficient article volume: {sparseYears.join(", ")}. These intervals are regularized to prevent sample size bias.
          </div>
        </div>
      )}

      {/* Partial / Low Coverage Advisory */}
      {(inv.status === "partial" || usableCount === 0) && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "1.25rem", color: "#1E40AF", fontSize: "0.92rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.3rem" }}>ℹ️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
              Partial Dataset Completed
            </div>
            <div>
              Direct web scraping yielded limited long-form articles for this specific topic and date range ({inv.start_year}&ndash;{inv.end_year}). Available headlines, metadata, and computed signals are displayed below. For deeper empirical shifts, try broadening the query or using a topic with wider cross-publisher coverage.
            </div>
          </div>
        </div>
      )}

      {/* 2. Hero Finding Section */}
      <section style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
        borderRadius: "16px",
        padding: "2.5rem 3rem",
        color: "white",
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: "2.5rem",
        alignItems: "center",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
      }}>
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
            EMPIRICAL NARRATIVE SHIFT
          </div>
          <div style={{ fontSize: "4.5rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", color: "#FFFFFF" }}>
            {peakShift !== null ? `${peakShift.toFixed(2)}%` : "—"}
          </div>
          <div style={{ fontSize: "1.1rem", color: "#E0E7FF", marginTop: "1rem", fontWeight: 500 }}>
            Peak narrative realignment observed across adjacent periods (<strong>{peakTransition}</strong>).
          </div>
          <div style={{ fontSize: "0.85rem", color: "#94A3B8", marginTop: "0.75rem", fontFamily: "monospace" }}>
            Formula: (1 &minus; Cosine Similarity) &times; 100 on MiniLM L6 embeddings.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: "2.5rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#CBD5E1", lineHeight: "1.6" }}>
            <strong>Semantic Distance:</strong> Measures how far the centroid of news framing shifted in vector space between adjacent yearly representations.
            Unlike sentiment, semantic shift detects thematic and conceptual reframing.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "0.85rem", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.72rem", color: "#94A3B8", textTransform: "uppercase" }}>Dataset Coverage</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38BDF8" }}>{usableCount} Articles</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "0.85rem", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.72rem", color: "#94A3B8", textTransform: "uppercase" }}>Active Claim Clusters</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#34D399" }}>{clusterList.length} Clusters</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Semantic Shift Visualization & Why Did It Shift */}
      <section style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "2rem" }}>
        {/* Semantic Shift Chart */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "1.75rem", background: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: "#0F172A" }}>
              Year-to-Year Semantic Shift
            </h2>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Interactive Bar Plot</span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "0 0 1.25rem 0" }}>
            Adjacent annual transitions measuring thematic trajectory divergence.
          </p>
          <div style={{ height: "300px" }}>
            <SemanticShiftChart transitions={transitions} />
          </div>
        </div>

        {/* Why Did It Shift (Decomposition) */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "1.75rem", background: "#F8FAFC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              SYSTEM OBSERVATION
            </span>
            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>6-Factor Decomposition</span>
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#0F172A" }}>
            Why Did It Shift?
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 1.25rem 0", fontStyle: "italic" }}>
            Deterministic decomposition signals (associated with shift magnitude, not causal proof).
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {drivers.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Decomposition signals being computed...</div>
            ) : (
              [...drivers]
                .sort((a, b) => b.magnitude_score - a.magnitude_score)
                .map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{
                      minWidth: "48px", height: "26px", borderRadius: "6px",
                      background: d.magnitude_score > 30 ? "#EEF2FF" : "#F1F5F9",
                      color: d.magnitude_score > 30 ? "#4338CA" : "#334155",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: "0.78rem"
                    }}>
                      {d.magnitude_score.toFixed(0)}%
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1E293B" }}>
                        {DIMENSION_LABELS[d.dimension_name] || d.dimension_name}
                      </div>
                      {d.phrasing_context && (
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                          {d.phrasing_context}
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      {/* 4. Grounded AI Interpretation & Ask AI Assistant */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Grounded Summary */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "1.75rem", background: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              AI INTERPRETATION
            </span>
            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>Grounded in Real Findings</span>
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0F172A" }}>
            Executive Narrative Synthesis
          </h2>
          <AIAssistantPanel investigationId={id} type="summary" metadata={meta} whyShift={whyShift} shift={shift} />
        </div>

        {/* Ask AI Chat Panel */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "1.75rem", background: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              AI INVESTIGATOR
            </span>
            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>Temporally Grounded</span>
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0F172A" }}>
            Ask AI About This Investigation
          </h2>
          <AIAssistantPanel investigationId={id} type="ask" metadata={meta} whyShift={whyShift} shift={shift} />
        </div>
      </section>

      {/* 5. Narrative Evolution (Visual Timeline & Supporting Table) */}
      <section style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "2rem", background: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Narrative Evolution Timeline
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.3rem 0 0 0" }}>
              Signature year-by-year narrative continuity, thematic persistence, and reframing transitions.
            </p>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
          <NarrativeEvolutionFlow narratives={narrativeList} />
        </div>

        {/* Supporting Table */}
        {narrativeList.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "0.6rem 0.75rem", width: "80px" }}>Year</th>
                  <th style={{ padding: "0.6rem 0.75rem", width: "120px" }}>Transition Type</th>
                  <th style={{ padding: "0.6rem 0.75rem", width: "100px" }}>Shift Delta</th>
                  <th style={{ padding: "0.6rem 0.75rem" }}>Analytical Narrative Summary</th>
                </tr>
              </thead>
              <tbody>
                {narrativeList.map((n, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "0.75rem", fontWeight: 700, color: "#1E293B" }}>{n.year}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span style={{
                        padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700,
                        background: n.transition_type === "reframed" ? "#FEF3C7" : "#F1F5F9",
                        color: n.transition_type === "reframed" ? "#92400E" : "#475569",
                        textTransform: "uppercase"
                      }}>
                        {n.transition_type || "persistent"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem", fontWeight: 600 }}>{n.shift_delta ? `${n.shift_delta.toFixed(2)}%` : "0.00%"}</td>
                    <td style={{ padding: "0.75rem", color: "#334155", lineHeight: "1.5" }}>{n.narrative_summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. Sentiment Distribution & Source Divergence */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Sentiment Distribution */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "1.75rem", background: "white" }}>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.35rem 0", color: "#0F172A" }}>
            Sentiment Distribution Over Time
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 1.25rem 0" }}>
            Yearly percentage breakdown: Negative, Neutral, Positive (CardiffNLP RoBERTa).
          </p>
          <div style={{ height: "300px" }}>
            <SentimentDistributionChart sentiment={sentimentDist} />
          </div>
        </div>

        {/* Source Divergence */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "1.75rem", background: "white" }}>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.35rem 0", color: "#0F172A" }}>
            Source Perspective Divergence
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 1.25rem 0" }}>
            Cross-perspective divergence scores over time (Left / Centre / Right) — where sufficient cross-source data exists.
          </p>
          <div style={{ height: "300px" }}>
            <SourceDivergenceChart divergence={divergenceList} />
          </div>
        </div>
      </section>

      {/* 7. Source & Political Perspective Analysis */}
      <section style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "2rem", background: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>
              CLASSIFICATION METADATA
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Political Perspective
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.3rem 0 0 0" }}>
              Source orientation classifications are metadata used for comparative analysis and should not be interpreted as objective judgments.
            </p>
          </div>
          {perspectiveData && (
            <span style={{
              background: perspectiveData.is_sufficient ? "#ECFDF5" : "#FFFBEB",
              color: perspectiveData.is_sufficient ? "#047857" : "#92400E",
              border: `1px solid ${perspectiveData.is_sufficient ? "#A7F3D0" : "#FDE68A"}`,
              fontSize: "0.78rem", fontWeight: 700, padding: "0.3rem 0.75rem",
              borderRadius: "999px", textTransform: "uppercase", whiteSpace: "nowrap",
            }}>
              {perspectiveData.is_sufficient ? "✓ Cross-Perspective Data Available" : "⚠ Single-Perspective Dataset"}
            </span>
          )}
        </div>
        <PoliticalPerspectivePanel perspectiveAnalysis={perspectiveData} />
      </section>

      {/* 8. Claims & Verifiable Evidence Explorer */}
      <section style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "2rem", background: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Claims & Verifiable Evidence Spans
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.3rem 0 0 0" }}>
              Empirical statements extracted from source documents with verified quote citations and dates.
            </p>
          </div>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
            {clusterList.length} Clusters &bull; {evidenceList.length} Evidence Quotes
          </span>
        </div>

        {clusterList.length === 0 ? (
          <div style={{ color: "var(--muted)", padding: "2rem 0" }}>No claim clusters available.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
            {clusterList.map((c, i) => {
              const isExpanded = expandedClaimId === c.id || (expandedClaimId === null && i === 0);
              // Find matching evidence spans
              const matchingEvidence = evidenceList.filter(
                (e) => e.claim_id === c.id || e.document_id === c.id
              ).slice(0, 3);

              return (
                <div
                  key={c.id || i}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "1.5rem",
                    background: "#FFFFFF",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1E293B", lineHeight: "1.5" }}>
                        "{c.cluster_label}"
                      </div>
                      <div style={{ display: "flex", gap: "1rem", fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.5rem", alignItems: "center" }}>
                        <span style={{ background: "#EEF2FF", color: "#4F46E5", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 700 }}>
                          Year {c.year}
                        </span>
                        <span>{c.member_claims_count} member claims</span>
                        {c.description && <span>&bull; {c.description}</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedClaimId(isExpanded ? "" : c.id)}
                      style={{
                        background: isExpanded ? "#EEF2FF" : "#F8FAFC",
                        border: "1px solid var(--border)",
                        color: isExpanded ? "#4F46E5" : "#475569",
                        borderRadius: "6px",
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0
                      }}
                    >
                      {isExpanded ? "Hide Evidence ▲" : `Inspect Evidence (${c.member_claims_count}) ▼`}
                    </button>
                  </div>

                  {/* Evidence Spans Drilldown */}
                  {isExpanded && (
                    <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid #F1F5F9" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.75rem" }}>
                        Supporting Document Quotes & Links:
                      </div>

                      {documentsList.slice(0, 2).map((doc, docIdx) => (
                        <div key={docIdx} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.85rem 1rem", marginBottom: "0.6rem" }}>
                          <div style={{ fontSize: "0.92rem", color: "#334155", fontStyle: "italic", lineHeight: "1.5" }}>
                            "{c.cluster_label}"
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                            <span>📰 {doc.title} ({doc.published_year})</span>
                            {doc.canonical_url && (
                              <a
                                href={doc.canonical_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}
                              >
                                View Source Article &rarr;
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 9. User Opinions & Research Annotations */}
      <section style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "2rem", background: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Research Opinions & Community Annotations
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.3rem 0 0 0" }}>
              Researcher perspectives, contextual qualifications, and qualitative notes.
            </p>
          </div>
          <span style={{
            background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A",
            fontSize: "0.75rem", fontWeight: 800, padding: "0.2rem 0.6rem", borderRadius: "999px"
          }}>
            USER OPINION LAYER
          </span>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <UserOpinionsPanel
            investigationId={id}
            currentUser={currentUser}
            onAuthRequired={() => ctx?.setShowLogin && ctx.setShowLogin(true)}
          />
        </div>
      </section>

      {/* 10. Methodology & Provenance Details */}
      <section style={{ borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          style={{
            background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
            fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", padding: 0
          }}
        >
          {showMethodology ? "▲ Hide Technical Methodology & Provenance" : "▼ Show Technical Methodology, Models & Provenance"}
        </button>

        {showMethodology && (
          <div style={{ marginTop: "1.5rem", background: "#F8FAFC", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.75rem", fontSize: "0.9rem", color: "#334155", lineHeight: "1.6" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#0F172A" }}>
              Mathematical Methodology & Model Provenance
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
              <div>
                <strong>Embedding Pipeline:</strong>
                <ul style={{ margin: "0.5rem 0 0 1.25rem", color: "var(--muted)" }}>
                  <li>Model: <code>sentence-transformers/all-MiniLM-L6-v2</code></li>
                  <li>Metric: Cosine Distance &times; 100 between yearly centroid representations</li>
                  <li>Regularization: Temporal coverage variance weighting for sparse years</li>
                </ul>
              </div>
              <div>
                <strong>Sentiment & Decomposition:</strong>
                <ul style={{ margin: "0.5rem 0 0 1.25rem", color: "var(--muted)" }}>
                  <li>Sentiment: <code>cardiffnlp/twitter-roberta-base-sentiment-latest</code></li>
                  <li>Decomposition: 6 non-causal orthogonal intelligence dimensions</li>
                  <li>Verification: 100% database persistence on Neon PostgreSQL</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
