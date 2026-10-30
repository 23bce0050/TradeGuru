import { useEffect, useState } from "react";
import api from "../api";
import NewsList, { MoodBar } from "./NewsList";
import { ticker } from "../format";

export default function StockNews({ symbol }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    api
      .get(`/news/stock/${symbol}`, { timeout: 60000 })
      .then(({ data }) => alive && setData(data))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [symbol]);

  return (
    <section className="panel" aria-label={`News about ${ticker(symbol)}`}>
      <div className="panel-head">
        <h2>Latest news</h2>
      </div>
      {!data && !failed && <p className="muted">Loading news…</p>}
      {failed && <p className="muted">News isn’t available for this stock right now.</p>}
      {data && data.articles.length === 0 && <p className="muted">No recent news for {ticker(symbol)}.</p>}
      {data && data.articles.length > 0 && (
        <>
          {data.articles.some((a) => a.sentiment) && <MoodBar mood={data.mood} />}
          <NewsList articles={data.articles} compact />
        </>
      )}
    </section>
  );
}
