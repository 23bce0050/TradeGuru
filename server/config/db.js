import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI missing in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");
}
