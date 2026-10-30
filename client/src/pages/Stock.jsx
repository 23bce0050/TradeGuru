import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorText } from "../api";
import { useAuth } from "../auth";
import { pct, rupee, signed, ticker, tone } from "../format";
import PriceChart from "../components/PriceChart";
import OrderTicket from "../components/OrderTicket";
import StockNews from "../components/StockNews";
import usePolling from "../usePolling";

export default function Stock() {
  const { symbol } = useParams();
  const { user, refreshUser } = useAuth();
  const [quote, setQuote] = useState(null);
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");

  const loadQuote = useCallback(async () => {
    try {
      const { data } = await api.get(`/stocks/${symbol}/quote`);
      setQuote(data);
      setError("");
    } catch (err) {
      setError(errorText(err));
    }
  }, [symbol]);

  const loadPosition = useCallback(async () => {
    const { data } = await api.get("/portfolio");
    const sym = symbol.toUpperCase().includes(".") ? symbol.toUpperCase() : `${symbol.toUpperCase()}.NS`;
    setPosition(data.holdings.find((h) => h.symbol === sym) || null);
  }, [symbol]);

  useEffect(() => {
    setQuote(null);
    setPosition(null);
    loadQuote();
    loadPosition().catch(() => {});
  }, [loadQuote, loadPosition]);
  usePolling(loadQuote, 30000); // sirf jab tab dikh raha ho

  const afterTrade = () => Promise.all([refreshUser(), loadPosition()]).catch(() => {});

  if (error && !quote)
    return (
      <div className="page-status">
        <p>{error}</p>
        <Link to="/">Back to portfolio</Link>
      </div>
    );
  if (!quote) return <p className="page-status">Loading {ticker(symbol)}…</p>;

  const open = quote.marketState === "REGULAR";

  return (
    <div className="stock">
      <header className="stock-head">
        <div>
          <h1>
            {ticker(quote.symbol)}
            <span className="exchange">{quote.symbol.endsWith(".BO") ? "BSE" : "NSE"}</span>
          </h1>
          <p className="muted">{quote.name}</p>
        </div>
        <div className="stock-price">
          <p className="price">{rupee(quote.price)}</p>
          <p className={tone(quote.change)}>
            {signed(quote.change)} ({pct(quote.changePercent)}) today
          </p>
          <p className="market-state">
            <span className={`dot ${open ? "on" : ""}`} /> {open ? "Market open" : "Market closed"}
          </p>
        </div>
      </header>

      <div className="stock-grid">
        <div className="stock-main">
          <PriceChart symbol={quote.symbol} />
          <dl className="facts panel">
            <div><dt>Previous close</dt><dd>{rupee(quote.previousClose)}</dd></div>
            <div><dt>Day high</dt><dd>{rupee(quote.dayHigh)}</dd></div>
            <div><dt>Day low</dt><dd>{rupee(quote.dayLow)}</dd></div>
          </dl>
          <StockNews symbol={quote.symbol} />
        </div>

        <aside className="stock-side">
          <OrderTicket quote={quote} owned={position?.quantity || 0} cash={user?.balance || 0} onDone={afterTrade} />

          {position && (
            <section className="panel position" aria-label="Your position">
              <h2>Your position</h2>
              <dl>
                <div><dt>Shares</dt><dd>{position.quantity}</dd></div>
                <div><dt>Avg price</dt><dd>{rupee(position.avgPrice)}</dd></div>
                <div><dt>Invested</dt><dd>{rupee(position.invested)}</dd></div>
                <div>
                  <dt>P&amp;L</dt>
                  <dd className={tone(position.pnl)}>
                    {signed(position.pnl)} ({pct(position.pnlPercent)})
                  </dd>
                </div>
              </dl>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
