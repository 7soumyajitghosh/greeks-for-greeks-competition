# Architecture & Technical Understanding — DevFix AI Monorepo

> Single source of truth for how this repo is organized, how each subsystem works, and how data flows end-to-end. Verified against code on disk (Oct 2026).

## 1. Repo Map

```
plan.md / ui.plan.md          # Product spec (v1 scope, phased roadmap, UI direction)
backend/                      # DevFix AI backend — Express + Zod, rule-based analysis (Phase 2 done)
  src/index.js                # App entry, rate-limit, static serving
  src/routes/                 # analyze.js, followup.js, upload.js, history.js
  src/lib/                    # analyzer.js, rules.js, prompts.js, secrets.js, validator.js, store.js
  prisma/schema.prisma        # Phase 3 DB design (not yet wired)
  public/index.html           # Placeholder static frontend (no Next.js yet)
  test/*.test.js              # node:test suites
brain/                        # Unified AI Brain — coding + animation intelligence (TypeScript)
  index.ts                    # Public entry (UnifiedBrain, CodingBrain, AnimationBrain, loops)
  ARCHITECTURE.md / README.md # Brain-internal diagrams (supplement, not whole-repo view)
  core/                       # brain.ts (UnifiedBrain), orchestrator.ts, brain-loop.ts, state
  coding/                     # CodingBrain.ts + perception/graph/understanding/planning/generation/review
  animation/                  # Animation Brain (SEE→…→IMPROVE) + DSL/reconstruction/renderer/comparator
  codebase/ perception/ understanding/ cognition/ debugging/ testing/ review/
  memory/ context/ models/ agents/ tools/ loops/ security/ performance/ observability/ schemas/ config/
logscope/                     # Standalone log-analysis CLI (TypeScript, zero runtime deps)
  src/cli.ts                  # analyze | parse | templates commands
  src/analyze.ts              # File → AnalysisResult pipeline
  src/parser.ts drain.ts grouper.ts report.ts types.ts
```

**Key fact:** there are **three independent runtimes** with no cross-imports today. `backend` (JS/CJS), `brain` (TS), `logscope` (TS/ESM). The product vision (`plan.md`) describes a Next.js app that does not exist yet — `backend/public/index.html` is only a placeholder.

## 2. System Context

```
                    ┌─────────────────────────────────┐
                    │        Client (planned Next.js) │
                    │  Monaco + screenshot upload     │  ← NOT BUILT (placeholder page only)
                    └────────┬───────────────┬────────┘
                             │ code+error    │ screenshot
                             ▼               ▼
                    ┌─────────────────────────────────┐
                    │  backend/ (Express :4000)       │──► AI_API_URL (optional, else rule fallback)
                    │  /api/analyze|followup|upload   │──► uploads/ (local disk, 5MB png/jpg/webp)
                    │  /api/history                   │──► store.js (in-memory; Prisma in Phase 3)
                    └─────────────────────────────────┘
         ┌──────────────────────┐            ┌──────────────────────┐
         │ brain/ (library)     │            │ logscope/ (CLI)      │
         │ UnifiedBrain/Coding/ │            │ log file → report    │
         │ Animation brains     │            │ Drain + Sentry-style │
         │ NOT called by backend│            │ NOT called by backend│
         └──────────────────────┘            └──────────────────────┘
```

Planned production (per `plan.md` §2): Next.js 14 App Router + Tailwind/shadcn + Monaco + Prisma/Supabase Postgres + Auth.js + Upstash Redis + Vercel. Current backend is the **fallback Express path** (`plan.md` §2 last line) used to unblock Phase 2 without Next.js.

## 3. Backend — DevFix AI API (`backend/`)

Stack: `express@4 + zod@3 + multer + express-rate-limit + dotenv`. CJS (`require`). Entry `backend/src/index.js:1-35`.

### 3.1 Routes

| Route | File | Behavior |
|---|---|---|
| `GET /api/health` | `src/index.js:19` | `{ok:true, service}` liveness probe |
| `POST /api/analyze` | `src/routes/analyze.js:10-18` | Validate → `analyze()` → `201 {id:null, result}`. **Never persists** |
| `POST /api/analyze/save` | `src/routes/analyze.js:21-36` | Validate → `analyze()` → `redactSecrets()` → `store.save()` → `201 {id, result}`. **Only persistence path** |
| `POST /api/followup` | `src/routes/followup.js:7-24` | Keyword-matched answer (`why`→cause, `fix`→fix, `test`→regression advice). No AI call today |
| `POST /api/upload` | `src/routes/upload.js:21-27` | `multer` single `screenshot`, 5MB cap, MIME allowlist png/jpeg/webp, renames to `<hash><ext>`, returns `{screenshotUrl:/uploads/...}`. Served via `express.static` (`src/index.js:24`) |
| `GET /api/history`, `GET /api/history/:id` | `src/routes/history.js:7-16` | Newest-first list / by-id from in-memory Map. No auth, no pagination |
| `GET *` (non-API) | `src/index.js:26-29` | Serves `public/index.html` SPA fallback |

