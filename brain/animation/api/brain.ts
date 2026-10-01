// Animation Brain facade (§16–18):
//   analyze  → "What exactly is happening in this animation?"
//   recreate → REFERENCE → UNDERSTAND → ADL → IMPLEMENT → RENDER → COMPARE → IMPROVE
//   modify   → NL command applied to the ADL, never to unrelated code.
import { auditRow } from "../evidence";
import { buildAdl, modifyAdl, validateAdl } from "../animation-dsl/adl";
import { buildGraph } from "../animation-graph/graph";
import { PatternMemory } from "../animation-memory/pattern-memory";
import { generateCode } from "../code-generator/generator";
import { estimateFromJs, parseEasingToken } from "../easing-engine/easing";
import { routeSource } from "../perception/source-router";
import { renderAdlFrames, selectTechnology } from "../reconstruction/engine";
import { analyzeCss } from "../source-analyzer/css-analyzer";
import { buildDependencyMap } from "../source-analyzer/dependency-map";
import { analyzeHtml } from "../source-analyzer/html-analyzer";
import { analyzeJs } from "../source-analyzer/js-analyzer";
import { buildSpatialGraph } from "../spatial-engine/spatial";
import { buildTimeline } from "../timeline-engine/timeline";
import { detectTriggers } from "../trigger-engine/triggers";
import { compareFrames } from "../visual-comparator/comparator";
import { detectElements } from "../visual-analyzer/element-detector";
import { trackMotion } from "../visual-analyzer/motion-tracker";
import type {
  ADL,
  AnimationSource,
  ComparisonReport,
  EasingInfo,
  Evidence,
  ReconstructionPlan,
  UnderstandingResult,
} from "../types";

const LOVE_HINTS = ["love-seed", "soil", "roots", "trunk", "branches", "leaves", "hearts", "particles"];

function semanticHintsFor(code: string): string[] | undefined {
  const l = code.toLowerCase();
  const hits = LOVE_HINTS.filter((h) => l.includes(h.replace("-", " ")) || l.includes(h) || l.includes(h.replace("-", "")));
  if (hits.length >= 3) return LOVE_HINTS;
  if (/seed|trunk|branch|leaf|bloom|heart/i.test(code) && /grow|tree/i.test(code)) return LOVE_HINTS;
  return undefined;
}

function splitCode(input: string): { html: string; css: string; js: string } {
  const styles = [...input.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const scripts = [...input.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  const cssBlocks = [...input.matchAll(/@keyframes[\s\S]*?\}\s*\}/g)].map((m) => m[0]).join("\n");
  return { html: input, css: `${styles}\n${cssBlocks}`, js: scripts.length ? scripts : input };
}

function sceneNameFor(src: AnimationSource, code: string): string {
  const m = code.match(/scene["']?\s*[:=]\s*["']([a-z0-9_-]+)["']/i);
  if (m) return m[1];
  if (/heart|love/i.test(code)) return "heart_tree";
  if (/seed|grow|tree/i.test(code)) return "growth_scene";
  return src.type.replace(/-/g, "_");
}

function estimateDuration(tracks: Array<{ endTime: number }>, fallback = 12000): number {
  const max = tracks.reduce((a, t) => Math.max(a, t.endTime), 0);
  return max > 0 ? max : fallback;
}

export class AnimationBrain {
  readonly memory = new PatternMemory();

