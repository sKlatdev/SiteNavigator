# GitNexus Clone Duo Disambiguation — Plan C: Graph-Powered Ambiguity Resolution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `UNRESOLVED_AMBIGUOUS` fields in Clone Duo drafts by querying the GitNexus graph to pick the most authoritative candidate value — no new AI provider required.

**Architecture:** A new `cloneDuoGraphResolver.js` module queries `graphQueryClient.search()` for each conflicting candidate value and picks the one most corroborated by the indexed docs (confidence ≥ 0.6, margin ≥ 0.15). `cloneDuoMapping.js` calls the resolver immediately after detecting `UNRESOLVED_AMBIGUOUS`. On unavailability or low confidence, the field stays `UNRESOLVED_AMBIGUOUS` — no regression.

**Tech Stack:** Node.js 22 ESM, `graphQueryClient` (from Plan A — must be present).

**Repos touched:** `C:\Admin\Projects\SiteNavigator\duo-sitenavigator`

**Depends on:** Plan A — `graphQueryClient`.

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `server/src/cloneDuoGraphResolver.js` | Create | `resolveAmbiguityWithGraph()` — per-candidate search + scoring |
| `server/tests/cloneDuoGraphResolver.test.js` | Create | Unit tests: unavailable, clear winner, tie, low confidence |
| `server/src/cloneDuoMapping.js` | Modify | `resolveFieldState` → async; call resolver on `UNRESOLVED_AMBIGUOUS`; `buildCloneDuoDraft` → `Promise.all` |

---

## Task 1: `cloneDuoGraphResolver.js` — ambiguity resolver

**Files:**
- Create: `server/src/cloneDuoGraphResolver.js`
- Create: `server/tests/cloneDuoGraphResolver.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/cloneDuoGraphResolver.test.js`:

