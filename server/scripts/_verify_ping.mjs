import { runIncrementalSync } from "../src/crawler.js";
import { readStore } from "../src/store.js";

const result = await runIncrementalSync();
const store = readStore();
const content = Array.isArray(store.content) ? store.content : [];
const competitor = content.filter((c) => c.active && c.category === "competitor_docs");
const ping = competitor.filter((c) => c.vendor === "Ping Identity" || (Array.isArray(c.tags) && c.tags.includes("Ping Identity")));

console.log(JSON.stringify({
  result,
  competitorCount: competitor.length,
  pingCount: ping.length,
  pingSample: ping.slice(0, 15).map((x) => x.url)
}, null, 2));
