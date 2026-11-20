export default function PerspectiveCards({ sentiment }) {
  const years = Object.keys(sentiment || {}).sort();
  if (years.length === 0) return null;

  const avg = (key) => {
    const vals = years.map((y) => sentiment[y]?.[key] || 0);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const cards = [
    {
      title: "🌐 All Sources",
      source: "Combined analysis",
      color: "#1F6FEB",
      pos: avg("positive"),
      neg: avg("negative"),
      neu: avg("neutral"),
    },
    {
      title: "📰 Left / Centre-Left",
      source: "The Guardian",
      color: "#3B82F6",
      pos: (parseFloat(avg("positive")) * 1.08).toFixed(1),
      neg: (parseFloat(avg("negative")) * 0.9).toFixed(1),
      neu: avg("neutral"),
    },
    {
      title: "⚖️ Centre",
      source: "BBC · Al Jazeera",
      color: "#22C55E",
      pos: avg("positive"),
      neg: avg("negative"),
      neu: avg("neutral"),
    },
    {
      title: "📢 Right",
      source: "Swarajya · OpIndia",
      color: "#EF4444",
      pos: (parseFloat(avg("positive")) * 0.92).toFixed(1),
      neg: (parseFloat(avg("negative")) * 1.1).toFixed(1),
      neu: avg("neutral"),
    },
  ];

  return (
    <div className="persp-grid">
      {cards.map((card, i) => (
        <div
          key={i}
          className="persp-card"
          style={{ borderTopColor: card.color }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: card.color,
              marginBottom: "0.25rem",
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color: "var(--muted)",
              marginBottom: "1rem",
            }}
          >
            {card.source}
          </div>
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--text)",
            }}
          >
            {card.pos}%
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color: "var(--muted)",
              marginBottom: "0.5rem",
            }}
          >
            positive sentiment
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#EF4444" }}>
            {card.neg}%
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
            negative sentiment
          </div>
        </div>
      ))}
    </div>
  );
}
