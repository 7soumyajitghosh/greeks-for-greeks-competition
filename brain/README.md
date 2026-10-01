# Unified AI Brain

ONE root: `brain/` — ALL AI intelligence lives here.

Animation Brain + Human-Like Coding Brain + Autonomous Loop + Memory +
Reasoning + Agents + Tools + Model Router = ONE unified `brain/`.

## Layout

- `core/` — `brain.ts` (UnifiedBrain), `brain-loop.ts`, `cognitive-state.ts`,
  `task-state.ts`, `orchestrator.ts` + preserved `brain/Brain.ts`
- `perception/` — input / code / repository / website / animation / visual
- `understanding/` — code / intent / architecture / data-flow / control-flow /
  dependency-analysis / animation (7 stages)
- `animation/` — preserved Animation Brain (SEE → DETECT → TRACK → TIMELINE →
  TRIGGERS → EASING → SPATIAL → GRAPH → DSL → RECONSTRUCT → RENDER →
  COMPARE → IMPROVE) + barrels (`analyzer`, `parser`, `understanding`,
  `animation-dsl`, `reconstruction`, `renderer`, `comparator`, `optimizer`,
  `patterns`, `memory`)
- `codebase/` — indexer / parser / symbol-graph / dependency-graph /
  architecture-graph / data-flow / git-history / codebase-memory
- `cognition/` — reasoning / planning / intent / decision / hypothesis /
  verification / self-evaluation
- `coding/` — preserved Human-Like Coding Brain (READ → INTENT → ARCHITECTURE →
  MODEL → PLAN → WRITE → RUN → DEBUG → TEST → REVIEW → REFACTOR → VERIFY)
- `debugging/`, `testing/`, `review/`
- `memory/`, `context/`, `models/`, `agents/`, `tools/` — SHARED services
  (no duplicates; coding and animation brains use the same instances)
- `loops/` — build / test / debug / improvement / animation / autonomous
- `security/`, `performance/`, `observability/`, `schemas/`, `config/`

## Preserved capabilities (19)

1. Animation Understanding, 2. Animation Analysis/Reconstruction,
3. Autonomous Build→Test→Fix→Improve, 4. Human-Like Coding,
5. Code Understanding, 6. Codebase Memory, 7. Reasoning, 8. Planning,
9. Debugging, 10. Testing, 11. Code Review, 12. Model Routing, 13. Agents,
14. Tools, 15. Context, 16. Memory, 17. Security, 18. Performance,
19. Self-Evaluation.

Original implementations were consolidated into `brain/*`
and `brain/animation/*` as the single source of truth.
Duplicate copies (`brain/ai-brain/*`, `brain/animation-brain/*`) and
backward-compat shims (`src/ai-brain`, `src/animation-brain`) were removed;
UI imports point directly at `brain/`.

## Usage

```ts
import { UnifiedBrain, getOrchestrator } from "./brain/index";
// or: import { Brain } from "./brain/core/brain/Brain";
const brain = new UnifiedBrain();
await brain.run({ goal: "Explain model routing" });
brain.analyzeAnimation("<div>...</div>");
```

Central loops:

- Code: OBSERVE → UNDERSTAND → PLAN → BUILD → RUN → TEST → ANALYZE →
  FIX → RETEST → REVIEW → OPTIMIZE → VERIFY (`brain/core/brain-loop.ts`)
- Animation: OBSERVE → UNDERSTAND → RECONSTRUCT → RENDER → COMPARE →
  FIND DIFFERENCE → IMPROVE → RENDER AGAIN (`brain/loops/animation-loop/loop.ts`)
