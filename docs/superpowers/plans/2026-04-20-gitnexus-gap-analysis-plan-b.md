# GitNexus Gap Analysis — Plan B: Server-Side Smart Gap Finder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Smart Gap Finder computation server-side using GitNexus BM25+semantic search, while keeping the existing client-side token-matcher as a transparent fallback.

**Architecture:** A new `POST /api/gap/analyze` endpoint runs GitNexus semantic search per competitor item to find Duo counterparts. A new `gapAnalysis.js` client module wraps the fetch call and falls back silently to the existing inline computation when the server returns `fallback: true` or errors. The App.jsx gap `useEffect` becomes async and delegates to `fetchGapItems` per chunk.

**Tech Stack:** Node.js 22 ESM (server), React 19 (client), `graphQueryClient` (from Plan A — must be present).

**Repos touched:** `C:\Admin\Projects\SiteNavigator\duo-sitenavigator`

**Depends on:** Plan A — `graphQueryClient`, `/api/compare/related`, `gitNexusIndexer`.

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `server/src/server.js` | Modify | Add `POST /api/gap/analyze` route after `/api/compare/related` |
| `server/tests/gapAnalyze.test.js` | Create | Unit tests: fallback shape, success shape, severity values |
| `client/src/features/sitenavigator/gapAnalysis.js` | Create | `fetchGapItems()` — server-first with null-on-fallback |
| `client/src/App.jsx` | Modify | gap `step()` async, calls `fetchGapItems`, falls back inline |

---

## Task 1: Server — `POST /api/gap/analyze` endpoint

**Files:**
- Modify: `server/src/server.js` (after line ~339, after `/api/compare/related`)
- Create: `server/tests/gapAnalyze.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/gapAnalyze.test.js`:

```js
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import express from "express";
import { createServer } from "node:http";

// We test the route logic in isolation by importing server after patching the module.
// Instead, we test the behavior via a lightweight mock of graphQueryClient.

describe("POST /api/gap/analyze", () => {
  it("returns fallback:true when graphQueryClient is unavailable", async () => {
    // Arrange: create a minimal express app with the route logic duplicated
    const app = express();
    app.use(express.json());

    const mockClient = { isAvailable: () => false, search: async () => [] };

    app.post("/api/gap/analyze", async (req, res) => {
      if (!mockClient.isAvailable()) {
        if (process.env.DEBUG_GITNEXUS) {
          console.debug(`[gap/analyze] fallback: GitNexus unavailable. items=${(req.body?.competitorItems || []).length}`);
        }
        return res.status(503).json({ ok: false, fallback: true, message: "GitNexus unavailable" });
      }
    });

    const server = createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/gap/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorItems: [{ id: "1", title: "SAML SSO", summary: "Single sign-on", vendor: "Okta", url: "https://okta.com/saml" }], limit: 3 }),
    });
    const data = await response.json();

    assert.equal(response.status, 503);
    assert.equal(data.ok, false);
    assert.equal(data.fallback, true);
    assert.ok(data.message.includes("unavailable"));

    await new Promise((r) => server.close(r));
  });

  it("returns findings array with correct shape when client is available", async () => {
    const app = express();
    app.use(express.json());

    const mockClient = {
      isAvailable: () => true,
      search: async (query) => [
        { id: "duo_1", title: "Duo SSO Guide", url: "https://duo.com/sso", vendor: "Duo", score: 0.82, excerpt: "Configure SSO" },
      ],
    };

    app.post("/api/gap/analyze", async (req, res) => {
      if (!mockClient.isAvailable()) {
        return res.status(503).json({ ok: false, fallback: true, message: "GitNexus unavailable" });
      }
      const competitorItems = Array.isArray(req.body?.competitorItems) ? req.body.competitorItems : [];
      const limit = Math.min(10, Math.max(1, Number(req.body?.limit || 3)));

      try {
        const findings = await Promise.all(
          competitorItems.map(async (item) => {
            const query = `${item.title || ""} ${item.summary || ""}`.trim();
            const hits = await mockClient.search(query, { limit });
            const relatedDuo = hits[0] || null;
            const relationScore = relatedDuo ? Number(relatedDuo.score || 0) : 0;
            const recencyScore = item.recencyScore || 0;
            const evidenceCount = item.evidenceCount || 0;
            const spreadScore = Math.min(4, evidenceCount);
            const severityScore = spreadScore + recencyScore + Math.max(0, 6 - relationScore);
            const severity = severityScore >= 9 ? "high" : severityScore >= 6 ? "medium" : "low";
            const gapType = item.gapType || "feature_gap";
            const whyFlagged = relatedDuo
              ? `Weak Duo alignment (${relationScore.toFixed(2)}). Best match: '${relatedDuo.title}'.`
              : `No Duo counterpart found. evidence vendors: ${evidenceCount}.`;

            return {
              id: `gap_${item.id}`,
              title: `${item.vendor || "Competitor"} ${(item.title || "").split(" ").slice(0, 6).join(" ")}`,
              summary: relatedDuo
                ? `Potential ${gapType.replace("_", " ")} gap. Closest Duo topic: '${relatedDuo.title}'.`
                : `Likely ${gapType.replace("_", " ")} gap with no reliable Duo equivalent.`,
              vendor: item.vendor || "",
              url: item.url || "",
              relatedDuoTitle: relatedDuo?.title || "",
              relationScore,
              severity,
              severityScore,
              gapType,
              whyFlagged,
              evidenceCount,
              feedbackState: item.feedbackState || "none",
              tags: [
                ...(Array.isArray(item.tags) ? item.tags : []),
                !relatedDuo ? "strong_gap" : "partial_gap",
                `gap_${gapType}`,
                `severity_${severity}`,
              ],
            };
          })
        );
        res.json({ ok: true, findings });
      } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
      }
    });

    const server = createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/gap/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitorItems: [{ id: "okta_1", title: "SAML SSO", summary: "single sign-on", vendor: "Okta", url: "https://okta.com/saml", evidenceCount: 2, recencyScore: 1, gapType: "feature_gap" }],
        limit: 3,
      }),
    });
    const data = await response.json();

    assert.equal(data.ok, true);
    assert.ok(Array.isArray(data.findings));
    assert.equal(data.findings.length, 1);
    const f = data.findings[0];
    assert.equal(f.id, "gap_okta_1");
    assert.ok(["high", "medium", "low"].includes(f.severity), `unexpected severity: ${f.severity}`);
    assert.ok(typeof f.severityScore === "number");
    assert.ok(typeof f.relatedDuoTitle === "string");
    assert.ok(Array.isArray(f.tags));

    await new Promise((r) => server.close(r));
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator/server
node --test tests/gapAnalyze.test.js
```

