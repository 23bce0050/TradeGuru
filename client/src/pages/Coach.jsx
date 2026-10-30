import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorText } from "../api";
import { pct, rupee, signed, ticker } from "../format";

const SEVERITY = { high: "High impact", medium: "Worth fixing", low: "Minor" };
const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// Har finding ke evidence ko ek seedhi line mein likho
function evidenceLine(id, e) {
  const t = ticker(e.symbol);
  switch (id) {
    case "panic_sell":
      return (
        <>
          Sold {e.quantity} {t} at {rupee(e.price)} on {day(e.date)}
          {e.reason === "red_day" ? `, on a day it fell ${pct(e.dayChangePercent)}` : `, ${e.heldDays} days after buying`}.{" "}
          Loss {rupee(Math.abs(e.loss))}.
          {e.priceNow != null && (
            <> Now {rupee(e.priceNow)} (<span className={e.sinceSoldPercent >= 0 ? "gain" : "loss"}>{pct(e.sinceSoldPercent)}</span> since you sold).</>
          )}
        </>
      );
    case "fomo_buy":
      return (
        <>
          Bought {e.quantity} {t} at {rupee(e.price)} on {day(e.date)}
          {e.runUp5d != null && e.runUp5d >= 8 ? ` after a ${pct(e.runUp5d)} run in 5 days` : `, on a day it was up ${pct(e.dayChangePercent)}`}.
          {e.priceNow != null && (
            <> Now {rupee(e.priceNow)} (<span className={e.sinceBoughtPercent >= 0 ? "gain" : "loss"}>{pct(e.sinceBoughtPercent)}</span>).</>
          )}
        </>
      );
    case "overtrading":
      return <>{e.count} trades on {day(e.day)}.</>;
    case "holding_losers":
      return (
        <>
          {e.quantity} {t} bought at {rupee(e.avgPrice)}, now {rupee(e.priceNow)}:{" "}
          <span className="loss">{signed(e.pnl)} ({pct(e.pnlPercent)})</span>
        </>
      );
    case "early_profit":
      return (
        <>
          Sold {e.quantity} {t} on {day(e.date)} for a {pct(e.gainPercent)} gain. It has gone up another{" "}
          <span className="gain">{pct(e.sinceSoldPercent)}</span> since.
        </>
      );
    case "concentration":
      return <>{t} is {e.sharePercent}% of your money ({rupee(e.currentValue)}).</>;
    default:
      return null;
  }
}

export default function Coach() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/coach")
      .then(({ data }) => setReport(data))
      .catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <p className="page-status">{error}</p>;
  if (!report) return <p className="page-status">Reviewing your trades…</p>;

  const s = report.stats;

  if (report.status === "not_enough_data") {
    return (
      <section className="panel coach-empty">
        <h1>Your trading coach</h1>
        <p>
          The coach looks for habits like panic selling and chasing stocks that have just jumped. It needs a few trades
          to work with. Make {report.needed} more {report.needed === 1 ? "trade" : "trades"} and come back.
        </p>
        <Link to="/" className="chip">Go to portfolio</Link>
      </section>
    );
  }

  const band = report.score >= 80 ? "good" : report.score >= 60 ? "ok" : "bad";

  return (
    <div className="coach">
      <section className="coach-hero" aria-label="Discipline score">
        <div>
          <p className="score-hello">Discipline score</p>
          <p className={`coach-score ${band}`}>
            {report.score}
            <span>/100</span>
          </p>
          <p className="coach-grade">{report.grade}</p>
        </div>
        <div className="coach-intro">
          <p>
            Based on your {s.totalTrades} trades. The score starts at 100 and drops for each habit that tends to lose
            money: selling in a panic, chasing jumps, trading too often, holding losers and putting too much in one
            stock.
          </p>
          <div className="coach-track" aria-hidden="true">
            <span className={`coach-fill ${band}`} style={{ width: `${report.score}%` }} />
          </div>
        </div>
      </section>

      <dl className="score-stats coach-stats">
        <div><dt>Trades</dt><dd>{s.totalTrades}</dd></div>
        <div><dt>Profitable sells</dt><dd>{s.winRate == null ? "—" : `${s.winRate}%`}</dd></div>
        <div><dt>Average win</dt><dd className="gain">{s.avgWin ? signed(s.avgWin) : <span className="muted">—</span>}</dd></div>
        <div><dt>Average loss</dt><dd className="loss">{s.avgLoss ? signed(s.avgLoss) : "—"}</dd></div>
      </dl>

      {report.findings.length === 0 ? (
        <section className="panel">
          <h2>No bad habits found</h2>
          <p className="muted">Your trades don’t show any of the patterns the coach looks for. Keep going.</p>
        </section>
      ) : (
        <section className="findings" aria-label="Habits to work on">
          <h2>What to work on</h2>
          {report.findings.map((f) => (
            <article key={f.id} className={`panel finding sev-${f.severity}`}>
              <header>
                <h3>{f.title}</h3>
                <span className="sev-label">{SEVERITY[f.severity]}</span>
              </header>
              <p className="finding-summary">{f.summary}</p>
              {f.evidence?.length > 0 && (
                <ul className="evidence">
                  {f.evidence.map((e, i) => (
                    <li key={i}>{evidenceLine(f.id, e)}</li>
                  ))}
                </ul>
              )}
              <p className="advice">
                <b>Try this:</b> {f.advice}
              </p>
            </article>
          ))}
        </section>
      )}

      {report.strengths.length > 0 && (
        <section className="panel strengths" aria-label="What you are doing well">
          <h2>What you’re doing well</h2>
          <ul>
            {report.strengths.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
