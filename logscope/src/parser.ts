/**
 * Log line parser.
 *
 * Auto-detects common log shapes and normalizes them into LogEvent objects:
 *   - JSON logs            ({"time":..., "level":..., "msg":...})
 *   - ISO timestamps       (2024-01-15 10:23:45,123 [ERROR] app: message)
 *   - syslog               (Jan 15 10:23:45 host process[pid]: message)
 *   - nginx/apache combined (127.0.0.1 - - [15/Jan/2024:10:23:45 +0000] "GET / 200")
 *   - plain text            (level inferred from message content)
 */

import type { LogEvent, LogLevel } from './types.js';

export type LogFormat = 'auto' | 'json' | 'iso' | 'syslog' | 'nginx' | 'plain';

const LEVEL_WORDS: [LogLevel, RegExp][] = [
  ['fatal', /\b(fatal|panic)\b/i],
  ['error', /\b(error|err|exception|failed|failure|uncaught|unhandled)\b/i],
  ['warn', /\b(warn|warning)\b/i],
  ['info', /\b(info|information)\b/i],
  ['debug', /\b(debug|trace)\b/i],
];

/** Infer a log level from free text. */
export function inferLevel(text: string): LogLevel {
  for (const [level, re] of LEVEL_WORDS) {
    if (re.test(text)) return level;
  }
  return 'info';
}

const LEVEL_TOKEN = /^(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL|SEVERE)\b[:\s-]?/i;

const ISO_TS = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/;

const SYSLOG_TS = /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*?)(?:\[(\d+)\])?:\s*(.*)$/;

const NGINX_TS = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3})\s+(\S+)/;

const BRACKET_LEVEL = /\[(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\]/i;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseIsoTs(s: string): number | null {
  const normalized = s.replace(',', '.').replace(' ', 'T');
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? null : t;
}

function parseSyslogTs(s: string): number | null {
  // "Jan 15 10:23:45" — no year in syslog; assume current year.
  const m = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const month = MONTHS[m[1]!.toLowerCase()];
  if (month === undefined) return null;
  const year = new Date().getFullYear();
  return new Date(year, month, Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])).getTime();
}

