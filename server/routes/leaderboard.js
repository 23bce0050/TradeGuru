import { Router } from "express";
import User, { STARTING_BALANCE } from "../models/User.js";
import Holding from "../models/Holding.js";
import Trade from "../models/Trade.js";
import { protect } from "../middleware/auth.js";
import { livePrices } from "../services/portfolioService.js";
import { round2 } from "../services/portfolioMath.js";
import { createCache } from "../services/cache.js";

const router = Router();
router.use(protect);

// Ranking sab users ke liye ek jaisi hai, toh har request par dobara calculate karne ki zaroorat nahi.
// 60 sec cache + coalescing: 1000 users ek saath kholein tab bhi calculation sirf 1 baar.
const boardCache = createCache();
const TTL = 60;

// "Harsh Gupta" -> "Harsh G." (poora naam public nahi)
const publicName = (name = "") => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first || "Trader";
};

async function netWorthOf(users, holdings) {
  const quotes = await livePrices(holdings.map((h) => h.symbol));
  const valueById = {};
  for (const h of holdings) {
    const price = quotes[h.symbol]?.price ?? h.invested / h.quantity;
    valueById[h.userId] = (valueById[h.userId] || 0) + h.quantity * price;
  }
  return users.map((u) => {
    const netWorth = round2(u.balance + (valueById[u._id] || 0));
    return {
      id: String(u._id),
      name: publicName(u.name),
      netWorth,
      returnPercent: round2(((netWorth - STARTING_BALANCE) / STARTING_BALANCE) * 100),
    };
  });
}

// Poori ranking (sirf un users ki jinhone kam se kam 1 trade kiya)
function ranking() {
  return boardCache.memo("board", TTL, async () => {
    const tradeCounts = await Trade.aggregate([{ $group: { _id: "$userId", trades: { $sum: 1 } } }]);
    const countById = Object.fromEntries(tradeCounts.map((t) => [String(t._id), t.trades]));
    const ids = Object.keys(countById);
    const [users, holdings] = await Promise.all([
      User.find({ _id: { $in: ids } }).select("name balance").lean(),
      Holding.find({ userId: { $in: ids }, quantity: { $gt: 0 } }).lean(),
    ]);
    const rows = (await netWorthOf(users, holdings))
      .map((r) => ({ ...r, trades: countById[r.id] || 0 }))
      .sort((a, b) => b.netWorth - a.netWorth)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    return { rows, updatedAt: new Date().toISOString() };
  });
}

const strip = ({ id, ...r }) => r;

// GET /api/leaderboard
router.get("/", async (req, res) => {
  const { rows, updatedAt } = await ranking();
  const myId = String(req.userId);
  let me = rows.find((r) => r.id === myId);

  // Naya user (cache mein nahi): sirf apna hisaab, aur andaza ki ranking mein kahan aata
  if (!me) {
    const [user, holdings] = await Promise.all([
      User.findById(req.userId).select("name balance").lean(),
      Holding.find({ userId: req.userId, quantity: { $gt: 0 } }).lean(),
    ]);
    if (user) {
      const [row] = await netWorthOf([user], holdings);
      me = { ...row, trades: 0, rank: rows.filter((r) => r.netWorth > row.netWorth).length + 1 };
    }
  }

  res.json({
    totalTraders: rows.length + (me && !rows.some((r) => r.id === myId) ? 1 : 0),
    updatedAt,
    top: rows.slice(0, 20).map((r) => ({ ...strip(r), isYou: r.id === myId })),
    you: me ? { ...strip(me), isYou: true } : null,
  });
});

export default router;
