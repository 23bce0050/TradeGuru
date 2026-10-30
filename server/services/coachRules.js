// TradeGuru Coach: user ke trades dekh ke behavioural galtiyan pakadta hai.
// Pure function hai (koi DB/API call nahi), taaki test karna aasaan ho.
//
// Input:
//   trades    -> purane se naye order mein [{ symbol, name, type, quantity, price, total,
//                realizedPnl, avgPriceAtTrade, dayChangePercent, createdAt }]
//   holdings  -> valued holdings [{ symbol, name, quantity, avgPrice, livePrice, currentValue, pnl, pnlPercent }]
//   prices    -> { "TCS.NS": 3120.5, ... }  abhi ka price
//   history   -> { "TCS.NS": [{ date, close }, ...] }  daily closes (purane se naye)
//   netWorth  -> cash + holdings value

export const RULES = {
  panicDayDrop: -2, // us din stock 2%+ gira ho aur loss mein becha
  panicQuickDays: 3, // ya khareedne ke 3 din ke andar loss mein becha
  fomoDayRise: 3, // us din stock 3%+ chadha ho aur tab khareeda
  fomoRunUp5d: 8, // ya pichhle 5 trading days mein 8%+ chadha ho
  overtradePerDay: 8, // ek din mein 8+ trades
  bagHoldLoss: -10, // holding 10%+ loss mein
  quickProfitDays: 2, // 2 din mein chhota profit book kiya...
  quickProfitMaxGain: 3, // ...3% se kam...
  missedRunAfterSell: 5, // ...aur uske baad stock 5%+ aur chadha
  concentration: 0.4, // ek stock net worth ka 40%+ ho
};

const PENALTY = {
  panic_sell: [12, 36],
  fomo_buy: [8, 24],
  overtrading: [10, 20],
  holding_losers: [8, 16],
  early_profit: [6, 18],
  concentration: [10, 10],
};

const DAY = 86400000;
const IST = 5.5 * 3600000;
const r2 = (n) => Math.round(n * 100) / 100;
const pctChange = (from, to) => (from ? ((to - from) / from) * 100 : 0);
const istDay = (d) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);
const tickerOf = (s = "") => s.replace(/\.(NS|BO)$/, "");

// Trade se pehle ke 5 trading days mein stock kitna chadha
export function runUpBefore(points, when, sessions = 5) {
  if (!points?.length) return null;
  const cutoff = istDay(when);
  const before = points.filter((p) => istDay(p.date) < cutoff);
  if (before.length <= sessions) return null;
  const last = before[before.length - 1].close;
  const earlier = before[before.length - 1 - sessions].close;
  return r2(pctChange(earlier, last));
}

// SELL se pehle is stock ki last BUY kab hui thi
function heldDaysFor(sell, trades) {
  const t = new Date(sell.createdAt).getTime();
  let lastBuy = null;
  for (const x of trades) {
    if (x.symbol !== sell.symbol || x.type !== "BUY") continue;
    const bt = new Date(x.createdAt).getTime();
    if (bt <= t) lastBuy = bt;
  }
  return lastBuy == null ? null : r2((t - lastBuy) / DAY);
}

