// Regression + behavior tests for the Animation Understanding Brain.
// Every discovered bug must produce a regression test (§FINAL COMMAND).
import { describe, expect, it } from "vitest";
import { AnimationBrain } from "../api/brain";
import { buildAdl, modifyAdl, validateAdl } from "../animation-dsl/adl";
import { buildGraph } from "../animation-graph/graph";
import { PatternMemory } from "../animation-memory/pattern-memory";
import { generateCode } from "../code-generator/generator";
import { estimateFromJs, parseEasingToken } from "../easing-engine/easing";
import { routeSource } from "../perception/source-router";
import { renderAdlFrames, selectTechnology } from "../reconstruction/engine";
import { analyzeCss } from "../source-analyzer/css-analyzer";
import { analyzeHtml } from "../source-analyzer/html-analyzer";
import { analyzeJs } from "../source-analyzer/js-analyzer";
import { buildSpatialGraph } from "../spatial-engine/spatial";
import { buildTimeline } from "../timeline-engine/timeline";
import { detectTriggers } from "../trigger-engine/triggers";
import { compareFrames } from "../visual-comparator/comparator";
import { detectElements } from "../visual-analyzer/element-detector";
import { trackMotion } from "../visual-analyzer/motion-tracker";
import { optimize } from "../optimizer/loop";
import type { ADL } from "../types";

const HEART_TREE_CODE = `
<div id="heart-tree">
  <svg class="trunk"><path d="M0 0 L10 100"/></svg>
  <canvas id="particles"></canvas>
  <button>water</button>
</div>
<style>
@keyframes grow { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.seed { animation: grow 2s cubic-bezier(0.22, 1, 0.36, 1) both; transition: opacity .3s ease-out; }
.leaf { transform: rotate(12deg); }
</style>
<script>
import gsap from "gsap";
requestAnimationFrame(tick);
new IntersectionObserver(cb, {threshold: 0.2});
window.addEventListener("scroll", onScroll);
window.addEventListener("pointermove", onPointer);
const c = document.querySelector("canvas").getContext("2d");
</script>
<p>love seed grows into a heart tree with roots trunk branches leaves hearts particles</p>
`;

describe("source router (§1)", () => {
  it("routes website URLs", () => {
    expect(routeSource("https://example.com/anim").type).toBe("website");
  });
  it("routes gif / video / code", () => {
    expect(routeSource("anim.gif").type).toBe("gif");
    expect(routeSource("clip.mp4").type).toBe("video");
    expect(routeSource("<div><svg></svg></div>").type).toBe("code");
  });
});

describe("source analyzers (§2)", () => {
  it("finds svg/canvas/interactive in HTML", () => {
    const h = analyzeHtml(HEART_TREE_CODE);
    expect(h.svgCount).toBe(1);
    expect(h.canvasCount).toBe(1);
    expect(h.interactive).toContain("button");
  });
  it("finds keyframes + easing tokens in CSS", () => {
    const c = analyzeCss(HEART_TREE_CODE);
    expect(c.keyframes).toContain("grow");
    expect(c.rawEasings.join(" ")).toContain("cubic-bezier");
  });
  it("detects gsap + rAF + observers in JS", () => {
    const j = analyzeJs(HEART_TREE_CODE);
    expect(j.libraries).toContain("gsap");
    expect(j.usesRequestAnimationFrame).toBe(true);
    expect(j.usesIntersectionObserver).toBe(true);
    expect(j.usesScrollListener).toBe(true);
  });
});