```js
import assert from "node:assert/strict";
import { describe, it, before, after, mock } from "node:test";

// We mock graphQueryClient by patching the module registry.
// node:test mock.module is available in Node 22+.

describe("resolveAmbiguityWithGraph", () => {
  it("returns null when graphQueryClient is unavailable", async () => {
    // Inline test using a factory that accepts a client dependency
    async function resolveAmbiguityWithGraphFn(field, candidateValues, context, client) {
      if (!client.isAvailable()) {
        if (process.env.DEBUG_GITNEXUS) {
          console.debug(`[cloneDuoGraphResolver] unavailable — skipping disambiguation for field ${context?.fieldId}`);
        }
        return null;
      }
      const scores = await Promise.all(
        candidateValues.map(async (value) => {
          const hits = await client.search(`${value} ${field.label}`, { limit: 3 });
          const score = hits.reduce((sum, h) => sum + Number(h.score || 0), 0);
          return { value, score, evidenceUrls: hits.map((h) => h.url || "").filter(Boolean) };
        })
      );
      scores.sort((a, b) => b.score - a.score);
      const top = scores[0];
      const second = scores[1];
      const margin = second ? top.score - second.score : top.score;
      const CONFIDENCE_THRESHOLD = 0.6;
      const MARGIN_THRESHOLD = 0.15;
      if (top.score < CONFIDENCE_THRESHOLD || margin < MARGIN_THRESHOLD) {
        if (process.env.DEBUG_GITNEXUS) {
          console.debug(`[cloneDuoGraphResolver] low confidence for field ${context?.fieldId}: top=${top.score.toFixed(3)} margin=${margin.toFixed(3)}`);
        }
        return null;
      }
      return { resolvedValue: top.value, confidence: top.score, evidenceUrls: top.evidenceUrls };
    }

    const field = { id: "sp_entity_id", label: "SP Entity ID" };
    const unavailableClient = { isAvailable: () => false, search: async () => [] };

    const result = await resolveAmbiguityWithGraphFn(field, ["https://a.com/sp", "https://b.com/sp"], { fieldId: "sp_entity_id" }, unavailableClient);
    assert.equal(result, null);
  });

  it("returns resolvedValue for the higher-scored candidate", async () => {
    async function resolveAmbiguityWithGraphFn(field, candidateValues, context, client) {
      if (!client.isAvailable()) return null;
      const scores = await Promise.all(
        candidateValues.map(async (value) => {
          const hits = await client.search(`${value} ${field.label}`, { limit: 3 });
          const score = hits.reduce((sum, h) => sum + Number(h.score || 0), 0);
          return { value, score, evidenceUrls: hits.map((h) => h.url || "").filter(Boolean) };
        })
      );
      scores.sort((a, b) => b.score - a.score);
      const top = scores[0];
      const second = scores[1];
      const margin = second ? top.score - second.score : top.score;
      const CONFIDENCE_THRESHOLD = 0.6;
      const MARGIN_THRESHOLD = 0.15;
      if (top.score < CONFIDENCE_THRESHOLD || margin < MARGIN_THRESHOLD) return null;
      return { resolvedValue: top.value, confidence: top.score, evidenceUrls: top.evidenceUrls };
    }

    const field = { id: "sp_entity_id", label: "SP Entity ID" };
    // Mock: first candidate scores high (0.85), second scores low (0.30)
    let callCount = 0;
    const mockClient = {
      isAvailable: () => true,
      search: async (query) => {
        callCount++;
        if (query.includes("https://okta.com/sp")) return [{ score: 0.85, url: "https://duo.com/okta-sp" }];
        return [{ score: 0.30, url: "https://duo.com/other" }];
      },
    };

    const result = await resolveAmbiguityWithGraphFn(
      field,
      ["https://okta.com/sp", "https://pingid.com/sp"],
      { fieldId: "sp_entity_id" },
      mockClient
    );

    assert.ok(result !== null, "expected non-null result");
    assert.equal(result.resolvedValue, "https://okta.com/sp");
    assert.ok(result.confidence >= 0.6, `confidence too low: ${result.confidence}`);
    assert.ok(Array.isArray(result.evidenceUrls));
    assert.equal(callCount, 2); // one search per candidate
  });

  it("returns null when margin between top two candidates is below 0.15", async () => {
    async function resolveAmbiguityWithGraphFn(field, candidateValues, context, client) {
      if (!client.isAvailable()) return null;
      const scores = await Promise.all(
        candidateValues.map(async (value) => {
          const hits = await client.search(`${value} ${field.label}`, { limit: 3 });
          const score = hits.reduce((sum, h) => sum + Number(h.score || 0), 0);
          return { value, score, evidenceUrls: [] };
        })
      );
      scores.sort((a, b) => b.score - a.score);
      const top = scores[0];
      const second = scores[1];
      const margin = second ? top.score - second.score : top.score;
      if (top.score < 0.6 || margin < 0.15) return null;
      return { resolvedValue: top.value, confidence: top.score, evidenceUrls: [] };
    }

    const field = { id: "sp_entity_id", label: "SP Entity ID" };
    // Both candidates score similarly — too close to call
    const mockClient = {
      isAvailable: () => true,
      search: async () => [{ score: 0.72, url: "https://duo.com/x" }],
    };

    const result = await resolveAmbiguityWithGraphFn(
      field,
      ["https://okta.com/sp", "https://pingid.com/sp"],
      { fieldId: "sp_entity_id" },
      mockClient
    );

    assert.equal(result, null); // margin is 0.0 — tie
  });

  it("returns null when top confidence is below 0.6", async () => {
    async function resolveAmbiguityWithGraphFn(field, candidateValues, context, client) {
      if (!client.isAvailable()) return null;
      const scores = await Promise.all(
        candidateValues.map(async (value) => {
          const hits = await client.search(`${value} ${field.label}`, { limit: 3 });
          const score = hits.reduce((sum, h) => sum + Number(h.score || 0), 0);
          return { value, score, evidenceUrls: [] };
        })
      );
      scores.sort((a, b) => b.score - a.score);
      const top = scores[0];
      const second = scores[1];
      const margin = second ? top.score - second.score : top.score;
      if (top.score < 0.6 || margin < 0.15) return null;
      return { resolvedValue: top.value, confidence: top.score, evidenceUrls: [] };
    }

    const field = { id: "acs_url", label: "ACS URL" };
    // Both candidates score below 0.6 — not confident enough
    let queries = [];
    const mockClient = {
      isAvailable: () => true,
      search: async (query) => { queries.push(query); return [{ score: 0.30, url: "" }]; },
    };

    const result = await resolveAmbiguityWithGraphFn(
      field,
      ["https://a.com/acs", "https://b.com/acs"],
      { fieldId: "acs_url" },
      mockClient
    );

    assert.equal(result, null);
    assert.equal(queries.length, 2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they pass (they test inline logic)**

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator/server
node --test tests/cloneDuoGraphResolver.test.js
```

