import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import stockRoutes from "./routes/stocks.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, app: "TradeGuru" }));
app.use("/api/auth", authRoutes);
app.use("/api/stocks", stockRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Express 5 async errors yahan aate hain
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

export default app;
