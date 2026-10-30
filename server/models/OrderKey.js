import mongoose from "mongoose";

// Idempotency: har order ke saath client ek unique key bhejta hai (Idempotency-Key header).
// Same key dobara aaye (double click, network retry) toh order dobara NAHI chalta,
// pehle wala jawab hi lauta diya jaata hai.
const orderKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  status: { type: String, enum: ["pending", "done"], default: "pending" },
  statusCode: Number,
  response: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }, // 24 ghante baad apne aap delete
});

// Ek user ki ek key sirf ek baar: ye unique index hi asli suraksha hai
orderKeySchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model("OrderKey", orderKeySchema);
