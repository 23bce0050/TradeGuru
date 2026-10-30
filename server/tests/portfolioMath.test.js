import test from "node:test"; import assert from "node:assert/strict";
import { applyBuy, applySell, valueHolding, summarize } from "../services/portfolioMath.js";
test("buy avg", () => {
  let h = applyBuy(null, 10, 100); assert.deepEqual(h, {quantity:10, invested:1000, avgPrice:100});
  h = applyBuy(h, 10, 200); assert.equal(h.avgPrice, 150); assert.equal(h.invested, 3000);
});
test("sell pnl", () => {
  const s = applySell({quantity:20, invested:3000}, 5, 180);
  assert.equal(s.realizedPnl, 150); assert.equal(s.quantity, 15); assert.equal(s.invested, 2250);
  const loss = applySell({quantity:20, invested:3000}, 20, 120);
  assert.equal(loss.realizedPnl, -600); assert.equal(loss.invested, 0);
  assert.throws(() => applySell({quantity:2, invested:200}, 3, 100));
});
test("summary numbers", () => {
  // start 10L, bought 3000 total, sold 5 @180 (+900 cash) => cash 997900
  const v = valueHolding({symbol:"TCS.NS", quantity:15, invested:2250}, 160);
  const s = summarize(997900, [v], 150);
  assert.equal(s.netWorth, 1000300); assert.equal(s.totalReturn, 300);
  assert.equal(s.unrealizedPnl + s.realizedPnl, 300);
});
test("float rounding", () => {
  const h = applyBuy(null, 3, 1385.35); assert.equal(h.invested, 4156.05);
});
