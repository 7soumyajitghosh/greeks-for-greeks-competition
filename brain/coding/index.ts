// Public entry point for the Human-Like Coding Brain (§1–§29).
export * from "./types";
export { CodePerceptionEngine, detectLanguage } from "./perception/CodePerceptionEngine";
export { CodebaseGraph } from "./graph/CodebaseGraph";
export { SymbolGraph } from "./graph/SymbolGraph";
export { FlowAnalyzer } from "./graph/FlowAnalyzer";
export { HumanCodeReader, IntentEngine, ArchitectureDetector } from "./understanding/Understanding";
export { CodebaseMemory, InMemoryCodebaseStore, type MemoryStore } from "./memory/CodebaseMemory";
export { CodingStyleMemory, type StyleProfile } from "./style/CodingStyleMemory";
export { HumanPlanner, ImpactAnalyzer } from "./planning/Planning";
export { BugAnalysisEngine } from "./bugs/BugAnalysisEngine";
export { CodeGenerationBrain, TestFixLoop, RefactoringBrain, GitHistoryBrain } from "./generation/Generation";
export { SelfReviewer, IndependentReviewer, SecurityBrain, PerformanceBrain, TestingBrain } from "./review/Review";
export { CodingModelRouter, type RoleRoute } from "./models/CodingModelRouter";
export { CodingBrain, type CodingBrainDeps, type CodingRequest } from "./CodingBrain";
