import test from "node:test";
import assert from "node:assert/strict";
import { createCache } from "../services/cache.js";

test("100 concurrent requests for the same key make 1 upstream call", async () => {
  const c = createCache();
  let calls = 0;
  const slow = () => new Promise((r) => setTimeout(() => r(++calls), 30));
  const results = await Promise.all(Array.from({ length: 100 }, () => c.memo("q:TCS.NS", 30, slow)));
  assert.equal(calls, 1);
  assert.ok(results.every((v) => v === 1));
  const s = c.stats();
  assert.equal(s.upstreamCalls, 1);
  assert.equal(s.coalesced, 99);
  assert.equal(s.upstreamSavedPercent, 99);
});

test("cached value is reused, errors are not cached", async () => {
  const c = createCache();
  let n = 0;
  await c.memo("a", 30, async () => ++n);
  await c.memo("a", 30, async () => ++n);
  assert.equal(n, 1);
  assert.equal(c.stats().hits, 1);
  await assert.rejects(c.memo("b", 30, async () => { throw new Error("down"); }));
  assert.equal(await c.memo("b", 30, async () => "ok"), "ok");
});
