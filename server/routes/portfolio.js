import { Router } from "express";
import mongoose from "mongoose";
import User, { STARTING_BALANCE } from "../models/User.js";
import Holding from "../models/Holding.js";
import Trade from "../models/Trade.js";
import { protect } from "../middleware/auth.js";
import { buildPortfolio } from "../services/portfolioService.js";

const router = Router();
router.use(protect);

export async function realizedPnlFor(userId) {
  const r = await Trade.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), type: "SELL" } },
    { $group: { _id: null, total: { $sum: "$realizedPnl" } } },
  ]);
  return r[0]?.total || 0;
}

// GET /api/portfolio  -> holdings + live P&L + summary
router.get("/", async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  const { summary, holdings } = await buildPortfolio(user, await realizedPnlFor(req.userId));
  res.json({ summary, holdings });
});

// POST /api/portfolio/reset  -> sab saaf, wapas ₹10 lakh
router.post("/reset", async (req, res) => {
  await Promise.all([
    Holding.deleteMany({ userId: req.userId }),
    Trade.deleteMany({ userId: req.userId }),
    User.updateOne({ _id: req.userId }, { $set: { balance: STARTING_BALANCE } }),
  ]);
  res.json({ message: "Your portfolio is reset. Cash is back to ₹10,00,000.", balance: STARTING_BALANCE });
});

export default router;
