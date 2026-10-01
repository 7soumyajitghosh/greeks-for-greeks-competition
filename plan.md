# Fixa AI — Build Plan

> Tagline: "Find bugs, improve design, and build faster."
> Pitch: Fixa AI is a web-based developer-support platform that helps programmers find bugs, improve frontend design, review backend logic, and understand code fixes. Users can paste code, error messages, or UI screenshots and receive structured, explainable suggestions.

## 1. Goal & Scope

Build a web-based developer assistant that helps developers:
- Diagnose bugs + propose corrected code
- Improve UI/frontend design (layout, responsive, a11y, contrast)
- Get backend guidance (API, DB, auth, validation, perf)
- Learn why the fix works, not just copy-paste

Out of scope for v1: GitHub PR review, team collab, auto-ticketing, URL-based UI crawl, perf/security deep scans. Those are Phase 5.

## 2. Tech Stack (decided)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14+ (App Router) + React | One deploy, API routes built-in |
| Styling | Tailwind CSS + shadcn/ui | Responsive fast, accessible primitives |
| Code editor | Monaco Editor (@monaco-editor/react) | VS Code-like, lang support |
| Markdown/code display | react-markdown + rehype-highlight | For results/explanations |
| Backend | Next.js API Routes (Route Handlers) | No separate Express server for MVP; extract later if needed |
| DB | PostgreSQL + Prisma | Use Supabase Postgres (free, storage + auth backup) |
| Auth | Auth.js (NextAuth v5) | GitHub/Google + credentials; Clerk as alternative if time is short |
| File storage | Supabase Storage (or S3) | Screenshots only, private buckets |
| AI analysis | AI API + rule-based pre-checks | Prompt templates per analysis type; rules for secrets, quick wins |
| Deployment | Vercel (app) + Supabase (db/storage) | Student-friendly, free tiers |
| Validation | Zod | Shared client/server schemas |
| Rate limit | Upstash Redis (or in-memory for dev) | Prevent abuse on /api/analyze |

Fallback starter stack if blocked: React (Vite) + Tailwind + Node/Express + MongoDB/Supabase. Prefer Next.js path above.

## 3. User Flow

1. Land on marketing page -> "Try Code Fixer" (no login) or "Create Account".
2. Dashboard: recent projects, issue counts, recent analyses, [New Analysis].
3. New Analysis: pick task (Fix error / Review UI / Review API / Explain code / Improvement plan) -> select language + framework -> paste code + error log +/or upload screenshot -> Analyze.
4. Results: issue summary, severity, probable cause, suggested fix, improved code, UI recommendations, step-by-step explanation, follow-up chat.
5. Save to history / Export report (markdown/PDF print).

## 4. Pages / Routes

```
 /                      Landing (headline, CTAs, feature cards, before/after demo, pricing placeholder)
 /dashboard             Recent projects, stats, recent analyses, quick tools
 /analyze/new           Language + framework + category + Monaco + error field + screenshot upload + Analyze
 /analyze/[id]          Results page (cards: summary/severity/cause/fix/code/explanation/next actions + follow-up Q)
 /ui-review             (v1: tab inside /analyze/new; v2: dedicated screenshot/URL flow with UI score)
 /projects              List + detail
 /projects/[id]         Project history / saved analyses
 /history               All analyses filterable
 /login, /signup        Auth (or Auth.js built-ins)
 /api/analyze           POST code+error+screenshotUrl -> structured result
 /api/followup          POST follow-up Q + analysis context -> answer
 /api/projects, /api/history, /api/upload  CRUD + storage
```

### Landing must have
- H1: "Debug your code and improve your UI in minutes."
- Buttons: Try Code Fixer, Create Account
- Feature cards: frontend, backend, debugging, design review
- Before/after code fix demo (static)
- Pricing/free-plan section (placeholder)

### Dashboard must have
- Recent projects, issues detected count, recent analyses, New Analysis button, saved reports, quick tools (Debug Error, Review UI, Check API)

