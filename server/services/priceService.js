import YahooFinance from "yahoo-finance2";
import { createCache } from "./cache.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Cache: price 30 sec, search 1 din, chart 10 min (Yahoo ko baar-baar hit karne se rate-limit lagta hai).
// Ek saath aayi same requests ek hi Yahoo call share karti hain (cache.js).
const priceCache = createCache();
export const priceStats = () => priceCache.stats();
const TTL = { quote: 30, search: 86400, chart: 600 };

// "reliance" -> "RELIANCE.NS" (agar exchange suffix nahi diya toh NSE maan lo)
export function toYahooSymbol(symbol) {
  const s = String(symbol || "").trim().toUpperCase();
  if (!s) throw new Error("Symbol required");
  return s.includes(".") ? s : `${s}.NS`;
}

const cached = (key, ttl, fn) => priceCache.memo(key, ttl, fn);

export function getQuote(symbol) {
  const sym = toYahooSymbol(symbol);
  return cached(`q:${sym}`, TTL.quote, async () => {
    const q = await yf.quote(sym);
    if (!q || q.regularMarketPrice == null) throw new Error(`No price for ${sym}`);
    return {
      symbol: sym,
      name: q.longName || q.shortName || sym,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      previousClose: q.regularMarketPreviousClose,
      dayHigh: q.regularMarketDayHigh,
      dayLow: q.regularMarketDayLow,
      currency: q.currency,
      marketState: q.marketState, // REGULAR = market khula, CLOSED = band
      updatedAt: q.regularMarketTime,
    };
  });
}

// Sirf Indian (NSE/BSE) equities return karo
export function searchStocks(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return Promise.resolve([]);
  return cached(`s:${q.toLowerCase()}`, TTL.search, async () => {
    const res = await yf.search(q, { quotesCount: 10, newsCount: 0 });
    return (res.quotes || [])
      .filter((x) => x.quoteType === "EQUITY" && /\.(NS|BO)$/.test(x.symbol || ""))
      .map((x) => ({
        symbol: x.symbol,
        name: x.longname || x.shortname || x.symbol,
        exchange: x.symbol.endsWith(".NS") ? "NSE" : "BSE",
      }));
  });
}

const RANGES = { "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365 };

export function getChart(symbol, range = "1m") {
  const sym = toYahooSymbol(symbol);
  const days = RANGES[range] || RANGES["1m"];
  return cached(`c:${sym}:${range}`, TTL.chart, async () => {
    const period1 = new Date(Date.now() - days * 86400000);
    const res = await yf.chart(sym, { period1, interval: "1d" });
    return (res.quotes || [])
      .filter((c) => c.close != null)
      .map((c) => ({ date: c.date, close: Number(c.close.toFixed(2)) }));
  });
}
