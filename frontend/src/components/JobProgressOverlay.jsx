import React from "react";

/**
 * 5 User-Friendly Investigation Phases mapped from internal pipeline stages
 */
const PHASES = [
  {
    id: 1,
    title: "Discovering Sources",
    description: "Scanning live news feeds, publishers, and archival indices for relevant reporting.",
    stages: ["QUEUED", "DISCOVERING"],
  },
  {
    id: 2,
    title: "Collecting & Preparing Articles",
    description: "Acquiring full-text content, deduplicating, and standardizing metadata.",
    stages: ["ACQUIRING", "EXTRACTING", "DEDUPLICATING"],
  },
  {
    id: 3,
    title: "Understanding Coverage",
    description: "Generating MiniLM dense vector embeddings, semantic shift vectors, and RoBERTa sentiment scores.",
    stages: ["EMBEDDING", "SENTIMENT"],
  },
  {
    id: 4,
    title: "Discovering Narratives",
    description: "Extracting factual claims, semantic similarity clustering, and mapping temporal trajectories.",
    stages: ["CLAIMS", "CLUSTERING", "NARRATIVE_EVOLUTION"],
  },
  {
    id: 5,
    title: "Building the Intelligence Report",
    description: "Linking evidence provenance, source divergence matrices, and synthesizing AI interpretations.",
    stages: ["EVIDENCE", "PROVENANCE", "INTELLIGENCE", "AI", "COMPLETED", "PARTIAL"],
  },
];

