import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { authClient } from "./api/auth";
import Sidebar from "./components/Sidebar";
import ChatBot from "./components/ChatBot";
import LoginModal from "./components/LoginModal";
import LandingPage from "./pages/LandingPage";
import InvestigationWorkspace from "./pages/InvestigationWorkspace";
import InvestigationHistory from "./pages/InvestigationHistory";
import LiveNews from "./pages/LiveNews";
import ArticleAnalyzer from "./pages/ArticleAnalyzer";
import Profile from "./pages/Profile";
import Articles from "./pages/Articles";
import ArticleEditor from "./pages/ArticleEditor";
import ArticleReader from "./pages/ArticleReader";
import NotFound from "./pages/NotFound";

function AppInner() {
  const { data, isPending: authLoading } = authClient.useSession();
  const user = data?.user ? {
    id: data.user.id,
    name: data.user.name || "User",
    email: data.user.email,
    photo: data.user.image,
  } : null;
  const setUser = () => {};
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [history, setHistoryState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ns_history") || "[]");
    } catch {
      return [];
    }
  });

  // Sync history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("ns_history", JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history to localStorage:", e);
    }
  }, [history]);

  const setHistory = (fn) => {
    setHistoryState((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      return next;
    });
  };
  const navigate = useNavigate();

  // Load result from sessionStorage
  const getStoredResult = () => {
    try {
      const stored = sessionStorage.getItem("ns_result");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const getStoredMeta = () => {
    try {
      const stored = sessionStorage.getItem("ns_meta");
      return stored
        ? JSON.parse(stored)
        : { topicKey: null, topicCfg: null, startYr: 2021, endYr: 2024 };
    } catch {
      return { topicKey: null, topicCfg: null, startYr: 2021, endYr: 2024 };
    }
  };

  const [result, setResultState] = useState(getStoredResult);
  const [meta, setMetaState] = useState(getStoredMeta);

  const setResult = (res) => {
    sessionStorage.setItem("ns_result", JSON.stringify(res));
    setResultState(res);
  };

  const setMeta = (topicKey, topicCfg, startYr, endYr) => {
    const m = { topicKey, topicCfg, startYr, endYr };
    sessionStorage.setItem("ns_meta", JSON.stringify(m));
    setMetaState(m);
  };

  useEffect(() => {
    // Session is automatically synchronized by authClient hooks now
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await authClient.signIn.social({ 
        provider: "google", 
        callbackURL: window.location.origin 
      });
      setShowLogin(false);
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    sessionStorage.clear();
    setHistory([]);
    setSidebarOpen(false);
    navigate("/");
  };

  const onSearchDone = (res, key, cfg, s, e) => {
    setResult(res);
    setMeta(key, cfg, s, e);

    // Always save to history (both state and localStorage)
    const newItem = {
      topic: cfg?.label || key,
      topic_key: key,
      topic_cfg: cfg,
      result: res,
      start_yr: s,
      end_yr: e,
      id: Date.now(),
    };

    setHistory((prev) =>
      [newItem, ...prev.filter((h) => h.topic_key !== key)].slice(0, 30),
    );

    navigate("/results");
  };

  const loadFromHistory = (item) => {
    setResult(item.result);
    setMeta(item.topic_key, item.topic_cfg, item.start_yr, item.end_yr);
    navigate("/results");
  };

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const ctx = {
    user,
    setUser,
    handleGoogleLogin,
    handleLogout,
    sidebarOpen,
    setSidebarOpen,
    result,
    topicKey: meta.topicKey,
    topicCfg: meta.topicCfg,
    startYr: meta.startYr,
    endYr: meta.endYr,
    onSearchDone,
    loadFromHistory,
    history,
    setHistory,
    showLogin,
    setShowLogin,
  };

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar ctx={ctx} />

      <div className="main-content">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.3rem",
                color: "var(--text)",
                fontSize: "1.2rem",
              }}
            >
              ☰
            </button>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--accent)",
                cursor: "pointer",
                letterSpacing: "-0.02em",
              }}
              onClick={() => navigate("/")}
            >
              📡 NarrativeShift
            </div>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            {user ? (
              <>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  Welcome, {user.name.split(" ")[0]} 👋
                </span>
                {user.photo && (
                  <img
                    src={user.photo}
                    alt="avatar"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "2px solid var(--border)",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/profile")}
                  />
                )}
              </>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowLogin(true)}
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        <Routes>
          <Route path="/" element={<LandingPage ctx={ctx} />} />
          <Route path="/investigation/:id" element={<InvestigationWorkspace ctx={ctx} />} />
          <Route path="/history" element={<InvestigationHistory ctx={ctx} />} />
          <Route path="/articles" element={<Articles ctx={ctx} />} />
          <Route path="/article/new" element={<ArticleEditor ctx={ctx} />} />
          <Route path="/article/edit/:id" element={<ArticleEditor ctx={ctx} />} />
          <Route path="/article/:id" element={<ArticleReader ctx={ctx} />} />
          <Route path="/news" element={<LiveNews ctx={ctx} />} />
          <Route path="/analyzer" element={<ArticleAnalyzer ctx={ctx} />} />
          <Route path="/profile" element={<Profile ctx={ctx} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

      <ChatBot ctx={ctx} />
      {showLogin && <LoginModal ctx={ctx} />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
