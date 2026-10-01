/**
 * Shared types for LogScope.
 *
 * Vocabulary is borrowed from the projects that inspired this tool:
 * - "template" / "parameters"  <- logpai/logparser (Drain)
 * - "issue" / "fingerprint"    <- getsentry/sentry, icoretech/airbroke
 * - "anomaly"                  <- logpai/awesome-log-analysis
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

export function levelRank(level: LogLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

/** A single parsed log line. */
export interface LogEvent {
  id: number;
  /** epoch ms, null when the line had no recognizable timestamp */
  timestamp: number | null;
  level: LogLevel;
  /** the message part of the line (timestamp/level prefixes removed) */
  message: string;
  /** the original raw line */
  raw: string;
  /** logger / module / process name when one could be extracted */
  source: string | null;
}

/** A log event template extracted by the Drain-style parser. */
export interface LogTemplate {
  id: string;
  /** human-readable template, parameter positions replaced with `<*>` */
  template: string;
  /** template tokens; parameter positions hold `<*>` */
  tokens: string[];
  count: number;
  level: LogLevel;
  firstSeen: number | null;
  lastSeen: number | null;
  /** one raw example line that produced this template */
  sample: string;
  /** parameter values collected across occurrences (capped) */
  parameters: string[][];
}

/** A Sentry/Airbroke-style group of similar error events. */
export interface Issue {
  id: string;
  fingerprint: string;
  title: string;
  level: LogLevel;
  count: number;
  firstSeen: number | null;
  lastSeen: number | null;
  /** per-minute buckets, chronological */
  timeline: { bucket: string; count: number }[];
  /** up to N raw sample lines */
  samples: string[];
  /** true when the issue first appeared in the last 10% of the time range */
  isNew: boolean;
  /** ASCII sparkline of the timeline */
  sparkline: string;
}

export type AnomalyType = 'spike' | 'new_template' | 'error_surge';

export interface Anomaly {
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  at: number | null;
  detail: string;
}

export interface AnalysisResult {
  file: string;
  totalLines: number;
  parsedLines: number;
  timeRange: { start: number | null; end: number | null };
  levelCounts: Record<LogLevel, number>;
  templates: LogTemplate[];
  issues: Issue[];
  anomalies: Anomaly[];
  durationMs: number;
}
