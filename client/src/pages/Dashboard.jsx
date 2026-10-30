import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorText } from "../api";
import { useAuth } from "../auth";
import { pct, rupee, rupee0, signed, ticker, tone } from "../format";
import StockSearch from "../components/StockSearch";
import usePolling from "../usePolling";

const STARTING = 1_000_000;
const STARTERS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC", "SBIN"];

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/portfolio");
      setData(data);
      setError("");
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  // Pehli baar load, phir har 30 sec (sirf jab tab dikh raha ho)
  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 30000);

  const reset = async () => {
    if (!window.confirm("Reset your portfolio? All holdings and trades will be deleted and cash goes back to ₹10,00,000.")) return;
    await api.post("/portfolio/reset");
    await Promise.all([load(), refreshUser()]);
  };

  if (error && !data) return <p className="page-status">{error}</p>;
  if (!data) return <p className="page-status">Loading your portfolio…</p>;

  const s = data.summary;
  const first = user?.name?.split(" ")[0];
  // Scoreboard strip: start ₹10L ke mukable abhi kahan ho (±20% tak scale)
  const offset = Math.max(-1, Math.min(1, s.totalReturnPercent / 20));

  return (
    <div className="dash">
      <section className="scoreboard" aria-label="Portfolio value">
        <p className="score-hello">{first ? `${first}’s portfolio` : "Your portfolio"}</p>
        <p className="score-value">{rupee(s.netWorth)}</p>
        <p className={`score-return ${tone(s.totalReturn)}`}>
          {signed(s.totalReturn)} ({pct(s.totalReturnPercent)}) since you started with {rupee0(STARTING)}
        </p>

        <div className="score-track" role="img" aria-label={`Total return ${pct(s.totalReturnPercent)}`}>
          <span className="score-start" />
          <span
            className={`score-fill ${tone(s.totalReturn)}`}
            style={{
              left: offset >= 0 ? "50%" : `${50 + offset * 50}%`,
              width: `${Math.abs(offset) * 50}%`,
            }}
          />
          <span className="score-scale"><i>−20%</i><i>Start</i><i>+20%</i></span>
        </div>

        <dl className="score-stats">
          <div><dt>Cash</dt><dd>{rupee(s.cash)}</dd></div>
          <div><dt>Invested</dt><dd>{rupee(s.invested)}</dd></div>
          <div>
            <dt>Holdings P&amp;L</dt>
            <dd className={tone(s.unrealizedPnl)}>{signed(s.unrealizedPnl)}</dd>
          </div>
          <div>
            <dt>Booked P&amp;L</dt>
            <dd className={tone(s.realizedPnl)}>{signed(s.realizedPnl)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Holdings</h2>
          <span className="muted small">Prices refresh every 30 seconds</span>
        </div>

        {data.holdings.length === 0 ? (
          <div className="empty">
            <p>You don’t own any shares yet. Search for a company or start with a well-known one:</p>
            <div className="empty-search"><StockSearch placeholder="Search, e.g. Tata Steel" /></div>
            <div className="chips">
              {STARTERS.map((t) => (
                <Link key={t} to={`/stock/${t}.NS`} className="chip">{t}</Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th className="num">Qty</th>
                  <th className="num">Avg price</th>
                  <th className="num">Live price</th>
                  <th className="num">Current value</th>
                  <th className="num">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((h) => (
                  <tr key={h.symbol}>
                    <td>
                      <Link to={`/stock/${h.symbol}`} className="stock-cell">
                        <strong>{ticker(h.symbol)}</strong>
                        <span>{h.name}</span>
                      </Link>
                    </td>
                    <td className="num">{h.quantity}</td>
                    <td className="num">{rupee(h.avgPrice)}</td>
                    <td className="num">
                      {rupee(h.livePrice)}
                      {h.priceStale && <span className="stale" title="Live price unavailable, showing average price"> *</span>}
                    </td>
                    <td className="num">{rupee(h.currentValue)}</td>
                    <td className={`num ${tone(h.pnl)}`}>
                      {signed(h.pnl)}
                      <small>{pct(h.pnlPercent)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="reset-row">
        <button className="btn-quiet" onClick={reset}>Reset portfolio to ₹10,00,000</button>
      </p>
    </div>
  );
}