Cross-cutting: `express.json({limit:"1mb"})`, global `rateLimit({windowMs:1h, max:100})` on `/api/` (`src/index.js:16-17`), permissive `cors()`.

### 3.2 Analysis pipeline (`src/lib/analyzer.js:10-26`)

```
validate (Zod) → runRules() + detectSecrets() → try callAI() → finalize() ↘
                                                        ↓ fail/missing key  → ruleBasedResult() → finalize()
```

1. **Static checks first** — `runRules({code,error})` returns `findings[]`; `detectSecrets(code+"\n"+error)` returns hit names.
2. **AI-first** — `callAI(type, ctx)` (`src/lib/prompts.js:13-30`): no-op (`return null`) unless **both** `AI_API_KEY` and `AI_API_URL` set; POSTs `{prompt, temperature}` (0.2 fixes, 0.5 explain), 30s abort timeout; accepts `{result:{...}}`, `{text:"<json>"}` or raw object; any throw → rule fallback.
3. **Rule fallback** — `ruleBasedResult()` branches on `type`: `review_ui` (score + `uiProblems[]`), `explain` (generic reading guide), default (`fix_error|review_api|improvement_plan`).
4. **Finalize** (`analyzer.js:28-40`): prepends secret-revoke warning to `nextActions`, guarantees a "test before production" action, attaches `staticFindings: string[]`.

Result shape (per `plan.md` §4): `{issueSummary, severity(Low|Medium|High|Critical), category, likelyCause, suggestedFix, originalCode(≤4k), improvedCode(≤4k), explanation, nextActions[], uiScore?, uiProblems?}`.

### 3.3 Static rules (`src/lib/rules.js:3-110`)

10 regex/heuristic checks, no parser: `react-onclick-invoked` (High), `null-guard` (High, error-text driven), `missing-await` (High), `loose-equality` (Medium), `react-missing-key` (Medium), `fixed-width` (Medium, `\d{3,}px`), `a11y-input-label` (Medium), `a11y-img-alt` (Low), `sql-injection-risk` (High), `http-status` (Low). `applyFirstFix()` (`rules.js:113-126`) only rewrites 3 cases (onclick, `==`→`===`, img alt); otherwise echoes input.

### 3.4 Validation & safety

`src/lib/validator.js:11-20`: `type` enum (`fix_error|review_ui|review_api|explain|improvement_plan`), `language/framework` ≤50 chars (defaults `javascript/react`), `code` ≤50KB, `error` ≤20KB, `screenshotUrl` ≤2048 chars; requires ≥1 of code/error/screenshotUrl. `followupSchema`: `question` 1–5000 chars + optional prior-result context. Secrets (`src/lib/secrets.js:2-11`): 8 patterns (sk-, ghp_, AKIA, xox[baprs]-, private-key block, mongodb+srv creds, password/api_key assignments); `detectSecrets()` → names, `redactSecrets()` → masks 4 key formats (generic password assignments detected but not redacted — gap). Privacy rule enforced by design: persistence **only** in `/save` with redacted fields.

### 3.5 Storage

Today: `src/lib/store.js` — `Map<uuid, record>` + ISO timestamp, `list()` newest-first. Volatile (lost on restart), no user scoping. Phase 3 target `prisma/schema.prisma:10-54`: `User 1—N Project 1—N Analysis 1—N SavedFix`, `Analysis{type,language,framework,codeInput:Text,errorMessage:Text,screenshotUrl,result:Json,score}` + `@@index([userId, createdAt])`. Not wired — no `@prisma/client` dep, no migration runner.

Run/test: `cd backend && npm install && npm test (node --test) && node src/index.js (:4000)`. Env: see `backend/.env.example` (`PORT, AI_API_KEY, AI_API_URL, DATABASE_URL, UPLOAD_DIR`).

## 4. Brain — Unified AI Brain (`brain/`)

Stack: TypeScript library, no framework. Public API `brain/index.ts:4-20`. Two facades over one preserved `Brain` (`core/brain/Brain.ts`):

