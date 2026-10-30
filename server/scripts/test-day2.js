// Day 2 ka poora flow test: signup -> buy -> sell -> portfolio -> history
// Chalane ke liye: server chalu rakho (npm run dev), doosre terminal mein: npm run test:day2

const BASE = process.env.API || "http://localhost:5000";
let token = "";

async function call(method, path, body, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.message || "error"}`);
  return data;
}

const rupee = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

try {
  const email = `test${Date.now()}@tradeguru.dev`;
  const signup = await call("POST", "/api/auth/signup", { name: "Test User", email, password: "123456" });
  token = signup.token;
  console.log("1. Signup OK  | balance:", rupee(signup.user.balance));

  const buy1 = await call("POST", "/api/trade/buy", { symbol: "TCS", quantity: 10 });
  console.log("2. BUY  OK    |", buy1.message, "| balance:", rupee(buy1.balance));

  const buy2 = await call("POST", "/api/trade/buy", { symbol: "RELIANCE", quantity: 5 });
  console.log("3. BUY  OK    |", buy2.message);

  const sell = await call("POST", "/api/trade/sell", { symbol: "TCS", quantity: 4 });
  console.log("4. SELL OK    |", sell.message);

  try {
    await call("POST", "/api/trade/sell", { symbol: "TCS", quantity: 999 });
    console.log("5. FAIL: zyada shares bech diye!");
  } catch (e) {
    console.log("5. Over-sell blocked OK |", e.message.split(": ").pop());
  }

  const p = await call("GET", "/api/portfolio");
  console.log("6. Portfolio OK");
  console.table(
    p.holdings.map((h) => ({ symbol: h.symbol, qty: h.quantity, avg: h.avgPrice, live: h.livePrice, pnl: h.pnl }))
  );
  console.log("   Summary:", {
    cash: rupee(p.summary.cash),
    holdingsValue: rupee(p.summary.currentValue),
    netWorth: rupee(p.summary.netWorth),
    realizedPnl: rupee(p.summary.realizedPnl),
  });

  const h = await call("GET", "/api/trade/history");
  console.log("7. History OK |", h.count, "trades");

  // 8. Idempotency: same key se order 2 baar -> sirf 1 baar chalna chahiye
  const key = `test-${Date.now()}`;
  const cashBefore = (await call("GET", "/api/auth/me")).user.balance;
  const o1 = await call("POST", "/api/trade/buy", { symbol: "INFY", quantity: 2 }, { "Idempotency-Key": key });
  const o2 = await call("POST", "/api/trade/buy", { symbol: "INFY", quantity: 2 }, { "Idempotency-Key": key });
  const cashAfter = (await call("GET", "/api/auth/me")).user.balance;
  const charged = Math.round((cashBefore - cashAfter) * 100) / 100;
  const sameTrade = o1.trade._id === o2.trade._id;
  console.log(`8. Idempotency ${sameTrade && charged === o1.trade.total ? "OK" : "FAIL"} | same trade id: ${sameTrade}, charged once: ${rupee(charged)}`);

  // 9. Ek saath 10 BUY same stock -> holding mein poore shares judne chahiye (lost update nahi)
  const hBefore = (await call("GET", "/api/portfolio")).holdings.find((x) => x.symbol === "ITC.NS")?.quantity || 0;
  const burst = await Promise.allSettled(Array.from({ length: 10 }, () => call("POST", "/api/trade/buy", { symbol: "ITC", quantity: 3 })));
  const okCount = burst.filter((b) => b.status === "fulfilled").length;
  const hAfter = (await call("GET", "/api/portfolio")).holdings.find((x) => x.symbol === "ITC.NS")?.quantity || 0;
  console.log(`9. Concurrent BUY ${hAfter - hBefore === okCount * 3 ? "OK" : "FAIL"} | ${okCount} orders filled, holding +${hAfter - hBefore} shares (expected +${okCount * 3})`);

  console.log("\n✅ Day 2 ke saare APIs kaam kar rahe hain!");
} catch (err) {
  console.error("\n❌ Test fail:", err.message);
  if (/fetch failed/i.test(err.message)) console.error("   Server chalu hai? Pehle doosre terminal mein: npm run dev");
  process.exit(1);
}