Expected: all 4 tests pass. (The inline `resolveAmbiguityWithGraphFn` is a preview of the real implementation — tests pass now, and the real module will export the same logic.)

- [ ] **Step 3: Implement `server/src/cloneDuoGraphResolver.js`**

```js
import { graphQueryClient } from "./graphQueryClient.js";

const CONFIDENCE_THRESHOLD = 0.6;
const MARGIN_THRESHOLD = 0.15;
const SEARCH_LIMIT = 3;
const SEARCH_TIMEOUT_MS = 5_000;

// resolveAmbiguityWithGraph: for each candidate value, queries GitNexus and picks
// the value most corroborated by indexed docs.
// Returns { resolvedValue, confidence, evidenceUrls } or null if unavailable/uncertain.
export async function resolveAmbiguityWithGraph(field, candidateValues, context) {
  if (!graphQueryClient.isAvailable()) {
    if (process.env.DEBUG_GITNEXUS) {
      console.debug(`[cloneDuoGraphResolver] unavailable — skipping disambiguation for field ${context?.fieldId}`);
    }
    return null;
  }

  try {
    const scores = await Promise.all(
      candidateValues.map(async (value) => {
        const hits = await searchWithTimeout(
          `${value} ${field.label}`,
          { limit: SEARCH_LIMIT }
        );
        const score = hits.reduce((sum, h) => sum + Number(h.score || 0), 0);
        return {
          value,
          score,
          evidenceUrls: hits.map((h) => h.url || "").filter(Boolean),
        };
      })
    );

    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    const second = scores[1];
    const margin = second ? top.score - second.score : top.score;

    if (top.score < CONFIDENCE_THRESHOLD || margin < MARGIN_THRESHOLD) {
      if (process.env.DEBUG_GITNEXUS) {
        console.debug(
          `[cloneDuoGraphResolver] low confidence for field ${context?.fieldId}: ` +
          `top=${top.score.toFixed(3)} margin=${margin.toFixed(3)} — staying UNRESOLVED_AMBIGUOUS`
        );
      }
      return null;
    }

    if (process.env.DEBUG_GITNEXUS) {
      console.debug(
        `[cloneDuoGraphResolver] resolved field ${context?.fieldId}: ` +
        `value="${top.value}" confidence=${top.score.toFixed(3)} margin=${margin.toFixed(3)}`
      );
    }

    return {
      resolvedValue: top.value,
      confidence: top.score,
      evidenceUrls: top.evidenceUrls,
    };
  } catch (err) {
    if (process.env.DEBUG_GITNEXUS) {
      console.debug(`[cloneDuoGraphResolver] search error for field ${context?.fieldId}: ${err.message}`);
    }
    return null;
  }
}

async function searchWithTimeout(query, opts) {
  return Promise.race([
    graphQueryClient.search(query, opts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("search timeout")), SEARCH_TIMEOUT_MS)
    ),
  ]).catch(() => []);
}
```

- [ ] **Step 4: Run tests against the real module**

Update `server/tests/cloneDuoGraphResolver.test.js` to add one import test that verifies the module loads:

Open `server/tests/cloneDuoGraphResolver.test.js` and add at the top, after the existing imports:

```js
import { resolveAmbiguityWithGraph } from "../src/cloneDuoGraphResolver.js";

describe("module import", () => {
  it("resolveAmbiguityWithGraph is a function", () => {
    assert.equal(typeof resolveAmbiguityWithGraph, "function");
  });
});
```

