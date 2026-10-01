import { describe, expect, it } from 'vitest';
import { detectAnomalies, fingerprint, groupIssues } from '../src/grouper.js';
import { extractTemplates } from '../src/drain.js';
import type { LogEvent } from '../src/types.js';

function ev(
  message: string,
  level: LogEvent['level'],
  timestamp: number | null,
): LogEvent {
  return { id: 0, timestamp, level, message, raw: message, source: null };
}

function setup() {
  const events: LogEvent[] = [];
  let id = 0;
  const add = (msg: string, level: LogEvent['level'], ts: number | null) => {
    events.push({ id: id++, timestamp: ts, level, message: msg, raw: msg, source: null });
  };

  // 10 connection errors spread over 10 minutes
  for (let m = 0; m < 10; m++) {
    add(`connection refused to db port ${443 + m}`, 'error', 1000 + m * 60000);
  }
  // 5 timeouts
  for (let m = 0; m < 5; m++) {
    add(`timeout waiting for /api after ${5000 + m}ms`, 'error', 1000 + m * 120000);
  }
  // 3 info lines
  add('user alice logged in', 'info', 1000);
  add('user bob logged in', 'info', 2000);
  add('user carol logged in', 'info', 3000);

  const { templates, eventTemplateId } = extractTemplates(events);
  const issues = groupIssues(events, templates, eventTemplateId);
  return { events, templates, issues };
}

describe('fingerprint', () => {
  it('is deterministic', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'));
  });
  it('differs for different inputs', () => {
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'));
  });
});

describe('groupIssues', () => {
  it('groups errors by template and ignores info', () => {
    const { issues } = setup();
    expect(issues).toHaveLength(2);
    expect(issues[0]!.count).toBe(10);
    expect(issues[0]!.title).toContain('connection refused');
    expect(issues[1]!.count).toBe(5);
  });

  it('tracks first/last seen', () => {
    const { issues } = setup();
    expect(issues[0]!.firstSeen).toBe(1000);
    expect(issues[0]!.lastSeen).toBe(1000 + 9 * 60000);
  });

  it('builds a timeline', () => {
    const { issues } = setup();
    expect(issues[0]!.timeline.length).toBe(10);
    expect(issues[0]!.sparkline.length).toBeGreaterThan(0);
  });

  it('sorts by count descending', () => {
    const { issues } = setup();
    for (let i = 1; i < issues.length; i++) {
      expect(issues[i - 1]!.count).toBeGreaterThanOrEqual(issues[i]!.count);
    }
  });
});

describe('detectAnomalies', () => {
  it('detects error spikes via z-score', () => {
    const events: LogEvent[] = [];
    let id = 0;
    // baseline: 1 error per minute for 10 minutes
    for (let m = 0; m < 10; m++) {
      events.push({ id: id++, timestamp: m * 60000, level: 'error', message: `boom ${m}`, raw: '', source: null });
    }
    // spike: 30 errors in one minute
    for (let i = 0; i < 30; i++) {
      events.push({ id: id++, timestamp: 10 * 60000 + i * 1000, level: 'error', message: `boom ${i}`, raw: '', source: null });
    }
    const { templates, eventTemplateId } = extractTemplates(events);
    const issues = groupIssues(events, templates, eventTemplateId);
    const anomalies = detectAnomalies(events, templates, issues);
    expect(anomalies.some((a) => a.type === 'spike')).toBe(true);
  });

  it('detects new templates appearing late', () => {
    const events: LogEvent[] = [];
    let id = 0;
    // Long enough to share a 4-token prefix so they form one template.
    for (let m = 0; m < 20; m++) {
      events.push({ id: id++, timestamp: m * 60000, level: 'error', message: `old error occurred in module auth`, raw: '', source: null });
    }
    // new pattern only in the last minute
    for (let i = 0; i < 5; i++) {
      events.push({ id: id++, timestamp: 20 * 60000 + i * 1000, level: 'error', message: `brand new failure detected in service`, raw: '', source: null });
    }
    const { templates, eventTemplateId } = extractTemplates(events);
    const issues = groupIssues(events, templates, eventTemplateId);
    const anomalies = detectAnomalies(events, templates, issues);
    expect(anomalies.some((a) => a.type === 'new_template')).toBe(true);
  });
});