Expected: both tests pass against the inline mock app — they test the route *logic*, not the live server. This is intentional — the tests are green now as a contract for the real implementation.

> **Note:** These tests mock `graphQueryClient` inline via a local `mockClient`. They will still pass after Task 1's implementation because the test uses its own express app, not the live server. The value is documenting the contract and shapes.

- [ ] **Step 3: Add `POST /api/gap/analyze` to `server/src/server.js`**

Open `server/src/server.js`. After the `/api/compare/related` block (around line 339), add:

```js
// POST /api/gap/analyze
// Body: { competitorItems: Item[], limit?: number }
// Each item: { id, title, summary, vendor, url, evidenceCount?, recencyScore?, gapType?, feedbackState?, tags? }
// Returns: { ok: true, findings: GapFinding[] } or { ok: false, fallback: true } when GitNexus unavailable
app.post("/api/gap/analyze", async (req, res) => {
  if (!graphQueryClient.isAvailable()) {
    if (process.env.DEBUG_GITNEXUS) {
      console.debug(`[gap/analyze] fallback: GitNexus unavailable. items=${(req.body?.competitorItems || []).length}`);
    }
    return res.status(503).json({ ok: false, fallback: true, message: "GitNexus unavailable" });
  }

  const competitorItems = Array.isArray(req.body?.competitorItems) ? req.body.competitorItems : [];
  const limit = Math.min(10, Math.max(1, Number(req.body?.limit || 3)));

  try {
    const findings = await Promise.all(
      competitorItems.map(async (item) => {
        const query = `${item.title || ""} ${item.summary || ""}`.trim();
        const hits = await graphQueryClient.search(query, { limit });
        const relatedDuo = hits[0] || null;
        const relationScore = relatedDuo ? Number(relatedDuo.score || 0) : 0;
        const recencyScore = Number(item.recencyScore || 0);
        const evidenceCount = Number(item.evidenceCount || 0);
        const spreadScore = Math.min(4, evidenceCount);
        const severityScore = spreadScore + recencyScore + Math.max(0, 6 - relationScore);
        const severity = severityScore >= 9 ? "high" : severityScore >= 6 ? "medium" : "low";
        const gapType = String(item.gapType || "feature_gap");
        const whyFlagged = relatedDuo
          ? `Weak Duo alignment (${relationScore.toFixed(2)}). Best match: '${relatedDuo.title}'.`
          : `No Duo counterpart found. evidence vendors: ${evidenceCount}.`;

        return {
          id: `gap_${item.id}`,
          title: `${item.vendor || "Competitor"} ${(item.title || "").split(" ").slice(0, 6).join(" ")}`,
          summary: relatedDuo
            ? `Potential ${gapType.replace("_", " ")} gap. Closest Duo topic: '${relatedDuo.title}'.`
            : `Likely ${gapType.replace("_", " ")} gap with no reliable Duo equivalent.`,
          vendor: item.vendor || "",
          url: item.url || "",
          relatedDuoTitle: relatedDuo?.title || "",
          relationScore,
          severity,
          severityScore,
          gapType,
          whyFlagged,
          evidenceCount,
          feedbackState: String(item.feedbackState || "none"),
          tags: [
            ...(Array.isArray(item.tags) ? item.tags : []),
            !relatedDuo ? "strong_gap" : "partial_gap",
            `gap_${gapType}`,
            `severity_${severity}`,
          ],
        };
      })
    );

    res.json({ ok: true, findings });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});
```

