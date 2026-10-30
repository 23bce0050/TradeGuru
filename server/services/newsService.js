// Finance + technology news: Google News RSS (free, bina API key, din bhar update hota hai)
// Hum sirf headline, source, time aur link dikhate hain; poora article original site par khulta hai.
import Parser from "rss-parser";
import NodeCache from "node-cache";
import crypto from "node:crypto";
import { classify, modelLoading } from "./sentimentService.js";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (TradeGuru news reader)" },
  customFields: { item: ["source"] },
});
const cache = new NodeCache({ stdTTL: 30 * 60 }); // har category 30 min cache

export const CATEGORIES = {
  markets: { label: "Markets", query: '(Sensex OR Nifty OR "stock market" OR "share market") India' },
  fintech: { label: "Fintech", query: '(fintech OR UPI OR "digital payments" OR "neobank" OR "NBFC") India' },
  technology: { label: "Technology", query: '(technology OR "artificial intelligence" OR startup OR semiconductor) India' },
  economy: { label: "Economy", query: '(RBI OR inflation OR GDP OR "repo rate" OR "Indian economy")' },
};

const feedUrl = (query, days) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=en-IN&gl=IN&ceid=IN:en`;

// Google News title: "Headline here - Source Name"
export function splitTitle(raw = "", sourceName = "") {
  if (sourceName && raw.endsWith(` - ${sourceName}`)) return raw.slice(0, -(sourceName.length + 3)).trim();
  const i = raw.lastIndexOf(" - ");
  return i > 20 ? raw.slice(0, i).trim() : raw.trim();
}

export function toArticle(item) {
  const sourceName = typeof item.source === "string" ? item.source : item.source?._ || "";
  const title = splitTitle(item.title, sourceName);
  return {
    id: crypto.createHash("md5").update(item.guid || item.link || item.title).digest("hex").slice(0, 12),
    title,
    source: sourceName || (item.title?.split(" - ").pop() ?? ""),
    link: item.link,
    publishedAt: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null),
  };
}

// Same khabar alag sites par -> ek hi rakho
function dedupe(articles) {
  const seen = new Set();
  return articles.filter((a) => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 8).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchFeed(query) {
  // Pehle sirf aaj ki (1 din), kam mile toh 3 din ki
  for (const days of [1, 3]) {
    const feed = await parser.parseURL(feedUrl(query, days));
    const items = (feed.items || []).map(toArticle).filter((a) => a.title && a.link);
    if (items.length >= 8 || days === 3) return items;
  }
  return [];
}

async function withSentiment(articles) {
  const scores = await classify(articles.map((a) => a.title));
  return articles.map((a, i) => ({ ...a, sentiment: scores[i] }));
}

function mood(articles) {
  const m = { positive: 0, negative: 0, neutral: 0, unknown: 0 };
  for (const a of articles) m[a.sentiment?.label || "unknown"]++;
  return m;
}

export async function getNews(category = "markets", limit = 30) {
  const cat = CATEGORIES[category] ? category : "markets";
  const key = `cat:${cat}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const raw = await fetchFeed(CATEGORIES[cat].query);
  const articles = await withSentiment(
    dedupe(raw)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit)
  );
  const result = { category: cat, label: CATEGORIES[cat].label, updatedAt: new Date().toISOString(), aiLoading: modelLoading(), mood: mood(articles), articles };
  cache.set(key, result, result.aiLoading ? 60 : undefined);
  return result;
}

// Ek company ki news (stock page ke liye)
export async function getStockNews(companyName, limit = 6) {
  const name = String(companyName || "").replace(/\b(limited|ltd\.?|inc\.?)\b/gi, "").trim();
  if (!name) return { articles: [], mood: mood([]) };
  const key = `stock:${name.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const raw = await fetchFeed(`"${name}" (shares OR stock OR results OR NSE)`);
  const articles = await withSentiment(
    dedupe(raw)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit)
  );
  const result = { company: name, updatedAt: new Date().toISOString(), aiLoading: modelLoading(), mood: mood(articles), articles };
  cache.set(key, result, result.aiLoading ? 60 : undefined);
  return result;
}
