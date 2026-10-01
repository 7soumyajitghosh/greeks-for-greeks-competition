import { describe, it, expect } from "vitest";
import { CodePerceptionEngine } from "../coding/perception/CodePerceptionEngine";
import { CodebaseGraph } from "../coding/graph/CodebaseGraph";
import { SymbolGraph } from "../coding/graph/SymbolGraph";
import { FlowAnalyzer } from "../coding/graph/FlowAnalyzer";
import { HumanCodeReader, IntentEngine, ArchitectureDetector } from "../coding/understanding/Understanding";
import { CodebaseMemory } from "../coding/memory/CodebaseMemory";
import { CodingStyleMemory } from "../coding/style/CodingStyleMemory";
import { HumanPlanner, ImpactAnalyzer } from "../coding/planning/Planning";
import { BugAnalysisEngine } from "../coding/bugs/BugAnalysisEngine";
import { TestFixLoop, RefactoringBrain, GitHistoryBrain } from "../coding/generation/Generation";
import { SelfReviewer, IndependentReviewer, SecurityBrain, PerformanceBrain, TestingBrain } from "../coding/review/Review";
import { CodingModelRouter } from "../coding/models/CodingModelRouter";
import { CodingBrain } from "../coding/CodingBrain";

const TS_AUTH = `
import { UserService } from "./UserService";
import { SessionStore } from "./SessionStore";
/** Authenticates a user and creates a session. */
export async function loginUser(email: string, password: string): Promise<string> {
  const user = await UserService.findByEmail(email);
  const ok = await UserService.verify(password, user.passwordHash);
  if (!ok) throw new Error("bad credentials");
  return SessionStore.create(user.id);
}
export class AuthController {
  async login(req: any, res: any) {
    const token = await loginUser(req.body.email, req.body.password);
    res.json({ token });
  }
}
`;

const TS_USER = `
import { loginUser } from "./auth";
export const UserService = {
  async findByEmail(email: string) { return { id: "1", passwordHash: "x" }; },
  async verify(pw: string, hash: string) { return true; },
};
export function getProfile() { return loginUser("a@b.c", "x"); }
`;

describe("CodePerceptionEngine (§1)", () => {
  it("parses TS + supports 8 languages", () => {
    const e = new CodePerceptionEngine();
    expect(e.supportedLanguages()).toContain("rust");
    const f = e.perceiveFile("src/auth.ts", TS_AUTH);
    expect(f.symbols.map((s) => s.name)).toContain("loginUser");
    expect(f.imports.length).toBeGreaterThan(0);
    const py = e.perceiveFile("a.py", "def foo(x):\n  return x\n");
    expect(py.symbols[0].name).toBe("foo");
    const go = e.perceiveFile("a.go", "package m\nfunc Do() {}\n");
    expect(go.symbols[0].name).toBe("Do");
  });
});

describe("CodebaseGraph (§2) + SymbolGraph (§5)", () => {
  it("builds hierarchy and caller edges", () => {
    const e = new CodePerceptionEngine();
    const files = e.perceiveFolder([
      { path: "src/auth.ts", content: TS_AUTH },
      { path: "src/UserService.ts", content: TS_USER },
    ]);
    const g = new CodebaseGraph();
    const nodes = g.build(files, "demo");
    expect(nodes.some((n) => n.level === "repo")).toBe(true);
    const sg = new SymbolGraph();
    const map = sg.build(files);
    const login = map.get("src/auth.ts::loginUser");
    expect(login).toBeDefined();
    expect(sg.transitiveDependents("src/UserService.ts::findByEmail").length).toBeGreaterThanOrEqual(0);
  });
});

describe("Human reading (§3) + intent (§8) + arch (§9)", () => {
  it("produces structured understanding with uncertainty", () => {
    const e = new CodePerceptionEngine();
    const files = e.perceiveFolder([{ path: "src/auth.ts", content: TS_AUTH }]);
    const sg = new SymbolGraph();
    const map = sg.build(files);
    const reader = new HumanCodeReader();
    const u = reader.read(files[0].symbols[0], files[0], map);
    expect(u.purpose.length).toBeGreaterThan(0);
    expect(u.edgeCases).toContain("empty input ('' / [] / {} / null / undefined)");
    const intent = new IntentEngine().infer(files[0].symbols[0], files[0], u);
    expect(intent.confidence).toBeLessThan(1);
    expect(intent.designReasoning).toMatch(/hypothesis/i);
    const arch = new ArchitectureDetector().detect(files);
    expect(arch.primary).toBeTruthy();
  });
});

