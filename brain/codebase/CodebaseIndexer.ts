// Lightweight codebase index: File → Symbol → Dependency → Feature → Architecture.
// Host feeds file contents in; the Brain queries it for impact analysis before edits.
export interface CodeFile { path: string; language: string; content: string; }
export interface CodeSymbol { name: string; kind: "function" | "class" | "interface" | "const" | "other"; file: string; line: number; }
export interface CodeIndex {
  files: CodeFile[];
  symbols: CodeSymbol[];
  imports: Array<{ from: string; to: string }>;
  summary: string;
}

const SYMBOL_RES = [
  { re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/, kind: "function" as const },
  { re: /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_]+)/, kind: "class" as const },
  { re: /^\s*(?:export\s+)?interface\s+([A-Za-z0-9_]+)/, kind: "interface" as const },
  { re: /^\s*(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=/, kind: "const" as const },
];

export class CodebaseIndexer {
  private files = new Map<string, CodeFile>();

  indexFile(f: CodeFile): void { this.files.set(f.path, { ...f, content: f.content.slice(0, 20000) }); }
  indexFiles(list: CodeFile[]): void { list.forEach((f) => this.indexFile(f)); }
  removeFile(path: string): void { this.files.delete(path); }
  fileCount(): number { return this.files.size; }

  buildIndex(): CodeIndex {
    const files = [...this.files.values()];
    const symbols: CodeSymbol[] = [];
    const imports: Array<{ from: string; to: string }> = [];
    for (const f of files) {
      const lines = f.content.split("\n");
      lines.forEach((line, i) => {
        for (const { re, kind } of SYMBOL_RES) {
          const m = line.match(re);
          if (m) { symbols.push({ name: m[1], kind, file: f.path, line: i + 1 }); break; }
        }
        const im = line.match(/from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/);
        const target = im?.[1] ?? im?.[2] ?? im?.[3];
        if (target) imports.push({ from: f.path, to: target });
      });
    }
    const summary = `Indexed ${files.length} files, ${symbols.length} symbols, ${imports.length} imports. Top symbols: ${symbols.slice(0, 8).map((s) => `${s.kind} ${s.name} (${s.file})`).join("; ").slice(0, 500) || "none"}`;
    return { files, symbols, imports, summary };
  }

  findRelevant(query: string, topK = 5): CodeFile[] {
    const q = query.toLowerCase();
    const scored = [...this.files.values()].map((f) => {
      const hay = `${f.path} ${f.content.slice(0, 3000)}`.toLowerCase();
      const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score++;
      if (f.path.toLowerCase().includes(q.slice(0, 30))) score += 2;
      return { f, score };
    });
    return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, topK).map((x) => x.f);
  }

  impactOf(filePath: string): string[] {
    const idx = this.buildIndex();
    return idx.imports.filter((i) => i.to.includes(filePath) || filePath.includes(i.to)).map((i) => i.from);
  }
}
