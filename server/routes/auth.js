import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// POST /api/auth/signup  { name, email, password }
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ message: "Name, email aur password zaroori hain" });
  if (password.length < 6)
    return res.status(400).json({ message: "Password kam se kam 6 characters ka ho" });

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ message: "Email already registered" });

  const user = await User.create({ name, email, password });
  res.status(201).json({ token: signToken(user._id), user });
});

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: "Email aur password daalo" });

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ message: "Galat email ya password" });

  res.json({ token: signToken(user._id), user });
});

// GET /api/auth/me  (logged-in user + balance)
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

export default router;