### New Analysis inputs
- Language selector, framework selector (React, Next.js, HTML/CSS, Node.js, Python, etc.), problem category, Monaco editor, error-message field, screenshot upload, Analyze button

### Results cards
- Issue, Severity (Low/Med/High/Critical), Category, Likely cause, Suggested correction (diff/original vs improved), Why/explanation, Next actions, Ask follow-up, Copy + Save + Export

Example shape:
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

### UI review output (Phase 4)
- UI Score 0-100 + Problems[] + Suggested changes[] + a11y notes (labels, alt, keyboard, contrast, spacing, hierarchy, navbar <768px, 16px+ body, 16-24px form gaps)

## 5. MVP Definition (build first)

Must have:
1. Paste frontend/backend code
2. Paste error message
3. Submit to analysis service (`/api/analyze`)
4. Display: error explanation, possible cause, fixed code, short learning explanation
5. Copy corrected code button
6. Save analysis to history (requires auth+DB — or localStorage fallback if auth not done yet)

No login required to try analysis; login only required to save. Dummy-data results page first, then wire real API.

## 6. Phased Roadmap

### Phase 1: Basic interface (no DB/AI)
- [ ] Next.js + Tailwind + shadcn setup, responsive layout, nav/footer
- [ ] Landing, Dashboard (mock data), New Analysis form w/ Monaco, Results page w/ dummy data
- [ ] Shared types + Zod schemas for analysis request/response
- [ ] Acceptance: 4 screens navigable on desktop+mobile, Lighthouse mobile OK

### Phase 2: Code debugging
- [ ] `POST /api/analyze`: validation, language/framework/category routing, prompt templates, AI call, structured JSON parse + fallback
- [ ] Rule-based pre-checks: missing `await`, `onClick={fn()}` vs `onClick={fn}`, undefined null-check, `==` vs `===`, missing key in React list, wrong HTTP status, SQL string concat flag
- [ ] Secret detector: regex for `sk-`, `ghp_`, `AKIA`, `xoxb-`, `-----BEGIN PRIVATE KEY-----`, `mongodb+srv://user:pass` -> warn + redact from saved reports
- [ ] Syntax highlight + Copy button + error empty-state handling
- [ ] Rate limit (e.g., 20 req/hr anon, 100/hr authed)
- [ ] Acceptance: paste JS/React + error -> structured response end-to-end

### Phase 3: Accounts + history
- [ ] Auth.js + Prisma + Postgres (Supabase): User, Project, Analysis, SavedFix (schema below)
- [ ] Protect /dashboard, /projects, /history; anon can still analyze but cannot save
- [ ] Save/unsave, project grouping, user profile, export markdown
- [ ] Privacy: code stored only on explicit Save; private per-user queries
- [ ] Acceptance: signup -> analyze -> save -> reload history -> export works

### Phase 4: UI/screenshot analysis
- [ ] Upload (Supabase Storage, 5MB max, png/jpg/webp only), private URLs, thumbnail
- [ ] UI-review prompt: layout, mobile, button clarity, readability, contrast, spacing, nav, labels, hierarchy -> UI Score + categorized suggestions + a11y checklist
- [ ] Responsive checker heuristics: fixed `px` widths, missing viewport meta, missing media queries, overflow risks
- [ ] Acceptance: screenshot +/or frontend code -> score + 4+ actionable items

### Phase 5: Advanced (post-competition)
- [ ] GitHub connect, PR review, team workspaces, API testing workspace, perf + security scans, auto-generated tickets

## 7. Database Design (Prisma/Postgres)

```prisma
model User {
  id           String     @id @default(cuid())
  name         String?
  email        String     @unique
  passwordHash String?
  createdAt    DateTime   @default(now())
  projects     Project[]
}

model Project {
  id        String     @id @default(cuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  framework String?
  createdAt DateTime   @default(now())
  analyses  Analysis[]
}

model Analysis {
  id           String   @id @default(cuid())
  projectId    String?
  project      Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  userId       String?
  type         String   // fix_error | review_ui | review_api | explain | improvement_plan
  language     String?
  framework    String?
  codeInput    String?  @db.Text
  errorMessage String?  @db.Text
  screenshotUrl String?
  result       Json     // structured result (see §4)
  score        Int?
  createdAt    DateTime @default(now())
  savedFixes   SavedFix[]
  @@index([userId, createdAt])
}

model SavedFix {
  id            String   @id @default(cuid())
  analysisId    String
  analysis      Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  originalCode  String?  @db.Text
  suggestedCode String?  @db.Text
  userNotes     String?  @db.Text
  createdAt     DateTime @default(now())
}
```