export default function JobProgressOverlay({ status, topic, progress, stage, error, metadata, onRetry }) {
  const normStatus = (status || "").toUpperCase();
  const normStage = (stage || status || "").toUpperCase();

  const isCompleted = normStatus === "COMPLETED";
  const isPartial = normStatus === "PARTIAL";
  const isFailed = normStatus === "FAILED";
  const isFinished = isCompleted || isPartial;

  // Determine active phase index (0 to 4)
  let activePhaseIndex = 0;
  if (isFinished) {
    activePhaseIndex = 4;
  } else {
    for (let i = 0; i < PHASES.length; i++) {
      if (PHASES[i].stages.includes(normStage) || PHASES[i].stages.includes(normStatus)) {
        activePhaseIndex = i;
        break;
      }
    }
  }

  // Display percentage (from backend if present, else sensible mapping)
  const displayProgress = isFinished
    ? 100
    : progress !== undefined && progress !== null && progress > 0
    ? Math.min(98, Math.max(5, Math.round(progress)))
    : Math.min(95, Math.max(8, Math.round(((activePhaseIndex + 0.6) / PHASES.length) * 100)));

  // Real backend metrics if available
  const counts = metadata?.counts;
  const timings = metadata?.timings;

  return (
    <div style={{
      maxWidth: "920px",
      margin: "2rem auto",
      padding: "2.5rem",
      background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
      border: "1px solid #E2E8F0",
      borderRadius: "20px",
      boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.08)",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Top Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          background: isFailed ? "#FEF2F2" : isPartial ? "#FFFBEB" : "#EEF2FF",
          color: isFailed ? "#B91C1C" : isPartial ? "#B45309" : "#4F46E5",
          padding: "0.35rem 0.9rem",
          borderRadius: "999px",
          fontSize: "0.8rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "1rem",
          border: `1px solid ${isFailed ? "#FCA5A5" : isPartial ? "#FDE68A" : "#C7D2FE"}`
        }}>
          {!isFinished && !isFailed && (
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#4F46E5",
              animation: "pulse 1.8s infinite ease-in-out"
            }} />
          )}
          {isFailed ? "Investigation Interrupted" : isPartial ? "Partially Completed" : isFinished ? "Investigation Ready" : "Investigation Active"}
        </div>

        <h1 style={{
          fontSize: "2.4rem",
          fontWeight: 800,
          color: "#0F172A",
          margin: "0 0 0.5rem 0",
          letterSpacing: "-0.02em"
        }}>
          {topic ? `Analyzing: ${topic}` : "Analyzing Media Narratives"}
        </h1>

        <p style={{
          color: "#64748B",
          fontSize: "1.05rem",
          maxWidth: "600px",
          margin: "0 auto",
          lineHeight: "1.5"
        }}>
          Cross-examining multi-source journalism to detect framing divergence, semantic trajectories, and empirical claims.
        </p>
      </div>

      {/* Progress Bar & High-Level Progress Metric */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        padding: "1.5rem 2rem",
        marginBottom: "2.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>
            {isFinished ? "Analysis Complete" : `Phase ${activePhaseIndex + 1} of ${PHASES.length}: ${PHASES[activePhaseIndex].title}`}
          </span>
          <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#4F46E5" }}>
            {displayProgress}%
          </span>
        </div>

        <div style={{
          width: "100%",
          height: "10px",
          background: "#EEF2F6",
          borderRadius: "999px",
          overflow: "hidden",
          position: "relative"
        }}>
          <div style={{
            height: "100%",
            width: `${displayProgress}%`,
            background: isFailed ? "#EF4444" : "linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%)",
            borderRadius: "999px",
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)"
          }} />
        </div>

        {/* Live Sub-Status Details */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.9rem",
          fontSize: "0.82rem",
          color: "#64748B"
        }}>
          <div>
            Status: <strong style={{ color: "#0F172A" }}>{normStatus}</strong>
            {normStage && normStage !== normStatus && (
              <span> &bull; Stage: <strong style={{ color: "#0F172A" }}>{normStage}</strong></span>
            )}
          </div>
          {counts && (
            <div>
              Acquired: <strong style={{ color: "#0F172A" }}>{counts.acquired || counts.discovered || 0}</strong> articles
              {counts.usable ? ` (${counts.usable} verified)` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Failure Box (if failed) */}
      {isFailed && (
        <div style={{
          background: "#FEF2F2",
          border: "1px solid #FCA5A5",
          borderRadius: "14px",
          padding: "1.5rem",
          marginBottom: "2rem",
          color: "#991B1B"
        }}>
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontWeight: 700 }}>
            Investigation could not be completed
          </h4>
          <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
            {error || "The background data pipeline encountered an unexpected interruption while querying sources. You can restart the investigation or refine your topic search keywords."}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                marginTop: "1rem",
                padding: "0.6rem 1.25rem",
                background: "#DC2626",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Retry Investigation
            </button>
          )}
        </div>
      )}

      {/* 5 Grouped Visual Phases */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {PHASES.map((p, idx) => {
          const isDone = isFinished || idx < activePhaseIndex;
          const isCurrent = !isFinished && !isFailed && idx === activePhaseIndex;
          const isUpcoming = !isFinished && idx > activePhaseIndex;

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1.25rem",
                padding: "1.25rem 1.5rem",
                borderRadius: "14px",
                border: isCurrent
                  ? "1px solid #818CF8"
                  : isDone
                  ? "1px solid #E2E8F0"
                  : "1px dashed #CBD5E1",
                background: isCurrent
                  ? "#F5F3FF"
                  : isDone
                  ? "#FFFFFF"
                  : "#FAFAFA",
                boxShadow: isCurrent ? "0 4px 12px rgba(99, 102, 241, 0.08)" : "none",
                transition: "all 0.3s ease",
                opacity: isUpcoming ? 0.6 : 1,
              }}
            >
              {/* Step indicator circle */}
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.95rem",
                background: isDone
                  ? "#10B981"
                  : isCurrent
                  ? "#4F46E5"
                  : "#E2E8F0",
                color: isDone || isCurrent ? "#FFFFFF" : "#64748B",
                boxShadow: isCurrent ? "0 0 0 4px rgba(79, 70, 229, 0.2)" : "none"
              }}>
                {isDone ? "✓" : p.id}
              </div>

              {/* Phase Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    margin: 0,
                    color: isCurrent ? "#312E81" : isDone ? "#0F172A" : "#64748B"
                  }}>
                    {p.title}
                  </h3>
                  {isCurrent && (
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#4F46E5",
                      background: "#EEF2FF",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "6px"
                    }}>
                      IN PROGRESS
                    </span>
                  )}
                  {isDone && (
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#059669"
                    }}>
                      Completed
                    </span>
                  )}
                </div>

                <p style={{
                  margin: "0.35rem 0 0 0",
                  fontSize: "0.88rem",
                  color: isCurrent ? "#4338CA" : "#64748B",
                  lineHeight: "1.45"
                }}>
                  {p.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Epistemic note */}
      <div style={{
        marginTop: "2.5rem",
        textAlign: "center",
        fontSize: "0.8rem",
        color: "#94A3B8",
        lineHeight: "1.5"
      }}>
        NarrativeShift processes news articles deterministically with sentence transformers and RoBERTa before generating epistemic AI interpretations.
      </div>
    </div>
  );
}
