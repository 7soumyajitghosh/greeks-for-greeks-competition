import { describe, expect, it } from 'vitest';
import { detectFormat, inferLevel, parseLine, parseLines } from '../src/parser.js';

describe('inferLevel', () => {
  it('detects levels from message content', () => {
    expect(inferLevel('something failed')).toBe('error');
    expect(inferLevel('warning: disk almost full')).toBe('warn');
    expect(inferLevel('connection refused')).toBe('error');
    expect(inferLevel('FATAL: out of memory')).toBe('fatal');
    expect(inferLevel('all good')).toBe('info');
  });
});

describe('parseLine', () => {
  it('parses ISO timestamp lines with bracket levels', () => {
    const e = parseLine('2024-01-15 10:23:45,123 [ERROR] web-01: connection refused', 'auto');
    expect(e.level).toBe('error');
    expect(e.message).toBe('connection refused');
    expect(e.source).toBe('web-01');
    expect(e.timestamp).not.toBeNull();
  });

  it('parses JSON logs', () => {
    const e = parseLine(
      '{"time":"2024-01-15T10:23:45.000Z","level":"warn","logger":"audit","msg":"slow query"}',
      'auto',
    );
    expect(e.level).toBe('warn');
    expect(e.message).toBe('slow query');
    expect(e.source).toBe('audit');
    expect(e.timestamp).not.toBeNull();
  });

  it('parses syslog lines', () => {
    const e = parseLine('Jan 15 10:23:45 web-01 nginx[1234]: connection refused', 'auto');
    expect(e.message).toBe('connection refused');
    expect(e.source).toBe('nginx');
    expect(e.timestamp).not.toBeNull();
  });

  it('parses nginx combined lines', () => {
    const e = parseLine(
      '127.0.0.1 - - [15/Jan/2024:10:23:45 +0000] "GET /api/login HTTP/1.1" 200 1234',
      'auto',
    );
    expect(e.level).toBe('info');
    expect(e.message).toBe('GET /api/login HTTP/1.1 -> 200');
    expect(e.timestamp).not.toBeNull();
  });

  it('maps 5xx statuses to error level', () => {
    const e = parseLine(
      '10.0.0.1 - - [15/Jan/2024:10:23:45 +0000] "POST /api/orders HTTP/1.1" 500 12',
      'auto',
    );
    expect(e.level).toBe('error');
  });

  it('falls back to plain parsing', () => {
    const e = parseLine('just some random text with failure in it', 'auto');
    expect(e.level).toBe('error');
    expect(e.message).toBe('just some random text with failure in it');
    expect(e.timestamp).toBeNull();
  });
});

describe('detectFormat', () => {
  it('detects json', () => {
    expect(detectFormat(['{"time":"x","level":"info","msg":"y"}'])).toBe('json');
  });
  it('detects nginx', () => {
    expect(detectFormat(['1.2.3.4 - - [15/Jan/2024:10:23:45 +0000] "GET / 200 1'])).toBe('nginx');
  });
  it('detects syslog', () => {
    expect(detectFormat(['Jan 15 10:23:45 host proc[1]: msg'])).toBe('syslog');
  });
  it('detects iso', () => {
    expect(detectFormat(['2024-01-15 10:23:45 [INFO] hello'])).toBe('iso');
  });
  it('detects plain', () => {
    expect(detectFormat(['hello world'])).toBe('plain');
  });
});

describe('parseLines', () => {
  it('skips blank lines and assigns ids', () => {
    const events = parseLines(['hello failure', '', '   ', 'warn: x'], 'auto');
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.id)).toEqual([0, 1, 2]);
  });
});
