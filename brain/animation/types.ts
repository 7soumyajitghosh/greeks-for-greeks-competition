// Animation Understanding Brain — central type definitions.
// Single source of truth for the whole pipeline:
// INPUT → UNDERSTAND → ADL → RECONSTRUCT → COMPARE → IMPROVE

/** Supported animation input kinds (§1). */
export type AnimationSourceType =
  | "website"
  | "video"
  | "gif"
  | "screen-recording"
  | "image-sequence"
  | "code";

export interface AnimationSource {
  type: AnimationSourceType;
  /** URL, file path, directory, or raw code string. */
  source: string;
  /** Optional MIME hint (e.g. "video/mp4", "image/gif"). */
  mimeHint?: string;
}

/** How a fact was obtained (§20). Never pretend an approximation is exact. */
export type EvidenceKind = "exactly-observed" | "inferred" | "approximated";

export interface Evidence<T> {
  value: T;
  source: EvidenceKind;
  /** 0..1 */
  confidence: number;
  /** How the value was derived, e.g. "css-keyframes", "visual-analysis". */
  method: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Path {
  kind: "line" | "curve" | "arc" | "bezier" | "polyline" | "custom";
  points: Point[];
}

export interface Size {
  w: number;
  h: number;
}

/** A detected visual object (§3). */
export interface VisualElement {
  /** Stable dotted id, e.g. "heart-tree.trunk". */
  id: string;
  /** Shape / image / text / particle-system / canvas-layer / svg-node … */
  type: string;
  parent: string | null;
  children: string[];
  position: Point;
  size: Size;
  properties: Record<string, string | number | boolean>;
  /** How sure are we this element exists? */
  confidence: number;
}

/** Motion of one element over time (§4). */
export interface MotionTrack {
  elementId: string;
  startTime: number; // ms
  endTime: number; // ms
  position: {
    from: Point;
    to: Point;
    path?: Path;
  };
  rotation?: { from: number; to: number };
  scale?: { from: number; to: number };
  opacity?: { from: number; to: number };
  color?: { from: string; to: string };
  blur?: { from: number; to: number };
  easing?: string;
}

/** A causal timeline entry (§5). */
export interface TimelineEvent {
  /** ms from animation start */
  at: number;
  label: string;
  elementIds: string[];
  /** ids of events that caused this one */
  causedBy: string[];
  /** human-readable causal note */
  cause?: string;
}

export type TriggerType =
  | "PAGE_LOAD"
  | "SCROLL"
  | "HOVER"
  | "CLICK"
  | "TOUCH"
  | "DRAG"
  | "MOUSE_MOVE"
  | "POINTER_MOVE"
  | "KEYBOARD"
  | "TIME"
  | "INTERSECTION"
  | "AUDIO"
  | "VIDEO"
  | "CUSTOM_EVENT"
  | "ANIMATION_END";

export interface AnimationTrigger {
  type: TriggerType;
  source?: string;
  condition?: string;
  threshold?: number;
  /** Which timeline events this trigger fires. */
  fires: string[];
}

/** Easing curve estimate (§7). */
export interface EasingInfo {
  type:
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "cubic-bezier"
    | "spring"
    | "bounce"
    | "elastic"
    | "custom";
  parameters?: number[];
  confidence: number;
  /** true when estimated from visual evidence rather than parsed exactly. */
  approximated: boolean;
}

export type SpatialRelationKind =
  | "child-of"
  | "follows"
  | "orbits"
  | "attaches-to"
  | "originates-from"
  | "detaches-from"
  | "camera-follows";

export interface SpatialRelation {
  from: string;
  to: string;
  kind: SpatialRelationKind;
}

export interface SpatialGraph {
  roots: string[];
  relations: SpatialRelation[];
}

/** Machine-readable causal DAG (§9). */
export interface AnimationGraphNode {
  id: string;
  label: string;
  elementIds: string[];
  at: number;
}

export interface AnimationGraphEdge {
  from: string;
  to: string;
  kind: "causes" | "follows" | "triggers" | "contains";
}

export interface AnimationGraph {
  nodes: AnimationGraphNode[];
  edges: AnimationGraphEdge[];
}

// ---------------------------------------------------------------------------
// Animation Description Language (ADL) — §10
// The universal language between Understanding → Reconstruction → Codegen.
// ---------------------------------------------------------------------------

export interface ADLObjectState {
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  rotation?: number;
  color?: string;
  [k: string]: string | number | boolean | undefined;
}

export interface ADLObject {
  id: string;
  type: string;
  initialState: ADLObjectState;
}

export interface ADLEvent {
  id?: string;
  trigger: string;
  action: string;
  target: string;
  startAt?: number;
  duration: number;
  easing?: string;
  from?: ADLObjectState;
  to?: ADLObjectState;
}

export interface ADL {
  version: "adl/1";
  scene: string;
  /** total duration in ms */
  duration: number;
  objects: ADLObject[];
  events: ADLEvent[];
  triggers?: AnimationTrigger[];
  metadata?: {
    technology?: string;
    confidence?: number;
    provenance?: EvidenceKind;
    [k: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Analysis outputs
// ---------------------------------------------------------------------------

export interface HtmlFinding {
  domElements: string[];
  svgCount: number;
  canvasCount: number;
  webglSuspected: boolean;
  images: string[];
  videos: string[];
  texts: string[];
  interactive: string[];
}

export interface CssFinding {
  transitions: string[];
  keyframes: string[];
  transforms: string[];
  animations: string[];
  opacityUses: number;
  filterUses: number;
  clipPathUses: number;
  gradientUses: number;
  maskUses: number;
  pseudoElements: string[];
  rawEasings: string[];
}

export interface JsFinding {
  libraries: Array<"gsap" | "framer-motion" | "anime.js" | "motion" | "three.js" | "wapi" | "none">;
  usesRequestAnimationFrame: boolean;
  usesIntersectionObserver: boolean;
  usesScrollListener: boolean;
  usesPointerEvents: boolean;
  usesMouseEvents: boolean;
  usesTouchEvents: boolean;
  usesCanvas: boolean;
  usesWebGL: boolean;
  customEvents: string[];
}

export interface DependencyMap {
  htmlToCss: Array<{ element: string; animation: string }>;
  cssToJs: Array<{ animation: string; controller: string }>;
  jsToCanvas: Array<{ controller: string; target: string }>;
  notes: string[];
}

export interface UnderstandingResult {
  source: AnimationSource;
  technology: string;
  scenes: number;
  objects: VisualElement[];
  motions: MotionTrack[];
  timeline: TimelineEvent[];
  triggers: AnimationTrigger[];
  easings: Record<string, Evidence<EasingInfo>>;
  spatial: SpatialGraph;
  graph: AnimationGraph;
  adl: ADL;
  summary: {
    durationMs: number;
    primaryMotions: string[];
    mainSequence: string;
    confidence: number;
  };
  evidence: Array<{ property: string; source: EvidenceKind; confidence: number; method: string }>;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Comparison + optimization (§14–15)
// ---------------------------------------------------------------------------

export interface FrameSample {
  /** ms */
  t: number;
  /** elementId → snapshot state */
  states: Record<string, ADLObjectState & { x: number; y: number }>;
}

export interface ComparisonMetric {
  name: string;
  /** 0..100 */
  score: number;
  detail: string;
}

export interface ComparisonReport {
  /** 0..100 overall */
  similarity: number;
  metrics: ComparisonMetric[];
  differences: string[];
  comparedAt: number;
}

export interface OptimizeOptions {
  targetSimilarity?: number;
  maxIterations?: number;
  /** stop when an iteration improves less than this (0..100 points) */
  minImprovement?: number;
}

export interface OptimizeIteration {
  iteration: number;
  similarity: number;
  changes: string[];
  adl: ADL;
}

export interface OptimizeResult {
  finalAdl: ADL;
  finalReport: ComparisonReport;
  iterations: OptimizeIteration[];
  stoppedBecause: "target-reached" | "budget-exhausted" | "no-improvement";
}

/** Reusable animation knowledge (§11). */
export interface AnimationPattern {
  id: string;
  name: string;
  characteristics: string[];
  tags: string[];
  adlFragment: Partial<ADL>;
  confidence: number;
  uses: number;
}

export type ReconstructionTarget =
  | "css"
  | "svg"
  | "canvas"
  | "gsap"
  | "framer-motion"
  | "wapi"
  | "three";

export interface ReconstructionPlan {
  target: ReconstructionTarget;
  reason: string;
  files: Array<{ path: string; language: string; content: string }>;
  runtimeNotes: string[];
}

export interface AgentStep {
  phase: string;
  detail: string;
  at: number;
}
