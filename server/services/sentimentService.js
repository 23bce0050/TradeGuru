// AI sentiment: FinBERT (finance news par trained model) jo seedha Node.js mein chalta hai.
// Koi API key nahi. Pehli baar model (~110 MB) download hota hai, phir disk par cache.
// Model load na ho paaye toh app chalta rehta hai, bas sentiment null aata hai.

const MODEL = process.env.SENTIMENT_MODEL || "Xenova/finbert";
const ENABLED = process.env.SENTIMENT !== "off";

let classifierPromise = null;
let classifier = null; // load ho jaane ke baad yahan
let disabledReason = ENABLED ? null : "disabled by SENTIMENT=off";
const cache = new Map(); // title -> { label, score }
const stats = { headlinesClassified: 0, batches: 0, inferenceMs: 0, loadMs: null };
let loadStarted = null;

function loadModel() {
  if (!classifierPromise) {
    loadStarted = Date.now();
    classifierPromise = import("@huggingface/transformers")
      .then(({ pipeline }) => pipeline("text-classification", MODEL, { dtype: "q8" }))
      .then((clf) => {
        console.log(`[sentiment] ${MODEL} loaded`);
        classifier = clf;
        stats.loadMs = Date.now() - loadStarted;
        return clf;
      })
      .catch((err) => {
        disabledReason = err.message;
        console.error("[sentiment] model load failed, news will show without sentiment:", err.message);
        return null;
      });
  }
  return classifierPromise;
}

// Server start hote hi background mein model load karna shuru (pehli request fast ho)
export function warmUp() {
  if (ENABLED) loadModel();
}

const LABELS = { positive: "positive", negative: "negative", neutral: "neutral" };

export const modelReady = () => Boolean(classifier);
export const modelLoading = () => ENABLED && !classifier && !disabledReason;

// texts -> [{ label: "positive" | "negative" | "neutral", score: 0..1 } | null]
// Model abhi download ho raha ho toh intezaar NAHI karte: news turant bina tags ke jaati hai,
// aur model ready hone ke baad agli refresh mein tags aa jaate hain.
export async function classify(texts) {
  if (!ENABLED || !texts.length) return texts.map(() => null);
  if (!classifier) {
    loadModel();
    return texts.map(() => null);
  }
  const clf = classifier;

  const todo = [...new Set(texts.filter((t) => !cache.has(t)))];
  const BATCH = 16;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    try {
      const t0 = Date.now();
      const out = await clf(chunk);
      stats.inferenceMs += Date.now() - t0;
      stats.batches++;
      stats.headlinesClassified += chunk.length;
      const list = Array.isArray(out) ? out : [out];
      list.forEach((o, k) => {
        const best = Array.isArray(o) ? o[0] : o;
        const label = LABELS[String(best?.label || "").toLowerCase()] || null;
        cache.set(chunk[k], label ? { label, score: Math.round(best.score * 100) / 100 } : null);
      });
    } catch (err) {
      console.error("[sentiment] classify failed:", err.message);
      chunk.forEach((t) => cache.set(t, null));
    }
  }
  if (cache.size > 5000) cache.clear(); // memory limit
  return texts.map((t) => cache.get(t) ?? null);
}

export const sentimentStats = () => ({
  ...stats,
  ready: Boolean(classifier),
  avgMsPerHeadline: stats.headlinesClassified ? Math.round((stats.inferenceMs / stats.headlinesClassified) * 10) / 10 : null,
});

export const sentimentStatus = () => ({ enabled: ENABLED && !disabledReason, model: MODEL, reason: disabledReason });
