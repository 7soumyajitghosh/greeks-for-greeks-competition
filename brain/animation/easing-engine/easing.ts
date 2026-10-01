// Easing understanding (§7): recognize or estimate motion curves.
// Exact when parsed from CSS/GSAP params; otherwise closest-curve estimate
// with confidence < 1 and approximated=true. Never claim exactness falsely.
import { approximated, observed } from "../evidence";
import type { EasingInfo, Evidence } from "../types";

const NAMED: Record<string, EasingInfo["type"]> = {
  linear: "linear",
  ease: "ease-in-out",
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",
};

const BEZIER_PRESETS: Array<{ params: number[]; type: EasingInfo["type"] }> = [
  { params: [0.22, 1, 0.36, 1], type: "ease-out" },
  { params: [0.42, 0, 1, 1], type: "ease-in" },
  { params: [0.42, 0, 0.58, 1], type: "ease-in-out" },
  { params: [0, 0, 1, 1], type: "linear" },
];

export function parseEasingToken(token: string): Evidence<EasingInfo> {
  const t = token.trim().toLowerCase();
  const named = NAMED[t];
  if (named) return observed({ type: named, confidence: 1, approximated: false }, "css-easing-keyword");

  const bez = t.match(/cubic-bezier\(\s*([0-9.\-,\s]+)\)/);
  if (bez) {
    const params = bez[1].split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
    if (params.length === 4) {
      const closest = closestPreset(params);
      return observed(
        { type: "cubic-bezier", parameters: params, confidence: 1, approximated: false },
        `css-cubic-bezier→${closest}`,
      );
    }
  }
  const steps = t.match(/steps\(/);
  if (steps) return observed({ type: "custom", parameters: [], confidence: 1, approximated: false }, "css-steps");

  if (/elastic/i.test(t)) return observed({ type: "elastic", confidence: 1, approximated: false }, "lib-easing");
  if (/bounce/i.test(t)) return observed({ type: "bounce", confidence: 1, approximated: false }, "lib-easing");
  if (/spring/i.test(t)) return observed({ type: "spring", confidence: 1, approximated: false }, "lib-easing");

  // Unknown token → closest estimate, explicitly approximated.
  return approximated({ type: "ease-out", confidence: 0.55, approximated: true }, "visual-analysis", 0.55);
}

/** Estimate easing from JS library hints when no CSS token exists. */
export function estimateFromJs(jsSource: string): Evidence<EasingInfo> {
  const s = jsSource.toLowerCase();
  if (/elastic/.test(s)) return approximated({ type: "elastic", confidence: 0.78, approximated: true }, "visual-analysis", 0.78);
  if (/bounce/.test(s)) return approximated({ type: "bounce", confidence: 0.78, approximated: true }, "visual-analysis", 0.78);
  if (/spring/.test(s)) return approximated({ type: "spring", confidence: 0.8, approximated: true }, "visual-analysis", 0.8);
  if (/power\d|expo|circ/.test(s)) return approximated({ type: "ease-out", confidence: 0.7, approximated: true }, "gsap-ease-hint", 0.7);
  return approximated({ type: "ease-in-out", confidence: 0.5, approximated: true }, "visual-analysis", 0.5);
}

function closestPreset(params: number[]): string {
  let best = "custom";
  let bestD = Infinity;
  for (const p of BEZIER_PRESETS) {
    const d = p.params.reduce((acc, v, i) => acc + Math.abs(v - (params[i] ?? 0)), 0);
    if (d < bestD) {
      bestD = d;
      best = p.type;
    }
  }
  return bestD < 0.15 ? best : "custom";
}
