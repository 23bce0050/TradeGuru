import { useCallback, useEffect, useState } from "react";
import api, { errorText } from "../api";
import { ago } from "../format";
import NewsList, { MoodBar } from "../components/NewsList";

const TABS = [
  { id: "markets", label: "Markets" },
  { id: "fintech", label: "Fintech" },
  { id: "technology", label: "Technology" },
  { id: "economy", label: "Economy" },
];

export default function News() {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem("tg_news_tab") || "markets";
    } catch {
      return "markets";
    }
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (category) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/news", { params: { category }, timeout: 60000 });
      setData(data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
    try {
      localStorage.setItem("tg_news_tab", tab);
    } catch {
      /* ignore */
    }
  }, [tab, load]);

  const hasAI = data?.articles?.some((a) => a.sentiment);

  return (
    <div className="news-page">
      <header className="news-head">
        <div>
          <h1>News</h1>
          <p className="muted">
            Today’s finance and technology headlines from Indian and global publications, refreshed through the day.
          </p>
        </div>
        <div className="segmented" role="tablist" aria-label="News topic">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <section className="panel">
        {loading && <p className="page-status">Loading headlines…</p>}
        {!loading && error && (
          <div className="page-status">
            <p>{error}</p>
            <button className="btn-quiet" onClick={() => load(tab)}>Try again</button>
          </div>
        )}
        {!loading && !error && data && (
          <>
            <div className="news-summary">
              {hasAI ? (
                <div>
                  <h2>Market mood in these headlines</h2>
                  <MoodBar mood={data.mood} />
                </div>
              ) : (
                <div>
                  <h2>{data.label}</h2>
                </div>
              )}
              <p className="muted small">Updated {ago(data.updatedAt)}</p>
            </div>
            {data.articles.length === 0 ? (
              <p className="page-status">No {data.label.toLowerCase()} headlines in the last few days.</p>
            ) : (
              <NewsList articles={data.articles} />
            )}
          </>
        )}
      </section>
      <p className="muted small news-note">Headlines open on the publisher’s website. Mood tags are automated and are not investment advice.</p>
    </div>
  );
}
