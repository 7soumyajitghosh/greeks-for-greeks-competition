// CSS analyzer (§2): transitions, keyframes, transforms, opacity, filters,
// clip-path, gradients, masks, pseudo-elements, raw easing tokens.
import type { CssFinding } from "../types";

export function analyzeCss(css: string): CssFinding {
  const keyframes = [...css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  const transitions = [...css.matchAll(/transition\s*:\s*([^;]+);/gi)].map((m) => m[1].trim().slice(0, 120));
  const transforms = [...css.matchAll(/(transform)\s*:\s*([^;]+);/gi)].map((m) => m[2].trim().slice(0, 120));
  const animations = [...css.matchAll(/(?:^|[{\s])animation\s*:\s*([^;]+);/gi)].map((m) => m[1].trim().slice(0, 120));
  const pseudoElements = [...new Set([...css.matchAll(/::?(before|after|marker|placeholder|selection)/gi)].map((m) => `::${m[1].toLowerCase()}`))];
  const rawEasings = [...css.matchAll(/(cubic-bezier\([^)]+\)|steps\([^)]+\)|\bease(?:-in-out|-in|-out)?\b|\blinear\b)/gi)].map(
    (m) => m[1].toLowerCase(),
  );
  const count = (re: RegExp): number => css.match(re)?.length ?? 0;
  return {
    transitions,
    keyframes,
    transforms,
    animations,
    opacityUses: count(/opacity\s*:/gi),
    filterUses: count(/filter\s*:/gi),
    clipPathUses: count(/clip-path\s*:/gi),
    gradientUses: count(/(linear|radial|conic)-gradient\(/gi),
    maskUses: count(/(mask|mask-image)\s*:/gi),
    pseudoElements,
    rawEasings,
  };
}