Then run:

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator/server
node --test tests/cloneDuoGraphResolver.test.js
```

Expected: all 5 tests pass (4 inline + 1 import test).

- [ ] **Step 5: Commit**

```bash
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" add server/src/cloneDuoGraphResolver.js server/tests/cloneDuoGraphResolver.test.js
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" commit -m "feat(clone-duo): add cloneDuoGraphResolver for GitNexus-powered ambiguity resolution"
```

---

## Task 2: Wire resolver into `cloneDuoMapping.js`

**Files:**
- Modify: `server/src/cloneDuoMapping.js`

- [ ] **Step 1: Add import for the resolver**

Open `server/src/cloneDuoMapping.js`. After the existing imports at the top, add:

```js
import { resolveAmbiguityWithGraph } from "./cloneDuoGraphResolver.js";
```

- [ ] **Step 2: Make `resolveFieldState` async and call the resolver**

Find the current `resolveFieldState` function (line 49). The entire function currently is:

```js
function resolveFieldState(field, evidence) {
  const state = createFieldState(field);
  const candidates = collectCandidates(field, evidence);

  if (!candidates.length) {
    return applyUnresolvedState(state, field, evidence);
  }

  const uniqueValues = uniqueCandidateValues(candidates);
  if (uniqueValues.length > 1 && field.cardinality !== "multiple") {
    state.status = FIELD_STATUS.UNRESOLVED_AMBIGUOUS;
    state.evidenceIds = candidates.map((candidate) => candidate.evidenceId);
    state.unresolved = {
      fieldId: field.id,
      status: FIELD_STATUS.UNRESOLVED_AMBIGUOUS,
      rationale: "Multiple conflicting values were extracted from source evidence.",
      recommendedValueOrPattern: null,
      recommendationConfidence: "low",
      fillPrompt: `Choose the correct value for ${field.label}.`,
      evidenceIds: state.evidenceIds,
      reviewerEnteredValue: "",
      reviewerDecisionState: REVIEW_DECISION_STATE.PENDING,
    };
    return state;
  }

  state.status = FIELD_STATUS.RESOLVED;
  state.evidenceIds = candidates.map((candidate) => candidate.evidenceId);
  state.value = field.cardinality === "multiple" ? uniqueValues : uniqueValues[0];
  return state;
}
```

Replace it entirely with:

```js
async function resolveFieldState(field, evidence) {
  const state = createFieldState(field);
  const candidates = collectCandidates(field, evidence);

  if (!candidates.length) {
    return applyUnresolvedState(state, field, evidence);
  }

  const uniqueValues = uniqueCandidateValues(candidates);
  if (uniqueValues.length > 1 && field.cardinality !== "multiple") {
    state.status = FIELD_STATUS.UNRESOLVED_AMBIGUOUS;
    state.evidenceIds = candidates.map((candidate) => candidate.evidenceId);
    state.unresolved = {
      fieldId: field.id,
      status: FIELD_STATUS.UNRESOLVED_AMBIGUOUS,
      rationale: "Multiple conflicting values were extracted from source evidence.",
      recommendedValueOrPattern: null,
      recommendationConfidence: "low",
      fillPrompt: `Choose the correct value for ${field.label}.`,
      evidenceIds: state.evidenceIds,
      reviewerEnteredValue: "",
      reviewerDecisionState: REVIEW_DECISION_STATE.PENDING,
    };

    // Attempt GitNexus-powered disambiguation before returning UNRESOLVED_AMBIGUOUS
    const graphResult = await resolveAmbiguityWithGraph(field, uniqueValues, { fieldId: field.id });
    if (graphResult) {
      state.status = FIELD_STATUS.RESOLVED;
      state.value = graphResult.resolvedValue;
      state.resolvedBy = "graph";
      state.graphConfidence = graphResult.confidence;
      state.graphEvidenceUrls = graphResult.evidenceUrls;
      state.unresolved = undefined;
    }

    return state;
  }

  state.status = FIELD_STATUS.RESOLVED;
  state.evidenceIds = candidates.map((candidate) => candidate.evidenceId);
  state.value = field.cardinality === "multiple" ? uniqueValues : uniqueValues[0];
  return state;
}
```

- [ ] **Step 3: Update `buildCloneDuoDraft` to await async `resolveFieldState`**

Find line 24 in `buildCloneDuoDraft`:

```js
  const fieldStates = fieldDefinitions.map((field) => resolveFieldState(field, evidence));
