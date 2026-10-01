/**
 * Analysis pipeline: file -> lines -> events -> templates -> issues -> anomalies.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { AnalysisResult, LogEvent, LogLevel } from './types.js';
import { LEVEL_ORDER, levelRank } from './types.js';
import { parseLines, type LogFormat } from './parser.js';
import { extractTemplates } from './drain.js';
import { detectAnomalies, groupIssues } from './grouper.js';

export interface AnalyzeOptions {
  format?: LogFormat;
  /** drop events below this level before analysis (default: debug = keep all) */
  minLevel?: LogLevel;
  depth?: number;
  simThreshold?: number;
  includeWarn?: boolean;
}

/** Stream a file line by line (memory-efficient for large logs). */
export async function* readLines(path: string): AsyncGenerator<string> {
  const rl = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) yield line;
}

export async function analyzeFile(path: string, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
  const started = performance.now();

  const lines: string[] = [];
  for await (const line of readLines(path)) lines.push(line);

  const totalLines = lines.length;
  let events = parseLines(lines, opts.format ?? 'auto');

  const minLevel = opts.minLevel ?? 'debug';
  if (minLevel !== 'debug') {
    events = events.filter((e) => levelRank(e.level) >= levelRank(minLevel));
  }

  const { templates, eventTemplateId } = extractTemplates(events, {
    depth: opts.depth,
    simThreshold: opts.simThreshold,
  });

  const issues = groupIssues(events, templates, eventTemplateId, {
    includeWarn: opts.includeWarn,
  });

  const anomalies = detectAnomalies(events, templates, issues);

  const levelCounts = Object.fromEntries(LEVEL_ORDER.map((l) => [l, 0])) as Record<LogLevel, number>;
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  for (const e of events) {
    levelCounts[e.level]++;
    if (e.timestamp !== null) {
      if (rangeStart === null || e.timestamp < rangeStart) rangeStart = e.timestamp;
      if (rangeEnd === null || e.timestamp > rangeEnd) rangeEnd = e.timestamp;
    }
  }

  return {
    file: path,
    totalLines,
    parsedLines: events.length,
    timeRange: { start: rangeStart, end: rangeEnd },
    levelCounts,
    templates,
    issues,
    anomalies,
    durationMs: performance.now() - started,
  };
}

/** Analyze several files and merge them into one result set. */
export async function analyzeFiles(paths: string[], opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
  const results: AnalysisResult[] = [];
  for (const p of paths) results.push(await analyzeFile(p, opts));

  if (results.length === 1) return results[0]!;

  // Merge: concatenate events conceptually by re-deriving from parts.
  const levelCounts = Object.fromEntries(LEVEL_ORDER.map((l) => [l, 0])) as Record<LogLevel, number>;
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  let totalLines = 0;
  let parsedLines = 0;
  for (const r of results) {
    totalLines += r.totalLines;
    parsedLines += r.parsedLines;
    for (const l of LEVEL_ORDER) levelCounts[l] += r.levelCounts[l];
    if (r.timeRange.start !== null && (rangeStart === null || r.timeRange.start < rangeStart)) {
      rangeStart = r.timeRange.start;
    }
    if (r.timeRange.end !== null && (rangeEnd === null || r.timeRange.end > rangeEnd)) {
      rangeEnd = r.timeRange.end;
    }
  }

  // Re-run grouping/anomaly detection over the union of templates+issues is not
  // meaningful across files, so merge templates by id and issues by fingerprint.
  const templateMap = new Map<string, (typeof results)[number]['templates'][number]>();
  for (const r of results) {
    for (const t of r.templates) {
      const existing = templateMap.get(t.id);
      if (existing) {
        existing.count += t.count;
        if (t.firstSeen !== null && (existing.firstSeen === null || t.firstSeen < existing.firstSeen)) {
          existing.firstSeen = t.firstSeen;
        }
        if (t.lastSeen !== null && (existing.lastSeen === null || t.lastSeen > existing.lastSeen)) {
          existing.lastSeen = t.lastSeen;
        }
      } else {
        templateMap.set(t.id, { ...t });
      }
    }
  }

  const issueMap = new Map<string, (typeof results)[number]['issues'][number]>();
  for (const r of results) {
    for (const i of r.issues) {
      const existing = issueMap.get(i.fingerprint);
      if (existing) {
        existing.count += i.count;
        existing.timeline = [...existing.timeline, ...i.timeline];
        existing.samples = [...existing.samples, ...i.samples].slice(0, 5);
        existing.isNew = existing.isNew || i.isNew;
        if (i.firstSeen !== null && (existing.firstSeen === null || i.firstSeen < existing.firstSeen)) {
          existing.firstSeen = i.firstSeen;
        }
        if (i.lastSeen !== null && (existing.lastSeen === null || i.lastSeen > existing.lastSeen)) {
          existing.lastSeen = i.lastSeen;
        }
      } else {
        issueMap.set(i.fingerprint, { ...i, timeline: [...i.timeline], samples: [...i.samples] });
      }
    }
  }

  const issues = [...issueMap.values()].sort((a, b) => b.count - a.count);
  const anomalies = results.flatMap((r) => r.anomalies);

  return {
    file: paths.join(', '),
    totalLines,
    parsedLines,
    timeRange: { start: rangeStart, end: rangeEnd },
    levelCounts,
    templates: [...templateMap.values()].sort((a, b) => b.count - a.count),
    issues,
    anomalies,
    durationMs: results.reduce((a, r) => a + r.durationMs, 0),
  };
}

export type { LogEvent };
