// §1 CodePerceptionEngine — pluggable parser architecture.
// Lightweight regex-based structural parsers (not full compilers) that build
// an AST-ish representation: symbols, imports, exports, doc comments.
// Design: LanguageParser interface + registry; 8 languages supported.

import type {
  ParsedFile, ParsedImport, ParsedSymbol, SupportedLanguage,
} from "../types";

export interface LanguageParser {
  language: SupportedLanguage;
  parse(path: string, content: string): ParsedFile;
}

function base(path: string, language: SupportedLanguage, content: string): ParsedFile {
  return { path, language, content: content.slice(0, 100_000), symbols: [], imports: [], exports: [], loc: content.split("\n").length };
}

function docCommentAbove(lines: string[], idx: number): string | undefined {
  const buf: string[] = [];
  for (let i = idx - 1; i >= Math.max(0, idx - 6); i--) {
    const t = lines[i].trim();
    if (t.startsWith("//") || t.startsWith("#") || t.startsWith("*") || t.startsWith("/*") || t.startsWith('"""')) {
      buf.unshift(t.replace(/^\/\/\s?|^#\s?|^\*\s?|^\/\*\*?\s?|\s?\*\/$/, "").slice(0, 200));
    } else if (t === "" || t.startsWith("@") || t.startsWith("export") || t.startsWith("import")) {
      continue;
    } else break;
  }
  return buf.length ? buf.join(" ").slice(0, 300) : undefined;
}

// ---- TypeScript / JavaScript (shared core) ----
function parseTsLike(path: string, content: string, language: SupportedLanguage): ParsedFile {
  const f = base(path, language, content);
  const lines = content.split("\n");
  const patterns: Array<{ re: RegExp; kind: ParsedSymbol["kind"] }> = [
    { re: /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?::\s*([A-Za-z0-9_<>\[\]| ]+))?/, kind: "function" },
    { re: /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_]+)/, kind: "class" },
    { re: /^\s*(?:export\s+)?interface\s+([A-Za-z0-9_]+)/, kind: "interface" },
    { re: /^\s*(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=/, kind: "type" },
    { re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*(?::\s*[^=]+)?=\s*(?:\(|async\s*\(|[^;]*=>)/, kind: "function" },
    { re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*(?::\s*[^=;]+)?\s*=/, kind: "const" },
    { re: /^\s*(?:public|private|protected)?\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/, kind: "method" },
  ];
  lines.forEach((line, i) => {
    for (const { re, kind } of patterns) {
      const m = line.match(re);
      if (m) {
        const exported = /^\s*export/.test(line);
        const params = (m[2] ?? "").split(",").map((s) => s.trim().split(/[:= ]/)[0]).filter(Boolean).slice(0, 12);
        f.symbols.push({
          name: m[1], kind, file: path, line: i + 1, signature: line.trim().slice(0, 240),
          exported, params, returnType: m[3]?.trim(), docComment: docCommentAbove(lines, i),
        });
        break;
      }
    }
    const im = line.match(/import\s+(?:[^'"]*from\s+)?["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)|from\s+["']([^"']+)["']/);
    const target = im?.[1] ?? im?.[2] ?? im?.[3];
    if (target) {
      const names = [...line.matchAll(/import\s*\{([^}]*)\}/g)].flatMap((x) => x[1].split(",").map((s) => s.trim()).filter(Boolean));
      f.imports.push({ from: path, to: target, names, line: i + 1 });
    }
    const ex = line.match(/^\s*export\s+(?:\{([^}]*)\}|(?:default\s+)?(?:function|class|const|interface|type)\s+([A-Za-z0-9_]+))/);
    if (ex) {
      const list = (ex[1] ?? ex[2] ?? "").split(",").map((s) => s.trim().split(/\s+as\s+/).pop() ?? "").filter(Boolean);
      f.exports.push(...list);
    }
  });
  // React component heuristic: capitalized const/function returning JSX
  for (const s of f.symbols) {
    if (/^[A-Z]/.test(s.name) && (s.kind === "function" || s.kind === "const")) s.kind = "component";
  }
  return f;
}

// ---- Python ----
function parsePython(path: string, content: string): ParsedFile {
  const f = base(path, "python", content);
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    let m = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
    if (m) {
      const params = m[2].split(",").map((s) => s.trim().split(/[:= ]/)[0]).filter(Boolean).slice(0, 12);
      f.symbols.push({ name: m[1], kind: line.includes("self") || /^[ \t]+def/.test(line) ? "method" : "function", file: path, line: i + 1, signature: line.trim().slice(0, 240), params, docComment: docCommentAbove(lines, i) });
      return;
    }
    m = line.match(/^\s*class\s+([A-Za-z0-9_]+)/);
    if (m) { f.symbols.push({ name: m[1], kind: "class", file: path, line: i + 1, signature: line.trim().slice(0, 240), exported: true }); return; }
    m = line.match(/^\s*(?:from|import)\s+([A-Za-z0-9_./]+)/);
    if (m) {
      const imp = line.match(/^\s*from\s+(\S+)\s+import\s+(.+)|^\s*import\s+(.+)/);
      const to = imp?.[1] ?? imp?.[3] ?? m[1];
      const names = (imp?.[2] ?? imp?.[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
      f.imports.push({ from: path, to: to.trim(), names, line: i + 1 });
    }
    m = line.match(/^([A-Za-z0-9_]+)\s*=/);
    if (m && i < 40) f.symbols.push({ name: m[1], kind: "variable", file: path, line: i + 1 });
  });
  return f;
}

// ---- Java ----
function parseJava(path: string, content: string): ParsedFile {
  const f = base(path, "java", content);
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    let m = line.match(/^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?class\s+([A-Za-z0-9_]+)/);
    if (m) { f.symbols.push({ name: m[1], kind: "class", file: path, line: i + 1, signature: line.trim().slice(0, 240), exported: true }); return; }
    m = line.match(/^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:[\w<>\[\]]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
    if (m && !/^\s*(if|for|while|switch|catch)\b/.test(line)) {
      f.symbols.push({ name: m[1], kind: "method", file: path, line: i + 1, signature: line.trim().slice(0, 240) });
      return;
    }
    m = line.match(/^\s*import\s+(?:static\s+)?([\w.]+);?/);
    if (m) f.imports.push({ from: path, to: m[1], names: [], line: i + 1 });
    m = line.match(/^\s*package\s+([\w.]+);?/);
    if (m) f.exports.push(m[1]);
  });
  return f;
}

// ---- C / C++ ----
function parseCLike(path: string, content: string, language: SupportedLanguage): ParsedFile {
  const f = base(path, language, content);
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    let m = line.match(/^\s*(?:class|struct)\s+([A-Za-z0-9_]+)/);
    if (m) { f.symbols.push({ name: m[1], kind: "class", file: path, line: i + 1, signature: line.trim().slice(0, 240) }); return; }
    m = line.match(/^\s*(?:[\w:<>*&]+\s+)+([A-Za-z0-9_:]+)\s*\(([^)]*)\)\s*(?:const\s*)?(?:\{|;)/);
    if (m && !/^\s*(if|for|while|switch|catch|return)\b/.test(line)) {
      f.symbols.push({ name: m[1].split(":").pop() ?? m[1], kind: "function", file: path, line: i + 1, signature: line.trim().slice(0, 240) });
      return;
    }
    m = line.match(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/);
    if (m) f.imports.push({ from: path, to: m[1], names: [], line: i + 1 });
  });
  return f;
}

// ---- Go ----
function parseGo(path: string, content: string): ParsedFile {
  const f = base(path, "go", content);
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    let m = line.match(/^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
    if (m) { f.symbols.push({ name: m[1], kind: /^[A-Z]/.test(m[1]) ? "function" : "function", file: path, line: i + 1, signature: line.trim().slice(0, 240), exported: /^[A-Z]/.test(m[1]) }); return; }
    m = line.match(/^\s*type\s+([A-Za-z0-9_]+)\s+(?:struct|interface)/);
    if (m) { f.symbols.push({ name: m[1], kind: /interface/.test(line) ? "interface" : "class", file: path, line: i + 1, signature: line.trim().slice(0, 240), exported: /^[A-Z]/.test(m[1]) }); return; }
    m = line.match(/^\s*(?:import\s+["']([^"']+)["']|["']([^"']+)["'])/);
    const target = m?.[1] ?? m?.[2];
    if (/^\s*import/.test(line) && target) f.imports.push({ from: path, to: target, names: [], line: i + 1 });
  });
  return f;
}