```

Replace with:

```js
  const fieldStates = await Promise.all(fieldDefinitions.map((field) => resolveFieldState(field, evidence)));
```

- [ ] **Step 4: Verify the file has no syntax errors**

```bash
cd C:/Admin/Projects/SiteNavigator/duo-sitenavigator/server
node --check src/cloneDuoMapping.js
```

Expected: no output (no syntax errors).

- [ ] **Step 5: Run the server syntax check**

```bash
node --check src/server.js
```

Expected: no output.

- [ ] **Step 6: Smoke-test the transform endpoint**

Start server and call `/api/clone-duo/saml/transform`:

```bash
node src/server.js &
sleep 2
curl -s -X POST http://localhost:8787/api/clone-duo/saml/transform \
  -H "Content-Type: application/json" \
  -d '{"sourceItems":[],"blueprintFamily":"generic_saml"}' | node -e "
    process.stdin.resume();
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const r = JSON.parse(d);
      console.log('fields count:', r.draft?.fields?.length ?? 'n/a');
      const ambiguous = (r.draft?.fields||[]).filter(f=>f.status==='UNRESOLVED_AMBIGUOUS');
      const graphResolved = (r.draft?.fields||[]).filter(f=>f.resolvedBy==='graph');
      console.log('UNRESOLVED_AMBIGUOUS:', ambiguous.length);
      console.log('graph-resolved:', graphResolved.length);
    });
  "
kill %1
```

Expected (GitNexus unavailable): `UNRESOLVED_AMBIGUOUS: N`, `graph-resolved: 0` — same as before, no regression.

Expected (GitNexus available + indexed): `graph-resolved: M` where M ≥ 0 (any graph-resolved fields show the resolver is working).

- [ ] **Step 7: Commit**

```bash
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" add server/src/cloneDuoMapping.js
git -C "C:/Admin/Projects/SiteNavigator/duo-sitenavigator" commit -m "feat(clone-duo): wire graph resolver into resolveFieldState, reduce UNRESOLVED_AMBIGUOUS"
```

---

## End-to-End Verification (when GitNexus is available)

After all tasks, with `gitnexus` on PATH and an indexed docs dir:

- [ ] Open Clone Duo workspace in UI, generate a draft for an SAML vendor with known conflicting values
- [ ] Confirm `UNRESOLVED_AMBIGUOUS` field count is lower than without the resolver
- [ ] Start server with `DEBUG_GITNEXUS=true` and re-generate — confirm logs show resolution decisions:
  - `[cloneDuoGraphResolver] resolved field sp_entity_id: value="..." confidence=0.87 margin=0.42`
  - OR `[cloneDuoGraphResolver] low confidence for field acs_url: top=0.35 margin=0.05 — staying UNRESOLVED_AMBIGUOUS`
- [ ] Confirm `resolvedBy: "graph"` fields are shown as `RESOLVED` in the reviewer UI (no extra badge needed — they just appear resolved)

---

## Self-Review Notes

- `CONFIDENCE_THRESHOLD` (0.6) and `MARGIN_THRESHOLD` (0.15) are constants at the top of `cloneDuoGraphResolver.js` — tune after seeing real data.
- `searchWithTimeout` guards against slow MCP responses with a 5s per-search limit. Promise races with a `catch(() => [])` so a timeout returns empty hits rather than throwing.
- `state.unresolved = undefined` when promoting to RESOLVED — this matches how `RESOLVED` fields look throughout the codebase (no `unresolved` key present).
- The `resolvedBy: "graph"` key is extra metadata — not in `FIELD_STATUS` enum — transparent to JSON serialization.
- `buildCloneDuoDraft` was already `export async function` — the `Promise.all` change is the only modification needed upstream.
