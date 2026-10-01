// JS analyzer (§2): animation libraries + runtime mechanisms.
import type { JsFinding } from "../types";

export function analyzeJs(js: string): JsFinding {
  const has = (re: RegExp): boolean => re.test(js);
  const libraries: JsFinding["libraries"] = [];
  if (has(/gsap/i)) libraries.push("gsap");
  if (has(/framer-?motion|from\s+["']framer-motion["']/i)) libraries.push("framer-motion");
  if (has(/anime(\.js|min\.js)?|anime\s*\(/i)) libraries.push("anime.js");
  if (has(/from\s+["']motion["']|motion\.dev/i)) libraries.push("motion");
  if (has(/three(\.js|\.min\.js)?|\bTHREE\b/i)) libraries.push("three.js");
  if (has(/\.animate\s*\(|AnimationPlayer|document\.timeline|Element\.animate/i)) libraries.push("wapi");
  if (!libraries.length) libraries.push("none");

  const customEvents = [...new Set([...js.matchAll(/dispatchEvent\s*\(\s*new\s+(?:Custom)?Event\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1]))].slice(0, 16);

  return {
    libraries,
    usesRequestAnimationFrame: has(/requestAnimationFrame/i),
    usesIntersectionObserver: has(/IntersectionObserver/i),
    usesScrollListener: has(/addEventListener\s*\(\s*["']scroll["']|onscroll|useScroll|useInView/i),
    usesPointerEvents: has(/pointer(move|down|up|enter)|onPointer/i),
    usesMouseEvents: has(/mouse(move|enter|leave|down|up)|onMouse/i),
    usesTouchEvents: has(/touch(start|move|end)|onTouch/i),
    usesCanvas: has(/getContext\s*\(\s*["']2d["']|<canvas|Canvas/i),
    usesWebGL: has(/getContext\s*\(\s*["']webgl|WebGLRenderer|\bTHREE\b/i),
    customEvents,
  };
}
