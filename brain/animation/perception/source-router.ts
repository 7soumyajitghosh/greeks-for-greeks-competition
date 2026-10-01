// Perception layer: classify raw input into an AnimationSource (§1).
// Pure string sniffing — works in browser and Node, no I/O performed here.
import type { AnimationSource } from "../types";

const URL_RE = /^https?:\/\//i;
const IMAGE_SEQ_RE = /(%\d*d|%s|[_-]?\d{3,4}\.(png|jpe?g|webp|avif))|sprite|sequence|frames?\//i;

export function routeSource(input: string, mimeHint?: string): AnimationSource {
  const s = input.trim();
  const mime = (mimeHint ?? "").toLowerCase();

  if (mime.includes("gif") || /\.gif(\?|#|$)/i.test(s)) {
    return { type: "gif", source: input, mimeHint };
  }
  if (mime.includes("mp4") || mime.includes("webm") || /\.(mp4|webm|mov)(\?|#|$)/i.test(s)) {
    return { type: s.length < 4096 && looksLikeCode(s) ? "code" : "video", source: input, mimeHint };
  }
  if (URL_RE.test(s) && !looksLikeCode(s)) {
    return { type: "website", source: input, mimeHint };
  }
  if (IMAGE_SEQ_RE.test(s) || (/,/.test(s) && /\.(png|jpe?g|webp)/i.test(s))) {
    return { type: "image-sequence", source: input, mimeHint };
  }
  if (looksLikeScreenRecording(s, mime)) {
    return { type: "screen-recording", source: input, mimeHint };
  }
  if (looksLikeCode(s)) {
    return { type: "code", source: input, mimeHint };
  }
  // Local website directory / html file fallback
  if (/\.html?(\?|#|$)/i.test(s) || /\/$/.test(s) || /^[.\/\\]/.test(s)) {
    return { type: "website", source: input, mimeHint };
  }
  return { type: "code", source: input, mimeHint };
}

function looksLikeCode(s: string): boolean {
  return /<(html|div|svg|canvas|style|script)\b/i.test(s) || /@(keyframes|media)\b/.test(s) || /\.(html|css|js|ts|tsx|svg)\b/.test(s.slice(0, 512));
}

function looksLikeScreenRecording(s: string, mime: string): boolean {
  if (/screen.?recording|replay|session/i.test(s)) return true;
  if (mime.includes("webm") && /record/i.test(s)) return true;
  return /\.(webm|mkv)(\?|#|$)/i.test(s) && s.length < 512 && !looksLikeCode(s);
}

/** Human-readable technology guess used before deep analysis. */
export function guessTechnologyHint(src: AnimationSource): string {
  const s = src.source;
  if (src.type === "gif") return "GIF (frame sequence)";
  if (src.type === "video" || src.type === "screen-recording") return "video frames (visual-analysis)";
  if (src.type === "image-sequence") return "image sequence (visual-analysis)";
  if (/\bgsap\b/i.test(s)) return "GSAP";
  if (/framer-?motion/i.test(s)) return "Framer Motion";
  if (/\banime(\.js|\b)/i.test(s)) return "Anime.js";
  if (/motion\s*\(|motion\.dev/i.test(s)) return "Motion";
  if (/three\.js|\bTHREE\b|webgl/i.test(s)) return "Three.js/WebGL";
  if (/<canvas/i.test(s)) return "Canvas 2D";
  if (/<svg/i.test(s)) return "SVG + CSS";
  if (/@keyframes/i.test(s)) return "CSS keyframes";
  return "unknown (code/visual analysis required)";
}