function parseNginxTs(s: string): number | null {
  // "15/Jan/2024:10:23:45 +0000"
  const m = /^(\d{1,2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (month === undefined) return null;
  const iso = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1]}T${m[4]}:${m[5]}:${m[6]}${m[7]}:${m[8]}`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Field names used by common JSON logging libraries. */
const JSON_TIME_KEYS = ['time', 'timestamp', '@timestamp', 'ts', 'date', 'datetime', 'logged_at'];
const JSON_LEVEL_KEYS = ['level', 'severity', 'log.level', 'lvl'];
const JSON_MSG_KEYS = ['msg', 'message', 'log', 'error', 'err', 'event', 'text'];
const JSON_SOURCE_KEYS = ['logger', 'source', 'module', 'component', 'app', 'service', 'name'];

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function parseJsonLine(line: string): Omit<LogEvent, 'id' | 'raw'> | null {
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;

  let timestamp: number | null = null;
  const rawTime = pick(rec, JSON_TIME_KEYS);
  if (typeof rawTime === 'string') {
    timestamp = parseIsoTs(rawTime) ?? (Number.isNaN(Date.parse(rawTime)) ? null : Date.parse(rawTime));
  } else if (typeof rawTime === 'number') {
    // epoch seconds or millis
    timestamp = rawTime < 1e12 ? rawTime * 1000 : rawTime;
  }

  let level: LogLevel = 'info';
  const rawLevel = pick(rec, JSON_LEVEL_KEYS);
  if (typeof rawLevel === 'string') {
    const m = LEVEL_TOKEN.exec(rawLevel.toUpperCase().replace(/^(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\b[:\s-]?/, '$1'));
    if (m) {
      const tok = m[1]!.toUpperCase();
      level = tok === 'WARNING' ? 'warn' : (tok.toLowerCase() as LogLevel);
    } else {
      level = inferLevel(rawLevel);
    }
  }

  const rawMsg = pick(rec, JSON_MSG_KEYS);
  const message = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg ?? rec);

  const rawSource = pick(rec, JSON_SOURCE_KEYS);
  const source = typeof rawSource === 'string' ? rawSource : null;

  return { timestamp, level, message, source };
}

function parseNginxLine(line: string): Omit<LogEvent, 'id' | 'raw'> | null {
  const m = NGINX_TS.exec(line);
  if (!m) return null;
  const timestamp = parseNginxTs(m[2]!);
  const methodPath = m[3]!;
  const status = Number(m[4]!);
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  return {
    timestamp,
    level,
    message: `${methodPath} -> ${status}`,
    source: m[1],
  };
}

function parseSyslogLine(line: string): Omit<LogEvent, 'id' | 'raw'> | null {
  const m = SYSLOG_TS.exec(line);
  if (!m) return null;
  const timestamp = parseSyslogTs(m[1]!);
  const source = m[3]!;
  const message = m[5]!;
  return { timestamp, level: inferLevel(message), message, source };
}

function parseIsoLine(line: string): Omit<LogEvent, 'id' | 'raw'> | null {
  const m = ISO_TS.exec(line);
  if (!m) return null;
  const timestamp = parseIsoTs(m[1]!);
  let rest = m[2]!;

  let level: LogLevel | null = null;
  const lm = LEVEL_TOKEN.exec(rest);
  if (lm) {
    const tok = lm[1]!.toUpperCase();
    level = tok === 'WARNING' ? 'warn' : (tok.toLowerCase() as LogLevel);
    rest = rest.slice(lm[0].length);
  }

  let source: string | null = null;
  // "app: message" or "app - message"
  const sm = /^([A-Za-z0-9_.-]+)\s*[:|-]\s+(.*)$/.exec(rest);
  if (sm) {
    source = sm[1]!;
    rest = sm[2]!;
  }

  return { timestamp, level: level ?? inferLevel(rest), message: rest, source };
}

function parsePlainLine(line: string): Omit<LogEvent, 'id' | 'raw'> {
  let rest = line;
  let level: LogLevel | null = null;
  const lm = LEVEL_TOKEN.exec(rest);
  if (lm) {
    const tok = lm[1]!.toUpperCase();
    level = tok === 'WARNING' ? 'warn' : (tok.toLowerCase() as LogLevel);
    rest = rest.slice(lm[0].length);
  }
  return { timestamp: null, level: level ?? inferLevel(rest), message: rest, source: null };
}

/** Parse a single line with an explicit format. */
export function parseLine(line: string, format: LogFormat): Omit<LogEvent, 'id' | 'raw'> {
  switch (format) {
    case 'json':
      return parseJsonLine(line) ?? parsePlainLine(line);
    case 'nginx':
      return parseNginxLine(line) ?? parsePlainLine(line);
    case 'syslog':
      return parseSyslogLine(line) ?? parsePlainLine(line);
    case 'iso':
      return parseIsoLine(line) ?? parsePlainLine(line);
    case 'plain':
      return parsePlainLine(line);
    case 'auto':
    default: {
      const trimmed = line.trim();
      if (trimmed.startsWith('{')) {
        const j = parseJsonLine(trimmed);
        if (j) return j;
      }
      const nginx = parseNginxLine(trimmed);
      if (nginx) return nginx;
      const syslog = parseSyslogLine(trimmed);
      if (syslog) return syslog;
      const iso = parseIsoLine(trimmed);
      if (iso) return iso;
      return parsePlainLine(trimmed);
    }
  }
}

/** Detect the dominant format from the first non-empty line. */
export function detectFormat(lines: string[]): LogFormat {
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('{') && parseJsonLine(t)) return 'json';
    if (parseNginxLine(t)) return 'nginx';
    if (parseSyslogLine(t)) return 'syslog';
    if (parseIsoLine(t)) return 'iso';
    return 'plain';
  }
  return 'plain';
}

/** Parse many lines into events. */
export function parseLines(lines: string[], format: LogFormat = 'auto'): LogEvent[] {
  const effective = format === 'auto' ? detectFormat(lines) : format;
  const events: LogEvent[] = [];
  let id = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseLine(line, effective);
    events.push({ id: id++, raw: line, ...parsed });
  }
  return events;
}
