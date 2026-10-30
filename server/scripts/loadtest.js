// Load test: kitne users tak TradeGuru theek chalta hai, ASLI numbers.
//
// Kaise chalayein:
//   1. server/.env mein ek line jodo:  RATE_LIMIT=off   (warna rate limit test ko hi rok dega)
//   2. Server chalao:                   npm run dev
//   3. Doosre terminal mein:            npm run loadtest
//   4. Test ke baad .env se RATE_LIMIT=off hata dena.

import autocannon from "autocannon";

const BASE = process.env.API || "http://localhost:5000";
const TEST_USERS = Number(process.env.TEST_USERS) || 50;
const STAGES = (process.env.STAGES || "10,50,100,250,500").split(",").map(Number);
const SECONDS = Number(process.env.SECONDS) || 15;
const SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ITC", "SBIN", "ICICIBANK", "LT"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data.message || ""}`);
  return data;
}

function run(connections, tokens) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: BASE,
        connections,
        duration: SECONDS,
        timeout: 10,
        requests: [
          {
            setupRequest: (req) => {
              const token = pick(tokens);
              const r = Math.random();
              let path = "/api/portfolio";
              let method = "GET";
              let body;
              if (r < 0.45) path = "/api/portfolio"; // sabse common: portfolio refresh
              else if (r < 0.75) path = `/api/stocks/${pick(SYMBOLS)}/quote`; // stock page
              else if (r < 0.85) path = "/api/leaderboard";
              else if (r < 0.95) path = "/api/trade/history?limit=50";
              else {
                method = "POST"; // 5% orders
                path = "/api/trade/buy";
                body = JSON.stringify({ symbol: pick(["ITC", "SBIN"]), quantity: 1 }); // saste shares, taaki balance jaldi khatam na ho
              }
              return {
                ...req,
                method,
                path,
                body,
                headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
              };
            },
          },
        ],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });
}

const ms = (n) => `${Math.round(n)} ms`;

try {
  const stats = await api("GET", "/api/stats").catch(() => null);
  if (!stats) throw new Error("fetch failed");

  // 1. Test users banao, har ek ke paas kuch shares ho
  process.stdout.write(`Setting up ${TEST_USERS} test users... `);
  const tokens = [];
  for (let i = 0; i < TEST_USERS; i++) {
    const r = await api("POST", "/api/auth/signup", {
      name: `Load Tester ${i}`,
      email: `load${Date.now()}_${i}@tradeguru.dev`,
      password: "loadtest123",
    });
    tokens.push(r.token);
    await api("POST", "/api/trade/buy", { symbol: SYMBOLS[i % SYMBOLS.length], quantity: 5 }, r.token);
    await api("POST", "/api/trade/buy", { symbol: SYMBOLS[(i + 3) % SYMBOLS.length], quantity: 3 }, r.token);
  }
  console.log("done\n");

  // 2. Har stage par load
  const rows = [];
  for (const c of STAGES) {
    process.stdout.write(`${String(c).padStart(4)} simultaneous connections for ${SECONDS}s... `);
    const r = await run(c, tokens);
    const total = r.requests.total || 1;
    const codes = r.statusCodeStats || {};
    const count = (pred) => Object.entries(codes).filter(([c]) => pred(Number(c))).reduce((s, [, v]) => s + v.count, 0);
    const status429 = count((c) => c === 429);
    // Error = server fail (5xx), rate limit (429), connection error ya timeout.
    // 400 (jaise "Not enough cash") business rule hai, error nahi.
    const bad = count((c) => c >= 500) + status429 + r.errors + r.timeouts;
    const row = {
      connections: c,
      reqPerSec: Math.round(r.requests.average),
      p50: r.latency.p50,
      p90: r.latency.p90,
      p99: r.latency.p99,
      errorPct: Math.round((bad / total) * 1000) / 10,
      status429,
    };
    rows.push(row);
    console.log(`${row.reqPerSec} req/s, p50 ${ms(row.p50)}, p99 ${ms(row.p99)}, errors ${row.errorPct}%`);
    if (row.errorPct > 20) {
      console.log("   Too many errors, stopping here.");
      break;
    }
  }

  console.table(
    rows.map((r) => ({
      Connections: r.connections,
      "Req/sec": r.reqPerSec,
      "p50": ms(r.p50),
      "p90": ms(r.p90),
      "p99": ms(r.p99),
      "Errors %": r.errorPct,
    }))
  );

  if (rows.some((r) => r.status429 > 0)) {
    console.log("⚠️  429 (rate limit) responses aaye. server/.env mein RATE_LIMIT=off daal ke server restart karo, phir dobara chalao.\n");
  }

  // 3. Healthy = p99 1 sec se kam, errors 1% se kam
  const healthy = rows.filter((r) => r.p99 < 1000 && r.errorPct < 1);
  const maxHealthy = [...healthy].sort((a, b) => b.connections - a.connections)[0];
  const best = [...healthy].sort((a, b) => b.reqPerSec - a.reqPerSec)[0];
  const final = await api("GET", "/api/stats").catch(() => null);

  console.log("================ RESULT ================");
  if (best) {
    // Ek asli user ~ har 30 sec portfolio refresh + kabhi-kabhi click = ~1 request / 10 sec (andaza)
    const estUsers = best.reqPerSec * 10;
    console.log(`• Healthy (p99 < 1 s, errors < 1%) up to ${maxHealthy.connections} simultaneous connections (p99 ${ms(maxHealthy.p99)}).`);
    console.log(`• Peak healthy throughput: ${best.reqPerSec} requests/second.`);
    console.log(`• Rough estimate: ~${estUsers.toLocaleString("en-IN")} active users (if each user makes ~1 request every 10 s).`);
  } else {
    console.log("• Even the smallest stage was not healthy (p99 > 1s or errors > 1%). Check the server terminal for errors.");
  }
  if (final?.marketData) console.log(`• Market data cache: ${final.marketData.upstreamSavedPercent}% of requests served without calling Yahoo.`);
  console.log("• Ye numbers TUMHARE laptop ke hain. Deploy (free server) par kam aayenge.");
  console.log("========================================");
  console.log("Test ke baad .env se RATE_LIMIT=off hata dena.");
} catch (err) {
  console.error("\n❌ Load test fail:", err.message);
  if (/fetch failed/i.test(err.message)) console.error("   Server chalu hai? Pehle doosre terminal mein: npm run dev");
  if (/429/.test(err.message)) console.error("   Rate limit laga. server/.env mein RATE_LIMIT=off daal ke server restart karo.");
  process.exit(1);
}
