# Animation Understanding Brain

Production-grade animation intelligence layer: **SEE → UNDERSTAND → REPRESENT → REMEMBER → RECREATE → MODIFY → COMPARE → IMPROVE.**

Not an animation generator. A brain specialized in *understanding* animation.

## Pipeline

```
ANIMATION INPUT → CAPTURE/PARSE → VISUAL UNDERSTANDING → ELEMENT DETECTION
→ MOTION TRACKING → TIMELINE → TRIGGERS → EASING → SPATIAL → GRAPH
→ ADL → MEMORY → RECONSTRUCTION → CODEGEN → RENDER → COMPARE → IMPROVE → RENDER AGAIN
```

## Layout (`brain/animation/`)

| Area | Path | Responsibility |
|---|---|---|
| perception | `perception/source-router.ts` | Classify URL / video / gif / recording / image-sequence / code |
| source-analyzer | `source-analyzer/{html,css,js}-analyzer.ts`, `dependency-map.ts` | DOM, keyframes/transforms/easings, GSAP/FM/Anime/Motion/WAPI/rAF/observers, cross-system map |
| visual-analyzer | `visual-analyzer/{element-detector, motion-tracker, frame-sampler}.ts` | Stable element ids, MotionTracks, synthetic frames |
| timeline | `timeline-engine/timeline.ts` | Causal ordered events + pretty printer |
| triggers | `trigger-engine/triggers.ts` | PAGE_LOAD…ANIMATION_END mapping |
| easing | `easing-engine/easing.ts` | Exact parse or closest-curve estimate with confidence |
| spatial | `spatial-engine/spatial.ts` | child-of / follows / orbits / attaches / originates / detaches / camera-follows |
| graph | `animation-graph/graph.ts` | Causal DAG + ASCII chain |
| ADL | `animation-dsl/adl.ts` | `adl/1` schema, validator, builder, NL modifier (§18) |
| memory | `animation-memory/pattern-memory.ts` | Reusable patterns (branch growth, drift, reveal, bloom, push-in) |
| reconstruction | `reconstruction/engine.ts` | Simplest-capable tech selection + ADL frame renderer |
| codegen | `code-generator/generator.ts` | Modular per-tech files (css/svg/canvas/gsap/fm/wapi/three) |
| comparator | `visual-comparator/comparator.ts` | Position/timing/easing/scale/rotation/opacity/particles/transitions diagnostics |
| optimizer | `optimizer/loop.ts` | Bounded improve loop (target / budget / no-improvement) |
| agents | `agents/animation-agent.ts` | Full OBSERVE…VERIFY autonomous loop |
| api | `api/brain.ts` | `AnimationBrain`: `analyze` / `describe` / `recreate` / `modify` |
| tests | `__tests__/animation-brain.test.ts` | 20 behavior + regression tests (`vitest run`) |

## Usage

```ts
import { AnimationBrain } from "./animation-brain";

const brain = new AnimationBrain();

// "What exactly is happening in this animation?"
const u = brain.analyze(htmlCssJs);
console.log(brain.describe(u));
// Technology: gsap + SVG … Objects: 9 … Confidence: 0.91

// "How can I recreate it?"
const { plan, report } = brain.recreate(htmlCssJs);
// plan.files → modular components; report.similarity → 0..100 diagnostics

// "Modify it" — edits the ADL, not unrelated code:
const { adl, changes } = brain.modify(u.adl, "Make the tree grow 30% slower");
const hearts = brain.modify(u.adl, "Replace the leaves with hearts");
```

Supported NL edits: `% slower/faster`, `replace X with Y`, `follow the wind`,
`remove the scroll interaction`, `make watering trigger the growth`,
`fly toward the camera`, `more organic`.

## Evidence rule (§20)

Every important inference carries `{ value, source, confidence, method }` where
`source` is `exactly-observed` | `inferred` | `approximated`. Approximations are
never presented as exact — see `evidence.ts` and `UnderstandingResult.evidence`.

## Dashboard

`src/components/AnimationBrainDashboard.tsx` — paste input → understanding report,
causal timeline, graph chain, NL modify box, live ADL, similarity diagnostics.

## Verify

```sh
npm test        # vitest run (20 tests)
npm run typecheck
npm run build
```
