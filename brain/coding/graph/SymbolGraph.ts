// §5 Symbol graph: definition, references, callers, callees, imports/exports,
// side effects, data dependencies. Powers impact analysis.

import type { ParsedFile, SymbolNode } from "../types";

const CALL_RE = /([A-Za-z0-9_]+)\s*\(/g;
const EMIT_RE = /\bemits?\b|\bevent\b|EventBus|emit\(|dispatch\(/i;
const WRITE_RE = /\b(insert|update|delete|save|write|setItem|localStorage|prisma\.\w+\.(create|update|delete|upsert))\b/i;
const READ_RE = /\b(get|fetch|query|find|select|read|load)\b/i;

export class SymbolGraph {
  private nodes = new Map<string, SymbolNode>();
  private fileIndex = new Map<string, ParsedFile>();

  build(files: ParsedFile[]): Map<string, SymbolNode> {
    this.nodes.clear();
    this.fileIndex.clear();
    for (const f of files) this.fileIndex.set(f.path, f);

    // 1. definitions
    for (const f of files) {
      for (const s of f.symbols) {
        const id = `${f.path}::${s.name}`;
        this.nodes.set(id, {
          id, symbol: s, calls: [], calledBy: [], reads: [], writes: [], emits: [], dataDeps: [],
        });
      }
    }
    // 2. references: scan file bodies for calls to known symbols
    const names = new Map<string, string[]>();
    for (const id of this.nodes.keys()) {
      const short = id.split("::").pop() ?? id;
      if (!names.has(short)) names.set(short, []);
      names.get(short)?.push(id);
    }
    for (const f of files) {
      const body = f.content;
      const definedInFile = new Set(f.symbols.map((s) => s.name));
      for (const match of body.matchAll(CALL_RE)) {
        const callee = match[1];
        if (["if", "for", "while", "switch", "catch", "return", "function"].includes(callee)) continue;
        const targets = names.get(callee);
        if (!targets?.length) continue;
        // caller = nearest symbol above the match index (approx: file-level if unknown)
        const callerId = this.nearestSymbol(f, body, match.index ?? 0);
        for (const target of targets) {
          if (target === callerId) continue;
          if (callerId) {
            const caller = this.nodes.get(callerId);
            if (caller && !caller.calls.includes(target)) caller.calls.push(target);
            const calleeNode = this.nodes.get(target);
            if (calleeNode && caller && !calleeNode.calledBy.includes(callerId)) calleeNode.calledBy.push(callerId);
          }
        }
      }
      // 3. imports/exports as data deps
      for (const imp of f.imports) {
        for (const s of f.symbols) {
          const id = `${f.path}::${s.name}`;
          const n = this.nodes.get(id);
          if (n && !n.dataDeps.includes(imp.to)) n.dataDeps.push(imp.to);
        }
      }
      void definedInFile;
      // 4. side-effect heuristics per symbol body slice
      for (const s of f.symbols) {
        const slice = this.symbolSlice(f, s.line);
        const n = this.nodes.get(`${f.path}::${s.name}`);
        if (!n) continue;
        if (EMIT_RE.test(slice)) n.emits.push("event (heuristic)");
        if (WRITE_RE.test(slice)) n.writes.push("external-state (heuristic)");
        if (READ_RE.test(slice)) n.reads.push("external-state (heuristic)");
        const depHits = [...slice.matchAll(/from\s+["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);
        for (const d of depHits) if (!n.dataDeps.includes(d)) n.dataDeps.push(d);
      }
    }
    return this.nodes;
  }

  get(id: string): SymbolNode | undefined { return this.nodes.get(id); }
  all(): SymbolNode[] { return [...this.nodes.values()]; }
  callers(id: string): SymbolNode[] {
    const n = this.nodes.get(id);
    if (!n) return [];
    return n.calledBy.map((c) => this.nodes.get(c)).filter((x): x is SymbolNode => !!x);
  }
  callees(id: string): SymbolNode[] {
    const n = this.nodes.get(id);
    if (!n) return [];
    return n.calls.map((c) => this.nodes.get(c) ?? this.nodes.get(this.resolveShort(c))).filter((x): x is SymbolNode => !!x);
  }

  /** Transitive dependents (callers-of-callers) up to depth — for impact analysis. */
  transitiveDependents(id: string, depth = 3): string[] {
    const out = new Set<string>();
    let frontier = [id];
    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const cur of frontier) {
        const n = this.nodes.get(cur);
        if (!n) continue;
        for (const caller of n.calledBy) {
          if (!out.has(caller)) { out.add(caller); next.push(caller); }
        }
      }
      frontier = next;
    }
    return [...out];
  }

  private resolveShort(name: string): string {
    for (const id of this.nodes.keys()) if (id.endsWith(`::${name}`)) return id;
    return name;
  }

  private nearestSymbol(f: ParsedFile, body: string, index: number): string | null {
    const uptoLine = body.slice(0, index).split("\n").length;
    let best: string | null = null;
    let bestLine = -1;
    for (const s of f.symbols) {
      if (s.line <= uptoLine && s.line > bestLine) { bestLine = s.line; best = `${f.path}::${s.name}`; }
    }
    return best;
  }

  private symbolSlice(f: ParsedFile, line: number): string {
    const lines = f.content.split("\n");
    return lines.slice(Math.max(0, line - 1), line + 60).join("\n");
  }
}
