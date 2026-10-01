/**
 * Report rendering: terminal output plus JSON / CSV export.
 *
 * CSV files follow the logpai/logparser conventions:
 *   templates.csv    — EventId, EventTemplate, Occurrences
 *   structured.csv   — LineId, Timestamp, Level, TemplateId, EventTemplate, ParameterList
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisResult, Issue, LogEvent, LogTemplate } from './types.js';
import { LEVEL_ORDER } from './types.js';

const COLOR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

export function colorize(enabled: boolean): (text: string, color: string) => string {
  if (!enabled) return (text) => text;
  return (text, color) => `${color}${text}${COLOR.reset}`;
}

function fmtTime(ts: number | null): string {
  if (ts === null) return '—';
  return new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

const LEVEL_COLOR: Record<string, string> = {
  debug: COLOR.dim,
  info: COLOR.green,
  warn: COLOR.yellow,
  error: COLOR.red,
  fatal: COLOR.magenta,
};

export interface ReportOptions {
  top?: number;
  color?: boolean;
}

/** Render the full terminal report for one analyzed file. */
export function renderReport(result: AnalysisResult, opts: ReportOptions = {}): string {
  const top = opts.top ?? 10;
  const useColor = opts.color ?? true;
  const c = colorize(useColor);
  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  const rule = '═'.repeat(72);
  const thin = '─'.repeat(72);

  push(c(` ${rule}`, COLOR.bold));
  push(c(` LogScope report — ${result.file}`, COLOR.bold));
  push(c(` ${rule}`, COLOR.bold));
  push();

  const { start, end } = result.timeRange;
  push(` Time range : ${fmtTime(start)} → ${fmtTime(end)}`);
  push(` Lines      : ${fmtNum(result.totalLines)} (${fmtNum(result.parsedLines)} parsed)`);
  const levelStr = LEVEL_ORDER
    .filter((l) => result.levelCounts[l] > 0)
    .map((l) => {
      const col = LEVEL_COLOR[l] ?? COLOR.reset;
      return c(`${l} ${fmtNum(result.levelCounts[l])}`, col);
    })
    .join(' | ');
  push(` Levels     : ${levelStr}`);
  push(` Templates  : ${fmtNum(result.templates.length)}`);
  const newCount = result.issues.filter((i) => i.isNew).length;
  push(` Issues     : ${fmtNum(result.issues.length)}${newCount > 0 ? c(` (${newCount} new)`, COLOR.yellow) : ''}`);
  push(` Anomalies  : ${result.anomalies.length > 0 ? c(String(result.anomalies.length), COLOR.red) : '0'}`);
  push();

  // ---- Top issues ----
  const issues = result.issues.slice(0, top);
  if (issues.length > 0) {
    push(c(` ${thin}`, COLOR.dim));
    push(c(` Top issues`, COLOR.bold));
    push(c(` ${thin}`, COLOR.dim));
    push(
      c(' #   ', COLOR.dim) + 'Count  Level   First seen          Last seen            Title',
    );
    issues.forEach((issue, idx) => {
      const col = LEVEL_COLOR[issue.level] ?? COLOR.reset;
      const flag = issue.isNew ? c(' ★', COLOR.yellow) : '  ';
      push(
        `${String(idx + 1).padStart(2)} ${flag} ${String(issue.count).padStart(5)}  ` +
          c(issue.level.toUpperCase().padEnd(7), col) +
          ` ${fmtTime(issue.firstSeen).slice(5, 19)}   ${fmtTime(issue.lastSeen).slice(5, 19)}   ` +
          truncate(issue.title, 46),
      );
    });
    if (result.issues.length > top) {
      push(c(` … and ${result.issues.length - top} more (use --json for the full list)`, COLOR.dim));
    }
    push();
  }

  // ---- Anomalies ----
  if (result.anomalies.length > 0) {
    push(c(` ${thin}`, COLOR.dim));
    push(c(` Anomalies`, COLOR.bold));
    push(c(` ${thin}`, COLOR.dim));
    for (const a of result.anomalies) {
      const icon = a.type === 'spike' ? '⚡' : a.type === 'new_template' ? '★' : '▲';
      const col = a.severity === 'high' ? COLOR.red : a.severity === 'medium' ? COLOR.yellow : COLOR.dim;
      push(` ${c(icon, col)} ${c(a.type.replace('_', ' ').toUpperCase(), col)}  ${a.message}`);
      push(c(`   ${a.detail}`, COLOR.dim));
    }
    push();
  }

  // ---- Error sparkline ----
  const errorBuckets = new Map<string, number>();
  for (const issue of result.issues) {
    for (const b of issue.timeline) {
      errorBuckets.set(b.bucket, (errorBuckets.get(b.bucket) ?? 0) + b.count);
    }
  }
  if (errorBuckets.size > 0) {
    const sorted = [...errorBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const counts = sorted.map(([, n]) => n);
    const max = Math.max(...counts);
    const bar = counts
      .map((n) => '█'.repeat(Math.max(1, Math.round((n / max) * 40))))
      .join('');
    push(c(` ${thin}`, COLOR.dim));
    push(c(` Errors per minute (all issues)`, COLOR.bold));
    push(c(` ${bar}`, COLOR.red));
    push(c(` ${sorted[0]![0]} → ${sorted[sorted.length - 1]![0]}`, COLOR.dim));
    push();
  }

  push(c(` ${rule}`, COLOR.bold));
  return lines.join('\n');
}

/** Export the full result as JSON. */
export function exportJson(result: AnalysisResult, path: string): void {
  writeFileSync(path, JSON.stringify(result, null, 2), 'utf8');
}

/** Export logparser-compatible templates.csv + structured.csv. */
export function exportCsv(
  result: AnalysisResult,
  events: LogEvent[],
  templates: LogTemplate[],
  eventTemplateId: Map<number, string>,
  dir: string,
): void {
  mkdirSync(dir, { recursive: true });

  const templateById = new Map(templates.map((t) => [t.id, t]));
  const sorted = [...templates].sort((a, b) => b.count - a.count);

  const csvEscape = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  const templatesCsv = [
    'EventId,EventTemplate,Occurrences',
    ...sorted.map((t) => `${t.id},${csvEscape(t.template)},${t.count}`),
  ].join('\n');
  writeFileSync(join(dir, 'templates.csv'), templatesCsv + '\n', 'utf8');

  const structuredCsv = [
    'LineId,Timestamp,Level,TemplateId,EventTemplate,ParameterList',
    ...events.map((e) => {
      const tid = eventTemplateId.get(e.id) ?? '';
      const tpl = templateById.get(tid);
      const ts = e.timestamp !== null ? new Date(e.timestamp).toISOString() : '';
      const params = tpl && tpl.parameters.length > 0 ? JSON.stringify(tpl.parameters[0]) : '';
      return `${e.id},${ts},${e.level},${tid},${csvEscape(tpl?.template ?? e.message)},${csvEscape(params)}`;
    }),
  ].join('\n');
  writeFileSync(join(dir, 'structured.csv'), structuredCsv + '\n', 'utf8');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
