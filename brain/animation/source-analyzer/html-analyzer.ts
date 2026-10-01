// HTML analyzer (§2): DOM / SVG / Canvas / WebGL / media / interactive inventory.
// Regex-based so it runs in Node and browsers without a DOM.
import type { HtmlFinding } from "../types";

const TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
const IMG_RE = /<img\b[^>]*src=["']([^"']+)["']/gi;
const VIDEO_RE = /<(video|source)\b[^>]*src=["']([^"']+)["']/gi;
const TEXT_RE = /<(p|h[1-6]|span|a|li|button|label)\b[^>]*>([^<]{1,120})/gi;
const INTERACTIVE_RE = /<(button|a|input|select|textarea|details|summary|form)\b/gi;

export function analyzeHtml(html: string): HtmlFinding {
  const domElements: string[] = [];
  let svgCount = 0;
  let canvasCount = 0;
  let webglSuspected = false;
  const m = html.match(/webgl|getContext\(["']webgl/i);
  if (m) webglSuspected = true;

  TAG_RE.lastIndex = 0;
  let t: RegExpExecArray | null;
  const counts = new Map<string, number>();
  while ((t = TAG_RE.exec(html)) !== null) {
    const tag = t[1].toLowerCase();
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
    if (tag === "svg") svgCount++;
    if (tag === "canvas") canvasCount++;
  }
  for (const [tag, n] of counts) domElements.push(`${tag}×${n}`);

  const images: string[] = [];
  IMG_RE.lastIndex = 0;
  let im: RegExpExecArray | null;
  while ((im = IMG_RE.exec(html)) !== null) images.push(im[1].slice(0, 160));

  const videos: string[] = [];
  VIDEO_RE.lastIndex = 0;
  let v: RegExpExecArray | null;
  while ((v = VIDEO_RE.exec(html)) !== null) videos.push((v[2] ?? v[1]).slice(0, 160));

  const texts: string[] = [];
  TEXT_RE.lastIndex = 0;
  let tx: RegExpExecArray | null;
  while ((tx = TEXT_RE.exec(html)) !== null && texts.length < 24) {
    const clean = tx[2].replace(/\s+/g, " ").trim();
    if (clean) texts.push(clean.slice(0, 80));
  }

  const interactive: string[] = [];
  INTERACTIVE_RE.lastIndex = 0;
  let ix: RegExpExecArray | null;
  while ((ix = INTERACTIVE_RE.exec(html)) !== null && interactive.length < 24) {
    interactive.push(ix[1].toLowerCase());
  }

  return { domElements, svgCount, canvasCount, webglSuspected, images, videos, texts, interactive };
}
