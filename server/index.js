import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET missing in .env");
  process.exit(1);
}

await connectDB();
app.listen(PORT, () => console.log(`🚀 TradeGuru API running on http://localhost:${PORT}`));
