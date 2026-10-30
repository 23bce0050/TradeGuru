import { ago } from "../format";

const MOOD = { positive: "Positive", negative: "Negative", neutral: "Neutral" };

export function SentimentTag({ s }) {
  if (!s) return null;
  return (
    <span className={`mood mood-${s.label}`}>
      {MOOD[s.label]}
    </span>
  );
}

// Aaj ka mood: kitni khabrein positive / negative / neutral
export function MoodBar({ mood }) {
  const total = mood.positive + mood.negative + mood.neutral;
  if (!total) return null;
  const w = (n) => `${(n / total) * 100}%`;
  return (
    <div className="moodbar">
      <div className="moodbar-track" role="img" aria-label={`${mood.positive} positive, ${mood.neutral} neutral, ${mood.negative} negative headlines`}>
        <span className="mb-pos" style={{ width: w(mood.positive) }} />
        <span className="mb-neu" style={{ width: w(mood.neutral) }} />
        <span className="mb-neg" style={{ width: w(mood.negative) }} />
      </div>
      <p className="moodbar-legend">
        <span><i className="mb-pos" />{mood.positive} positive</span>
        <span><i className="mb-neu" />{mood.neutral} neutral</span>
        <span><i className="mb-neg" />{mood.negative} negative</span>
      </p>
    </div>
  );
}

export default function NewsList({ articles, compact = false }) {
  return (
    <ul className={`news-list ${compact ? "compact" : ""}`}>
      {articles.map((a) => (
        <li key={a.id}>
          <a href={a.link} target="_blank" rel="noopener noreferrer" className="news-title">
            {a.title}
          </a>
          <p className="news-meta">
            <span className="news-source">{a.source}</span>
            {a.publishedAt && <time dateTime={a.publishedAt}>{ago(a.publishedAt)}</time>}
            <SentimentTag s={a.sentiment} />
          </p>
        </li>
      ))}
    </ul>
  );
}
