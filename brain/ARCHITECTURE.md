# ARCHITECTURE — Unified AI Brain

                    ┌──────────────┐
                    │     BRAIN    │  brain/core/brain.ts (UnifiedBrain)
                    └──────┬───────┘  brain/core/orchestrator.ts
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   PERCEPTION         COGNITION          MEMORY
   brain/             brain/             brain/
   perception/        cognition/         memory/
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
        CODING BRAIN              ANIMATION BRAIN
        brain/coding/             brain/animation/
             │                           │
        CODEBASE BRAIN             VISUAL BRAIN
        brain/codebase/            brain/perception/visual/
             │                           │
        DEBUGGING                 RECONSTRUCTION
        brain/debugging/          brain/animation/reconstruction/
             │                           │
        TESTING                    COMPARISON
        brain/testing/             brain/animation/comparator/
             │                           │
             └─────────────┬─────────────┘
                           │
                       EVALUATION
                       brain/cognition/self-evaluation/
                           │
                       IMPROVEMENT
                       brain/loops/improvement-loop/

## Shared services (single instances)

- `brain/memory/` + `brain/context/` + `brain/models/` + `brain/tools/`
  + `brain/agents/` + `brain/security/` + `brain/observability/`
  + `brain/cognition/` + `brain/loops/`

`UnifiedBrain` exposes them via getters (`memory`, `tools`, `gateway`,
`security`, `obs`, `codebase`, `rag`) so coding and animation paths share
state, budgets, and audit trails.

## Pipelines

Human-like coding:
READ → INTENT → ARCHITECTURE → MODEL → PLAN → WRITE → RUN → DEBUG →
TEST → REVIEW → REFACTOR → VERIFY (`brain/coding/CodingBrain.ts`)

Animation:
SEE → DETECT → TRACK → TIMELINE → TRIGGERS → EASING → SPATIAL →
GRAPH → DSL → RECONSTRUCT → RENDER → COMPARE → IMPROVE
(`brain/animation/api/brain.ts`)

Autonomous code loop:
OBSERVE → UNDERSTAND → PLAN → BUILD → RUN → TEST → ANALYZE →
FIX → RETEST → REVIEW → OPTIMIZE → VERIFY (`brain/core/brain-loop.ts`)

Autonomous animation loop:
OBSERVE → UNDERSTAND → RECONSTRUCT → RENDER → COMPARE →
FIND DIFFERENCE → IMPROVE → RENDER AGAIN
(`brain/loops/animation-loop/loop.ts`)

## Migration notes

- Single source of truth: `brain/**` and `brain/animation/**`.
- Duplicate copies (`brain/ai-brain/**`, `brain/animation-brain/**`) removed.
- Old `src/ai-brain/**` and `src/animation-brain/**` shims removed;
  UI imports point directly at `brain/**`.
- New files only ADD: `brain/core/{brain,brain-loop,task-state,
  cognitive-state,orchestrator}.ts`, `brain/schemas/*`,
  `brain/config/brain-config.ts`, `brain/loops/*/loop.ts`,
  per-folder barrels, `brain/index.ts`.
