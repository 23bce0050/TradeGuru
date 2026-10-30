import { useEffect, useState } from "react";
import api, { errorText } from "../api";
import { pct, rupee, tone } from "../format";

function Row({ r }) {
  return (
    <tr className={r.isYou ? "you" : ""}>
      <td className="rank">{r.rank}</td>
      <td>
        {r.name}
        {r.isYou && <span className="you-tag">You</span>}
      </td>
      <td className="num">{rupee(r.netWorth)}</td>
      <td className={`num ${tone(r.returnPercent)}`}>{pct(r.returnPercent)}</td>
      <td className="num muted">{r.trades}</td>
    </tr>
  );
}

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/leaderboard")
      .then(({ data }) => setData(data))
      .catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <p className="page-status">{error}</p>;
  if (!data) return <p className="page-status">Loading leaderboard…</p>;

  const youInTop = data.top.some((r) => r.isYou);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Leaderboard</h2>
        <span className="muted small">
          Ranked by total value. Everyone started with ₹10,00,000.
        </span>
      </div>
      <div className="table-wrap">
        <table className="table leaderboard">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Trader</th>
              <th className="num">Total value</th>
              <th className="num">Return</th>
              <th className="num">Trades</th>
            </tr>
          </thead>
          <tbody>
            {data.top.map((r) => (
              <Row key={r.rank} r={r} />
            ))}
            {!youInTop && data.you && (
              <>
                <tr className="gap" aria-hidden="true"><td colSpan={5}>…</td></tr>
                <Row r={data.you} />
              </>
            )}
          </tbody>
        </table>
      </div>
      {data.totalTraders <= 1 && (
        <p className="muted small lb-note">You’re the only trader so far. Share the app with a friend to compete.</p>
      )}
    </section>
  );
}
