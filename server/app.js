import express from "express";
import cors from "cors";
import compression from "compression";
import { apiLimiter } from "./middleware/limits.js";
import authRoutes from "./routes/auth.js";
import stockRoutes from "./routes/stocks.js";
import tradeRoutes from "./routes/trade.js";
import portfolioRoutes from "./routes/portfolio.js";
import coachRoutes from "./routes/coach.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import newsRoutes from "./routes/news.js";
import { priceStats } from "./services/priceService.js";
import { sentimentStats } from "./services/sentimentService.js";

const app = express();

// Render/Vercel jaise proxy ke peeche asli user IP pehchanne ke liye (rate limit)
app.set("trust proxy", 1);
app.use(compression()); // JSON responses gzip: kam data, tez load

// CORS: localhost ka koi bhi port (5173, 5174...) + .env wala CLIENT_URL (deploy ke baad)
const allowed = (process.env.CLIENT_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      const ok = !origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) || allowed.includes(origin);
      cb(null, ok);
    },
  })
);
app.use(express.json({ limit: "10kb" })); // bade fake bodies se bachav

// Home: saari APIs ki list
app.get("/", (req, res) =>
  res.json({
    app: "TradeGuru API",
    status: "running",
    endpoints: [
      "GET  /api/health",
      "POST /api/auth/signup",
      "POST /api/auth/login",
      "GET  /api/auth/me",
      "GET  /api/stocks/search?q=tata",
      "GET  /api/stocks/RELIANCE/quote",
      "GET  /api/stocks/TCS/chart?range=1m",
      "POST /api/trade/buy        (login)",
      "POST /api/trade/sell       (login)",
      "GET  /api/trade/history    (login)",
      "GET  /api/portfolio        (login)",
      "POST /api/portfolio/reset  (login)",
      "GET  /api/coach            (login)",
      "GET  /api/leaderboard      (login)",
      "GET  /api/news?category=markets|fintech|technology|economy (login)",
      "GET  /api/news/stock/TCS   (login)",
    ],
  })
);

app.get("/api/health", (req, res) => res.json({ ok: true, app: "TradeGuru" }));

// Performance numbers (sirf counts, koi user data nahi): cache kitna kaam aaya, AI kitna fast hai
app.get("/api/stats", (req, res) =>
  res.json({ uptimeSec: Math.round(process.uptime()), marketData: priceStats(), sentiment: sentimentStats() })
);
// Har user/IP par request limit (health aur stats ke baad, baaki saari APIs par)
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/news", newsRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Express 5 async errors yahan aate hain
// Asli error sirf terminal mein; user ko andar ki detail (DB errors waghera) kabhi nahi
app.use((err, req, res, next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const status = err.status || err.statusCode || 500;
  if (status === 400 && err.type === "entity.parse.failed")
    return res.status(400).json({ message: "Invalid request" });
  res.status(status).json({ message: status < 500 ? err.message : "Something went wrong. Please try again." });
});

export default app;
