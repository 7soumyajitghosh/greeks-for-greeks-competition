// Visual element detection (§3): build a stable element tree with internal IDs.
// Heuristic but deterministic: same input → same ids. Works from HTML findings
// plus optional semantic hints (e.g. "love seed / soil / roots / trunk …").
import type { HtmlFinding, Point, VisualElement } from "../types";

let n = 0;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || `node-${n++}`;
}

export interface DetectOptions {
  scene?: string;
  /** e.g. ["love-seed","soil","roots","trunk","branches","leaves","hearts","particles"] */
  semanticHints?: string[];
  viewport?: { w: number; h: number };
}

export function detectElements(html: HtmlFinding, opts: DetectOptions = {}): VisualElement[] {
  const scene = slug(opts.scene ?? "scene");
  const W = opts.viewport?.w ?? 480;
  const H = opts.viewport?.h ?? 360;
  const els: VisualElement[] = [];

  const push = (
    id: string,
    type: string,
    parent: string | null,
    position: Point,
    w: number,
    h: number,
    confidence: number,
    properties: Record<string, string | number | boolean> = {},
  ): VisualElement => {
    const el: VisualElement = { id, type, parent, children: [], position, size: { w, h }, properties, confidence };
    els.push(el);
    if (parent) {
      const p = els.find((e) => e.id === parent);
      if (p && !p.children.includes(id)) p.children.push(id);
    }
    return el;
  };

  // Root
  push(scene, "scene", null, { x: W / 2, y: H / 2 }, W, H, 1, { viewport: `${W}x${H}` });

  if (opts.semanticHints?.length) {
    // Deterministic vertical-growth layout for organic scenes (seed → tree …).
    const hints = opts.semanticHints;
    let y = H * 0.85;
    const step = (H * 0.7) / Math.max(1, hints.length - 1);
    hints.forEach((hint, i) => {
      const id = `${scene}.${slug(hint)}`;
      const type = /particle/i.test(hint) ? "particle-system" : /heart/i.test(hint) ? "shape" : "shape";
      push(id, type, scene, { x: W / 2 + (i % 2 === 0 ? -8 : 8), y }, 40, 40, 0.72, { semantic: hint });
      y -= step;
    });
    void y;
    return els;
  }

  // Generic: one node per SVG / canvas / image / video + interactive landmarks.
  let i = 0;
  for (let k = 0; k < html.svgCount; k++) {
    i++;
    push(`${scene}.svg-${k}`, "svg-node", scene, { x: W / 2, y: H / 2 }, 120, 90, 0.9, { index: k });
  }
  for (let k = 0; k < html.canvasCount; k++) {
    push(`${scene}.canvas-${k}`, "canvas-layer", scene, { x: W / 2, y: H / 2 }, W, H, 0.95, { index: k });
  }
  html.images.slice(0, 12).forEach((src, k) => {
    push(`${scene}.img-${k}`, "image", scene, { x: 60 + (k % 4) * 110, y: 70 + Math.floor(k / 4) * 90 }, 96, 72, 0.85, { src: src.slice(0, 80) });
  });
  html.videos.slice(0, 4).forEach((src, k) => {
    push(`${scene}.video-${k}`, "video", scene, { x: W / 2, y: H / 2 }, 200, 140, 0.9, { src: src.slice(0, 80) });
  });
  void i;
  return els;
}