describe("understanding pipeline (§3–9)", () => {
  it("detects love-scene elements with stable ids", () => {
    const h = analyzeHtml(HEART_TREE_CODE);
    const els = detectElements(h, { scene: "heart-tree", semanticHints: ["love-seed", "soil", "roots", "trunk", "branches", "leaves", "hearts", "particles"] });
    expect(els[0].id).toBe("heart-tree");
    expect(els.some((e) => e.id === "heart-tree.trunk")).toBe(true);
    // determinism regression: same input → same ids
    const again = detectElements(h, { scene: "heart-tree", semanticHints: ["love-seed", "soil", "roots", "trunk", "branches", "leaves", "hearts", "particles"] });
    expect(again.map((e) => e.id)).toEqual(els.map((e) => e.id));
  });
  it("builds motion + causal timeline", () => {
    const h = analyzeHtml(HEART_TREE_CODE);
    const c = analyzeCss(HEART_TREE_CODE);
    const els = detectElements(h, { scene: "s" });
    const tracks = trackMotion(els, c, 12000);
    expect(tracks.length).toBeGreaterThan(0);
    const tl = buildTimeline(tracks, els);
    expect(tl[0].at).toBe(0);
    expect(tl.some((e) => e.causedBy.length > 0)).toBe(true);
  });
  it("detects triggers incl. scroll + intersection", () => {
    const j = analyzeJs(HEART_TREE_CODE);
    const h = analyzeHtml(HEART_TREE_CODE);
    const els = detectElements(h, { scene: "s" });
    const tl = buildTimeline(trackMotion(els, analyzeCss(HEART_TREE_CODE), 5000), els);
    const types = detectTriggers(j, tl).map((t) => t.type);
    expect(types).toContain("SCROLL");
    expect(types).toContain("INTERSECTION");
  });
  it("marks exact vs approximated easing (§7, §20)", () => {
    const exact = parseEasingToken("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(exact.source).toBe("exactly-observed");
    expect(exact.value.confidence).toBe(1);
    const est = estimateFromJs("gsap.to(x, {ease: 'elastic.out'})");
    expect(est.value.approximated).toBe(true);
    expect(est.value.confidence).toBeLessThan(1);
  });
  it("builds spatial relations + causal graph", () => {
    const h = analyzeHtml(HEART_TREE_CODE);
    const els = detectElements(h, { scene: "heart-tree", semanticHints: ["love-seed", "soil", "roots", "trunk", "branches", "leaves", "hearts", "particles"] });
    const tracks = trackMotion(els, analyzeCss(HEART_TREE_CODE), 12000);
    const spatial = buildSpatialGraph(els, tracks);
    expect(spatial.relations.length).toBeGreaterThan(0);
    const g = buildGraph(buildTimeline(tracks, els));
    expect(g.edges.length).toBe(g.nodes.length - 1);
  });
});

describe("ADL (§10) + memory (§11)", () => {
  function adlFixture(): ADL {
    const h = analyzeHtml(HEART_TREE_CODE);
    const els = detectElements(h, { scene: "heart-tree", semanticHints: ["love-seed", "soil", "roots", "trunk", "branches", "leaves", "hearts", "particles"] });
    const tracks = trackMotion(els, analyzeCss(HEART_TREE_CODE), 12000);
    const tl = buildTimeline(tracks, els);
    return buildAdl("heart_tree", els, tracks, buildGraph(tl), detectTriggers(analyzeJs(HEART_TREE_CODE), tl), 12000, "GSAP + SVG", 0.91);
  }
  it("validates ADL and rejects bad durations", () => {
    const adl = adlFixture();
    expect(validateAdl(adl)).toEqual([]);
    const bad: ADL = { ...adl, duration: -1 };
    expect(validateAdl(bad).length).toBeGreaterThan(0);
  });
  it("modifies ADL via NL: 30% slower", () => {
    const { adl: next, changes } = modifyAdl(adlFixture(), "Make the tree grow 30% slower");
    expect(changes.join(" ")).toMatch(/slower/);
    expect(next.duration).toBe(Math.round(12000 * 1.3));
  });
  it("modifies ADL via NL: replace leaves with hearts", () => {
    const adl = adlFixture();
    const { adl: next } = modifyAdl(adl, "Replace the leaves with hearts");
    expect(next.objects.some((o) => o.type === "heart")).toBe(true);
  });
  it("modifies ADL via NL: remove scroll + water trigger + camera flight", () => {
    const adl = adlFixture();
    const noScroll = modifyAdl(adl, "Remove the scroll interaction");
    expect((noScroll.adl.triggers ?? []).some((t) => t.type === "SCROLL")).toBe(false);
    const water = modifyAdl(adl, "Make watering trigger the growth");
    expect(water.adl.events.some((e) => e.trigger === "water_contact")).toBe(true);
    const cam = modifyAdl(adl, "Make the final hearts fly toward the camera");
    expect(cam.adl.events.some((e) => e.action === "fly-toward-camera")).toBe(true);
  });
  it("throws on unsupported NL commands instead of guessing", () => {
    expect(() => modifyAdl(adlFixture(), "Make it more blue-ish yesterday")).toThrow(/Unsupported/);
  });
  it("retrieves organic-growth pattern from memory", () => {
    const mem = new PatternMemory();
    const hits = mem.retrieve("organic branch growth staggered");
    expect(hits[0]?.id).toBe("organic-branch-growth");
  });
});

describe("reconstruction + comparison + optimizer (§12–15)", () => {
  it("selects simplest capable technology", () => {
    const brain = new AnimationBrain();
    const u = brain.analyze(HEART_TREE_CODE);
    expect(selectTechnology(u.adl).target).toBe("canvas"); // particle-system present
  });
  it("generates modular files (never one giant bundle)", () => {
    const brain = new AnimationBrain();
    const u = brain.analyze(HEART_TREE_CODE);
    const plan = generateCode(u.adl, "gsap", "heart-tree");
    expect(plan.files.length).toBeGreaterThanOrEqual(2);
    expect(plan.files.every((f) => f.content.length > 0)).toBe(true);
  });
  it("identical renders score 100 with no differences", () => {
    const brain = new AnimationBrain();
    const u = brain.analyze(HEART_TREE_CODE);
    const frames = renderAdlFrames(u.adl);
    const report = compareFrames(frames, frames);
    expect(report.similarity).toBe(100);
    expect(report.differences).toEqual([]);
  });
  it("optimizer stops on target and never loops endlessly", () => {
    const brain = new AnimationBrain();
    const u = brain.analyze(HEART_TREE_CODE);
    const original = renderAdlFrames(u.adl);
    const perturbed: ADL = JSON.parse(JSON.stringify(u.adl)) as ADL;
    for (const e of perturbed.events) e.duration = Math.round(e.duration * 1.5);
    const res = optimize(original, perturbed, { targetSimilarity: 99.9, maxIterations: 4, minImprovement: 0.5 });
    expect(res.iterations.length).toBeLessThanOrEqual(4);
    expect(["target-reached", "budget-exhausted", "no-improvement"]).toContain(res.stoppedBecause);
  });
});

describe("brain facade (§16–18)", () => {
  it("analyze → describe report with confidence", () => {
    const brain = new AnimationBrain();
    const u = brain.analyze(HEART_TREE_CODE);
    const text = brain.describe(u);
    expect(text).toMatch(/Technology:/);
    expect(text).toMatch(/Confidence:/);
    expect(u.summary.confidence).toBeGreaterThan(0.5);
    // every evidence row carries source + confidence (§20)
    for (const row of u.evidence) {
      expect(["exactly-observed", "inferred", "approximated"]).toContain(row.source);
      expect(row.confidence).toBeGreaterThanOrEqual(0);
      expect(row.confidence).toBeLessThanOrEqual(1);
    }
  });
  it("recreate pipeline returns plan + comparison", () => {
    const brain = new AnimationBrain();
    const out = brain.recreate(HEART_TREE_CODE);
    expect(out.plan.files.length).toBeGreaterThan(0);
    expect(out.report.similarity).toBeGreaterThanOrEqual(0);
  });
});
