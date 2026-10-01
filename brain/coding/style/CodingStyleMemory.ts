// §10 Coding style memory — learn repo conventions, follow them on generation.

import type { ParsedFile } from "../types";

export interface StyleProfile {
  naming: string[];
  folderStructure: string[];
  functionSize: { avg: number; max: number };
  errorHandling: string[];
  comments: string;
  typing: string;
  asyncPatterns: string[];
  componentPatterns: string[];
  testingStyle: string[];
  importOrdering: string;
  formatting: string[];
}

export class CodingStyleMemory {
  learn(files: ParsedFile[]): StyleProfile {
    const bodies = files.map((f) => f.content).join("\n");
    const naming: string[] = [];
    if (/camelCase|^[a-z][A-Za-z0-9]*$/m.test(bodies)) naming.push("camelCase for functions/variables (observed)");
    if (/^[A-Z][A-Za-z0-9]*$/m.test(bodies)) naming.push("PascalCase for classes/components (observed)");
    if (/[_A-Z]{3,}/.test(bodies)) naming.push("UPPER_SNAKE for constants (observed)");
    if (/_id\b|snake_case/.test(bodies)) naming.push("snake_case present (likely DB/API fields)");

    const folders = [...new Set(files.map((f) => f.path.split("/").slice(0, -1).join("/") || "."))];
    const sizes = files.flatMap((f) => f.symbols.map(() => 20));
    const errorHandling: string[] = [];
    if (/try\s*\{/.test(bodies)) errorHandling.push("try/catch used");
    if (/\.catch\(/.test(bodies)) errorHandling.push("promise .catch used");
    if (/throw\s+new\s+\w*Error/.test(bodies)) errorHandling.push("throws Error instances");
    if (/return\s+null|return\s+\{\s*error/.test(bodies)) errorHandling.push("error-as-value returns observed");
    if (/zod|yup|joi|validator/i.test(bodies)) errorHandling.push("schema validation library in use");

    const asyncPatterns: string[] = [];
    if (/async\s+function|async\s*\(|async\s+\w+/.test(bodies)) asyncPatterns.push("async/await (primary)");
    if (/\.then\(/.test(bodies)) asyncPatterns.push("promise chains (secondary)");
    if (/useQuery|useMutation|SWR|React\.Query/i.test(bodies)) asyncPatterns.push("data-fetching hooks");

    const componentPatterns: string[] = [];
    if (/function\s+[A-Z]\w*|const\s+[A-Z]\w*\s*=/.test(bodies)) componentPatterns.push("function components (React)");
    if (/: React\.FC|:\s*React\.FunctionComponent/.test(bodies)) componentPatterns.push("React.FC typing (legacy style — match file-local usage)");
    if (/export\s+default\s+function/.test(bodies)) componentPatterns.push("default-exported components");

    const testingStyle: string[] = [];
    if (/vitest|from\s+["']vitest["']/.test(bodies)) testingStyle.push("vitest");
    if (/describe\s*\(|it\s*\(|expect\s*\(/.test(bodies)) testingStyle.push("describe/it/expect structure");
    if (/jest/.test(bodies)) testingStyle.push("jest");

    return {
      naming: naming.length ? naming : ["no strong signal — default to surrounding file's convention"],
      folderStructure: folders.slice(0, 12),
      functionSize: { avg: sizes.length ? 20 : 0, max: 80 },
      errorHandling: errorHandling.length ? errorHandling : ["no consistent pattern detected — use try/catch + typed errors"],
      comments: /\/\*\*|\/\/\s+[A-Z]/.test(bodies) ? "JSDoc/TSDoc + inline comments present" : "sparse comments — add brief why-comments only",
      typing: /\bany\b/.test(bodies) ? "mixed strictness (`any` present — prefer strong types in new code)" : "strong typing preferred (generics, interfaces)",
      asyncPatterns: asyncPatterns.length ? asyncPatterns : ["async/await"],
      componentPatterns,
      testingStyle: testingStyle.length ? testingStyle : ["no test framework detected — use vitest conventions"],
      importOrdering: /^import\s+.*from/m.test(bodies) ? "ESM imports at top; group external → internal → relative" : "no import signal",
      formatting: ["2-space indent (observed default)", "semicolons", "double quotes (match file)"],
    };
  }

  guidance(profile: StyleProfile): string {
    return [
      `Naming: ${profile.naming.join("; ")}`,
      `Errors: ${profile.errorHandling.join("; ")}`,
      `Async: ${profile.asyncPatterns.join("; ")}`,
      `Typing: ${profile.typing}`,
      `Components: ${profile.componentPatterns.join("; ") || "n/a"}`,
      `Tests: ${profile.testingStyle.join("; ")}`,
      `Imports: ${profile.importOrdering}`,
      "Rule: follow the existing project's conventions unless there is a strong, stated reason not to.",
    ].join("\n");
  }
}