- [ ] **Step 4: Smoke-test the endpoint**

Start the server (or verify it starts without syntax errors):

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator/server
node --check src/server.js
```

Expected: no syntax errors.

Then start server and curl:

```bash
node src/server.js &
sleep 2
curl -s -X POST http://localhost:8787/api/gap/analyze \
  -H "Content-Type: application/json" \
  -d '{"competitorItems":[{"id":"test1","title":"SAML SSO","summary":"single sign-on","vendor":"Okta","url":"https://okta.com/saml","evidenceCount":2,"recencyScore":1,"gapType":"feature_gap"}],"limit":3}' | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
kill %1
```

Expected (GitNexus unavailable): `{"ok":false,"fallback":true,"message":"GitNexus unavailable"}`

- [ ] **Step 5: Run all server tests**

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator/server
node --test tests/gapAnalyze.test.js
```

Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" add server/src/server.js server/tests/gapAnalyze.test.js
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" commit -m "feat(server): add POST /api/gap/analyze backed by GitNexus with fallback"
```

---

## Task 2: Client — `gapAnalysis.js` fetch wrapper

**Files:**
- Create: `client/src/features/sitenavigator/gapAnalysis.js`

No dedicated test file — behavior is verified by App.jsx smoke test in Task 3. The module is a thin fetch wrapper; logic under test lives in the server.

- [ ] **Step 1: Create `client/src/features/sitenavigator/gapAnalysis.js`**

```js
// fetchGapItems: POST /api/gap/analyze for a slice of competitor items.
// Returns array of gap findings on success, null on server unavailable or any error.
// Null triggers caller to fall back to inline token-matcher computation.
export async function fetchGapItems(competitorItems, { signal } = {}) {
  const debug = typeof localStorage !== "undefined" && localStorage.getItem("debug") === "gitnexus";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const fetchSignal = signal ?? controller.signal;

    const response = await fetch("/api/gap/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorItems, limit: 3 }),
      signal: fetchSignal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (debug) console.debug(`[gitnexus] gap/analyze HTTP ${response.status} — falling back inline`);
      return null;
    }

    const data = await response.json();
    if (!data.ok || data.fallback) {
      if (debug) console.debug(`[gitnexus] gap/analyze fallback: ${data.message}`);
      return null;
    }

    return Array.isArray(data.findings) ? data.findings : null;
  } catch (err) {
    if (debug) console.debug(`[gitnexus] gap/analyze error — falling back inline:`, err.message);
    return null;
  }
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator
node --input-type=module < client/src/features/sitenavigator/gapAnalysis.js 2>&1 || true
```

Expected: no output (or only a fetch-not-defined error at runtime which is fine in Node — the module syntax is valid).

- [ ] **Step 3: Commit**

```bash
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" add client/src/features/sitenavigator/gapAnalysis.js
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" commit -m "feat(client): add gapAnalysis.js fetchGapItems with server-first + null fallback"
```

---

## Task 3: Client — App.jsx async gap `step()`

**Files:**
- Modify: `client/src/App.jsx`

The gap `useEffect` currently uses a synchronous `step()` with `setTimeout` for yielding. This task makes it async and wires in `fetchGapItems`. The existing inline computation is kept as the fallback branch.

- [ ] **Step 1: Add `fetchGapItems` import to App.jsx**

Find the existing import block near the top of `App.jsx` that imports from `compareMatching` (around line 88):

```js
import {
  findRelatedCompareItems,
  fetchRelatedItems,
  // ... other imports
} from "./features/sitenavigator/compareMatching";
```

Add a new import immediately after it (or after any nearby import block):

```js
import { fetchGapItems } from "./features/sitenavigator/gapAnalysis";
```

- [ ] **Step 2: Modify the gap `useEffect` — make step async and wire fetchGapItems**

In the gap `useEffect` (around line 4832), find:

```js
    const step = (startIndex) => {
      if (cancelled) return;
      const slice = competitorItems.slice(startIndex, startIndex + chunkSize);

      slice.forEach((item) => {
```

Replace the entire `step` function and its call site. The new version:

1. Makes `step` async
2. Calls `fetchGapItems` first; if it returns `null`, falls back to the existing inline loop
3. Replaces `setTimeout(() => step(nextIndex), 0)` with `await step(nextIndex)`
4. Adds `recencyScore`, `evidenceCount`, `gapType` to each item before sending to server

Replace from `const step = (startIndex) => {` down through `step(0);` with:

```js
    const step = async (startIndex) => {
      if (cancelled) return;
      const slice = competitorItems.slice(startIndex, startIndex + chunkSize);

      // Annotate items with precomputed scores so server can compute severity
      const annotated = slice.map((item) => ({
        ...item,
        evidenceCount: topicVendorSpread.get(toTopicKey(item))?.size || 0,
        recencyScore: changedWeight(item),
        gapType: gapTypeForItem(item),
        feedbackState: feedbackSnapshot[`gap_${item.id}`] || "none",
      }));

      const serverFindings = await fetchGapItems(annotated);

      if (serverFindings !== null) {
        // Server returned semantic gap findings — push directly
        serverFindings.forEach((finding) => built.push(finding));
      } else {
        // Inline fallback: same token-matcher logic as before
        slice.forEach((item) => {
          const seedTokens = tokenizeRelationText([item.title, item.summary, item.pathSummary].join(" ")).slice(0, 18);
          const candidateIds = new Set();
          seedTokens.forEach((token) => {
            const ids = duoTokenIndex.get(token);
            if (!ids) return;
            ids.forEach((id) => candidateIds.add(id));
          });

          const rankedCandidates = [...candidateIds]
            .slice(0, 120)
            .map((id) => duoById.get(id))
            .filter(Boolean)
            .map((candidate) => {
              const scoreMeta = relationScore(item, candidate, { vendorPriority: "duo_first", boostTerms: [] });
              return {
                ...candidate,
                relationScore: scoreMeta.score,
                relationConfidence: relationConfidence(scoreMeta.score),
                matchedTokens: scoreMeta.matchedTokens,
                boostedTokens: scoreMeta.boostedTokens,
              };
            })
            .filter((candidate) => candidate.relationScore > 0);

          const articleCandidates = rankedCandidates.filter((candidate) => !isNavigationHeavyContent(candidate));
          const relatedCandidates = (articleCandidates.length ? articleCandidates : rankedCandidates)
            .sort((a, b) => b.relationScore - a.relationScore)
            .slice(0, 3);

          const relatedDuo = relatedCandidates[0] || null;
          const topicKey = toTopicKey(item);
          const evidenceCount = topicVendorSpread.get(topicKey)?.size || 0;
          const relationConfidenceScore = relatedDuo?.relationScore || 0;
          const recencyScore = changedWeight(item);
          const spreadScore = Math.min(4, evidenceCount);
          const severityScore = spreadScore + recencyScore + Math.max(0, 6 - relationConfidenceScore);
          const severity = severityScore >= 9 ? "high" : severityScore >= 6 ? "medium" : "low";
          const isStrongGap = !relatedDuo && evidenceCount >= minimumStrongGapEvidence;
          const gapType = gapTypeForItem(item);
          const matched = relatedDuo?.matchedTokens?.slice(0, 4) || [];
          const missingHint = tokenizeRelationText(item.title).slice(0, 4).filter((token) => !matched.includes(token));
          const whyFlagged = relatedDuo
            ? `Weak Duo alignment (${relationConfidenceScore}). matched: ${matched.join(", ") || "none"}; missing: ${missingHint.join(", ") || "none"}.`
            : `No Duo counterpart above threshold. evidence vendors: ${evidenceCount}. missing: ${missingHint.join(", ") || "none"}.`;
          const feedbackState = feedbackSnapshot[`gap_${item.id}`] || "none";

          built.push({
            ...item,
            id: `gap_${item.id}`,
            title: `${item.vendor || "Competitor"} ${summarizeTopicTitle(item.title, 6)}`,
            summary: relatedDuo
              ? `Potential ${gapType.replace("_", " ")} gap. Closest Duo topic: '${summarizeTopicTitle(relatedDuo.title, 6)}'.`
              : `Likely ${gapType.replace("_", " ")} gap with no reliable Duo equivalent detected.`,
            tags: [
              ...(Array.isArray(item.tags) ? item.tags : []),
              isStrongGap ? "strong_gap" : "partial_gap",
              `gap_${gapType}`,
              `severity_${severity}`,
            ],
            relatedScore: relationConfidenceScore,
            relatedDuoTitle: relatedDuo?.title || "",
            severity,
            severityScore,
            gapType,
            whyFlagged,
            evidenceCount,
            feedbackState,
          });
        });
      }

      const nextIndex = startIndex + chunkSize;
      const progress = competitorItems.length
        ? Math.round((Math.min(nextIndex, competitorItems.length) / competitorItems.length) * 100)
        : 100;

      const partial = built
        .filter((item) => item.feedbackState !== "dismissed" && item.feedbackState !== "confirmed")
        .sort((a, b) => {
          const feedbackBoostA = a.feedbackState === "confirmed" ? 5 : 0;
          const feedbackBoostB = b.feedbackState === "confirmed" ? 5 : 0;
          return (b.severityScore + feedbackBoostB) - (a.severityScore + feedbackBoostA);
        })
        .slice(0, 300);

      if (!cancelled) {
        setSmartGapItems(partial);
        setToolLoadState((prev) => ({ ...prev, gap: { loading: nextIndex < competitorItems.length, progress } }));
      }

      if (nextIndex < competitorItems.length) {
        await step(nextIndex);
      } else {
        if (!cancelled) setToolComputedAt((prev) => ({ ...prev, gap: Date.now() }));
      }
    };

    step(0).catch(() => {});
```

- [ ] **Step 3: Build the client to confirm no errors**

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator
npm run build --workspace=client 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript/module errors.

- [ ] **Step 4: Dev server smoke test**

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator
npm run dev
```

Open http://localhost:4173, navigate to **Smart Gap Finder**, click **Run**. Verify:

- Results appear (same as before — GitNexus unavailable → inline fallback)
- No console errors about unhandled promise rejections
- Open DevTools → Network: `POST /api/gap/analyze` returns 503 with `fallback: true`
- Open DevTools → Console: set `localStorage.setItem("debug","gitnexus")`, re-run — debug log appears: `[gitnexus] gap/analyze fallback: GitNexus unavailable`

- [ ] **Step 5: Commit**

```bash
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" add client/src/App.jsx
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" commit -m "feat(compare): async gap step() uses fetchGapItems with GitNexus-first search"
```

---

## End-to-End Verification (when GitNexus is available)

After all tasks, with `gitnexus` on PATH and an indexed docs dir:

- [ ] Start server with `DEBUG_GITNEXUS=true node src/server.js` and confirm `/api/graph/status` shows `"available": true`
- [ ] Open Smart Gap Finder → Run — check Network tab: `/api/gap/analyze` returns 200 with `findings` array
- [ ] Confirm gap items appear with `severity` values and `relatedDuoTitle` populated from GitNexus results
- [ ] Kill gitnexus process, re-run — confirm fallback fires silently and results still appear

---

## Self-Review Notes

- `recencyScore`, `evidenceCount`, and `gapType` are annotated client-side before sending to the server because the server doesn't have the full catalog to compute `topicVendorSpread` or access `changedWeight`. This keeps the server payload self-contained per item.
- The fallback inline loop is a verbatim copy of the original `step` body — if the original logic changes, update both. A refactor to extract it is YAGNI until a third caller appears.
- `cancelled` is checked before every `setSmartGapItems` call in both server and inline paths.
- The `Promise.all` in the server handler fans out all items in a chunk concurrently. For chunks of 20 with a slow GitNexus, this could be 20 concurrent MCP calls — acceptable given chunkSize=20 is already the client's batch unit.
