// Rate limiting: koi ek user/IP server ko flood na kar sake.
// Load test ke waqt .env mein RATE_LIMIT=off daal sakte ho.
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import crypto from "node:crypto";

const OFF = process.env.RATE_LIMIT === "off";
const pass = (req, res, next) => next();

// Logged-in ho toh token se pehchano (ek office/college ke kai users ek IP share karte hain), warna IP se
const byUserOrIp = (req) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return "u:" + crypto.createHash("sha1").update(auth).digest("hex");
  return "ip:" + ipKeyGenerator(req.ip);
};

const make = (opts) =>
  OFF
    ? pass
    : rateLimit({
        standardHeaders: "draft-8",
        legacyHeaders: false,
        keyGenerator: byUserOrIp,
        ...opts,
      });

// Saari APIs: 300 requests / minute (normal use ~20-30/min hota hai)
export const apiLimiter = make({
  windowMs: 60 * 1000,
  limit: 300,
  message: { message: "Too many requests. Please slow down and try again in a minute." },
});

// Orders: 30 / minute
export const orderLimiter = make({
  windowMs: 60 * 1000,
  limit: 30,
  message: { message: "You’re placing orders too quickly. Wait a minute and try again." },
});

// Login/signup: 20 / 15 min per IP (password guessing rokne ke liye)
export const authLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => "ip:" + ipKeyGenerator(req.ip),
  message: { message: "Too many login attempts. Try again in 15 minutes." },
});
