import { Router } from "express";
import User from "../models/User.js";
import Holding from "../models/Holding.js";
import Trade from "../models/Trade.js";
import OrderKey from "../models/OrderKey.js";
import { protect } from "../middleware/auth.js";
import { orderLimiter } from "../middleware/limits.js";
import { getQuote } from "../services/priceService.js";
import { round2, applySell } from "../services/portfolioMath.js";

const router = Router();
router.use(protect);

function readQty(body) {
  const qty = Number(body?.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return null;
  return qty;
}

async function livePrice(symbol, res) {
  try {
    return await getQuote(symbol);
  } catch {
    res.status(404).json({ message: `Couldn’t get a price for ${symbol}` });
    return null;
  }
}


// ---------- Idempotency (duplicate order se bachav) ----------
// Client "Idempotency-Key: <uuid>" bhejta hai. Same key dobara aaye toh:
//   - pehla order ho chuka -> wahi jawab dobara (order dobara nahi chalta)
//   - pehla order abhi chal raha -> 409
async function idempotent(req, res, next) {
  const key = req.get("Idempotency-Key");
  if (!key) return next(); // header optional hai
  if (key.length > 100) return res.status(400).json({ message: "Invalid request" });

  let record;
  try {
    record = await OrderKey.create({ userId: req.userId, key });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const existing = await OrderKey.findOne({ userId: req.userId, key });
    if (existing?.status === "done") {
      res.set("Idempotent-Replayed", "true");
      return res.status(existing.statusCode).json(existing.response);
    }
    return res.status(409).json({ message: "This order is already being placed." });
  }

  // Success ka jawab key ke saath save karo; fail hua toh key hata do taaki user retry kar sake
  const send = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 300) return send(body);
    // Pehle jawab save karo, phir bhejo: turant aaya duplicate bhi "done" dekhega
    const plain = JSON.parse(JSON.stringify(body));
    OrderKey.updateOne({ _id: record._id }, { status: "done", statusCode: res.statusCode, response: plain })
      .catch((err) => console.error("[idempotency] save failed:", err.message))
      .finally(() => send(body));
    return res;
  };
  res.on("finish", () => {
    if (res.statusCode >= 300) OrderKey.deleteOne({ _id: record._id }).catch(() => {});
  });
  next();
}

// POST /api/trade/buy  { symbol: "RELIANCE", quantity: 10 }
router.post("/buy", orderLimiter, idempotent, async (req, res) => {
  const qty = readQty(req.body);
  if (!qty) return res.status(400).json({ message: "Quantity must be a whole number of 1 or more" });

  const quote = await livePrice(req.body?.symbol, res);
  if (!quote) return;

  const total = round2(quote.price * qty);

  // Atomic: balance tabhi katega jab utna paisa ho (do request ek saath aayein tab bhi safe)
  const user = await User.findOneAndUpdate(
    { _id: req.userId, balance: { $gte: total } },
    { $inc: { balance: -total } },
    { returnDocument: "after" }
  );
  if (!user) {
    const u = await User.findById(req.userId);
    return res.status(400).json({
      message: `Not enough cash. This order needs ₹${total}, you have ₹${round2(u?.balance ?? 0)}`,
    });
  }

  try {
    // Atomic $inc: read-then-write nahi, taaki ek saath do BUY ek-doosre ka update na mitayein
    const addToHolding = () =>
      Holding.findOneAndUpdate(
        { userId: req.userId, symbol: quote.symbol },
        { $inc: { quantity: qty, invested: total }, $set: { name: quote.name } },
        { upsert: true, returnDocument: "after" }
      );
    let h;
    try {
      h = await addToHolding();
    } catch (err) {
      if (err.code !== 11000) throw err; // do upsert ek saath: doosra wala dobara try karega
      h = await addToHolding();
    }
    const next = { quantity: h.quantity, invested: round2(h.invested), avgPrice: round2(h.invested / h.quantity) };

    const trade = await Trade.create({
      userId: req.userId,
      symbol: quote.symbol,
      name: quote.name,
      type: "BUY",
      quantity: qty,
      price: quote.price,
      total,
      dayChangePercent: quote.changePercent,
      marketState: quote.marketState,
    });

    res.status(201).json({
      message: `Bought ${qty} ${qty === 1 ? "share" : "shares"} of ${quote.name} at ₹${quote.price}`,
      trade,
      holding: { symbol: quote.symbol, ...next },
      balance: round2(user.balance),
    });
  } catch (err) {
    // Holding save fail hua toh paisa wapas
    await User.updateOne({ _id: req.userId }, { $inc: { balance: total } });
    throw err;
  }
});

// POST /api/trade/sell  { symbol: "RELIANCE", quantity: 5 }
router.post("/sell", orderLimiter, idempotent, async (req, res) => {
  const qty = readQty(req.body);
  if (!qty) return res.status(400).json({ message: "Quantity must be a whole number of 1 or more" });

  const quote = await livePrice(req.body?.symbol, res);
  if (!quote) return;

  const holding = await Holding.findOne({ userId: req.userId, symbol: quote.symbol });
  if (!holding || holding.quantity < qty) {
    return res.status(400).json({
      message: `You own ${holding?.quantity || 0} shares, so you can’t sell ${qty}`,
    });
  }

  const next = applySell(holding, qty, quote.price);
  const total = round2(quote.price * qty);

  // Optimistic concurrency: sirf tab update ho jab holding beech mein badla na ho (quantity wahi ho)
  const updated = await Holding.findOneAndUpdate(
    { _id: holding._id, quantity: holding.quantity },
    { $set: { quantity: next.quantity, invested: next.invested } },
    { returnDocument: "after" }
  );
  if (!updated) return res.status(409).json({ message: "Your holding changed while placing this order. Try again." });
  if (updated.quantity === 0) await Holding.deleteOne({ _id: updated._id, quantity: 0 });

  const user = await User.findByIdAndUpdate(req.userId, { $inc: { balance: total } }, { returnDocument: "after" });

  const trade = await Trade.create({
    userId: req.userId,
    symbol: quote.symbol,
    name: quote.name,
    type: "SELL",
    quantity: qty,
    price: quote.price,
    total,
    avgPriceAtTrade: next.avgPrice,
    realizedPnl: next.realizedPnl,
    dayChangePercent: quote.changePercent,
    marketState: quote.marketState,
  });

  const word = next.realizedPnl >= 0 ? "Profit" : "Loss";
  res.json({
    message: `Sold ${qty} ${qty === 1 ? "share" : "shares"} of ${quote.name} at ₹${quote.price}. ${word} of ₹${Math.abs(next.realizedPnl)}`,
    trade,
    holding: { symbol: quote.symbol, quantity: next.quantity, invested: next.invested },
    balance: round2(user.balance),
  });
});

// GET /api/trade/history?limit=50&symbol=TCS
router.get("/history", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filter = { userId: req.userId };
  if (req.query.symbol) {
    const s = String(req.query.symbol).toUpperCase();
    filter.symbol = s.includes(".") ? s : `${s}.NS`;
  }
  const trades = await Trade.find(filter).sort({ createdAt: -1 }).limit(limit);
  res.json({ count: trades.length, trades });
});

export default router;
