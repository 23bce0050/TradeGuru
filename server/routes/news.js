import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { CATEGORIES, getNews, getStockNews } from "../services/newsService.js";
import { getQuote } from "../services/priceService.js";
import { sentimentStatus } from "../services/sentimentService.js";

const router = Router();
router.use(protect);

// GET /api/news/categories
router.get("/categories", (req, res) => {
  res.json({
    categories: Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label })),
    ai: sentimentStatus(),
  });
});

// GET /api/news?category=markets|fintech|technology|economy
router.get("/", async (req, res) => {
  try {
    res.json(await getNews(String(req.query.category || "markets")));
  } catch (err) {
    console.error("[news]", err.message);
    res.status(503).json({ message: "News isn’t available right now. Try again in a few minutes." });
  }
});

// GET /api/news/stock/RELIANCE
router.get("/stock/:symbol", async (req, res) => {
  try {
    const quote = await getQuote(req.params.symbol);
    res.json(await getStockNews(quote.name));
  } catch (err) {
    console.error("[news:stock]", req.params.symbol, err.message);
    res.status(503).json({ message: "News for this stock isn’t available right now." });
  }
});

export default router;
