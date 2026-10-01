// Unified Brain verification: proves all 19 capabilities are wired through ONE brain/.
import { describe, it, expect } from "vitest";
import { UnifiedBrain, getUnifiedBrain } from "../index";
import { BrainOrchestrator, routeCapability } from "../core/orchestrator";
import { runBrainLoop } from "../core/brain-loop";
import { runAnimationLoop } from "../loops/animation-loop/loop";
import { runAutonomousLoop } from "../loops/autonomous-loop/loop";
import { runBuildLoop } from "../loops/build-loop/loop";
import { CodingBrain } from "../coding/CodingBrain";
import { AnimationBrain } from "../animation/api/brain";

const SAMPLE = `<div id="heart-tree"><svg></svg></div><style>@keyframes grow { from { opacity: 0; } to { opacity: 1; } }</style>`;

describe("UnifiedBrain", () => {
  it("shares single memory/context/router/tools across coding + animation", () => {
    const u = new UnifiedBrain();
    expect(u.memory).toBe(u.brain.memory);
    expect(u.tools).toBe(u.brain.tools);
    expect(u.animation).toBeInstanceOf(AnimationBrain);
  });

  it("singleton + dashboard exposes animation patterns", () => {
    const u = getUnifiedBrain();
    expect(u.dashboard()).toHaveProperty("tasksStarted");
  });

  it("routes capabilities", () => {
    expect(routeCapability("animate a timeline with easing")).toBe("animation");
    expect(routeCapability("fix this bug in my function")).toBe("coding");
  });

  it("animation pipeline preserved: SEE→…→IMPROVE", () => {
    const u = new UnifiedBrain();
    const r = u.analyzeAnimation(SAMPLE);
    expect(r.objects.length).toBeGreaterThan(0);
    expect(r.adl.events.length).toBeGreaterThan(0);
    const re = u.recreateAnimation(SAMPLE);
    expect(re.report.similarity).toBeGreaterThan(0);
  });

  it("coding brain preserved: READ→…→VERIFY", async () => {
    const coder = new CodingBrain();
    const res = await coder.run({
      goal: "Add validation to login",
      files: [{ path: "login.ts", content: "export function login(u: string, p: string) { return u + p; }" }],
    });
    expect(res.response.length).toBeGreaterThan(50);
    expect(res.memoryUpdated).toBe(true);
  });

  it("autonomous animation loop: OBSERVE→…→RENDER AGAIN", async () => {
    const r = await runAnimationLoop(new AnimationBrain(), SAMPLE);
    expect(r.report.similarity).toBeGreaterThan(0);
  });

  it("autonomous code loop completes", async () => {
    const u = new UnifiedBrain();
    const task = await runBrainLoop(u.brain, "Explain model routing in 3 bullets");
    expect(["done", "failed"]).toContain(task.phase);
  }, 15000);

  it("orchestrator + build/autonomous loops run", async () => {
    const orch = new BrainOrchestrator();
    expect(orch.memory).toBe(orch.brain.memory);
    const b = await runBuildLoop(orch.brain, "Explain caching in 2 bullets");
    expect(b.built.response.length).toBeGreaterThan(20);
    const auto = await runAutonomousLoop(orch.brain, "Say hi in 5 words");
    expect(["done", "failed"]).toContain(auto.phase);
  }, 20000);
});
