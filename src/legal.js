import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const caseDirectory = path.join(directory, "../data/legal/cases");
const proposalDirectory = path.join(directory, "../data/legal/proposals");

const updateSchema = {
  name: "legal_case_update",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["caseSlug", "checkedAt", "summary", "changes", "noMaterialChange", "sources", "confidence", "warnings"],
    properties: {
      caseSlug: { type: "string" },
      checkedAt: { type: "string" },
      summary: { type: "string" },
      noMaterialChange: { type: "boolean" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      warnings: { type: "array", items: { type: "string" } },
      changes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "oldValue", "newValue", "reason", "sourceUrls"],
          properties: {
            field: { type: "string" },
            oldValue: {},
            newValue: {},
            reason: { type: "string" },
            sourceUrls: { type: "array", items: { type: "string" } }
          }
        }
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "url", "sourceType", "publishedAt", "supports"],
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            sourceType: { type: "string", enum: ["primary", "secondary"] },
            publishedAt: { type: ["string", "null"] },
            supports: { type: "string" }
          }
        }
      }
    }
  }
};

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export function createLegalService({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  return {
    async listCases() {
      const names = (await fs.readdir(caseDirectory)).filter((name) => name.endsWith(".json"));
      const cases = await Promise.all(names.map((name) => readJson(path.join(caseDirectory, name))));
      return cases.map(({ timeline, positions, ...item }) => ({ ...item, timelineCount: timeline.length }));
    },

    async getCase(slug) {
      if (!/^[a-z0-9-]+$/.test(slug)) return null;
      try {
        const record = await readJson(path.join(caseDirectory, `${slug}.json`));
        let latestProposal = null;
        try { latestProposal = await readJson(path.join(proposalDirectory, `${slug}.json`)); } catch {}
        return { ...record, latestProposal };
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },

    async refreshCase(slug) {
      if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
      const record = await this.getCase(slug);
      if (!record) return null;
      const sourceDomains = [...new Set(record.sources.map((source) => new URL(source.url).hostname))];
      const prompt = [
        "You are updating a legal case tracker. Research only verifiable developments after the record's lastVerifiedAt date.",
        "Prefer court dockets, filed orders, agency publications, statutes, and official press releases. Secondary reporting may identify leads but cannot alone establish a procedural fact.",
        "Do not provide legal advice. Do not predict outcomes as facts. Distinguish final holdings from preliminary rulings and allegations from adjudicated facts.",
        "Return only changes supported by cited URLs. If no material change is verified, set noMaterialChange to true.",
        `Current UTC time: ${new Date().toISOString()}`,
        `Canonical record: ${JSON.stringify(record)}`
      ].join("\n\n");
      const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.PUBLIC_APP_URL ?? "https://github.com/AtlasHarbor/AtlasHarbor",
          "X-OpenRouter-Title": "Atlas Harbor Legal Tracker"
        },
        body: JSON.stringify({
          model: env.OPENROUTER_LEGAL_MODEL ?? "openai/gpt-5.2",
          messages: [{ role: "user", content: prompt }],
          tools: [{ type: "openrouter:web_search", parameters: { engine: "auto", max_results: 8, max_total_results: 16, allowed_domains: sourceDomains } }],
          response_format: { type: "json_schema", json_schema: updateSchema },
          provider: { require_parameters: true }
        }),
        signal: AbortSignal.timeout(90_000)
      });
      if (!response.ok) throw new Error(`OpenRouter responded with ${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenRouter returned no update content");
      const proposal = JSON.parse(content);
      proposal.model = data.model ?? env.OPENROUTER_LEGAL_MODEL;
      proposal.annotations = data.choices?.[0]?.message?.annotations ?? [];
      await fs.mkdir(proposalDirectory, { recursive: true });
      await fs.writeFile(path.join(proposalDirectory, `${slug}.json`), JSON.stringify(proposal, null, 2));
      return proposal;
    }
  };
}
