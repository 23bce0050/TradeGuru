import mongoose from "mongoose";

// User ke paas abhi kaunse shares hain
// avgPrice = invested / quantity  (cost basis)
const holdingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true }, // e.g. RELIANCE.NS
    name: { type: String },
    quantity: { type: Number, required: true, min: 0 },
    invested: { type: Number, required: true, min: 0 }, // total kharid ki keemat
  },
  { timestamps: true }
);

// Ek user ka ek stock = ek hi holding
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

holdingSchema.virtual("avgPrice").get(function () {
  return this.quantity > 0 ? this.invested / this.quantity : 0;
});

export default mongoose.model("Holding", holdingSchema);
