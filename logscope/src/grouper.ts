/**
 * Issue grouping, Sentry/Airbroke style.
 *
 * Error (and optionally warning) events are grouped by a fingerprint derived
 * from their log template — the same "group similar errors" idea that Sentry
 * and Airbroke use to collapse thousands of raw events into a handful of
 * actionable issues. Each issue tracks count, first/last seen, a per-minute
 * timeline, sample events, and whether it looks newly introduced.
 */

import type { Anomaly, Issue, LogEvent, LogTemplate, LogLevel } from './types.js';
import { levelRank } from './types.js';

export interface GroupOptions {
  /** also group warnings into issues (default: false — errors only) */
  includeWarn?: boolean;
  /** max sample lines kept per issue (default 5) */
  maxSamples?: number;
  /** timeline bucket size in minutes (default 1) */
  bucketMinutes?: number;
}

/** FNV-1a — small, fast, dependency-free fingerprint. */
export function fingerprint(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const SPARK = '▁▂▃▄▅▆▇█';

function sparkline(counts: number[]): string {
  const max = Math.max(...counts, 1);
  return counts.map((c) => {
    const idx = Math.min(SPARK.length - 1, Math.round((c / max) * (SPARK.length - 1)));
    return SPARK[idx];
  }).join('');
}

function bucketKey(ts: number, bucketMinutes: number): string {
  const d = new Date(ts);
  const mins = Math.floor(d.getMinutes() / bucketMinutes) * bucketMinutes;
  d.setMinutes(mins, 0, 0);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export function groupIssues(
  events: LogEvent[],
  templates: LogTemplate[],
  eventTemplateId: Map<number, string>,
  opts: GroupOptions = {},
): Issue[] {
  const includeWarn = opts.includeWarn ?? false;
  const maxSamples = opts.maxSamples ?? 5;
  const bucketMinutes = opts.bucketMinutes ?? 1;

  const minLevel: LogLevel = includeWarn ? 'warn' : 'error';
  const templateById = new Map(templates.map((t) => [t.id, t]));

  interface Accum {
    fingerprint: string;
    title: string;
    level: LogLevel;
    count: number;
    firstSeen: number | null;
    lastSeen: number | null;
    buckets: Map<string, number>;
    samples: string[];
    firstEventTs: number | null;
  }

  const groups = new Map<string, Accum>();

  for (const e of events) {
    if (levelRank(e.level) < levelRank(minLevel)) continue;
    const tid = eventTemplateId.get(e.id);
    const tpl = tid ? templateById.get(tid) : undefined;
    const title = tpl ? tpl.template : e.message;
    const fp = fingerprint(`${e.level}::${title}`);

    let g = groups.get(fp);
    if (!g) {
      g = {
        fingerprint: fp,
        title,
        level: e.level,
        count: 0,
        firstSeen: null,
        lastSeen: null,
        buckets: new Map(),
        samples: [],
        firstEventTs: null,
      };
      groups.set(fp, g);
    }
    g.count++;
    if (e.timestamp !== null) {
      if (g.firstSeen === null || e.timestamp < g.firstSeen) g.firstSeen = e.timestamp;
      if (g.lastSeen === null || e.timestamp > g.lastSeen) g.lastSeen = e.timestamp;
      const key = bucketKey(e.timestamp, bucketMinutes);
      g.buckets.set(key, (g.buckets.get(key) ?? 0) + 1);
    }
    if (g.samples.length < maxSamples) g.samples.push(e.raw);
  }

  // Time range across all events, to judge which issues are "new".
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  for (const e of events) {
    if (e.timestamp === null) continue;
    if (rangeStart === null || e.timestamp < rangeStart) rangeStart = e.timestamp;
    if (rangeEnd === null || e.timestamp > rangeEnd) rangeEnd = e.timestamp;
  }
  const span = rangeStart !== null && rangeEnd !== null ? rangeEnd - rangeStart : 0;

  const issues: Issue[] = [];
  for (const g of groups.values()) {
    const sortedBuckets = [...g.buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const counts = sortedBuckets.map(([, c]) => c);
    const isNew =
      g.firstSeen !== null &&
      span > 0 &&
      rangeEnd !== null &&
      g.firstSeen >= rangeEnd - span * 0.1 &&
      g.count >= 3;

    issues.push({
      id: g.fingerprint,
      fingerprint: g.fingerprint,
      title: g.title,
      level: g.level,
      count: g.count,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
      timeline: sortedBuckets.map(([bucket, count]) => ({ bucket, count })),
      samples: g.samples,
      isNew,
      sparkline: sparkline(counts),
    });
  }

  issues.sort((a, b) => b.count - a.count || (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  return issues;
}

/**
 * Anomaly detection, inspired by the log-mining literature curated in
 * logpai/awesome-log-analysis:
 *   - spike: per-minute error rate far above the mean (z-score)
 *   - new_template: a template that only appears late in the trace
 *   - error_surge: recent error rate far above the overall rate
 */
export function detectAnomalies(
  events: LogEvent[],
  templates: LogTemplate[],
  issues: Issue[],
  opts: { zThreshold?: number; newTemplateMinCount?: number } = {},
): Anomaly[] {
  const zThreshold = opts.zThreshold ?? 3;
  const newTemplateMinCount = opts.newTemplateMinCount ?? 3;
  const anomalies: Anomaly[] = [];

  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  for (const e of events) {
    if (e.timestamp === null) continue;
    if (rangeStart === null || e.timestamp < rangeStart) rangeStart = e.timestamp;
    if (rangeEnd === null || e.timestamp > rangeEnd) rangeEnd = e.timestamp;
  }
  if (rangeStart === null || rangeEnd === null || rangeEnd <= rangeStart) return anomalies;

  // ---- 1. Error spike detection (z-score on per-minute error counts) ----
  const perMinute = new Map<string, number>();
  for (const e of events) {
    if (e.timestamp === null || levelRank(e.level) < levelRank('error')) continue;
    const key = bucketKey(e.timestamp, 1);
    perMinute.set(key, (perMinute.get(key) ?? 0) + 1);
  }
  if (perMinute.size >= 3) {
    const counts = [...perMinute.values()];
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const std = Math.sqrt(variance);
    if (std > 0) {
      for (const [bucket, count] of perMinute) {
        const z = (count - mean) / std;
        if (z >= zThreshold) {
          anomalies.push({
            type: 'spike',
            severity: z >= zThreshold * 1.5 ? 'high' : 'medium',
            message: `Error spike at ${bucket} — ${count} errors/min (z-score ${z.toFixed(1)})`,
            at: Date.parse(bucket.replace(' ', 'T') + ':00Z'),
            detail: `mean ${mean.toFixed(1)}/min, stddev ${std.toFixed(1)}`,
          });
        }
      }
    }
  }

  // ---- 2. New template detection ----
  const span = rangeEnd - rangeStart;
  for (const t of templates) {
    if (t.firstSeen === null || t.count < newTemplateMinCount) continue;
    if (t.firstSeen >= rangeEnd - span * 0.1) {
      anomalies.push({
        type: 'new_template',
        severity: t.level === 'error' || t.level === 'fatal' ? 'high' : 'medium',
        message: `New log pattern first seen late in the trace: "${truncate(t.template, 80)}"`,
        at: t.firstSeen,
        detail: `${t.count} occurrences, all in the last 10% of the time range`,
      });
    }
  }

  // ---- 3. Error surge: last 5 minutes vs overall rate ----
  const windowMs = 5 * 60 * 1000;
  let totalErrors = 0;
  let windowErrors = 0;
  for (const e of events) {
    if (e.timestamp === null || levelRank(e.level) < levelRank('error')) continue;
    totalErrors++;
    if (e.timestamp >= rangeEnd - windowMs) windowErrors++;
  }
  const totalMinutes = Math.max(1, (rangeEnd - rangeStart) / 60000);
  const overallRate = totalErrors / totalMinutes;
  const windowRate = windowErrors / Math.min(5, totalMinutes);
  if (overallRate > 0 && windowRate > overallRate * 3 && windowErrors >= 5) {
    anomalies.push({
      type: 'error_surge',
      severity: 'high',
      message: `Error rate surged: ${windowRate.toFixed(1)}/min in the last 5 min vs ${overallRate.toFixed(1)}/min overall`,
      at: rangeEnd,
      detail: `${windowErrors} errors in the final window`,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  anomalies.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.at ?? 0) - (a.at ?? 0));
  return anomalies;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
