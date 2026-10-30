// Cache + "request coalescing":
// Agar 100 users ek saath TCS ka price maangein aur cache khali ho,
// toh Yahoo par 100 nahi, sirf 1 call jaati hai. Baaki 99 usi call ka intezaar karte hain.
import NodeCache from "node-cache";

export function createCache() {
  const store = new NodeCache();
  const inflight = new Map(); // key -> Promise
  const stats = { hits: 0, coalesced: 0, upstreamCalls: 0, upstreamMs: 0, errors: 0 };

  async function memo(key, ttl, fn) {
    const hit = store.get(key);
    if (hit !== undefined) {
      stats.hits++;
      return hit;
    }
    if (inflight.has(key)) {
      stats.coalesced++;
      return inflight.get(key);
    }
    const started = Date.now();
    stats.upstreamCalls++;
    const p = (async () => {
      try {
        const value = await fn();
        store.set(key, value, ttl);
        return value;
      } catch (err) {
        stats.errors++;
        throw err;
      } finally {
        stats.upstreamMs += Date.now() - started;
        inflight.delete(key);
      }
    })();
    inflight.set(key, p);
    return p;
  }

  const snapshot = () => {
    const served = stats.hits + stats.coalesced + stats.upstreamCalls;
    return {
      ...stats,
      requestsServed: served,
      avgUpstreamMs: stats.upstreamCalls ? Math.round(stats.upstreamMs / stats.upstreamCalls) : null,
      upstreamSavedPercent: served ? Math.round(((served - stats.upstreamCalls) / served) * 1000) / 10 : 0,
    };
  };

  return { memo, stats: snapshot, clear: () => store.flushAll() };
}
