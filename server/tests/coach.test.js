import test from "node:test"; import assert from "node:assert/strict";
import { analyze, runUpBefore } from "../services/coachRules.js";
const D = (s) => new Date(s).toISOString();
const T = (o) => ({ name: o.symbol, total: o.price * o.quantity, realizedPnl: 0, ...o });

test("not enough data", () => {
  const r = analyze({ trades: [T({ symbol: "A.NS", type: "BUY", quantity: 1, price: 10, createdAt: D("2026-10-01T05:00Z") })] });
  assert.equal(r.status, "not_enough_data"); assert.equal(r.needed, 2);
});

test("panic sell on red day + recovered", () => {
  const trades = [
    T({ symbol: "TCS.NS", type: "BUY", quantity: 10, price: 3200, dayChangePercent: 0.5, createdAt: D("2026-09-01T05:00Z") }),
    T({ symbol: "TCS.NS", type: "SELL", quantity: 10, price: 3050, realizedPnl: -1500, avgPriceAtTrade: 3200, dayChangePercent: -3.1, createdAt: D("2026-09-20T05:00Z") }),
    T({ symbol: "INFY.NS", type: "BUY", quantity: 5, price: 1500, dayChangePercent: 0.2, createdAt: D("2026-09-21T05:00Z") }),
  ];
  const r = analyze({ trades, prices: { "TCS.NS": 3180, "INFY.NS": 1510 }, netWorth: 1e6 });
  const f = r.findings.find((x) => x.id === "panic_sell");
  assert.ok(f); assert.equal(f.evidence[0].sinceSoldPercent, 4.26);
  assert.match(f.summary, /That stock is higher/);
  assert.equal(r.score, 88);
});

test("quick loss exit counts as panic even on flat day", () => {
  const trades = [
    T({ symbol: "A.NS", type: "BUY", quantity: 1, price: 100, dayChangePercent: 0, createdAt: D("2026-09-01T05:00Z") }),
    T({ symbol: "A.NS", type: "SELL", quantity: 1, price: 97, realizedPnl: -3, avgPriceAtTrade: 100, dayChangePercent: -0.5, createdAt: D("2026-09-02T05:00Z") }),
    T({ symbol: "B.NS", type: "BUY", quantity: 1, price: 100, dayChangePercent: 0, createdAt: D("2026-09-03T05:00Z") }),
  ];
  const f = analyze({ trades, prices: {} }).findings.find((x) => x.id === "panic_sell");
  assert.equal(f.evidence[0].reason, "quick_exit"); assert.equal(f.evidence[0].heldDays, 1);
});

test("fomo via day jump and 5-day run-up", () => {
  const pts = []; let v = 100;
  for (let i = 0; i < 20; i++) { v *= i >= 14 ? 1.03 : 1.0; pts.push({ date: D(`2026-09-${String(i + 1).padStart(2, "0")}T10:00Z`), close: +v.toFixed(2) }); }
  assert.ok(runUpBefore(pts, D("2026-09-21T05:00Z")) > 8);
  const trades = [
    T({ symbol: "X.NS", type: "BUY", quantity: 1, price: 120, dayChangePercent: 0.5, createdAt: D("2026-09-21T05:00Z") }),
    T({ symbol: "Y.NS", type: "BUY", quantity: 1, price: 50, dayChangePercent: 4.2, createdAt: D("2026-09-21T06:00Z") }),
    T({ symbol: "Z.NS", type: "BUY", quantity: 1, price: 50, dayChangePercent: 1, createdAt: D("2026-09-21T07:00Z") }),
  ];
  const f = analyze({ trades, history: { "X.NS": pts }, prices: { "X.NS": 110, "Y.NS": 55 } }).findings.find((x) => x.id === "fomo_buy");
  assert.equal(f.evidence.length, 2); assert.match(f.summary, /2 of your 3 buys/); assert.match(f.summary, /1 of them is now below/);
});

test("overtrading, losers, concentration, early profit", () => {
  const trades = [];
  for (let i = 0; i < 9; i++) trades.push(T({ symbol: "A.NS", type: "BUY", quantity: 1, price: 100, dayChangePercent: 0, createdAt: D(`2026-10-01T0${i}:10Z`) }));
  trades.push(T({ symbol: "A.NS", type: "SELL", quantity: 1, price: 102, realizedPnl: 2, avgPriceAtTrade: 100, dayChangePercent: 0.5, createdAt: D("2026-10-02T05:00Z") }));
  const holdings = [
    { symbol: "A.NS", quantity: 8, avgPrice: 100, livePrice: 85, currentValue: 680, pnl: -120, pnlPercent: -15 },
    { symbol: "B.NS", quantity: 100, avgPrice: 100, livePrice: 100, currentValue: 5000, pnl: 0, pnlPercent: 0 },
  ];
  const r = analyze({ trades, holdings, prices: { "A.NS": 110 }, netWorth: 10000 });
  const ids = r.findings.map((f) => f.id).sort();
  assert.deepEqual(ids, ["concentration", "early_profit", "holding_losers", "overtrading"]);
  assert.equal(r.score, 100 - 10 - 8 - 6 - 10);
  assert.equal(r.findings[0].severity !== "low", true);
});

test("clean trader gets strengths and full score", () => {
  const trades = [
    T({ symbol: "A.NS", type: "BUY", quantity: 1, price: 100, dayChangePercent: 0.2, createdAt: D("2026-09-01T05:00Z") }),
    T({ symbol: "B.NS", type: "BUY", quantity: 1, price: 100, dayChangePercent: -0.2, createdAt: D("2026-09-02T05:00Z") }),
    T({ symbol: "C.NS", type: "BUY", quantity: 1, price: 100, dayChangePercent: 1, createdAt: D("2026-09-03T05:00Z") }),
    T({ symbol: "A.NS", type: "SELL", quantity: 1, price: 112, realizedPnl: 12, avgPriceAtTrade: 100, dayChangePercent: 1, createdAt: D("2026-09-20T05:00Z") }),
    T({ symbol: "B.NS", type: "SELL", quantity: 1, price: 108, realizedPnl: 8, avgPriceAtTrade: 100, dayChangePercent: 1, createdAt: D("2026-09-25T05:00Z") }),
  ];
  const r = analyze({ trades, prices: { "A.NS": 111, "B.NS": 107 }, netWorth: 1e6 });
  assert.equal(r.score, 100); assert.equal(r.grade, "Disciplined"); assert.ok(r.strengths.length >= 3);
  assert.equal(r.stats.winRate, 100);
});
