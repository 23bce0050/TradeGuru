import test from "node:test";
import assert from "node:assert/strict";
import Parser from "rss-parser";
import { splitTitle, toArticle } from "../services/newsService.js";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>"fintech" - Google News</title>
<item><title>RBI tightens rules for digital lenders, fintech stocks slip - The Economic Times</title>
<link>https://news.google.com/rss/articles/CBMiAAA?oc=5</link><guid isPermaLink="false">CBMiAAA</guid>
<pubDate>Wed, 14 Oct 2026 04:30:00 GMT</pubDate><description>&lt;a href="x"&gt;RBI&lt;/a&gt;</description>
<source url="https://economictimes.indiatimes.com">The Economic Times</source></item>
<item><title>UPI crosses 20 billion monthly transactions - Mint</title>
<link>https://news.google.com/rss/articles/CBMiBBB?oc=5</link><guid isPermaLink="false">CBMiBBB</guid>
<pubDate>Tue, 13 Oct 2026 10:00:00 GMT</pubDate><source url="https://www.livemint.com">Mint</source></item>
</channel></rss>`;

test("parses Google News RSS items", async () => {
  const parser = new Parser({ customFields: { item: ["source"] } });
  const feed = await parser.parseString(SAMPLE);
  const a = feed.items.map(toArticle);
  assert.equal(a.length, 2);
  assert.equal(a[0].title, "RBI tightens rules for digital lenders, fintech stocks slip");
  assert.equal(a[0].source, "The Economic Times");
  assert.equal(a[0].publishedAt, "2026-10-14T04:30:00.000Z");
  assert.match(a[1].link, /^https:\/\/news\.google\.com/);
  assert.equal(a[0].id.length, 12);
});

test("splitTitle keeps hyphenated headlines intact", () => {
  assert.equal(splitTitle("Q2 results: TCS beats estimates - year-on-year growth - Moneycontrol", "Moneycontrol"), "Q2 results: TCS beats estimates - year-on-year growth");
  assert.equal(splitTitle("Short - X"), "Short - X");
});
