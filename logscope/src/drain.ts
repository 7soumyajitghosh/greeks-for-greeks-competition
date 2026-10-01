/**
 * Drain-style online log parser.
 *
 * Adapted from the Drain algorithm (He et al., ICWS'17), the most widely used
 * parser in the logpai/logparser benchmark:
 *
 *   - messages are tokenized on non-alphanumeric delimiters
 *   - a fixed-depth prefix tree routes each message: the first layer is keyed
 *     by the length of the first token, deeper layers by the token at that
 *     position
 *   - each leaf holds template clusters; a message joins the most similar
 *     cluster when its token-wise similarity meets the threshold, otherwise a
 *     new cluster (template) is created
 *   - when a message joins a cluster, positions where its tokens differ from
 *     the template become `<*>` parameter placeholders
 *
 * The implementation keeps character spans so templates render back onto a
 * real sample line (e.g. `Connection refused to <*>:443`).
 */

import type { LogEvent, LogTemplate, LogLevel } from './types.js';
import { levelRank } from './types.js';

export interface DrainOptions {
  /** depth of the prefix tree (default 4) */
  depth?: number;
  /** similarity threshold 0..1 (default 0.5) */
  simThreshold?: number;
  /** max children per internal node before it stops splitting (default 100) */
  maxChildren?: number;
  /** max parameter lists kept per template (default 100) */
  maxParams?: number;
}

interface Tokenized {
  tokens: string[];
  /** [start, end) character span of each token in the original message */
  spans: [number, number][];
}

function tokenize(message: string): Tokenized {
  const tokens: string[] = [];
  const spans: [number, number][] = [];
  const re = /[A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    tokens.push(m[0]);
    spans.push([m.index, m.index + m[0].length]);
  }
  return { tokens, spans };
}

/** Position-wise token similarity, normalized by the longer message. */
export function similarity(a: string[], b: string[]): number {
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  let match = 0;
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i++) {
    if (a[i] === b[i]) match++;
  }
  return match / len;
}

interface Cluster {
  id: string;
  tokens: string[];
  count: number;
  level: LogLevel;
  firstSeen: number | null;
  lastSeen: number | null;
  sample: string;
  sampleSpans: [number, number][];
  /** character spans (in `sample`) that are parameters */
  paramSpans: [number, number][];
  params: string[][];
}

interface TreeNode {
  children: Map<string, TreeNode>;
  clusters: Cluster[];
}

export interface DrainResult {
  templates: LogTemplate[];
  /** event id -> template id */
  eventTemplateId: Map<number, string>;
}

export class DrainParser {
  private readonly depth: number;
  private readonly simThreshold: number;
  private readonly maxChildren: number;
  private readonly maxParams: number;
  private readonly root = new Map<number, TreeNode>();
  private clusterSeq = 0;

  constructor(opts: DrainOptions = {}) {
    this.depth = opts.depth ?? 4;
    this.simThreshold = opts.simThreshold ?? 0.5;
    this.maxChildren = opts.maxChildren ?? 100;
    this.maxParams = opts.maxParams ?? 100;
  }

  /** Add one event; returns the id of the template it matched or created. */
  add(event: LogEvent): string {
    const { tokens, spans } = tokenize(event.message);

    if (tokens.length === 0) {
      // Message with no alphanumeric content — treat the whole line as its own template.
      return this.addRaw(event, [event.message], [[0, event.message.length]]);
    }

    // First tree layer is keyed by the length of the first token (as in Drain).
    const firstLen = tokens[0]!.length;
    let node = this.root.get(firstLen);
    if (!node) {
      node = { children: new Map(), clusters: [] };
      this.root.set(firstLen, node);
    }

    // Descend up to `depth` levels, keyed by the token at each position.
    let i = 1;
    for (; i < this.depth && i < tokens.length; i++) {
      const key = tokens[i]!;
      let child = node.children.get(key);
      if (!child) {
        if (node.children.size >= this.maxChildren) break;
        child = { children: new Map(), clusters: [] };
        node.children.set(key, child);
      }
      node = child;
    }

    // Find the most similar cluster at this leaf.
    let best: Cluster | null = null;
    let bestSim = 0;
    for (const c of node.clusters) {
      const sim = similarity(tokens, c.tokens);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }

    if (best && bestSim >= this.simThreshold) {
      this.merge(best, tokens, spans, event);
      return best.id;
    }

    const cluster: Cluster = {
      id: `t${++this.clusterSeq}`,
      tokens: [...tokens],
      count: 0,
      level: 'info',
      firstSeen: null,
      lastSeen: null,
      sample: event.message,
      sampleSpans: spans,
      paramSpans: [],
      params: [],
    };
    node.clusters.push(cluster);
    this.merge(cluster, tokens, spans, event);
    return cluster.id;
  }