Notes: store `codeInput` only when user clicks Save. Never store secrets — redact before persist. Enforce row ownership in every query (`userId == session.user.id`).

## 8. API Contracts

`POST /api/analyze`
```json
{ "type": "fix_error", "language": "javascript", "framework": "react", "code": "...", "error": "...", "screenshotUrl": null }
```
-> `201 { "id": null (unsaved) | "...", "result": { issueSummary, severity, category, likelyCause, suggestedFix, improvedCode, explanation, nextActions } }`

`POST /api/followup` -> `{ "answer": "..." }` given prior result + question.
`POST /api/upload` -> multipart, returns private `screenshotUrl`.
`GET/POST /api/projects`, `GET/POST /api/history`, `POST /api/save`.

All inputs Zod-validated: code ≤ 50KB, error ≤ 20KB, types whitelisted.

## 9. AI Prompt Strategy

- System prompt: senior full-stack mentor; always return strict JSON matching schema; include severity + beginner-friendly "why"; never invent file paths; warn to test before prod.
- Per-type templates: fix_error, review_ui, review_api, explain, improvement_plan.
- Temperature ~0.2 for fixes, ~0.5 for explanations. Retry once on JSON parse fail, then return graceful fallback.
- Prepend rule-based findings into prompt context (e.g., "static check found X").

## 10. Safety, Privacy, Limits

- Do not permanently store code unless user clicks Save — state this in UI + privacy note.
- Per-user isolation: never list/share another user's code or screenshots.
- Redact secrets in display + reports; warn on probable secret paste.
- Upload limits: 5MB, png/jpg/webp only, scan MIME server-side.
- Rate limiting on analyze/upload/followup.
- Disclaimer on every result: "Automated suggestions — review and test before production use."

## 11. Repo Layout (proposed)

```
app/(marketing)/page.tsx
app/(app)/dashboard/page.tsx
app/(app)/analyze/new/page.tsx
app/(app)/analyze/[id]/page.tsx
app/(app)/projects/...  app/(app)/history/page.tsx
app/api/analyze/route.ts  app/api/followup/route.ts  app/api/upload/route.ts ...
components/landing/*  components/dashboard/*  components/analyze/*  components/results/*
lib/prompts.ts  lib/rules.ts  lib/secrets.ts  lib/rate-limit.ts  lib/auth.ts  lib/db.ts
prisma/schema.prisma
```

## 12. Build Order (next actions)

1. `npx create-next-app@latest fixa-ai --ts --tailwind --app --src-dir=false` + shadcn init + Monaco + Zod + Prisma init
2. Build 4 screens with mock data (Phase 1) — land, dashboard, analyze/new, analyze/[id]
3. Implement `/api/analyze` with one working path (JS/React + error) + rules + copy button (Phase 2 MVP demo)
4. Add Auth + Supabase Postgres + Save/history/export (Phase 3)
5. Add screenshot upload + UI score (Phase 4)
6. Polish: mobile, a11y, empty states, README demo GIF, deploy to Vercel

## 13. Demo Script (for competition)

Paste broken login button (`onClick={handleLogin()}`) + error -> show High severity, cause, fix (`onClick={handleLogin}`), why, improved code, copy, save. Second demo: low-contrast button screenshot -> UI score 72 + 4 fixes.

## 14. Risks / Open Questions

- AI cost/latency -> cache identical prompts, cap tokens, timeout 30s.
- Screenshot quality variance -> require min resolution note, allow code+image combo.
- Auth provider choice (Auth.js vs Clerk) — decide at Phase 3 start based on time.
