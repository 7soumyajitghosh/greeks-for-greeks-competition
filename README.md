# Fixa AI — Find bugs. Improve design. Build faster.

> A developer-support platform that explains **what's wrong, why it's wrong, and how to fix it** — for code, UI, APIs, and logs.
>
> Built for the GeeksforGeeks competition.

[![Node](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Backend tests](https://img.shields.io/badge/backend-5%20tests%20passing-brightgreen)](#-verify-it-works)
[![LogScope](https://img.shields.io/badge/logscope-zero--deps-orange)](#-logscope--log-analysis-cli)

🌐 **Live Demo: [https://sources-rep-carl-members.trycloudflare.com/](https://sources-rep-carl-members.trycloudflare.com/)**

**Try it in 60 seconds:**

```bash
cd backend && npm install && npm test && node src/index.js
# in another terminal:
curl -X POST http://localhost:4000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"fix_error","language":"javascript","framework":"react","code":"<button onClick={handleLogin()}>Login</button>","error":"Too many re-renders"}'
```

Returns a structured result with `issueSummary`, `severity`, `likelyCause`, `suggestedFix`, `improvedCode`, `explanation`, and `nextActions`.

---

## Table of contents

- [🌐 Live Demo](#-live-demo)
- [What is Fixa AI?](#-what-is-fixa-ai)
- [What works today](#-what-works-today)
- [Architecture](#-architecture)
- [Repository structure](#-repository-structure)
- [Quick start](#-quick-start)
- [API reference](#-api-reference)
- [Configuration](#-configuration)
- [Brain — Unified AI Brain](#-brain--unified-ai-brain)
- [LogScope — log analysis CLI](#-logscope--log-analysis-cli)
- [Verify it works](#-verify-it-works)
- [Roadmap](#-roadmap)
- [Safety, privacy & limits](#-safety-privacy--limits)
- [Contributing](#-contributing)
- [License & acknowledgments](#-license--acknowledgments)
- [Docs index](#-docs-index)

---

## 🌐 Live Demo

**App:** [https://sources-rep-carl-members.trycloudflare.com/](https://sources-rep-carl-members.trycloudflare.com/)

```bash
# Health check (live)
curl https://sources-rep-carl-members.trycloudflare.com/api/health
# {"ok":true,"service":"fixa-ai-backend"}

# Analyze (live)
curl -X POST https://sources-rep-carl-members.trycloudflare.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"fix_error","language":"javascript","framework":"react","code":"<button onClick={handleLogin()}>Login</button>","error":"Too many re-renders"}'
```

> Local dev still runs on `http://localhost:4000` (see [Quick start](#-quick-start)).

---

## 🧠 What is Fixa AI?

Paste code + an error (or a UI snippet / screenshot) and get back a **structured, explainable result** — not just fixed code, but the reasoning a senior dev would give you.

```
Your Code ──►                   ──► Fixed Code + Why
Your UI   ──►   Fixa AI   ──► UI Score + Actionable Fixes
Your Logs ──►   (Brain +        ──► Templates, Issues, Anomalies
Your API  ──►    LogScope)      ──► Optimized Backend Guidance
```

Example:

```diff
- const total = items.reduce((a, b) => a + b.price);      // NaN when price is missing
+ const total = items.reduce((a, b) => a + (b.price ?? 0), 0);
# Why: nullish coalescing stops NaN propagation when price is undefined.
```

Example (LogScope):

```bash
logscope analyze ./logs/production.log

  🔴 CRITICAL  12 occurrences  Database connection pool exhausted
  🟡 WARNING   47 occurrences  Slow query detected (>2000ms)
  🟢 INFO     891 occurrences  Request completed successfully
```

---

## ✅ What works today

| Component | Status | Notes |
|-----------|--------|-------|
| `backend/` Express API | **Working (Phase 2)** | Rule-based analysis works with no API key; AI augmentation is opt-in |
| `logscope/` CLI | **Working standalone** | Zero runtime deps; Drain parsing + Sentry-style grouping + anomaly detection |
| `brain/` TypeScript library | **Library only, not wired to backend** | `UnifiedBrain` / `CodingBrain` / `AnimationBrain` — import and use directly |
| Next.js frontend | **Not built** | `backend/public/index.html` is a placeholder only |
| Auth + Postgres persistence | **Not built** | Schema designed in `backend/prisma/schema.prisma`; runtime store is in-memory |

> Honest scope: there are **three independent runtimes** (`backend` JS/CJS, `brain` TS, `logscope` TS/ESM) with no cross-imports today. See [ARCHITECTURE.md](./ARCHITECTURE.md) — the verified single source of truth.

---

## 🏗️ Architecture

```
              ┌─────────────────────────────────┐
              │  Client (Next.js planned)       │
              │  Monaco + screenshot upload     │  ← NOT BUILT (placeholder only)
              └────────┬───────────────┬────────┘
                       │ code+error    │ screenshot
                       ▼               ▼
              ┌─────────────────────────────────┐
              │  backend/ (Express :4000)       │──► AI_API_URL (optional, else rule fallback)
              │  /api/analyze|followup|upload   │──► uploads/ (local disk, 5 MB png/jpg/webp)
              │  /api/history                   │──► store.js (in-memory; Prisma in Phase 3)
              └─────────────────────────────────┘
   ┌──────────────────────┐            ┌──────────────────────┐
   │ brain/ (library)     │            │ logscope/ (CLI)      │
   │ UnifiedBrain/Coding/ │            │ log file → report    │
   │ Animation brains     │            │ Drain + Sentry-style │
   │ NOT called by backend│            │ NOT called by backend│
   └──────────────────────┘            └──────────────────────┘
```

**Analysis pipeline** (`backend/src/lib/analyzer.js`):

```
validate (Zod) → runRules() + detectSecrets() → try callAI() → finalize()
                                            ↓ fail / no key → ruleBasedResult() → finalize()
```

- Static checks run first (10 regex/heuristic rules, no parser).
- AI is tried only if **both** `AI_API_KEY` and `AI_API_URL` are set (30 s timeout). Any failure falls back to rules.
- Persistence happens **only** on `POST /api/analyze/save` (explicit save, secrets redacted). Plain `/api/analyze` never stores.

Result shape:

```json
{
  "issueSummary": "Login button does not work",
  "severity": "High",
  "category": "Frontend / JavaScript",
  "likelyCause": "...",
  "suggestedFix": "...",
  "originalCode": "...",
  "improvedCode": "...",
  "explanation": "...",
  "nextActions": ["..."],
  "uiScore": 72
}
```

Full details: [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`plan.md`](./plan.md), [`ui.plan.md`](./ui.plan.md).

---

## 📁 Repository structure

```
greeks-for-greeks-competition/
├── backend/                 # ✅ Express API (Phase 2 done)
│   ├── src/index.js         # Entry, rate-limit, static serving (:4000)
│   ├── src/routes/          # analyze.js, followup.js, upload.js, history.js
│   ├── src/lib/             # analyzer.js, rules.js, prompts.js, secrets.js, validator.js, store.js
│   ├── prisma/schema.prisma # Phase 3 DB design (not yet wired)
│   ├── public/index.html    # Placeholder frontend (no Next.js yet)
│   └── test/*.test.js       # node:test suites (5 passing)
│
├── brain/                   # 📚 TS intelligence library (not called by backend)
│   ├── index.ts             # Public entry: UnifiedBrain, CodingBrain, AnimationBrain, loops
│   ├── core/                # UnifiedBrain, orchestrator, brain-loop, state
│   ├── coding/              # Human-like pipeline: READ → PLAN → WRITE → RUN → DEBUG → TEST → REVIEW
│   ├── animation/           # SEE → DETECT → TRACK → RECONSTRUCT → RENDER → COMPARE → IMPROVE
│   ├── memory/ context/ models/ agents/ tools/ loops/
│   ├── security/ performance/ observability/ cognition/ understanding/ codebase/
│   └── ARCHITECTURE.md / README.md
│
├── logscope/                # ✅ Standalone log CLI (zero runtime deps)
│   └── src/                 # cli.ts, analyze.ts, parser.ts, drain.ts, grouper.ts, report.ts, types.ts
│
├── ARCHITECTURE.md          # Verified system map, data flows, gaps & risks
├── plan.md                  # Product spec + phased roadmap
├── ui.plan.md               # UI/animation direction
└── README.md                # This file
```

---

## 🚀 Quick start

### Prerequisites

- Node.js 18+
- npm (or pnpm)
- Optional: PostgreSQL 14+ (Phase 3 only, not required today)
- Optional: an AI provider endpoint (only if you want AI augmentation)

### 1. Backend API (the working product)

```powershell
cd backend
npm install
npm test          # node --test, 5 tests should pass
node src/index.js # listens on :4000
```

Open `http://localhost:4000` (placeholder page) or hit the API:

```bash
curl http://localhost:4000/api/health
# {"ok":true,"service":"fixa-ai-backend"}
```

### 2. LogScope CLI

```bash
cd logscope
npm install
npm run build
npm run demo                    # analyzes test/sample.log
node dist/cli.js analyze ./test/sample.log --json out.json
```

More commands:

```bash
node dist/cli.js parse ./logs/app.log --format json
node dist/cli.js templates ./logs/app.log
node dist/cli.js analyze ./logs/app.log --export csv --top 20
```

### 3. Brain library

```ts
import { UnifiedBrain, getOrchestrator } from "./brain/index";

const brain = new UnifiedBrain();
await brain.run({ goal: "Explain model routing" });
brain.analyzeAnimation("<div>...</div>");
```

> `CodingBrain` expects `runTypecheck` / `runTests` runners to be injected — defaults are pass-through stubs, so inject real ones before trusting verdicts. See [`brain/README.md`](./brain/README.md).

---

## 🔌 API reference

Live base URL: `https://sources-rep-carl-members.trycloudflare.com` — local dev: `http://localhost:4000`

| Method & path | Body / input | Returns |
|---------------|--------------|---------|
| `GET /api/health` | — | `{ok:true, service}` |
| `POST /api/analyze` | `{type, language?, framework?, code?, error?, screenshotUrl?}` | `201 {id:null, result}` — never persists |
| `POST /api/analyze/save` | same as above | `201 {id, result}` — redacts secrets, stores in-memory |
| `POST /api/followup` | `{question, context?, analysisId?}` | `{answer}` (keyword-matched today: `why`→cause, `fix`→fix, `test`→regression advice) |
| `POST /api/upload` | multipart field `screenshot` (png/jpeg/webp, 5 MB max) | `{screenshotUrl:/uploads/...}` |
| `GET /api/history` | — | newest-first list (volatile, unscoped) |
| `GET /api/history/:id` | — | single record |

`type` enum: `fix_error | review_ui | review_api | explain | improvement_plan`

Limits (Zod): `code` ≤ 50 KB, `error` ≤ 20 KB, `language/framework` ≤ 50 chars, `screenshotUrl` ≤ 2048 chars. At least one of `code`/`error`/`screenshotUrl` required. Global rate limit: 100 req/hour per instance on `/api/`.

**Fix-error example:**

```bash
curl -X POST http://localhost:4000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"fix_error","language":"javascript","framework":"react","code":"<button onClick={handleLogin()}>Login</button>","error":"Too many re-renders"}'
```

**UI-review example:**

```bash
curl -X POST http://localhost:4000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"review_ui","code":"<img src=x><div style=\"width:900px\">hi</div>"}'
# → uiScore = max(40, 100 − n·8 − (px?4:0)) + uiProblems[]
```

**Upload example:**

```bash
curl -X POST http://localhost:4000/api/upload \
  -F screenshot=@./shot.png
```

Static rules today (10 checks): `react-onclick-invoked`, `null-guard`, `missing-await`, `loose-equality`, `react-missing-key`, `fixed-width`, `a11y-input-label`, `a11y-img-alt`, `sql-injection-risk`, `http-status`. Only 3 auto-fix (onclick, `==`→`===`, img alt); others echo input with guidance. See [`backend/README.md`](./backend/README.md).

---

## ⚙️ Configuration

`backend/.env.example`:

```env
PORT=4000
AI_API_KEY=
AI_API_URL=
DATABASE_URL="postgresql://user:password@localhost:5432/fixa"
UPLOAD_DIR="./uploads"
```

| Var | Required? | Effect |
|-----|-----------|--------|
| `PORT` | No (default 4000) | Listen port |
| `AI_API_KEY` + `AI_API_URL` | No — both must be set to enable AI | `POST {prompt, temperature}` (0.2 fixes, 0.5 explain), 30 s abort; accepts `{result:{...}}`, `{text:"<json>"}`, or raw object; any error → rule fallback |
| `DATABASE_URL` | Phase 3 only (unused today) | Target Prisma/Supabase Postgres |
| `UPLOAD_DIR` | No | Local screenshot dir (won't survive serverless — move to Supabase Storage in Phase 3) |

---

## 🧠 Brain — Unified AI Brain

Modular TS library: perception → cognition → memory → action, with shared singletons (`memory, tools, gateway, security, obs, codebase, rag`) across coding and animation paths.

| Module | Does |
|--------|------|
| **CodingBrain** | `READ → INTENT → ARCHITECTURE → MODEL → PLAN → WRITE → RUN → DEBUG → TEST → REVIEW → REFACTOR → VERIFY` with 12 guardrails (no blind overwrites, no fake impls, …) |
| **AnimationBrain** | `SEE → DETECT → TRACK → TIMELINE → TRIGGERS → EASING → SPATIAL → GRAPH → DSL → RECONSTRUCT → RENDER → COMPARE → IMPROVE` |
| **Autonomous loop** | `OBSERVE → UNDERSTAND → PLAN → BUILD → RUN → TEST → ANALYZE → FIX → RETEST → REVIEW → OPTIMIZE → VERIFY` |
| **Shared services** | Memory (short-term/semantic/episodic/codebase), ModelGateway + SmartRouter, tools, agents, security, observability |

Tests: `brain/__tests__/*.test.ts`. Details: [`brain/README.md`](./brain/README.md), [`brain/ARCHITECTURE.md`](./brain/ARCHITECTURE.md).

---

## 📊 LogScope — log analysis CLI

Pipeline: `readLines (stream) → parseLines → extractTemplates (Drain) → groupIssues (Sentry-style) → detectAnomalies → AnalysisResult`

- **Parser:** auto-detects `json | iso | syslog | nginx | plain`; extracts `{timestamp, level, message, source}`.
- **Drain** (He et al. ICWS'17): prefix tree (`depth=4`, `maxChildren=100`, `threshold=0.5`); differing tokens → `<*>`.
- **Grouper:** FNV-1a fingerprint of `level::template`; tracks count, first/last seen, per-minute timeline, samples, `isNew`, sparkline.
- **Anomalies:** z-score spike (`z≥3`), late-appearing template, 5-min error surge (`>3×` + ≥5 errors).
- **CLI:** `analyze` (`--json/--csv-dir/--top/--format/--min-level/--depth/--threshold/--include-warn/--no-color`), `parse`, `templates`; multi-file merge; terminal + JSON + `templates.csv/structured.csv` export.

Supported `--format`: `auto | json | iso | syslog | nginx | plain`

---

## ✔️ Verify it works

```powershell
cd backend; npm test
# 5 passing: onClick bug, null-read, secrets, structured result, empty-input validation

node src/index.js
curl -X POST http://localhost:4000/api/analyze -H "Content-Type: application/json" -d '{"type":"fix_error","code":"if (a == 1) {}","error":"x is null"}'
# check: findings mention loose-equality / null-guard, improvedCode uses === / guard
```

```bash
cd logscope; npm run demo
# check: terminal summary + templates + issues render without error
```

---

## 🗺️ Roadmap

```
Phase 1          Phase 2          Phase 3          Phase 4
─────────        ─────────        ─────────        ─────────
✅ Brain Core    ✅ Debug API     ⬜ Auth + DB     ⬜ UI vision
✅ LogScope      ✅ Rules+secrets ⬜ Save→Prisma   ⬜ Score+a11y audit
✅ API skeleton  ✅ Upload+history⬜ Ownership     ⬜ Storage→Supabase
```

- [x] Unified Brain architecture (library)
- [x] LogScope CLI + multi-format parser + Drain templates + Sentry-style grouping
- [x] `POST /api/analyze`, `/analyze/save`, `/followup`, `/upload`, `/history`
- [x] 10 static rules + secret detector + rate limit
- [ ] Next.js + Tailwind + shadcn + Monaco UI (landing, dashboard, analyze/new, analyze/[id])
- [ ] Auth.js + Prisma wiring (replace in-memory `store.js`, add per-user ownership)
- [ ] Uploads → Supabase Storage; vision model for `review_ui`
- [ ] Call `brain/` / `logscope/` as libraries from the analysis service
- [ ] Post-competition: GitHub/PR review, team workspaces, CI/CD, plugin SDK

Next build steps (from `plan.md` §12): scaffold Next.js → 4 screens with mock data → wire `/api/analyze` for JS/React → add Auth + Supabase + save/history/export → add screenshot upload + UI score → polish + deploy to Vercel.

---

## 🔒 Safety, privacy & limits

- Code is stored **only** when the user hits Save (`POST /api/analyze/save`). Say this in the UI.
- History is currently **in-memory, volatile, and unscoped** (anyone can list all) — must fix with auth + row ownership before production.
- Secrets: 8 patterns detected (`sk-`, `ghp_`, `AKIA`, `xox[baprs]-`, private-key block, `mongodb+srv` creds, password/api_key assignments); 4 key formats redacted on save. Generic password assignments are detected but not redacted — known gap.
- Uploads: 5 MB, png/jpg/webp, MIME allowlist; stored on local disk (not serverless-safe).
- `missing-await` check is regex-naive; `followup` is keyword templates, not grounded generation; global rate limit is per-instance (no Redis).
- Every result carries: *“Automated suggestions — review and test before production use.”*

---

## 🤝 Contributing

1. Fork → `git checkout -b feature/amazing-feature`
2. Keep changes atomic; add tests (`backend`: `node --test`; `logscope`: `vitest run`)
3. Update docs (`README.md` / `ARCHITECTURE.md`) when behavior changes
4. Push → open a Pull Request

Please follow existing style (CJS in `backend`, ESM+TS in `logscope`/`brain`) and don't add cross-runtime imports without discussion — the three runtimes are intentionally independent today.

---

## 📜 License & acknowledgments

MIT License — see [LICENSE](./LICENSE).

Thanks to [GeeksforGeeks](https://www.geeksforgeeks.org/) for the competition, and to [Next.js](https://nextjs.org/), [Prisma](https://www.prisma.io/), [shadcn/ui](https://ui.shadcn.com/), and [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the stack we build on.

<p align="center"><sub>Built with care by the Fixa AI team — ⭐ star this repo if it's useful!</sub></p>

---

## 📚 Docs index

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — verified system map (start here for truth)
- [`plan.md`](./plan.md) — product spec, API contracts, DB design, build order
- [`ui.plan.md`](./ui.plan.md) — animation & UI direction
- [`backend/README.md`](./backend/README.md) — backend quick ref
- [`brain/README.md`](./brain/README.md) + [`brain/ARCHITECTURE.md`](./brain/ARCHITECTURE.md) — Brain internals
