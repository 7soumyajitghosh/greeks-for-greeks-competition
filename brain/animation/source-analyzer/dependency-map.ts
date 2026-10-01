// Dependency map between HTML / CSS / JS animation systems (§2).
import type { CssFinding, DependencyMap, HtmlFinding, JsFinding } from "../types";

export function buildDependencyMap(html: HtmlFinding, css: CssFinding, js: JsFinding): DependencyMap {
  const htmlToCss = css.keyframes.map((k) => ({ element: "dom", animation: `keyframes:${k}` }));
  for (const a of css.animations.slice(0, 8)) htmlToCss.push({ element: "dom", animation: a.slice(0, 60) });

  const cssToJs: DependencyMap["cssToJs"] = [];
  for (const lib of js.libraries) {
    if (lib === "none") continue;
    cssToJs.push({ animation: "css-animations", controller: lib });
  }
  if (js.usesScrollListener) cssToJs.push({ animation: "scroll-driven", controller: "scroll-listener" });
  if (js.usesIntersectionObserver) cssToJs.push({ animation: "reveal", controller: "IntersectionObserver" });

  const jsToCanvas: DependencyMap["jsToCanvas"] = [];
  if (js.usesCanvas) jsToCanvas.push({ controller: "rAF-loop", target: "canvas-2d" });
  if (js.usesWebGL) jsToCanvas.push({ controller: "render-loop", target: "webgl" });
  if (html.canvasCount > 0 && js.usesRequestAnimationFrame) {
    jsToCanvas.push({ controller: "rAF-loop", target: `canvas×${html.canvasCount}` });
  }

  const notes: string[] = [];
  if (html.svgCount > 0) notes.push(`${html.svgCount} SVG scope(s) — path-drawing / transform animations likely`);
  if (css.keyframes.length > 0) notes.push(`${css.keyframes.length} keyframe set(s) drive declarative motion`);
  if (js.libraries.includes("gsap")) notes.push("GSAP timelines control sequencing");
  if (js.libraries.includes("framer-motion")) notes.push("Framer Motion variants control mount/presence motion");
  if (js.usesScrollListener || js.usesIntersectionObserver) notes.push("Scroll/visibility triggers gate playback");

  return { htmlToCss, cssToJs, jsToCanvas, notes };
}