// ---- Rust ----
function parseRust(path: string, content: string): ParsedFile {
  const f = base(path, "rust", content);
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    let m = line.match(/^\s*(?:pub\s+)?fn\s+([A-Za-z0-9_]+)\s*\(/);
    if (m) { f.symbols.push({ name: m[1], kind: "function", file: path, line: i + 1, signature: line.trim().slice(0, 240), exported: /^\s*pub/.test(line) }); return; }
    m = line.match(/^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z0-9_]+)/);
    if (m) { f.symbols.push({ name: m[1], kind: /trait/.test(line) ? "interface" : "class", file: path, line: i + 1, signature: line.trim().slice(0, 240), exported: /^\s*pub/.test(line) }); return; }
    m = line.match(/^\s*use\s+([^;]+);/);
    if (m) f.imports.push({ from: path, to: m[1].trim(), names: [], line: i + 1 });
    m = line.match(/^\s*(?:pub\s+)?mod\s+([A-Za-z0-9_]+)/);
    if (m) f.exports.push(m[1]);
  });
  return f;
}

export function detectLanguage(path: string, content?: string): SupportedLanguage {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts": case "tsx": case "mts": case "cts": return "typescript";
    case "js": case "jsx": case "mjs": case "cjs": return "javascript";
    case "py": return "python";
    case "java": return "java";
    case "c": case "h": return "c";
    case "cpp": case "cc": case "cxx": case "hpp": case "hh": return "cpp";
    case "go": return "go";
    case "rs": return "rust";
    default: break;
  }
  if (content) {
    if (/^\s*(from|import)\s+\S+\s+import|^def\s+\w+\s*\(|^class\s+\w+.*:\s*$/m.test(content) && /:\s*$|print\(|self/.test(content)) return "python";
    if (/^\s*package\s+\w+|^\s*func\s+\w+\s*\(/m.test(content)) return "go";
    if (/^\s*fn\s+\w+\s*\(|^\s*use\s+[\w:]+;/m.test(content)) return "rust";
  }
  return "unknown";
}

// §1 engine
export class CodePerceptionEngine {
  private parsers = new Map<SupportedLanguage, LanguageParser>();

  constructor() {
    this.register({ language: "typescript", parse: (p, c) => parseTsLike(p, c, "typescript") });
    this.register({ language: "javascript", parse: (p, c) => parseTsLike(p, c, "javascript") });
    this.register({ language: "python", parse: parsePython });
    this.register({ language: "java", parse: parseJava });
    this.register({ language: "c", parse: (p, c) => parseCLike(p, c, "c") });
    this.register({ language: "cpp", parse: (p, c) => parseCLike(p, c, "cpp") });
    this.register({ language: "go", parse: parseGo });
    this.register({ language: "rust", parse: parseRust });
  }

  register(parser: LanguageParser): void {
    this.parsers.set(parser.language, parser);
  }

  supportedLanguages(): SupportedLanguage[] {
    return [...this.parsers.keys()];
  }

  perceiveFile(path: string, content: string, language?: SupportedLanguage): ParsedFile {
    const lang = language ?? detectLanguage(path, content);
    const parser = this.parsers.get(lang);
    if (!parser) return base(path, "unknown", content);
    try {
      return parser.parse(path, content);
    } catch {
      return base(path, lang, content);
    }
  }

  perceiveFolder(files: Array<{ path: string; content: string }>): ParsedFile[] {
    return files.map((f) => this.perceiveFile(f.path, f.content));
  }

  // Folder-level rollup: folders, components, APIs, schemas, configs, tests, docs
  perceiveRepo(files: ParsedFile[]): {
    folders: Record<string, number>;
    apiRoutes: ParsedSymbol[];
    schemas: ParsedSymbol[];
    configs: string[];
    tests: string[];
    docs: string[];
  } {
    const folders: Record<string, number> = {};
    for (const f of files) {
      const dir = f.path.split("/").slice(0, -1).join("/") || ".";
      folders[dir] = (folders[dir] ?? 0) + 1;
    }
    const apiRoutes = files.flatMap((f) => f.symbols).filter((s) =>
      /route|controller|handler|endpoint|router/i.test(s.name) || /routes?|controllers?|api\//i.test(s.file));
    const schemas = files.flatMap((f) => f.symbols).filter((s) =>
      /schema|model|entity|migration|table/i.test(s.name) || /schema|model|migration|prisma|drizzle/i.test(s.file));
    const configs = files.map((f) => f.path).filter((p) => /config|\.env|tsconfig|vite\.config|package\.json|Dockerfile|render\.yaml/i.test(p));
    const tests = files.map((f) => f.path).filter((p) => /\.test\.|\.spec\.|__tests__|tests?\//i.test(p));
    const docs = files.map((f) => f.path).filter((p) => /README|\.md$|docs?\//i.test(p));
    return { folders, apiRoutes, schemas, configs, tests, docs };
  }
}
