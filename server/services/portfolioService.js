// Ek user ka portfolio live prices ke saath (portfolio, coach aur leaderboard teeno use karte hain)
import Holding from "../models/Holding.js";
import { getQuote } from "./priceService.js";
import { valueHolding, summarize } from "./portfolioMath.js";

export async function livePrices(symbols) {
  const unique = [...new Set(symbols)];
  const entries = await Promise.all(
    unique.map(async (s) => {
      try {
        const q = await getQuote(s);
        return [s, q];
      } catch {
        return [s, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

export function valueAll(holdings, quotes) {
  return holdings.map((h) => {
    const q = quotes[h.symbol];
    if (q) return { ...valueHolding(h, q.price), dayChangePercent: q.changePercent, priceStale: false };
    return { ...valueHolding(h, h.invested / h.quantity), priceStale: true };
  });
}

export async function buildPortfolio(user, realizedPnl = 0) {
  const holdings = await Holding.find({ userId: user._id, quantity: { $gt: 0 } }).sort({ symbol: 1 });
  const quotes = await livePrices(holdings.map((h) => h.symbol));
  const valued = valueAll(holdings, quotes);
  return { summary: summarize(user.balance, valued, realizedPnl), holdings: valued, quotes };
}
