// §6 + §7 Data-flow and control-flow understanding.
// Heuristic static extractors: input → validation → controller → service → db → response → UI,
// and if/else, loops, async/await, try/catch, retries, events.

import type { ControlFlow, DataFlow, ParsedFile, SymbolNode } from "../types";

const LAYER_HINTS: Array<{ re: RegExp; stage: string }> = [
  { re: /valid/i, stage: "Validation" },
  { re: /controller|route|handler|endpoint/i, stage: "Controller" },
  { re: /service|usecase|manager/i, stage: "Service" },
  { re: /repo|prisma|db|query|sql|store/i, stage: "Database" },
  { re: /response|res\.|return res|send\(/i, stage: "Response" },
  { re: /component|page|\.tsx$|render|useState/i, stage: "UI" },
];

export class FlowAnalyzer {
  /** §6: track important data through the app. */
  extractDataFlows(files: ParsedFile[], symbols: Map<string, SymbolNode>): DataFlow[] {
    const flows: DataFlow[] = [];
    // Flow per entrypoint-ish symbol (exported function / route / component)
    for (const [id, node] of symbols) {
      if (!node.symbol.exported && node.calledBy.length === 0 && node.symbol.kind !== "component") continue;
      const steps: DataFlow["steps"] = [{ stage: "Origin", file: node.symbol.file, symbol: node.symbol.name }];
      const visited = new Set<string>([id]);
      let current: SymbolNode | undefined = node;
      let guard = 0;
      while (current && guard++ < 8) {
        const nextId = current.calls.find((c) => !visited.has(c));
        if (!nextId) break;
        const next = symbols.get(nextId);
        if (!next) break;
        visited.add(nextId);
        steps.push({
          stage: this.stageOf(next.symbol.file, next.symbol.name),
          file: next.symbol.file,
          symbol: next.symbol.name,
          transform: this.transformHint(files, next),
        });
        current = next;
      }
      if (steps.length >= 3) {
        flows.push({ name: `${node.symbol.name} flow`, steps });
      }
      if (flows.length >= 25) break;
    }
    return flows;
  }

  /** §7: control-flow representation per symbol. */
  extractControlFlow(file: ParsedFile, symbolName: string): ControlFlow | null {
    const sym = file.symbols.find((s) => s.name === symbolName);
    if (!sym) return null;
    const lines = file.content.split("\n").slice(sym.line - 1, (sym.endLine ?? sym.line + 80) - 1);
    const id = `${file.path}::${symbolName}`;
    const nodes: ControlFlow["nodes"] = [{ id: `${id}#entry`, kind: "entry", label: `enter ${symbolName}`, line: sym.line, successors: [] }];
    let prev = `${id}#entry`;
    let counter = 0;
    const succ: string[] = [];
    const err: string[] = [];
    lines.forEach((raw, i) => {
      const line = raw.trim();
      const lineNo = sym.line + i;
      const push = (kind: ControlFlow["nodes"][number]["kind"], label: string) => {
        const nid = `${id}#n${counter++}`;
        nodes.push({ id: nid, kind, label: label.slice(0, 120), line: lineNo, successors: [] });
        nodes.find((n) => n.id === prev)?.successors.push(nid);
        prev = nid;
        return nid;
      };
      if (/^if\s*\(|^}\s*else/.test(line)) push("if", line);
      else if (/^(for|while)\s*\(|for\s+\w+\s+in|while\s+True/.test(line)) push("loop", line);
      else if (/await\s+/.test(line)) { const n = push("await", line); succ.push(n); }
      else if (/\.then\(|callback|=>\s*\{/.test(line)) push("callback", line);
      else if (/throw\s+|raise\s+/.test(line)) { const n = push("throw", line); err.push(n); }
      else if (/try\s*\{?|try:/.test(line)) push("try", line);
      else if (/retry|setTimeout|setInterval|backoff/i.test(line)) push("retry", line);
      else if (/addEventListener|on\(|emit\(|dispatch\(|subscribe/i.test(line)) push("event", line);
      else if (/catch|except/.test(line)) { const n = push("branch", `error-handler: ${line}`); err.push(n); }
    });
    nodes.push({ id: `${id}#exit`, kind: "exit", label: `exit ${symbolName}`, successors: [] });
    nodes.find((n) => n.id === prev)?.successors.push(`${id}#exit`);
    return {
      symbolId: id,
      nodes,
      asyncPaths: {
        success: succ.length ? [`${id}#entry`, ...succ, `${id}#exit`] : [`${id}#entry`, `${id}#exit`],
        error: err.length ? [`${id}#entry`, ...err, "retry → fallback"] : [`${id}#entry`, "error → fallback"],
      },
    };
  }

  private stageOf(file: string, name: string): string {
    const hay = `${file} ${name}`;
    for (const h of LAYER_HINTS) if (h.re.test(hay)) return h.stage;
    return "Transform";
  }

  private transformHint(files: ParsedFile[], node: SymbolNode): string | undefined {
    const f = files.find((x) => x.path === node.symbol.file);
    if (!f) return undefined;
    const slice = f.content.split("\n").slice(node.symbol.line - 1, node.symbol.line + 12).join(" ").slice(0, 160);
    return slice || undefined;
  }
}