  /** Update a cluster with a new matching event. */
  private merge(cluster: Cluster, tokens: string[], spans: [number, number][], event: LogEvent): void {
    // Positions where the new message differs become parameters.
    const paramPositions = new Set<number>();
    for (let i = 0; i < cluster.tokens.length; i++) {
      if (cluster.tokens[i] !== tokens[i]) paramPositions.add(i);
    }
    // New positions beyond the current template length are appended literally.
    for (let i = cluster.tokens.length; i < tokens.length; i++) {
      cluster.tokens.push(tokens[i]!);
      cluster.sampleSpans.push(spans[i]!);
    }
    for (const i of paramPositions) {
      cluster.tokens[i] = '<*>';
      if (spans[i]) cluster.paramSpans.push(spans[i]!);
    }

    cluster.count++;
    if (event.timestamp !== null) {
      if (cluster.firstSeen === null || event.timestamp < cluster.firstSeen) cluster.firstSeen = event.timestamp;
      if (cluster.lastSeen === null || event.timestamp > cluster.lastSeen) cluster.lastSeen = event.timestamp;
    }
    if (levelRank(event.level) > levelRank(cluster.level)) cluster.level = event.level;

    const params = tokens.filter((_, i) => cluster.tokens[i] === '<*>' || paramPositions.has(i));
    if (cluster.params.length < this.maxParams && params.length > 0) {
      cluster.params.push(params);
    }
  }

  private addRaw(event: LogEvent, tokens: string[], spans: [number, number][]): string {
    const cluster: Cluster = {
      id: `t${++this.clusterSeq}`,
      tokens,
      count: 1,
      level: event.level,
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
      sample: event.message,
      sampleSpans: spans,
      paramSpans: [],
      params: [],
    };
    // Raw clusters always live at the root under key 0.
    let node = this.root.get(0);
    if (!node) {
      node = { children: new Map(), clusters: [] };
      this.root.set(0, node);
    }
    node.clusters.push(cluster);
    return cluster.id;
  }

  /** Collect all clusters as templates. */
  templates(): LogTemplate[] {
    const out: LogTemplate[] = [];
    const visit = (node: TreeNode): void => {
      for (const c of node.clusters) out.push(toTemplate(c));
      for (const child of node.children.values()) visit(child);
    };
    for (const node of this.root.values()) visit(node);
    return out;
  }
}

function toTemplate(c: Cluster): LogTemplate {
  // Render the template by replacing parameter spans in the sample with `<*>`.
  let template = c.sample;
  const sorted = [...c.paramSpans].sort((a, b) => b[0] - a[0]);
  for (const [start, end] of sorted) {
    template = template.slice(0, start) + '<*>' + template.slice(end);
  }
  return {
    id: c.id,
    template,
    tokens: c.tokens,
    count: c.count,
    level: c.level,
    firstSeen: c.firstSeen,
    lastSeen: c.lastSeen,
    sample: c.sample,
    parameters: c.params,
  };
}

/** Convenience: parse a batch of events. */
export function extractTemplates(events: LogEvent[], opts: DrainOptions = {}): DrainResult {
  const parser = new DrainParser(opts);
  const eventTemplateId = new Map<number, string>();
  for (const e of events) {
    eventTemplateId.set(e.id, parser.add(e));
  }
  return { templates: parser.templates(), eventTemplateId };
}
