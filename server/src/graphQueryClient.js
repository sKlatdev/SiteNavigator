import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const gitnexusBin = String(process.env.SITENAVIGATOR_GITNEXUS_BIN || "gitnexus").trim();

const GRAPH_SEARCH_TIMEOUT_MS =
  Number(process.env.SITENAVIGATOR_GRAPH_SEARCH_TIMEOUT_MS) || 5_000;

export async function searchWithTimeout(query, opts, client) {
  return Promise.race([
    client.search(query, opts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("graph search timeout")), GRAPH_SEARCH_TIMEOUT_MS)
    ),
  ]).catch(() => []);
}

class GraphQueryClient {
  #client = null;
  #available = false;

  isAvailable() {
    return this.#available;
  }

  async start() {
    try {
      const transport = new StdioClientTransport({
        command: gitnexusBin,
        args: ["mcp"],
      });
      this.#client = new Client({ name: "sitenavigator", version: "1.0.0" }, { capabilities: {} });
      await this.#client.connect(transport);
      this.#available = true;
    } catch (err) {
      this.#available = false;
      console.warn(`[graphQueryClient] GitNexus MCP unavailable: ${err.message}`);
    }
  }

  async stop() {
    if (this.#client) {
      await this.#client.close().catch(() => {});
      this.#client = null;
      this.#available = false;
    }
  }

  async search(query, { vendors = [], limit = 6 } = {}) {
    if (!this.#available || !this.#client) return [];
    try {
      const args = { query, limit };
      if (vendors.length) args.vendors = vendors;
      const result = await this.#client.callTool({ name: "query", arguments: args });
      const text = result?.content?.[0]?.text || "[]";
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async cypher(query) {
    if (!this.#available || !this.#client) return [];
    try {
      const result = await this.#client.callTool({ name: "cypher", arguments: { query } });
      const text = result?.content?.[0]?.text || "[]";
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const graphQueryClient = new GraphQueryClient();
