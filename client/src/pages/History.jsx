import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorText } from "../api";
import { rupee, signed, ticker, tone, when } from "../format";

export default function History() {
  const [trades, setTrades] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/trade/history", { params: { limit: 200 } })
      .then(({ data }) => setTrades(data.trades))
      .catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <p className="page-status">{error}</p>;
  if (!trades) return <p className="page-status">Loading trades…</p>;

  const booked = trades.reduce((s, t) => s + (t.type === "SELL" ? t.realizedPnl : 0), 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Trades</h2>
        {trades.length > 0 && (
          <span className="muted small">
            {trades.length} trades, booked P&amp;L <b className={tone(booked)}>{signed(booked)}</b>
          </span>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="empty">
          <p>No trades yet. Your buys and sells will be listed here.</p>
          <Link to="/" className="chip">Find a stock to buy</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Order</th>
                <th>Stock</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Amount</th>
                <th className="num">Booked P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t._id}>
                  <td className="muted">{when(t.createdAt)}</td>
                  <td><span className={`side side-${t.type.toLowerCase()}`}>{t.type === "BUY" ? "Buy" : "Sell"}</span></td>
                  <td>
                    <Link to={`/stock/${t.symbol}`} className="stock-cell">
                      <strong>{ticker(t.symbol)}</strong>
                    </Link>
                  </td>
                  <td className="num">{t.quantity}</td>
                  <td className="num">{rupee(t.price)}</td>
                  <td className="num">{rupee(t.total)}</td>
                  <td className={`num ${t.type === "SELL" ? tone(t.realizedPnl) : "muted"}`}>
                    {t.type === "SELL" ? signed(t.realizedPnl) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
