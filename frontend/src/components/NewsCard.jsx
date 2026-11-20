export default function NewsCard({ article }) {
  const date = article.webPublicationDate?.slice(0, 10) || "";
  const title = article.webTitle || "";
  const url = article.webUrl || "#";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="news-card"
    >
      <div
        style={{
          fontSize: "0.68rem",
          color: "var(--muted)",
          marginBottom: "0.35rem",
        }}
      >
        {date} · The Guardian
      </div>
      <div
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "var(--text)",
          lineHeight: 1.4,
        }}
      >
        {title.slice(0, 100)}
        {title.length > 100 ? "..." : ""}
      </div>
    </a>
  );
}