- `UnifiedBrain` (`core/brain.ts:15-48`) — composes `Brain` + `AnimationBrain`, exposes **shared singletons** via getters (`memory, tools, gateway, security, obs, codebase, rag`) so coding and animation paths share budgets/audit.
- `BrainOrchestrator` (`core/orchestrator.ts:21-46`) — `routeCapability(goal)` by regex (animation keywords → animation, code/bug/test/review/api → coding, else general); animation-understand vs animation-recreate split; everything else → `runBrainLoop`.

### 4.1 CodingBrain (`coding/CodingBrain.ts:87-229`)

Host-agnostic orchestrator (FS/typecheck/test runners **injected**, defaults are pass-through stubs — it never claims untested success). Pipeline:

```
perceiveFolder → CodebaseGraph + SymbolGraph + FlowAnalyzer → ArchitectureDetector + CodingStyleMemory
 → CodebaseMemory.load/recall → HumanCodeReader (≤5 files) → [bugReport? BugAnalysisEngine]
 → ImpactAnalyzer → HumanPlanner → CodeGenerationBrain.stage (staged increments, not blob)
 → runTypecheck → runTests → TestFixLoop.nextAction
 → SelfReviewer + SecurityBrain + PerformanceBrain + IndependentReviewer (disagreement blocks change)
 → RefactoringBrain signals + GitHistoryBrain hint → bounded perfection loop (maxPasses=3)
 → re-test → recordDecision/applyChange/noteImportant → TestingBrain.testPlan → response string
```

Guardrails (`CodingBrain.ts:42-48`): 12 forbiddens (no blind overwrites, no fake impls, no secret exposure, no unrelated files, intent-as-hypothesis, etc.). Output `CodingBrainResult`: `{response, plan, impact, understanding, review, tests, decisions, memoryUpdated, durationMs}`.

### 4.2 Animation path

`AnimationBrain` (`animation/api/brain.ts`, via `UnifiedBrain.analyzeAnimation/recreateAnimation`): `SEE→DETECT→TRACK→TIMELINE→TRIGGERS→EASING→SPATIAL→GRAPH→DSL→RECONSTRUCT→RENDER→COMPARE→IMPROVE`. Autonomous loop `loops/animation-loop/loop.ts`: `OBSERVE→UNDERSTAND→RECONSTRUCT→RENDER→COMPARE→DIFF→IMPROVE→RE-RENDER`.

### 4.3 Autonomous code loop (`core/brain-loop.ts`)

`OBSERVE→UNDERSTAND→PLAN→BUILD→RUN→TEST→ANALYZE→FIX→RETEST→REVIEW→OPTIMIZE→VERIFY` — used by `Orchestrator.run()` for all non-animation goals.

### 4.4 Shared services

`memory/` (short-term, episodic, semantic, codebase, decisions, patterns, animation + `MemoryManager`), `context/`, `models/` (`ModelGateway`, `SmartRouter`, `CodingModelRouter`, providers), `tools/` (fs, git, github, browser, web, terminal, code-execution + registries), `agents/`, `cognition/` (reasoning/planning/intent/decision/hypothesis/verification/self-evaluation), `understanding/` (code/intent/architecture/data-flow/control-flow/dependency/animation), `codebase/` (indexer/parser/symbol/dependency/architecture-graph/git-history), `loops/` (build/test/debug/improvement/animation/autonomous), `security/`, `performance/`, `observability/`, `schemas/`, `config/`, `token/`, `rag/`, `planner/`, `review/`, `testing/`, `debugging/`, `perception/`. Tests: `brain/__tests__/*.test.ts`.

## 5. LogScope — Log Analysis CLI (`logscope/`)

Stack: TS/ESM, `bin: logscope=dist/cli.js`, deps only `tsx/typescript/vitest`. Zero runtime deps.

Pipeline (`src/analyze.ts:31-78`):

```
readLines (stream) → parseLines → extractTemplates (Drain) → groupIssues (Sentry-style) → detectAnomalies → AnalysisResult
```

