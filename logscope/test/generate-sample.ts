/**
 * Generates test/sample.log — a deterministic, realistic mixed-format log
 * file with recurring errors, an error spike, and a late-appearing new
 * error pattern. Run with: npm run generate:sample
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// mulberry32 — tiny seeded PRNG so the sample is reproducible
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;

const HOSTS = ['web-01', 'web-02', 'api-01', 'api-02', 'worker-01'];
const USERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'];
const PATHS = ['/api/login', '/api/users', '/api/orders', '/api/search', '/health', '/api/checkout'];
const COUNTRIES = ['US', 'DE', 'IN', 'BR', 'JP'];

function iso(ts: Date): string {
  return ts.toISOString().slice(0, 19).replace('T', ' ');
}

function infoLine(ts: Date): string {
  const host = pick(HOSTS);
  const user = pick(USERS);
  const path = pick(PATHS);
  const status = pick([200, 200, 200, 200, 201, 301, 404]);
  const ms = 20 + Math.floor(rand() * 400);
  return `${iso(ts)} [INFO] ${host} request: user=${user} path=${path} status=${status} ${ms}ms`;
}

function warnLine(ts: Date): string {
  const host = pick(HOSTS);
  const path = pick(PATHS);
  const ms = 800 + Math.floor(rand() * 2000);
  return `${iso(ts)} [WARN] ${host} slow request: path=${path} took ${ms}ms`;
}

function connectionError(ts: Date): string {
  const host = pick(HOSTS);
  const port = pick([443, 5432, 6379, 27017]);
  return `${iso(ts)} [ERROR] ${host} connection refused to db.internal port ${port}`;
}

function timeoutError(ts: Date): string {
  const host = pick(HOSTS);
  const path = pick(PATHS);
  const ms = 5000 + Math.floor(rand() * 3000);
  return `${iso(ts)} [ERROR] ${host} timeout waiting for ${path} after ${ms}ms`;
}

function nullPointer(ts: Date): string {
  const host = pick(HOSTS);
  const user = pick(USERS);
  return `${iso(ts)} [ERROR] ${host} NullPointerException in CheckoutService for user ${user}`;
}

// A new error pattern that only appears late in the trace
function diskFullError(ts: Date): string {
  const host = pick(HOSTS);
  return `${iso(ts)} [FATAL] ${host} disk full: no space left on device /var/log`;
}

function jsonLine(ts: Date): string {
  const host = pick(HOSTS);
  const user = pick(USERS);
  const country = pick(COUNTRIES);
  return JSON.stringify({
    time: ts.toISOString(),
    level: 'info',
    logger: 'audit',
    msg: 'audit event',
    host,
    user,
    country,
  });
}

function main(): void {
  const outPath = join(dirname(fileURLToPath(import.meta.url)), 'sample.log');
  mkdirSync(dirname(outPath), { recursive: true });

  const lines: string[] = [];
  const start = new Date('2024-06-15T10:00:00Z').getTime();
  const minute = 60 * 1000;

  for (let m = 0; m < 30; m++) {
    const ts = new Date(start + m * minute);

    // Baseline traffic: ~15 info lines per minute
    for (let i = 0; i < 15; i++) {
      lines.push(infoLine(new Date(ts.getTime() + Math.floor(rand() * minute))));
    }
    // Occasional JSON audit line
    if (rand() < 0.4) lines.push(jsonLine(ts));

    // Recurring errors throughout: ~2/min
    for (let i = 0; i < 2; i++) {
      lines.push(connectionError(new Date(ts.getTime() + Math.floor(rand() * minute))));
    }
    if (rand() < 0.5) lines.push(timeoutError(ts));
    if (rand() < 0.3) lines.push(nullPointer(ts));
    if (rand() < 0.2) lines.push(warnLine(ts));

    // Spike at minute 15: a burst of 40 errors
    if (m === 15) {
      for (let i = 0; i < 40; i++) {
        lines.push(timeoutError(new Date(ts.getTime() + Math.floor(rand() * minute))));
      }
    }

    // New error pattern appears only in the last 3 minutes
    if (m >= 27) {
      for (let i = 0; i < 4; i++) {
        lines.push(diskFullError(new Date(ts.getTime() + Math.floor(rand() * minute))));
      }
    }
  }

  writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${lines.length} lines to ${outPath}`);
}

main();
