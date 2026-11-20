import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "75vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "2rem",
    }}>
      <div style={{
        width: "80px",
        height: "80px",
        borderRadius: "20px",
        background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "2rem",
        fontWeight: 800,
        marginBottom: "1.5rem",
        boxShadow: "0 10px 25px rgba(99, 102, 241, 0.3)",
      }}>
        404
      </div>
      <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#0F172A", marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
        Page Not Found
      </h1>
      <p style={{ fontSize: "1.05rem", color: "var(--muted)", maxWidth: "480px", lineHeight: "1.6", marginBottom: "2rem" }}>
        The investigation, article, or page you are looking for may have been moved, deleted, or requires specific authorization.
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
          }}
        >
          🔍 New Investigation
        </button>
        <button
          onClick={() => navigate("/history")}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#F1F5F9",
            color: "#334155",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          📁 Saved Investigations
        </button>
        <button
          onClick={() => navigate("/articles")}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#F1F5F9",
            color: "#334155",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          📰 Research Articles
        </button>
      </div>
    </div>
  );
}
