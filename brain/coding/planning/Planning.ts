// §11 Human-like planner + §12 Impact analyzer.

import type { ImplementationPlan, ImpactReport, ParsedFile, SymbolNode } from "../types";
import { SymbolGraph } from "../graph/SymbolGraph";

const AUTH_AREAS = [
  "authentication architecture", "user model", "session handling",
  "frontend login", "backend auth", "database", "middleware", "tests",
];

export class HumanPlanner {
  /** Understand → inspect → affected → deps → risks → plan → smallest safe change. */
  plan(
    request: string,
    relevant: ParsedFile[],
    symbols: Map<string, SymbolNode>,
    impact: ImpactReport | null,
  ): ImplementationPlan {
    const lower = request.toLowerCase();
    const isAuth = /login|auth|oauth|google|sso|session|jwt/i.test(request);
    const areas = isAuth ? AUTH_AREAS : this.deriveAreas(relevant);
    const investigation = areas.map((area) => ({
      area,
      findings: relevant
        .filter((f) => this.areaMatch(area, f.path, f.content))
        .slice(0, 3)
        .map((f) => `${f.path}: ${f.symbols.slice(0, 4).map((s) => s.name).join(", ") || "no symbols"}`),
    })).map((x) => ({ ...x, findings: x.findings.length ? x.findings : ["no direct match — needs broader search"] }));

    const affectedComponents = (impact ? [...impact.directlyAffected, ...impact.potentiallyAffected] : relevant.map((f) => f.path)).slice(0, 12);
    const dependencies = [...new Set(relevant.flatMap((f) => f.imports.map((i) => i.to)))].slice(0, 12);
    const risks = this.risks(request, relevant);
    void symbols;
    const steps = this.stepsFor(request, relevant, affectedComponents);
    return {
      request,
      investigation,
      affectedComponents,
      dependencies,
      risks,
      steps,
      verification: [
        "typecheck passes", "targeted tests pass", "no unrelated files changed",
        void lower, "manual repro of the reported behavior",
      ].filter((s) => typeof s === "string") as string[],
    };
  }

  private deriveAreas(relevant: ParsedFile[]): string[] {
    const dirs = [...new Set(relevant.map((f) => f.path.split("/").slice(0, 2).join("/")))];
    return (dirs.length ? dirs : ["relevant modules"]).slice(0, 8);
  }

  private areaMatch(area: string, path: string, content: string): boolean {
    const key = area.split(" ")[0].toLowerCase();
    return path.toLowerCase().includes(key) || content.toLowerCase().includes(key);
  }

  private risks(request: string, relevant: ParsedFile[]): string[] {
    void request;
    const hay = relevant.map((f) => f.content).join("\n");
    const out = ["regression in callers of touched symbols"];
    if (/auth|session|token|password/i.test(hay)) out.push("auth/session breakage — verify login, logout, expiry paths");
    if (/prisma|migration|sql/i.test(hay)) out.push("schema change may require migration + seed updates");
    if (/await/i.test(hay)) out.push("async ordering / race conditions");
    return out;
  }

  private stepsFor(request: string, relevant: ParsedFile[], affected: string[]): ImplementationPlan["steps"] {
    const primary = relevant[0]?.path ?? affected[0] ?? "src/";
    void request;
    return [
      { title: "Reproduce / confirm current behavior", detail: "Run existing tests + manual repro before editing.", files: [], smallestSafeChange: true },
      { title: "Implement smallest safe change", detail: "Touch the narrowest surface that satisfies the request.", files: [primary], smallestSafeChange: true },
      { title: "Wire dependents + update contracts", detail: "Update callers, API contracts, and types only as needed.", files: affected.slice(0, 4), smallestSafeChange: false },
      { title: "Add/adjust tests", detail: "Cover normal, edge, and failure paths for the changed behavior.", files: [], smallestSafeChange: false },
    ];
  }
}

export class ImpactAnalyzer {
  constructor(private graph = new SymbolGraph()) {}

  analyze(
    targetFile: string,
    targetSymbol: string | null,
    files: ParsedFile[],
    symbols: Map<string, SymbolNode>,
  ): ImpactReport {
    // rebuild caller info if graph instance is fresh
    void this.graph;
    const direct = new Set<string>();
    const potential = new Set<string>();
    const reasoning: string[] = [];

    if (targetSymbol) {
      const id = `${targetFile}::${targetSymbol}`;
      const node = symbols.get(id);
      if (node) {
        for (const caller of node.calledBy) {
          const f = caller.split("::")[0];
          direct.add(f);
        }
        reasoning.push(`${node.calledBy.length} direct caller(s) of ${targetSymbol}`);
        // transitive
        const seen = new Set([id]);
        let frontier = [...node.calledBy];
        for (let d = 0; d < 2 && frontier.length; d++) {
          const next: string[] = [];
          for (const c of frontier) {
            if (seen.has(c)) continue;
            seen.add(c);
            const cn = symbols.get(c);
            if (!cn) continue;
            potential.add(cn.symbol.file);
            next.push(...cn.calledBy);
          }
          frontier = next;
        }
      } else {
        reasoning.push(`symbol ${targetSymbol} not found — falling back to file-level analysis`);
      }
    }
    // file-level: who imports the target
    for (const f of files) {
      for (const imp of f.imports) {
        if (imp.to.includes(targetFile) || targetFile.includes(imp.to) || imp.to.includes(targetFile.split("/").pop() ?? "\u0000")) {
          direct.add(f.path);
        }
      }
    }
    direct.delete(targetFile);
    for (const d of direct) potential.delete(d);
    const tests = files.map((f) => f.path).filter((p) =>
      /\.test\.|\.spec\.|__tests__/.test(p) &&
      [...direct, targetFile].some((t) => p.toLowerCase().includes(t.split("/").pop()?.split(".")[0] ?? "\u0000")));
    const total = direct.size + potential.size;
    const risk: ImpactReport["risk"] = total === 0 ? "low" : total <= 4 ? "medium" : "high";
    reasoning.push(`${direct.size} file(s) directly import/call the target; ${potential.size} transitively reachable`);
    return {
      target: targetSymbol ? `${targetFile}::${targetSymbol}` : targetFile,
      directlyAffected: [targetFile, ...direct].slice(0, 12),
      potentiallyAffected: [...potential].slice(0, 12),
      testsRequiringUpdates: tests.slice(0, 8),
      risk,
      reasoning,
      note: "Engineering diagnostic based on static references — not an absolute prediction. Verify with tests.",
    };
  }
}
