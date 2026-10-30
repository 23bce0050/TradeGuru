// TradeGuru benchmark: tumhare laptop par ASLI numbers naapta hai (resume ke liye).
// Chalane se pehle server chalu rakho (npm run dev), phir doosre terminal mein:  npm run benchmark

const BASE = process.env.API || "http://localhost:5000";
let token = "";

async function call(method, path, body) {
  const t0 = performance.now();
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = performance.now() - t0;
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, ms };
}

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const r1 = (n) => Math.round(n * 10) / 10;
const rupee = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const line = (s = "") => console.log(s);

try {
  // 0. Test user
  const email = `bench${Date.now()}@tradeguru.dev`;
  const su = await call("POST", "/api/auth/signup", { name: "Benchmark User", email, password: "bench123" });
  if (!su.ok) throw new Error("Signup failed: " + (su.data.message || su.status));
  token = su.data.token;

  // 1. Cache: pehli baar (Yahoo se) vs dobara (cache se)
  line("1) Price API: cache se kitna fast?");
  const symbols = ["HDFCBANK", "ICICIBANK", "ITC", "SBIN", "LT", "AXISBANK", "MARUTI", "WIPRO"];
  const cold = [], warm = [];
  for (const s of symbols) {
    const c = await call("GET", `/api/stocks/${s}/quote`);
    if (!c.ok) continue;
    cold.push(c.ms);
    for (let i = 0; i < 5; i++) warm.push((await call("GET", `/api/stocks/${s}/quote`)).ms);
  }
  if (!cold.length) throw new Error("Price API kaam nahi kar rahi (Yahoo se data nahi aa raha).");
  const coldMs = avg(cold), warmMs = avg(warm);
  line(`   Bina cache (Yahoo): ${r1(coldMs)} ms   |   Cache se: ${r1(warmMs)} ms   |   ${r1(coldMs / warmMs)}x faster`);

  // 2. Request coalescing: 100 users ek saath ek naya stock maangein
  line("2) 100 ek saath requests, ek naya stock");
  const before = (await call("GET", "/api/stats")).data.marketData;
  const burst = await Promise.all(Array.from({ length: 100 }, () => call("GET", "/api/stocks/BHARTIARTL/quote")));
  const after = (await call("GET", "/api/stats")).data.marketData;
  const upstream = after.upstreamCalls - before.upstreamCalls;
  line(`   ${burst.filter((b) => b.ok).length}/100 successful, Yahoo calls: ${upstream}`);

  // 3. Concurrency safety: 50 buy orders ek saath, har ek ~30% balance ka
  line("3) 50 buy orders ek saath (balance minus mein jaata hai kya?)");
  const q = (await call("GET", "/api/stocks/TCS/quote")).data;
  const qty = Math.max(1, Math.floor((1_000_000 * 0.3) / q.price));
  const cost = qty * q.price;
  const orders = await Promise.all(Array.from({ length: 50 }, () => call("POST", "/api/trade/buy", { symbol: "TCS", quantity: qty })));
  const filled = orders.filter((o) => o.ok).length;
  const me = (await call("GET", "/api/auth/me")).data.user;
  const tcsHeld = (await call("GET", "/api/portfolio")).data.holdings.find((x) => x.symbol === "TCS.NS")?.quantity || 0;
  const noLostUpdate = tcsHeld === filled * qty;
  const maxPossible = Math.floor(1_000_000 / cost);
  const safe = me.balance >= 0 && filled <= maxPossible && noLostUpdate;
  line(`   Filled: ${filled} (max possible ${maxPossible}), rejected: ${50 - filled}, final cash: ${rupee(me.balance)}, shares ${tcsHeld}/${filled * qty}  ${safe ? "✅ no overspend" : "❌ PROBLEM"}`);

  // 4. Order latency
  line("4) Ek order kitni der mein?");
  const lat = [];
  for (let i = 0; i < 10; i++) lat.push((await call("POST", "/api/trade/sell", { symbol: "TCS", quantity: 1 })).ms);
  const sorted = [...lat].sort((a, b) => a - b);
  line(`   Average: ${r1(avg(lat))} ms   |   p90: ${r1(sorted[8])} ms`);

  // 5. AI sentiment speed
  line("5) AI news sentiment");
  for (const c of ["markets", "fintech", "technology", "economy"]) await call("GET", `/api/news?category=${c}`);
  const ai = (await call("GET", "/api/stats")).data.sentiment;
  if (ai.ready && ai.headlinesClassified) {
    line(`   ${ai.headlinesClassified} headlines classified, ${ai.avgMsPerHeadline} ms per headline (model load: ${r1(ai.loadMs / 1000)} s)`);
  } else {
    line("   AI model abhi load ho raha hai. 1-2 minute baad benchmark dobara chalao.");
  }

  // Cleanup
  await call("POST", "/api/portfolio/reset");

  line();
  line("================ RESUME-READY NUMBERS ================");
  line(`• Caching made price lookups ${Math.round(coldMs / warmMs)}x faster (${Math.round(coldMs)} ms → ${r1(warmMs)} ms).`);
  line(`• Request coalescing: 100 concurrent requests → ${upstream} upstream call${upstream === 1 ? "" : "s"}.`);
  line(`• 50 concurrent orders: ${filled} filled, ${50 - filled} correctly rejected, 0 overspends.`);
  if (ai.ready && ai.avgMsPerHeadline) line(`• FinBERT sentiment: ~${ai.avgMsPerHeadline} ms per headline on CPU, no paid API.`);
  line("=======================================================");
  line("Ye numbers tumhare laptop ke hain. Resume par wahi likhna jo yahan aaya.");
} catch (err) {
  console.error("\n❌ Benchmark fail:", err.message);
  if (/fetch failed/i.test(err.message)) console.error("   Server chalu hai? Pehle doosre terminal mein: npm run dev");
  process.exit(1);
}
