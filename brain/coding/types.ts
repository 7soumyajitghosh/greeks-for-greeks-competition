// Human-Like Coding Brain — central type definitions.
// Single source of truth for §3, §8, §12, §25 and graph representations.

export type SupportedLanguage =
  | "typescript" | "javascript" | "python" | "java" | "c" | "cpp" | "go" | "rust" | "unknown";

export type SymbolKind =
  | "function" | "method" | "class" | "interface" | "type" | "const" | "variable"
  | "component" | "module" | "api" | "other";

export type ArchitecturePattern =
  | "mvc" | "mvvm" | "clean" | "hexagonal" | "microservices" | "monolith"
  | "event-driven" | "repository" | "factory" | "observer" | "di" | "component"
  | "layered" | "unknown";

export type CodingRole =
  | "architect" | "coder" | "debugger" | "reviewer" | "test-engineer"
  | "security" | "performance" | "documenter";

export interface ParsedSymbol {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  endLine?: number;
  signature?: string;
  exported?: boolean;
  params?: string[];
  returnType?: string;
  docComment?: string;
}

export interface ParsedImport {
  from: string; // importing file
  to: string;   // raw specifier
  names: string[];
  line: number;
}

export interface ParsedFile {
  path: string;
  language: SupportedLanguage;
  content: string;
  symbols: ParsedSymbol[];
  imports: ParsedImport[];
  exports: string[];
  loc: number;
}

export interface CodeUnderstanding {
  purpose: string;
  responsibilities: string[];
  dependencies: string[];
  dependents: string[];
  assumptions: string[];
  risks: string[];
  sideEffects: string[];
  invariants: string[];
  edgeCases: string[];
}

export interface CodeIntent {
  goal: string;
  constraints: string[];
  expectedBehavior: string[];
  designReasoning?: string;
  confidence: number; // 0..1 — never present as fact when < 1
}

export interface SymbolNode {
  id: string; // file::name
  symbol: ParsedSymbol;
  calls: string[];      // callee ids / names
  calledBy: string[];
  reads: string[];
  writes: string[];
  emits: string[];
  dataDeps: string[];
}

export interface DataFlowStep {
  stage: string;
  file?: string;
  symbol?: string;
  transform?: string;
}

export interface DataFlow {
  name: string;
  steps: DataFlowStep[];
}

export interface ControlFlowNode {
  id: string;
  kind:
    | "entry" | "exit" | "if" | "loop" | "await" | "callback"
    | "throw" | "try" | "retry" | "event" | "call" | "branch";
  label: string;
  line?: number;
  successors: string[];
}

export interface ControlFlow {
  symbolId: string;
  nodes: ControlFlowNode[];
  asyncPaths: { success: string[]; error: string[] };
}

export interface GraphNode {
  id: string;
  level: "repo" | "app" | "module" | "component" | "function";
  label: string;
  files: string[];
  children: string[];
  dependsOn: string[];
}

export interface ImpactReport {
  target: string;
  directlyAffected: string[];
  potentiallyAffected: string[];
  testsRequiringUpdates: string[];
  risk: "low" | "medium" | "high";
  reasoning: string[];
  note: string; // engineering diagnostic, not absolute prediction
}

export interface ImplementationPlan {
  request: string;
  investigation: Array<{ area: string; findings: string[] }>;
  affectedComponents: string[];
  dependencies: string[];
  risks: string[];
  steps: Array<{ title: string; detail: string; files: string[]; smallestSafeChange: boolean }>;
  verification: string[];
}

export interface BugDiagnosis {
  bugReport: string;
  reproduction: string[];
  executionTrace: string[];
  dataTrace: string[];
  rootCause: string;
  rootCauseConfidence: number;
  symptomFixRejected: string[];
  proposedFix: string;
  fixDiff?: string;
  testsToAdd: string[];
}

export interface ReviewFinding {
  severity: "info" | "minor" | "major" | "critical";
  category:
    | "correctness" | "readability" | "architecture" | "security"
    | "performance" | "error-handling" | "edge-case" | "concurrency"
    | "maintainability" | "tests";
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface ReviewReport {
  approved: boolean;
  productionReady: boolean;
  trustAnswer: string; // "Would I trust this code in production?" + why
  findings: ReviewFinding[];
  score: number; // 0..1
}

export interface SecurityFinding {
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string;
  message: string;
  file?: string;
  line?: number;
}

export interface PerfFinding {
  category: string;
  message: string;
  file?: string;
  estimatedImpact: "low" | "medium" | "high";
  suggestion: string;
}

export interface TestPlan {
  target: string;
  unit: string[];
  api?: Array<{ case: string; expected: number | string }>;
  ui?: string[];
  edge: string[];
}

export interface DecisionRecord {
  problem: string;
  options: string[];
  selectedApproach: string;
  reasoning: string;
  tradeoffs: string[];
  date: string;
}

export interface CodebaseMemorySnapshot {
  architecture: string;
  architecturePattern: ArchitecturePattern;
  designDecisions: DecisionRecord[];
  importantFiles: string[];
  importantSymbols: string[];
  dependencies: string[];
  dataFlows: DataFlow[];
  apiContracts: string[];
  dbRelationships: string[];
  knownBugs: string[];
  previousFixes: string[];
  testingStrategy: string;
  conventions: string[];
  preferences: string[];
  updatedAt: number;
}

export interface CodingBrainResult {
  response: string;
  plan: ImplementationPlan | null;
  impact: ImpactReport | null;
  understanding: CodeUnderstanding[];
  review: ReviewReport | null;
  tests: TestPlan | null;
  decisions: DecisionRecord[];
  memoryUpdated: boolean;
  durationMs: number;
}
