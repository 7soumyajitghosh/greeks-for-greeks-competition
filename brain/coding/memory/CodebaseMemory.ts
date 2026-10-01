// §4 Codebase Memory — persistent structured memory.
// Stores architecture, decisions, important symbols, flows, contracts, bugs,
// fixes, testing strategy, conventions, preferences. Updates on OLD→CHANGE→NEW.

import type { CodebaseMemorySnapshot, DecisionRecord } from "../types";

const EMPTY: CodebaseMemorySnapshot = {
  architecture: "", architecturePattern: "unknown", designDecisions: [],
  importantFiles: [], importantSymbols: [], dependencies: [], dataFlows: [],
  apiContracts: [], dbRelationships: [], knownBugs: [], previousFixes: [],
  testingStrategy: "", conventions: [], preferences: [], updatedAt: 0,
};

export interface MemoryStore {
  load(): Promise<CodebaseMemorySnapshot | null>;
  save(snap: CodebaseMemorySnapshot): Promise<void>;
}

export class InMemoryCodebaseStore implements MemoryStore {
  private snap: CodebaseMemorySnapshot | null = null;
  async load(): Promise<CodebaseMemorySnapshot | null> { return this.snap; }
  async save(snap: CodebaseMemorySnapshot): Promise<void> { this.snap = snap; }
}

export class CodebaseMemory {
  private snap: CodebaseMemorySnapshot = { ...EMPTY };
  private loaded = false;

  constructor(private store: MemoryStore = new InMemoryCodebaseStore()) {}

  async load(): Promise<CodebaseMemorySnapshot> {
    if (!this.loaded) {
      const s = await this.store.load().catch(() => null);
      if (s) this.snap = { ...EMPTY, ...s };
      this.loaded = true;
    }
    return this.snapshot();
  }

  snapshot(): CodebaseMemorySnapshot {
    return JSON.parse(JSON.stringify(this.snap)) as CodebaseMemorySnapshot;
  }

  async recordArchitecture(architecture: string, pattern: CodebaseMemorySnapshot["architecturePattern"], evidence: string[]): Promise<void> {
    await this.load();
    this.snap.architecture = `${architecture} (evidence: ${evidence.slice(0, 6).join(", ")})`.slice(0, 2000);
    this.snap.architecturePattern = pattern;
    await this.persist();
  }

  async recordDecision(d: DecisionRecord): Promise<void> {
    await this.load();
    this.snap.designDecisions.push({ ...d, date: d.date || new Date().toISOString() });
    this.snap.designDecisions = this.snap.designDecisions.slice(-50);
    await this.persist();
  }

  async noteImportant(files: string[], symbols: string[], dependencies: string[]): Promise<void> {
    await this.load();
    this.snap.importantFiles = [...new Set([...this.snap.importantFiles, ...files])].slice(-80);
    this.snap.importantSymbols = [...new Set([...this.snap.importantSymbols, ...symbols])].slice(-120);
    this.snap.dependencies = [...new Set([...this.snap.dependencies, ...dependencies])].slice(-80);
    await this.persist();
  }

  async noteBug(bug: string): Promise<void> {
    await this.load();
    if (!this.snap.knownBugs.includes(bug)) this.snap.knownBugs.push(bug);
    this.snap.knownBugs = this.snap.knownBugs.slice(-50);
    await this.persist();
  }

  async noteFix(oldCode: string, change: string, newCode: string): Promise<void> {
    await this.load();
    this.snap.previousFixes.push(
      `OLD: ${oldCode.slice(0, 200)} | CHANGE: ${change.slice(0, 200)} | NEW: ${newCode.slice(0, 200)}`.slice(0, 600),
    );
    this.snap.previousFixes = this.snap.previousFixes.slice(-50);
    await this.persist();
  }

  /** OLD CODE → CHANGE → NEW CODE → UPDATE MEMORY */
  async applyChange(args: {
    files: string[]; symbols?: string[]; contracts?: string[];
    conventions?: string[]; preferences?: string[]; testingStrategy?: string;
  }): Promise<CodebaseMemorySnapshot> {
    await this.load();
    if (args.symbols) this.snap.importantSymbols = [...new Set([...this.snap.importantSymbols, ...args.symbols])].slice(-120);
    if (args.files) this.snap.importantFiles = [...new Set([...this.snap.importantFiles, ...args.files])].slice(-80);
    if (args.contracts) this.snap.apiContracts = [...new Set([...this.snap.apiContracts, ...args.contracts])].slice(-40);
    if (args.conventions) this.snap.conventions = [...new Set([...this.snap.conventions, ...args.conventions])].slice(-40);
    if (args.preferences) this.snap.preferences = [...new Set([...this.snap.preferences, ...args.preferences])].slice(-20);
    if (args.testingStrategy) this.snap.testingStrategy = args.testingStrategy.slice(0, 1000);
    await this.persist();
    return this.snapshot();
  }

  async recall(query: string): Promise<string> {
    await this.load();
    const q = query.toLowerCase();
    const hits: string[] = [];
    const push = (label: string, vals: string[]) => {
      for (const v of vals) {
        if (q.split(/[^a-z0-9]+/).some((t) => t.length > 2 && v.toLowerCase().includes(t))) hits.push(`[${label}] ${v.slice(0, 220)}`);
      }
    };
    push("arch", [this.snap.architecture]);
    push("decision", this.snap.designDecisions.map((d) => `${d.problem} → ${d.selectedApproach}`));
    push("file", this.snap.importantFiles);
    push("symbol", this.snap.importantSymbols);
    push("contract", this.snap.apiContracts);
    push("bug", this.snap.knownBugs);
    push("fix", this.snap.previousFixes);
    push("convention", this.snap.conventions);
    return hits.slice(0, 12).join("\n") || "No directly relevant codebase memory. Proceed from fresh perception.";
  }

  private async persist(): Promise<void> {
    this.snap.updatedAt = Date.now();
    await this.store.save(this.snapshot());
  }
}
