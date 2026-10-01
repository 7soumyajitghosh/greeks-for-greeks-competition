#!/usr/bin/env node
/**
 * LogScope CLI — standalone log analysis.
 *
 * Examples:
 *   logscope analyze app.log                  # full report in the terminal
 *   logscope analyze app.log --json out.json # machine-readable export
 *   logscope analyze app.log --csv-dir out/  # logparser-compatible CSVs
 *   logscope analyze *.log --format syslog    # explicit format
 *   logscope parse app.log                   # structured events as JSON
 *   logscope templates app.log               # template table only
 */

import { existsSync } from 'node:fs';
import { analyzeFile, analyzeFiles } from './analyze.js';
import { parseLines, type LogFormat } from './parser.js';
import { extractTemplates } from './drain.js';
import { exportCsv, exportJson, renderReport } from './report.js';
import type { LogLevel } from './types.js';

const VERSION = '1.0.0';

const USAGE = `LogScope v${VERSION} — standalone log analysis

Usage:
  logscope analyze <files...> [options]   Full analysis: templates, issues, anomalies
  logscope parse <files...> [options]     Parse lines into structured JSON events
  logscope templates <files...> [options] Show extracted log templates

Options:
  --format <fmt>     auto | json | iso | syslog | nginx | plain (default: auto)
  --min-level <lvl>  debug | info | warn | error | fatal (default: debug)
  --depth <n>        Drain tree depth (default: 4)
  --threshold <t>    Drain similarity threshold 0..1 (default: 0.5)
  --include-warn     Also group warnings into issues
  --top <n>          Show top N issues in the report (default: 10)
  --json <file>      Write full JSON report to <file>
  --csv-dir <dir>    Write templates.csv + structured.csv to <dir>
  --no-color         Disable colored output
  -h, --help         Show this help
  -v, --version      Show version`;

interface Args {
  command: 'analyze' | 'parse' | 'templates' | 'help';
  files: string[];
  format: LogFormat;
  minLevel: LogLevel;
  depth?: number;
  simThreshold?: number;
  includeWarn: boolean;
  top: number;
  json?: string;
  csvDir?: string;
  color: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: 'analyze',
    files: [],
    format: 'auto',
    minLevel: 'debug',
    includeWarn: false,
    top: 10,
    color: true,
  };

  const formats: LogFormat[] = ['auto', 'json', 'iso', 'syslog', 'nginx', 'plain'];
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-h' || a === '--help') {
      args.command = 'help';
    } else if (a === '-v' || a === '--version') {
      console.log(VERSION);
      process.exit(0);
    } else if (a === '--format') {
      const v = argv[++i];
      if (!v || !formats.includes(v as LogFormat)) {
        fail(`--format must be one of: ${formats.join(', ')}`);
      }
      args.format = v as LogFormat;
    } else if (a === '--min-level') {
      const v = argv[++i];
      if (!v || !levels.includes(v as LogLevel)) {
        fail(`--min-level must be one of: ${levels.join(', ')}`);
      }
      args.minLevel = v as LogLevel;
    } else if (a === '--depth') {
      args.depth = Number(argv[++i]);
      if (!Number.isInteger(args.depth) || args.depth < 1) fail('--depth must be a positive integer');
    } else if (a === '--threshold') {
      args.simThreshold = Number(argv[++i]);
      if (!(args.simThreshold >= 0 && args.simThreshold <= 1)) {
        fail('--threshold must be between 0 and 1');
      }
    } else if (a === '--include-warn') {
      args.includeWarn = true;
    } else if (a === '--top') {
      args.top = Number(argv[++i]);
      if (!Number.isInteger(args.top) || args.top < 1) fail('--top must be a positive integer');
    } else if (a === '--json') {
      args.json = argv[++i];
      if (!args.json) fail('--json requires a file path');
    } else if (a === '--csv-dir') {
      args.csvDir = argv[++i];
      if (!args.csvDir) fail('--csv-dir requires a directory path');
    } else if (a === '--no-color') {
      args.color = false;
    } else if (a === 'analyze' || a === 'parse' || a === 'templates') {
      args.command = a;
    } else if (a.startsWith('-')) {
      fail(`unknown option: ${a}`);
    } else {
      args.files.push(a);
    }
  }

  if (args.command !== 'help' && args.files.length === 0) {
    fail('no input files given');
  }
  return args;
}

function fail(msg: string): never {
  console.error(`error: ${msg}\n\n${USAGE}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'help') {
    console.log(USAGE);
    return;
  }

  for (const f of args.files) {
    if (!existsSync(f)) fail(`file not found: ${f}`);
  }

  if (args.command === 'parse') {
    // Stream structured events to stdout as JSON.
    const { readLines } = await import('./analyze.js');
    const out: unknown[] = [];
    for (const file of args.files) {
      const lines: string[] = [];
      for await (const line of readLines(file)) lines.push(line);
      const events = parseLines(lines, args.format);
      out.push({ file, events });
    }
    console.log(JSON.stringify(args.files.length === 1 ? out[0] : out, null, 2));
    return;
  }

  if (args.command === 'templates') {
    const { readLines } = await import('./analyze.js');
    for (const file of args.files) {
      const lines: string[] = [];
      for await (const line of readLines(file)) lines.push(line);
      const events = parseLines(lines, args.format);
      const { templates } = extractTemplates(events, { depth: args.depth, simThreshold: args.simThreshold });
      templates.sort((a, b) => b.count - a.count);
      console.log(`Templates in ${file} (${templates.length}):`);
      for (const t of templates) {
        console.log(`  [${t.id}] (${t.count}x) ${t.template}`);
      }
    }
    return;
  }

  // analyze
  const result =
    args.files.length === 1
      ? await analyzeFile(args.files[0]!, {
          format: args.format,
          minLevel: args.minLevel,
          depth: args.depth,
          simThreshold: args.simThreshold,
          includeWarn: args.includeWarn,
        })
      : await analyzeFiles(args.files, {
          format: args.format,
          minLevel: args.minLevel,
          depth: args.depth,
          simThreshold: args.simThreshold,
          includeWarn: args.includeWarn,
        });

  console.log(renderReport(result, { top: args.top, color: args.color }));

  if (args.json) {
    exportJson(result, args.json);
    console.error(`JSON report written to ${args.json}`);
  }
  if (args.csvDir) {
    // CSV export needs the event->template mapping; recompute for single file.
    if (args.files.length === 1) {
      const { readLines } = await import('./analyze.js');
      const lines: string[] = [];
      for await (const line of readLines(args.files[0]!)) lines.push(line);
      const events = parseLines(lines, args.format);
      const { eventTemplateId } = extractTemplates(events, {
        depth: args.depth,
        simThreshold: args.simThreshold,
      });
      exportCsv(result, events, result.templates, eventTemplateId, args.csvDir);
      console.error(`CSV files written to ${args.csvDir}`);
    } else {
      console.error('(--csv-dir is only supported for a single input file; skipped');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
