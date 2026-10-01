// Evidence helpers (§20): every important inference carries
// { value, source, confidence, method } so approximations are never
// presented as exact observations.
import type { Evidence, EvidenceKind } from "./types";

export function observed<T>(value: T, method: string, confidence = 1): Evidence<T> {
  return { value, source: "exactly-observed", confidence, method };
}

export function inferred<T>(value: T, method: string, confidence: number): Evidence<T> {
  return { value, source: "inferred", confidence: clamp01(confidence), method };
}

export function approximated<T>(value: T, method: string, confidence: number): Evidence<T> {
  return { value, source: "approximated", confidence: clamp01(confidence), method };
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function kindOf(confidence: number, exact: boolean): EvidenceKind {
  if (exact && confidence >= 0.99) return "exactly-observed";
  if (confidence >= 0.55) return "inferred";
  return "approximated";
}

/** Flatten evidence into the audit rows stored on UnderstandingResult. */
export function auditRow(
  property: string,
  ev: Evidence<unknown>,
): { property: string; source: EvidenceKind; confidence: number; method: string } {
  return { property, source: ev.source, confidence: ev.confidence, method: ev.method };
}