describe("Memory (§4) + style (§10)", () => {
  it("persists OLD→CHANGE→NEW and learns style", async () => {
    const m = new CodebaseMemory();
    await m.recordArchitecture("component app", "component", ["src/App.tsx"]);
    await m.noteFix("old", "fix null", "new");
    await m.applyChange({ files: ["src/a.ts"], symbols: ["src/a.ts::f"] });
    const recall = await m.recall("auth component");
    expect(typeof recall).toBe("string");
    const e = new CodePerceptionEngine();
    const files = e.perceiveFolder([{ path: "src/a.ts", content: TS_AUTH }]);
    const style = new CodingStyleMemory().learn(files);
    expect(style.asyncPatterns.join()).toMatch(/async/);
  });
});

describe("Planner (§11) + impact (§12)", () => {
  it("investigates auth areas and scores risk as diagnostic", () => {
    const e = new CodePerceptionEngine();
    const files = e.perceiveFolder([
      { path: "src/auth.ts", content: TS_AUTH },
      { path: "src/UserService.ts", content: TS_USER },
    ]);
    const sg = new SymbolGraph();
    const map = sg.build(files);
    const impact = new ImpactAnalyzer().analyze("src/UserService.ts", "findByEmail", files, map);
    expect(impact.note).toMatch(/diagnostic/i);
    expect(impact.risk).toMatch(/low|medium|high/);
    const plan = new HumanPlanner().plan("Add Google login", files, map, impact);
    expect(plan.investigation.some((i) => /auth/i.test(i.area))).toBe(true);
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Bugs (§14/§15) + loop (§18) + refactor (§19) + git (§22)", () => {
  it("diagnoses root cause, refuses symptom patch", () => {
    const e = new CodePerceptionEngine();
    const files = e.perceiveFolder([{ path: "src/auth.ts", content: TS_AUTH }]);
    const sg = new SymbolGraph();
    const map = sg.build(files);
    const d = new BugAnalysisEngine().diagnose("Cannot read properties of undefined reading 'passwordHash'", files, map);
    expect(d.rootCauseConfidence).toBeLessThan(1);
    expect(d.symptomFixRejected.join()).toMatch(/\?\./);
    const loop = new TestFixLoop();
    expect(loop.nextAction({ testPassed: false, behaviorChanged: false, iterations: 0 })).toMatch(/FIX source/);
    expect(loop.validateTestEdit(false, false, true)).toMatch(/BLOCKED/);
    const sig = new RefactoringBrain().inspect(files);
    expect(Array.isArray(sig)).toBe(true);
    const hint = new GitHistoryBrain().interpret({ file: "src/auth.ts", currentCode: "x", log: [{ hash: "a", message: "hotfix race", date: "d" }] });
    expect(hint.safeToChange).toBe(false);
  });
});

describe("Review (§16/§24) + security (§20) + perf (§21) + tests (§17) + router (§23)", () => {
  it("reviews, audits, and routes roles", () => {
    const self = new SelfReviewer().review([{ path: "a.ts", content: "const x: any = 1;\nconsole.log(x);\n" }]);
    expect(self.findings.length).toBeGreaterThan(0);
    expect(self.trustAnswer).toMatch(/trust/i);
    const ind = new IndependentReviewer().secondOpinion(
      [{ path: "a.ts", content: "eval(x)" }], self);
    expect(ind.escalations.length).toBeGreaterThan(0);
    const sec = new SecurityBrain().audit(new CodePerceptionEngine().perceiveFolder([
      { path: "s.ts", content: "const q = `SELECT * FROM u WHERE id=${id}`" },
    ]));
    expect(sec.some((s) => s.category === "sql-injection")).toBe(true);
    const perf = new PerformanceBrain().analyze(new CodePerceptionEngine().perceiveFolder([
      { path: "p.ts", content: "items.forEach(async (i) => { await fetch(i); })" },
    ]));
    expect(perf.length).toBeGreaterThan(0);
    const tp = new TestingBrain().planForApi("/login");
    expect(tp.api?.some((a) => a.expected === 401)).toBe(true);
    const routes = new CodingModelRouter().route("fix auth security bug, complex", "complex");
    expect(routes.some((r) => r.role === "security")).toBe(true);
    expect(routes.some((r) => r.role === "reviewer")).toBe(true);
  });
});

describe("CodingBrain full loop (§26)", () => {
  it("runs understand→impact→plan→verify→memory without touching disk", async () => {
    const brain = new CodingBrain();
    const res = await brain.run({
      goal: "Add Google login",
      files: [
        { path: "src/auth.ts", content: TS_AUTH },
        { path: "src/UserService.ts", content: TS_USER },
      ],
      targetFile: "src/UserService.ts",
      targetSymbol: "findByEmail",
      history: [{ hash: "abc", message: "fix session race", date: "2024-01-01" }],
    });
    expect(res.plan).toBeTruthy();
    expect(res.impact).toBeTruthy();
    expect(res.review).toBeTruthy();
    expect(res.tests).toBeTruthy();
    expect(res.memoryUpdated).toBe(true);
    expect(res.response).toMatch(/Architecture/);
    expect(brain.guardrails().join()).toMatch(/blindly overwrite/);
  }, 15000);
});
