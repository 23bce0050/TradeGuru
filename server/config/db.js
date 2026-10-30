import mongoose from "mongoose";
import dns from "node:dns";

// Windows par kuch internet/router ka DNS "mongodb+srv" (SRV record) resolve nahi karta
// -> "querySrv ECONNREFUSED" error. Isliye Google + Cloudflare DNS use karo.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function connectDB() {
  // .env mein MONGO_URI ya MONGODB_URL, dono naam chalenge
  const uri = process.env.MONGO_URI || process.env.MONGODB_URL;
  if (!uri) {
    console.error("MONGO_URI (ya MONGODB_URL) missing in .env");
    process.exit(1);
  }

  // Link mein koi bhi database naam ho (jaise VirtualAssistant),
  // TradeGuru ka data hamesha "tradeguru" database mein hi jayega
  const dbName = process.env.DB_NAME || "tradeguru";

  try {
    // Pool: ek server se max itne DB connections (Atlas free = 500 total).
    await mongoose.connect(uri, {
      dbName,
      maxPoolSize: Number(process.env.DB_POOL_SIZE) || 20,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB connected (database: ${dbName})`);
  } catch (err) {
    console.error("MongoDB connect nahi hua:", err.message);
    if (/auth/i.test(err.message)) console.error("-> Username/password check karo (Atlas > Database Access)");
    if (/whitelist|ENOTFOUND|timed out|Server selection/i.test(err.message))
      console.error("-> Atlas > Network Access mein 0.0.0.0/0 allow karo, aur internet check karo");
    process.exit(1);
  }
}
