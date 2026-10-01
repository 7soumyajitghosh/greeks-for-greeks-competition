import { describe, expect, it } from 'vitest';
import { extractTemplates, similarity } from '../src/drain.js';
import type { LogEvent } from '../src/types.js';

function ev(message: string, level: LogEvent['level'] = 'info', timestamp: number | null = null): LogEvent {
  return { id: 0, timestamp, level, message, raw: message, source: null };
}

describe('similarity', () => {
  it('is 1 for identical token lists', () => {
    expect(similarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });
  it('is 0 for disjoint token lists', () => {
    expect(similarity(['a', 'b'], ['x', 'y'])).toBe(0);
  });
  it('normalizes by the longer list', () => {
    expect(similarity(['a', 'b'], ['a', 'b', 'c'])).toBeCloseTo(2 / 3);
  });
});

describe('extractTemplates', () => {
  it('groups similar messages into one template with parameters', () => {
    const events = [
      ev('connection refused to db.internal port 443'),
      ev('connection refused to db.internal port 5432'),
      ev('connection refused to cache.internal port 6379'),
    ];
    const { templates, eventTemplateId } = extractTemplates(events);
    expect(templates).toHaveLength(1);
    expect(templates[0]!.count).toBe(3);
    expect(templates[0]!.template).toBe('connection refused to <*> port <*>');
    expect(new Set(eventTemplateId.values()).size).toBe(1);
  });

  it('keeps dissimilar messages apart', () => {
    const events = [
      ev('user alice logged in'),
      ev('disk full on device'),
      ev('user bob logged in'),
    ];
    const { templates } = extractTemplates(events);
    expect(templates).toHaveLength(2);
    const login = templates.find((t) => t.template.includes('logged in'))!;
    expect(login.template).toBe('user <*> logged in');
    expect(login.count).toBe(2);
  });

  it('extracts parameter values', () => {
    const events = [
      ev('timeout waiting for /api/login after 5000ms'),
      ev('timeout waiting for /api/users after 7000ms'),
    ];
    const { templates } = extractTemplates(events);
    expect(templates[0]!.template).toBe('timeout waiting for <*> after <*>ms');
    expect(templates[0]!.parameters.length).toBeGreaterThan(0);
  });

  it('tracks first/last seen and level', () => {
    const events = [
      ev('request failed', 'error', 1000),
      ev('request failed', 'error', 3000),
      ev('request failed', 'fatal', 2000),
    ];
    const { templates } = extractTemplates(events);
    expect(templates[0]!.firstSeen).toBe(1000);
    expect(templates[0]!.lastSeen).toBe(3000);
    expect(templates[0]!.level).toBe('fatal');
  });

  it('handles empty messages', () => {
    const events = [ev(''), ev('!!!'), ev('???')];
    const { templates } = extractTemplates(events);
    expect(templates.length).toBeGreaterThanOrEqual(1);
  });
});
