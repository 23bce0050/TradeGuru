// Indian number style: ₹10,00,000
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const rupee = (n) => (n == null || Number.isNaN(n) ? "—" : inr.format(n));
export const rupee0 = (n) => (n == null || Number.isNaN(n) ? "—" : inr0.format(n));

export const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + inr.format(Math.abs(n || 0));
export const pct = (n) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}%`);

export const tone = (n) => (n > 0 ? "gain" : n < 0 ? "loss" : "flat");

// "RELIANCE.NS" -> "RELIANCE"
export const ticker = (symbol = "") => symbol.replace(/\.(NS|BO)$/, "");

export const when = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// "5 min ago", "3 h ago", "2 days ago"
export function ago(d) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
