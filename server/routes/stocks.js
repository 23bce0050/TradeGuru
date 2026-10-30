import { Router } from "express";
import { getQuote, searchStocks, getChart } from "../services/priceService.js";

const router = Router();

// GET /api/stocks/search?q=reliance
router.get("/search", async (req, res) => {
  const results = await searchStocks(req.query.q);
  res.json({ results });
});

// GET /api/stocks/RELIANCE/quote
router.get("/:symbol/quote", async (req, res) => {
  try {
    res.json(await getQuote(req.params.symbol));
  } catch (err) {
    res.status(404).json({ message: `Stock nahi mila: ${req.params.symbol}`, detail: err.message });
  }
});

// GET /api/stocks/RELIANCE/chart?range=1m   (1w | 1m | 3m | 6m | 1y)
router.get("/:symbol/chart", async (req, res) => {
  try {
    res.json({ symbol: req.params.symbol, points: await getChart(req.params.symbol, req.query.range) });
  } catch (err) {
    res.status(404).json({ message: "Chart data nahi mila", detail: err.message });
  }
});

export default router;
