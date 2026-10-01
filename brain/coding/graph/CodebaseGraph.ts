// §2 Codebase graph: Repository → Applications → Modules → Components → Functions
// plus Dependencies / Data flow / Control flow attach points.

import type { GraphNode, ParsedFile } from "../types";

export class CodebaseGraph {
  private nodes = new Map<string, GraphNode>();
  private fileToNode = new Map<string, string>();

  build(files: ParsedFile[], repoName = "repo"): GraphNode[] {
    this.nodes.clear();
    this.fileToNode.clear();
    this.ensure({ id: `repo:${repoName}`, level: "repo", label: repoName, files: [], children: [], dependsOn: [] });

    // Group by top-level folder as "application", second level as "module"
    for (const f of files) {
      const parts = f.path.split("/");
      const app = parts.length > 1 ? parts[0] : "app";
      const mod = parts.length > 2 ? parts.slice(0, 2).join("/") : app;
      const appId = `app:${app}`;
      const modId = `mod:${mod}`;
      this.ensure({ id: appId, level: "app", label: app, files: [], children: [], dependsOn: [] });
      this.ensure({ id: modId, level: "module", label: mod, files: [], children: [], dependsOn: [] });
      this.link(`repo:${repoName}`, appId);
      this.link(appId, modId);

      // Each file with symbols → component node; bare files attach to module
      const compId = `comp:${f.path}`;
      const symbolIds: string[] = [];
      for (const s of f.symbols) {
        const fnId = `fn:${f.path}::${s.name}`;
        symbolIds.push(fnId);
        this.ensure({ id: fnId, level: "function", label: `${s.kind} ${s.name}`, files: [f.path], children: [], dependsOn: [] });
      }
      if (symbolIds.length) {
        this.ensure({ id: compId, level: "component", label: f.path, files: [f.path], children: symbolIds, dependsOn: [...new Set(f.imports.map((i) => i.to))] });
        for (const s of symbolIds) this.ensureNode(s).dependsOn = [];
        this.link(modId, compId);
        this.fileToNode.set(f.path, compId);
      } else {
        const mod = this.ensureNode(modId);
        if (!mod.files.includes(f.path)) mod.files.push(f.path);
        this.fileToNode.set(f.path, modId);
      }
      // module-level dependency rollup from imports
      const modNode = this.ensureNode(modId);
      for (const imp of f.imports) {
        const dep = this.resolveImportToNode(imp.to, files);
        const depKey = dep ? `comp:${dep}` : `ext:${imp.to}`;
        if (!modNode.dependsOn.includes(depKey)) modNode.dependsOn.push(depKey);
      }
    }
    return [...this.nodes.values()];
  }

  // Example chain: App.tsx → ChatPage → ChatService → AIService → ModelGateway → Provider
  traceChain(startFileOrSymbol: string): string[] {
    const chain: string[] = [startFileOrSymbol];
    const seen = new Set(chain);
    let current = this.fileToNode.get(startFileOrSymbol) ?? (this.nodes.has(startFileOrSymbol) ? startFileOrSymbol : null);
    let guard = 0;
    while (current && guard++ < 12) {
      const node = this.nodes.get(current);
      if (!node) break;
      const next = node.dependsOn.find((d) => (d.startsWith("comp:") || d.startsWith("mod:")) && !seen.has(d));
      if (!next) break;
      chain.push(next.replace(/^comp:|^mod:/, ""));
      seen.add(next);
      current = next;
    }
    return chain;
  }

  childrenOf(id: string): GraphNode[] {
    const n = this.nodes.get(id);
    if (!n) return [];
    return n.children.map((c) => this.nodes.get(c)).filter((x): x is GraphNode => !!x);
  }

  all(): GraphNode[] { return [...this.nodes.values()]; }
  get(id: string): GraphNode | undefined { return this.nodes.get(id); }

  private ensure(n: GraphNode): void {
    if (!this.nodes.has(n.id)) this.nodes.set(n.id, n);
  }
  private ensureNode(id: string): GraphNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Missing graph node ${id}`);
    return n;
  }
  private link(parent: string, child: string): void {
    const p = this.nodes.get(parent);
    if (p && !p.children.includes(child)) p.children.push(child);
  }
  private resolveImportToNode(spec: string, files: ParsedFile[]): string | null {
    const norm = spec.replace(/^\.\/|^\.\.\//, "").replace(/\.(ts|tsx|js|jsx)$/, "");
    const hit = files.find((f) =>
      f.path.replace(/\.(ts|tsx|js|jsx)$/, "").endsWith(norm) ||
      norm.endsWith(f.path.replace(/\.(ts|tsx|js|jsx)$/, "").split("/").pop() ?? "\u0000"));
    return hit ? hit.path : null;
  }
}
