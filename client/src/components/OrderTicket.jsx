import { useRef, useState } from "react";
import api, { errorText } from "../api";
import { rupee } from "../format";

export default function OrderTicket({ quote, owned, cash, onDone }) {
  const [side, setSide] = useState("BUY");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  // Ek order = ek idempotency key. Retry/double-click par same key jaati hai, server order dobara nahi chalata.
  const orderKey = useRef(null);
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const n = Number(qty);
  const validQty = Number.isInteger(n) && n > 0;
  const total = validQty ? n * quote.price : 0;
  const maxBuy = Math.floor(cash / quote.price);

  let problem = "";
  if (qty && !validQty) problem = "Enter a whole number of shares.";
  else if (side === "BUY" && total > cash) problem = `Not enough cash. You can buy up to ${maxBuy} shares.`;
  else if (side === "SELL" && n > owned) problem = `You own ${owned} shares.`;

  const submit = async (e) => {
    e.preventDefault();
    if (!validQty || problem) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!orderKey.current) orderKey.current = newKey();
      const { data } = await api.post(
        `/trade/${side.toLowerCase()}`,
        { symbol: quote.symbol, quantity: n },
        { headers: { "Idempotency-Key": orderKey.current } }
      );
      orderKey.current = null; // agla order = nayi key
      setMsg({ kind: "ok", text: data.message });
      setQty("1");
      onDone?.();
    } catch (err) {
      setMsg({ kind: "err", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const canSell = owned > 0;

  return (
    <form className={`panel ticket ticket-${side.toLowerCase()}`} onSubmit={submit} aria-label="Place order">
      <div className="ticket-sides" role="radiogroup" aria-label="Order side">
        <button type="button" role="radio" aria-checked={side === "BUY"} onClick={() => { setSide("BUY"); orderKey.current = null; }}>
          Buy
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={side === "SELL"}
          onClick={() => { setSide("SELL"); orderKey.current = null; }}
          disabled={!canSell}
          title={canSell ? "" : "You don’t own this stock yet"}
        >
          Sell
        </button>
      </div>

      <label className="field">
        <span>Quantity</span>
        <div className="qty">
          <button type="button" aria-label="One less" onClick={() => { setQty(String(Math.max(1, (validQty ? n : 1) - 1))); orderKey.current = null; }}>
            −
          </button>
          <input inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value.replace(/[^\d]/g, "")); orderKey.current = null; }} />
          <button type="button" aria-label="One more" onClick={() => { setQty(String((validQty ? n : 0) + 1)); orderKey.current = null; }}>
            +
          </button>
        </div>
      </label>

      <dl className="ticket-math">
        <div>
          <dt>Price per share</dt>
          <dd>{rupee(quote.price)}</dd>
        </div>
        <div className="ticket-total">
          <dt>{side === "BUY" ? "You pay" : "You receive"}</dt>
          <dd>{rupee(total)}</dd>
        </div>
        <div>
          <dt>{side === "BUY" ? "Cash available" : "Shares you own"}</dt>
          <dd>{side === "BUY" ? rupee(cash) : owned}</dd>
        </div>
      </dl>

      {problem && <p className="ticket-problem">{problem}</p>}

      <button className="btn-primary" disabled={busy || !validQty || Boolean(problem)}>
        {busy ? "Placing order…" : `${side === "BUY" ? "Buy" : "Sell"} ${validQty ? n : ""} ${n === 1 ? "share" : "shares"}`}
      </button>

      {msg && (
        <p className={`ticket-msg ${msg.kind}`} role="status">
          {msg.text}
        </p>
      )}
      {quote.marketState && quote.marketState !== "REGULAR" && (
        <p className="ticket-note">Market is closed, so orders fill at the last traded price.</p>
      )}
    </form>
  );
}
