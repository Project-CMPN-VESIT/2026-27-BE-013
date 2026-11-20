export default function TopicPills({ topics, onSelect, cached }) {
  const cats = {};
  Object.entries(topics).forEach(([key, val]) => {
    if (!cats[val.category]) cats[val.category] = [];
    cats[val.category].push({ key, ...val });
  });

  return (
    <div>
      {Object.entries(cats)
        .sort()
        .map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--muted)",
                marginBottom: "0.5rem",
              }}
            >
              {cat}
            </div>
            <div>
              {items.map((item) => {
                const isCached = cached?.includes(item.key);
                return (
                  <span
                    key={item.key}
                    className="pill"
                    style={{ borderLeftColor: item.color }}
                    onClick={() => onSelect(item.key, item)}
                  >
                    {isCached ? "🟢 " : ""}
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
