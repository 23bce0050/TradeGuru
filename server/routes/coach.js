import { Router } from "express";
import User from "../models/User.js";
import Trade from "../models/Trade.js";
import { protect } from "../middleware/auth.js";
import { getChart } from "../services/priceService.js";
import { buildPortfolio, livePrices } from "../services/portfolioService.js";
import { analyze } from "../services/coachRules.js";
import { realizedPnlFor } from "./portfolio.js";

const router = Router();
router.use(protect);

const MAX_CHART_SYMBOLS = 15; // Yahoo par zyada load na pade

// GET /api/coach  -> trading behaviour report
router.get("/", async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  const [trades, realized] = await Promise.all([
    Trade.find({ userId: req.userId }).sort({ createdAt: 1 }).limit(1000).lean(),
    realizedPnlFor(req.userId),
  ]);
  const { summary, holdings, quotes } = await buildPortfolio(user, realized);

  // Beche hue stocks ka bhi abhi ka price chahiye ("bechne ke baad kitna chadha")
  const traded = [...new Set(trades.map((t) => t.symbol))];
  const extra = await livePrices(traded.filter((s) => !quotes[s]));
  const prices = {};
  for (const [s, q] of Object.entries({ ...quotes, ...extra })) if (q) prices[s] = q.price;

  // FOMO check ke liye kharide gaye stocks ki 3 mahine ki history
  const recentBuys = [...new Set(trades.filter((t) => t.type === "BUY").reverse().map((t) => t.symbol))].slice(0, MAX_CHART_SYMBOLS);
  const history = {};
  await Promise.all(
    recentBuys.map(async (s) => {
      try {
        history[s] = await getChart(s, "3m");
      } catch {
        /* history na mile toh sirf us din ka move use hoga */
      }
    })
  );

  const report = analyze({ trades, holdings, prices, history, netWorth: summary.netWorth });
  res.json({ ...report, generatedAt: new Date() });
});

export default router;