- **Parser** (`parser.ts`): auto-detects `json | iso | syslog | nginx | plain`; extracts `{timestamp, level, message, source}`; `inferLevel` by keyword fallback (`fatal>error>warn>info>debug`, default `info`).
- **Drain** (`drain.ts`, after He et al. ICWS'17): tokenize on `[A-Za-z0-9]+`, prefix tree keyed by first-token length then token-at-position (`depth=4`, `maxChildren=100`), token-similarity join (`threshold=0.5`), differing positions → `<*>` with char spans so templates render on real samples. `extractTemplates()` → `{templates, eventTemplateId}`.
- **Grouper** (`grouper.ts`): errors (or warn+ with `--include-warn`) grouped by FNV-1a fingerprint of `level::template` → `Issue{count, firstSeen/lastSeen, per-minute timeline, ≤5 samples, isNew (first in last 10% + count≥3), sparkline}`. **Anomalies**: z-score spike (`z≥3`), late-appearing template, 5-min error-surge (`>3×` overall + ≥5 errors).
- **CLI** (`cli.ts`): `analyze` (report + `--json/--csv-dir/--top/--format/--min-level/--depth/--threshold/--include-warn/--no-color`), `parse` (events JSON), `templates` (template table); multi-file merge in `analyzeFiles()` (`analyze.ts:81-160`). **Report** (`report.ts`): terminal summary + `exportJson` + logparser-compatible `templates.csv/structured.csv`.
- Types (`types.ts`): `LogEvent{timestamp|null,level,message,raw,source}`, `LogTemplate`, `Issue`, `Anomaly{spike|new_template|error_surge}`, `AnalysisResult{totalLines,parsedLines,timeRange,levelCounts,templates,issues,anomalies,durationMs}`.

Run: `npm run dev|demo|build|test (vitest)`, `generate:sample` for fixtures.

## 6. Data Flows (worked examples)

**Fix-error:** client POSTs `{type:fix_error, code:"…onClick={handleLogin()}…", error:"…"}` → Zod OK → `runRules` hits `react-onclick-invoked` → no AI key → `ruleBasedResult` picks top-severity finding → `applyFirstFix` rewrites to `onClick={handleLogin}` → `finalize` appends test disclaimer → `201 {id:null,result}`; `/save` variant additionally redacts + stores.

**UI review:** `{type:review_ui, code:"…width: 900px…<img src=…>…", screenshotUrl}` → `fixed-width` + `a11y-img-alt` findings → `uiScore = max(40, 100−n·8−(px?4:0))` + `uiProblems[]`.

**Follow-up:** `{question:"why…?", context:{likelyCause…}}` → keyword branch → `{answer}` (no model call).

**LogScope:** `logscope analyze app.log --json out.json` → stream lines → parse → Drain templates → fingerprint issues → z-score/new-template/surge anomalies → terminal report + JSON.

## 7. Current State vs Plan, Gaps & Risks

| Plan phase | Status |
|---|---|
| Phase 1 (Next.js UI: landing/dashboard/analyze/results) | **Missing** — only `backend/public/index.html` placeholder |
| Phase 2 (debugging core) | **Done (rule path)** — analyze/followup/upload/history + 10 rules + secrets + rate-limit; AI path stubbed behind env |
| Phase 3 (auth + history) | **Not started** — schema exists, no Prisma client/auth/ownership |
| Phase 4 (UI screenshot analysis) | **Partial** — upload + heuristic score only; no vision model, no a11y audit |
| `brain/`, `logscope/` integration | **Not integrated** — libraries exist, backend does not import them |

Risks/notes: in-memory history is volatile and unscoped (anyone lists all); `followup` is keyword templates, not grounded generation; `redactSecrets` misses generic password/api_key assignments on write; `missing-await` regex is naive (any `await` anywhere suppresses); global rate-limit (100/h) is per-instance, no Redis; `uploads/` on local disk won't survive Vercel/serverless; no pagination, no MIME re-sniff server-side beyond multer, no min-resolution check.

## 8. How to Verify / Extend

- Backend: `cd backend && npm test` → `node src/index.js` → `curl POST localhost:4000/api/analyze` with `fix_error` body; set `AI_API_KEY+AI_API_URL` to exercise AI branch.
- Brain: `import {UnifiedBrain,getOrchestrator} from "brain/index"` → `run({goal})` / `analyzeAnimation()`; inject real `runTypecheck/runTests` before trusting `CodingBrain` verdicts.
- LogScope: `npm run demo` / `logscope analyze <file> --json out.json`.
- Next build steps per `plan.md` §12: scaffold Next.js + shadcn + Monaco + Zod + Prisma; wire `backend` logic into Route Handlers or keep Express and point the UI at `:4000`; swap `store.js`→Prisma, add Auth.js, move uploads to Supabase Storage, connect a vision-capable model for `review_ui`, optionally call `brain/`/`logscope` as libraries from the analysis service.