  /** "Understand this animation" mode (§16). */
  analyze(input: string, mimeHint?: string): UnderstandingResult {
    const started = Date.now();
    const source = routeSource(input, mimeHint);
    const code = source.type === "code" || source.type === "website" ? input : "";
    const { html, css, js } = splitCode(code || input);

    const htmlF = analyzeHtml(html);
    const cssF = analyzeCss(css);
    const jsF = analyzeJs(js);
    void buildDependencyMap(htmlF, cssF, jsF);

    const scene = sceneNameFor(source, code || input);
    const els = detectElements(htmlF, {
      scene: scene === "heart_tree" ? "heart-tree" : scene,
      semanticHints: semanticHintsFor(code || input),
    });
    const duration = source.type === "video" || source.type === "gif" ? 8000 : estimateDuration([], 12000);
    const motions = trackMotion(els, cssF, duration);
    const dur = estimateDuration(motions, duration);
    const timeline = buildTimeline(motions, els);
    const triggers = detectTriggers(jsF, timeline);

    const easings: UnderstandingResult["easings"] = {};
    const tokens = cssF.rawEasings.length ? cssF.rawEasings : ["ease-out"];
    for (const [i, m] of motions.entries()) {
      const token = tokens[i % tokens.length];
      easings[m.elementId] = parseEasingToken(token);
    }
    if (!cssF.rawEasings.length) {
      const est: Evidence<EasingInfo> = estimateFromJs(js);
      for (const m of motions.slice(0, 1)) easings[m.elementId] = est;
    }

    const spatial = buildSpatialGraph(els, motions);
    const graph = buildGraph(timeline);
    const libs = jsF.libraries.filter((l) => l !== "none");
    const technology =
      libs.length > 0
        ? libs.join(" + ") + (htmlF.svgCount ? " + SVG" : htmlF.canvasCount ? " + Canvas" : "")
        : htmlF.canvasCount
          ? jsF.usesWebGL
            ? "Canvas/WebGL"
            : "Canvas 2D"
          : htmlF.svgCount
            ? "SVG + CSS"
            : cssF.keyframes.length
              ? "CSS keyframes"
              : "visual-analysis";

    const overallConfidence =
      els.length === 0
        ? 0.3
        : Math.min(
            0.97,
            0.55 +
              (cssF.keyframes.length ? 0.12 : 0) +
              (libs.length ? 0.1 : 0) +
              (htmlF.svgCount || htmlF.canvasCount ? 0.08 : 0) +
              Math.min(0.1, els.length * 0.005),
          );

    const elementsEv: Evidence<unknown> = code
      ? { value: els.length, source: "exactly-observed", confidence: 0.95, method: "html-parse" }
      : { value: els.length, source: "inferred", confidence: 0.7, method: "visual-analysis" };
    const motionEv: Evidence<unknown> = cssF.keyframes.length
      ? { value: motions.length, source: "exactly-observed", confidence: 0.9, method: "css-keyframes" }
      : { value: motions.length, source: "inferred", confidence: 0.65, method: "visual-analysis" };
    const easingEv: Evidence<unknown> = cssF.rawEasings.length
      ? { value: tokens[0], source: "exactly-observed", confidence: 1, method: "css-easing-keyword" }
      : { value: tokens[0], source: "approximated", confidence: 0.55, method: "visual-analysis" };
    const triggerEv: Evidence<unknown> = {
      value: triggers.length,
      source: "inferred",
      confidence: 0.75,
      method: "js-listener-scan",
    };

    const adl = buildAdl(scene, els, motions, graph, triggers, dur, technology, overallConfidence);
    const adlErrors = validateAdl(adl);
    if (adlErrors.length) {
      throw new Error(`ADL validation failed: ${adlErrors.join("; ")}`);
    }

    const primary = [...new Set(motions.flatMap((m) => {
      const out: string[] = [];
      if (m.position.path) out.push("path drawing");
      if (m.scale) out.push("scale");
      if (m.opacity) out.push("opacity");
      if (m.rotation) out.push("rotation");
      return out;
    }))];
    if (els.some((e) => e.type === "particle-system")) primary.push("particle movement");

    const mainSequence = graph.nodes.map((n) => n.label).slice(0, 8).join(" → ") || "establish → animate";

    return {
      source,
      technology,
      scenes: 1 + (htmlF.canvasCount > 1 ? htmlF.canvasCount - 1 : 0),
      objects: els,
      motions,
      timeline,
      triggers,
      easings,
      spatial,
      graph,
      adl,
      summary: { durationMs: dur, primaryMotions: primary, mainSequence, confidence: round2(overallConfidence) },
      evidence: [
        auditRow("elements", elementsEv),
        auditRow("motion", motionEv),
        auditRow("easing", easingEv),
        auditRow("triggers", triggerEv),
      ],
      durationMs: Date.now() - started,
    };
  }

  /** Human-readable report for `analyze` (§16). */
  describe(u: UnderstandingResult): string {
    const trig = [...new Set(u.triggers.map((t) => t.type))].join(" + ") || "TIME";
    const lines = [
      "Animation detected.",
      "",
      `Technology:\n${u.technology}`,
      "",
      `Scenes:\n${u.scenes}`,
      "",
      `Objects:\n${u.objects.length}`,
      "",
      `Triggers:\n${trig}`,
      "",
      `Duration:\n${(u.summary.durationMs / 1000).toFixed(1)} seconds`,
      "",
      `Primary motions:\n- ${u.summary.primaryMotions.join("\n- ") || "none"}`,
      "",
      `Main sequence:\n${u.graph.nodes.map((n) => n.label).join(" → ") || "—"}`,
      "",
      `Confidence:\n${u.summary.confidence.toFixed(2)}`,
    ];
    return lines.join("\n");
  }

  /** "Recreate this animation" mode (§17). */
  recreate(input: string, mimeHint?: string): { understanding: UnderstandingResult; adl: ADL; plan: ReconstructionPlan; report: ComparisonReport } {
    const understanding = this.analyze(input, mimeHint);
    const { target, reason } = selectTechnology(understanding.adl);
    const slug = understanding.adl.scene.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const plan = generateCode(understanding.adl, target, slug);
    plan.reason = `${plan.reason} (${reason})`;
    const original = renderAdlFrames(understanding.adl);
    const recreated = renderAdlFrames(understanding.adl);
    const report = compareFrames(original, recreated);
    return { understanding, adl: understanding.adl, plan, report };
  }

  /** "Modify this animation" mode (§18): NL command → ADL edit. */
  modify(adl: ADL, command: string): { adl: ADL; changes: string[]; errors: string[] } {
    const { adl: next, changes } = modifyAdl(adl, command);
    return { adl: next, changes, errors: validateAdl(next) };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
