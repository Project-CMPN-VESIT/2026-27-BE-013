import { useState, useRef, useEffect } from "react";
import { chat } from "../api/client";

export default function ChatBot({ ctx }) {
  const { result, topicCfg } = ctx;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContext = () => {
    if (!result) return "";
    return `Topic: ${topicCfg?.label || "Unknown"}
Shifts: ${JSON.stringify(result.shifts?.shifts || {})}
Sentiment: ${JSON.stringify(result.sentiment || {})}
Narratives: ${JSON.stringify(result.narratives || {})}`;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await chat([...messages, userMsg], buildContext());
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, could not get a response. Please try again.",
        },
      ]);
    }
    setLoading(false);
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)}>
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>💬 Ask AI Analyst</span>
            <button
              onClick={() => setMessages([])}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              Clear
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.82rem",
                  textAlign: "center",
                  marginTop: "2rem",
                }}
              >
                Ask anything about media narratives, this analysis, or any news
                topic.
                {result && (
                  <div style={{ marginTop: "0.5rem", color: "var(--accent)" }}>
                    Context loaded: {topicCfg?.label}
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant" style={{ opacity: 0.6 }}>
                Analysing...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button
              className="btn btn-primary"
              onClick={send}
              disabled={loading}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
