import type { ToolCallResult, ToolDefinition } from "../core/types";

export interface ToolHandler {
  definition: ToolDefinition;
  execute(input: unknown): Promise<unknown>;
}

type AnyRecord = Record<string, unknown>;

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void { this.tools.set(handler.definition.name, handler); }
  get(name: string): ToolHandler | undefined { return this.tools.get(name); }
  list(): ToolDefinition[] { return [...this.tools.values()].map((t) => t.definition); }
  names(): string[] { return [...this.tools.keys()]; }

  async call(name: string, input: unknown): Promise<ToolCallResult> {
    const start = Date.now();
    const tool = this.tools.get(name);
    if (!tool) return { toolName: name, success: false, output: null, latencyMs: 0, error: `Unknown tool: ${name}` };
    try {
      const output = await tool.execute(input);
      return { toolName: name, success: true, output, latencyMs: Date.now() - start };
    } catch (e) {
      return { toolName: name, success: false, output: null, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ---- Built-in safe tools (no network secrets, sandboxed) ----

export function builtinTools(): ToolHandler[] {
  return [
    {
      definition: {
        name: "web_search",
        description: "Search the web (stub: returns query plan; plug a real provider via WEB_SEARCH_API_KEY).",
        capabilities: ["research", "latest-info"],
        inputSchema: { query: "string" },
        outputSchema: { results: "array" },
        riskLevel: "low",
      },
      async execute(input: unknown) {
        const q = (input as AnyRecord)?.query ?? String(input ?? "");
        const apiKey = (typeof process !== "undefined" ? process.env?.WEB_SEARCH_API_KEY : undefined) as string | undefined;
        if (!apiKey) {
          return { results: [], note: `No WEB_SEARCH_API_KEY configured. Search plan for: ${String(q).slice(0, 200)}` };
        }
        return { results: [], note: "Provider integration point — implement fetch here." };
      },
    },
    {
      definition: {
        name: "filesystem",
        description: "Describe a file operation plan. Real FS access must be granted explicitly by the host.",
        capabilities: ["read", "list"],
        inputSchema: { path: "string", operation: "string" },
        outputSchema: { plan: "string" },
        riskLevel: "medium",
      },
      async execute(input: unknown) {
        const r = (input ?? {}) as AnyRecord;
        return { plan: `Filesystem ${String(r.operation ?? "read")} on ${String(r.path ?? ".")} — host must approve medium-risk tools.` };
      },
    },
    {
      definition: {
        name: "code_execution",
        description: "Safe arithmetic/code evaluation sandbox (math expressions only).",
        capabilities: ["compute"],
        inputSchema: { expression: "string" },
        outputSchema: { value: "number|string" },
        riskLevel: "medium",
      },
      async execute(input: unknown) {
        const expr = String((input as AnyRecord)?.expression ?? input ?? "").slice(0, 200);
        if (!/^[0-9+\-*/().\s%^]+$/.test(expr)) throw new Error("Only numeric expressions allowed in sandbox.");
        // eslint-disable-next-line no-new-func
        const value = Function(`"use strict"; return (${expr})`)() as unknown;
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Expression did not evaluate to a finite number.");
        return { value };
      },
    },
    {
      definition: {
        name: "document_processing",
        description: "Extract/summarize pasted document text.",
        capabilities: ["summarize", "extract"],
        inputSchema: { text: "string" },
        outputSchema: { summary: "string" },
        riskLevel: "low",
      },
      async execute(input: unknown) {
        const text = String((input as AnyRecord)?.text ?? input ?? "");
        const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 5);
        return { summary: sentences.join(" ").slice(0, 1500), chars: text.length };
      },
    },
  ];
}
