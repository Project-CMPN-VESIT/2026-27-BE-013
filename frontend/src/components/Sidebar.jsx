import { useNavigate, useLocation } from "react-router-dom";

export default function Sidebar({ ctx }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, user, handleLogout } = ctx;

  const links = [
    { name: "Search & Discovery", path: "/", icon: "SEARCH" },
    { name: "Saved Investigations", path: "/history", icon: "HISTORY" },
    { name: "Research Articles", path: "/articles", icon: "DOCS" },
    { name: "Live News Monitor", path: "/news", icon: "NEWS" },
    { name: "Article URL Analyzer", path: "/analyzer", icon: "ANALYZER" },
    { name: "Account Profile", path: "/profile", icon: "PROFILE" },
  ];

  const handleNav = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div
      className={`sidebar ${sidebarOpen ? "open" : ""}`}
      style={{
        background: "#0F172A",
        color: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #1E293B",
        boxShadow: "4px 0 24px rgba(0, 0, 0, 0.2)"
      }}
    >
      {/* Brand Header */}
      <div style={{
        padding: "1.75rem 1.5rem",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div onClick={() => handleNav("/")} style={{ cursor: "pointer" }}>
          <div style={{
            fontSize: "1.35rem",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            NarrativeShift
          </div>
          <div style={{ fontSize: "0.72rem", color: "#818CF8", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "0.15rem" }}>
            Media Intelligence
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", padding: "1.25rem 0.85rem", flex: 1 }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0.65rem 0.5rem 0.65rem" }}>
          Platform Navigation
        </div>
        {links.map(l => {
          const isActive = location.pathname === l.path;
          return (
            <div
              key={l.name}
              onClick={() => handleNav(l.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.7rem 0.85rem",
                borderRadius: "8px",
                cursor: "pointer",
                backgroundColor: isActive ? "rgba(99, 102, 241, 0.18)" : "transparent",
                color: isActive ? "#FFFFFF" : "#94A3B8",
                border: isActive ? "1px solid rgba(99, 102, 241, 0.35)" : "1px solid transparent",
                fontWeight: isActive ? 600 : 500,
                fontSize: "0.9rem",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.color = "#F1F5F9";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#94A3B8";
                }
              }}
            >
              <span style={{ fontSize: "0.85rem" }}>{l.name}</span>
            </div>
          );
        })}
      </div>

      {/* User / Session Footer */}
      {user ? (
        <div style={{
          padding: "1.25rem 1.25rem",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(0, 0, 0, 0.2)",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center"
        }}>
          {user.photo ? (
            <img src={user.photo} alt="user" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)" }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: "white" }}>
              {(user.name || "U")[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#F8FAFC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.name}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#94A3B8",
              fontSize: "0.75rem",
              padding: "0.3rem 0.55rem",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div style={{ padding: "1.25rem", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <button
            onClick={() => { ctx.setShowLogin(true); setSidebarOpen(false); }}
            style={{
              width: "100%",
              padding: "0.7rem",
              background: "#4F46E5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.88rem"
            }}
          >
            Sign In with Google
          </button>
        </div>
      )}
    </div>
  );
}