export function analyze({ trades = [], holdings = [], prices = {}, history = {}, netWorth = 0 }) {
  const sells = trades.filter((t) => t.type === "SELL");
  const buys = trades.filter((t) => t.type === "BUY");
  const findings = [];

  // ---------- stats ----------
  const wins = sells.filter((s) => s.realizedPnl > 0);
  const losses = sells.filter((s) => s.realizedPnl < 0);
  const holdTimes = sells.map((s) => heldDaysFor(s, trades)).filter((d) => d != null);
  const stats = {
    totalTrades: trades.length,
    buys: buys.length,
    sells: sells.length,
    winRate: sells.length ? r2((wins.length / sells.length) * 100) : null,
    avgWin: wins.length ? r2(wins.reduce((s, x) => s + x.realizedPnl, 0) / wins.length) : 0,
    avgLoss: losses.length ? r2(losses.reduce((s, x) => s + x.realizedPnl, 0) / losses.length) : 0,
    avgHoldDays: holdTimes.length ? r2(holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length) : null,
    activeDays: new Set(trades.map((t) => istDay(t.createdAt))).size,
  };

  if (trades.length < 3) {
    return { status: "not_enough_data", needed: 3 - trades.length, score: null, findings: [], strengths: [], stats };
  }

  // ---------- 1. Panic selling ----------
  const panic = losses
    .map((s) => {
      const held = heldDaysFor(s, trades);
      const redDay = s.dayChangePercent != null && s.dayChangePercent <= RULES.panicDayDrop;
      const quick = held != null && held <= RULES.panicQuickDays;
      if (!redDay && !quick) return null;
      const now = prices[s.symbol];
      return {
        symbol: s.symbol,
        date: s.createdAt,
        quantity: s.quantity,
        price: s.price,
        loss: s.realizedPnl,
        dayChangePercent: s.dayChangePercent,
        heldDays: held,
        priceNow: now ?? null,
        sinceSoldPercent: now ? r2(pctChange(s.price, now)) : null,
        reason: redDay ? "red_day" : "quick_exit",
      };
    })
    .filter(Boolean);

  if (panic.length) {
    const recovered = panic.filter((p) => p.sinceSoldPercent > 0);
    const lostTotal = r2(panic.reduce((s, p) => s + p.loss, 0));
    findings.push({
      id: "panic_sell",
      title: "Panic selling",
      severity: panic.length >= 2 ? "high" : "medium",
      summary:
        `You sold at a loss ${panic.length} ${panic.length === 1 ? "time" : "times"} right after a sharp fall, ` +
        `booking ₹${Math.abs(lostTotal).toLocaleString("en-IN")} in losses.` +
        (recovered.length ? ` ${recovered.length === panic.length ? (panic.length === 1 ? "That stock is" : "All of them are") : `${recovered.length} of them ${recovered.length === 1 ? "is" : "are"}`} higher now than where you sold.` : ""),
      advice:
        "Before you sell on a red day, write down why you bought. If that reason still holds, a one-day drop is usually noise. Decide your exit price when you buy, not in the middle of a fall.",
      evidence: panic.slice(-5).reverse(),
    });
  }

  // ---------- 2. FOMO buying ----------
  const fomo = buys
    .map((b) => {
      const runUp = runUpBefore(history[b.symbol], b.createdAt);
      const hotDay = b.dayChangePercent != null && b.dayChangePercent >= RULES.fomoDayRise;
      const chased = runUp != null && runUp >= RULES.fomoRunUp5d;
      if (!hotDay && !chased) return null;
      const now = prices[b.symbol];
      return {
        symbol: b.symbol,
        date: b.createdAt,
        quantity: b.quantity,
        price: b.price,
        dayChangePercent: b.dayChangePercent,
        runUp5d: runUp,
        priceNow: now ?? null,
        sinceBoughtPercent: now ? r2(pctChange(b.price, now)) : null,
      };
    })
    .filter(Boolean);

  if (fomo.length) {
    const underwater = fomo.filter((f) => f.sinceBoughtPercent < 0);
    findings.push({
      id: "fomo_buy",
      title: "Chasing stocks after they jump",
      severity: fomo.length >= 3 ? "high" : "medium",
      summary:
        `${fomo.length} of your ${buys.length} buys came right after the stock had already shot up.` +
        (underwater.length ? ` ${underwater.length === fomo.length ? (fomo.length === 1 ? "It is" : "All of them are") : `${underwater.length} of them ${underwater.length === 1 ? "is" : "are"}`} now below your buy price.` : ""),
      advice:
        "A stock that has just jumped is often where early buyers take profit. Put it on a watchlist and wait a few sessions for the excitement to cool before deciding.",
      evidence: fomo.slice(-5).reverse(),
    });
  }

  // ---------- 3. Overtrading ----------
  const perDay = {};
  for (const t of trades) perDay[istDay(t.createdAt)] = (perDay[istDay(t.createdAt)] || 0) + 1;
  const busyDays = Object.entries(perDay)
    .filter(([, n]) => n >= RULES.overtradePerDay)
    .map(([day, count]) => ({ day, count }));

  if (busyDays.length) {
    const max = Math.max(...busyDays.map((d) => d.count));
    findings.push({
      id: "overtrading",
      title: "Overtrading",
      severity: max >= RULES.overtradePerDay * 2 ? "high" : "medium",
      summary: `On ${busyDays.length} ${busyDays.length === 1 ? "day" : "days"} you placed ${RULES.overtradePerDay} or more trades, with a peak of ${max} in one day.`,
      advice:
        "More trades rarely means more profit; it usually means reacting to every tick. Try a limit of 3 trades a day and only trade when your plan says so.",
      evidence: busyDays.sort((a, b) => b.count - a.count).slice(0, 5),
    });
  }

  // ---------- 4. Holding on to big losers ----------
  const bags = holdings.filter((h) => h.pnlPercent <= RULES.bagHoldLoss);
  if (bags.length) {
    findings.push({
      id: "holding_losers",
      title: "Holding on to losing stocks",
      severity: bags.some((b) => b.pnlPercent <= RULES.bagHoldLoss * 2) ? "high" : "medium",
      summary: `${bags.map((b) => tickerOf(b.symbol)).join(", ")} ${bags.length === 1 ? "is" : "are"} down more than ${Math.abs(RULES.bagHoldLoss)}% from your buy price and still in your portfolio.`,
      advice:
        "Ask yourself: would I buy this stock today at this price? If not, hoping it gets back to your buy price is not a plan. Set a stop-loss level for every holding.",
      evidence: bags.map((b) => ({ symbol: b.symbol, quantity: b.quantity, avgPrice: b.avgPrice, priceNow: b.livePrice, pnl: b.pnl, pnlPercent: b.pnlPercent })),
    });
  }

  // ---------- 5. Booking small profits too early ----------
  const early = wins
    .map((s) => {
      const held = heldDaysFor(s, trades);
      const gainPct = s.avgPriceAtTrade ? pctChange(s.avgPriceAtTrade, s.price) : null;
      const now = prices[s.symbol];
      const after = now ? pctChange(s.price, now) : null;
      if (held == null || held > RULES.quickProfitDays) return null;
      if (gainPct == null || gainPct >= RULES.quickProfitMaxGain) return null;
      if (after == null || after < RULES.missedRunAfterSell) return null;
      return { symbol: s.symbol, date: s.createdAt, quantity: s.quantity, price: s.price, profit: s.realizedPnl, gainPercent: r2(gainPct), priceNow: now, sinceSoldPercent: r2(after) };
    })
    .filter(Boolean);

  if (early.length) {
    findings.push({
      id: "early_profit",
      title: "Selling winners too early",
      severity: early.length >= 3 ? "high" : "low",
      summary: `${early.length === 1 ? "Once" : `${early.length} times`} you sold within ${RULES.quickProfitDays} days for a gain under ${RULES.quickProfitMaxGain}%, and the stock kept climbing more than ${RULES.missedRunAfterSell}% afterwards.`,
      advice:
        "Small, quick profits feel safe but cap your upside, while losses are left to run. Let winners run with a trailing stop instead of selling at the first green tick.",
      evidence: early.slice(-5).reverse(),
    });
  }

  // ---------- 6. Too much in one stock ----------
  const heavy = netWorth > 0 ? holdings.filter((h) => h.currentValue / netWorth >= RULES.concentration) : [];
  if (heavy.length) {
    const h = heavy[0];
    findings.push({
      id: "concentration",
      title: "Too much in one stock",
      severity: "medium",
      summary: `${tickerOf(h.symbol)} makes up ${Math.round((h.currentValue / netWorth) * 100)}% of your total money. One bad result could hit your whole portfolio.`,
      advice: "Spread your money so no single stock is more than about 20% of your portfolio.",
      evidence: heavy.map((x) => ({ symbol: x.symbol, currentValue: x.currentValue, sharePercent: r2((x.currentValue / netWorth) * 100) })),
    });
  }

  // ---------- score ----------
  const count = { panic_sell: panic.length, fomo_buy: fomo.length, overtrading: busyDays.length, holding_losers: bags.length, early_profit: early.length, concentration: heavy.length ? 1 : 0 };
  let score = 100;
  for (const [id, n] of Object.entries(count)) {
    const [each, cap] = PENALTY[id];
    score -= Math.min(n * each, cap);
  }
  score = Math.max(0, score);

  // ---------- what's going well ----------
  const strengths = [];
  if (sells.length >= 2 && !panic.length) strengths.push("You haven’t sold in a panic after a sharp fall.");
  if (buys.length >= 3 && !fomo.length) strengths.push("You aren’t chasing stocks that have just jumped.");
  if (!busyDays.length && trades.length >= 5) strengths.push("You trade at a calm pace instead of reacting to every move.");
  if (holdings.length >= 3 && !heavy.length) strengths.push("Your money is spread across several stocks.");
  if (stats.winRate != null && sells.length >= 3 && stats.winRate >= 60) strengths.push(`${stats.winRate}% of your sells were profitable.`);

  const severityRank = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    status: "ok",
    score,
    grade: score >= 80 ? "Disciplined" : score >= 60 ? "Mostly steady" : score >= 40 ? "Trading on emotion" : "Needs a plan",
    findings,
    strengths,
    stats,
  };
}
