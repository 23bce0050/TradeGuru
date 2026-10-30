import mongoose from "mongoose";

// Har buy/sell ka record. AI Coach (Day 4) inhi se galtiyan pakdega,
// isliye trade ke waqt market ka haal bhi save karte hain.
const tradeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true },
    name: { type: String },
    type: { type: String, enum: ["BUY", "SELL"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }, // ek share ka daam
    total: { type: Number, required: true }, // price * quantity
    avgPriceAtTrade: { type: Number }, // SELL ke waqt average buy price
    realizedPnl: { type: Number, default: 0 }, // sirf SELL par
    dayChangePercent: { type: Number }, // us din stock kitna upar/neeche tha
    marketState: { type: String },
  },
  { timestamps: true }
);

// History (naye pehle) aur booked P&L (SELL) ki queries fast karne ke liye
tradeSchema.index({ userId: 1, createdAt: -1 });
tradeSchema.index({ userId: 1, type: 1 });

export default mongoose.model("Trade", tradeSchema);
