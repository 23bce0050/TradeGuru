import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const STARTING_BALANCE = 1_000_000; // ₹10 lakh virtual money

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    balance: { type: Number, default: STARTING_BALANCE },
  },
  { timestamps: true }
);

// Save hone se pehle password hash karo
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Response mein password kabhi na jaaye
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

export default mongoose.model("User", userSchema);
