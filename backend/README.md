# DevFix AI Backend

Express backend (Phase 2). Rule-based analysis works without AI key; set `AI_API_KEY` + `AI_API_URL` to enable AI augmentation.

## Run

```powershell
cd backend
npm install
npm test
node src/index.js  # :4000
```

## Endpoints

- `GET /api/health`
- `POST /api/analyze` — {type, language, framework, code, error, screenshotUrl} -> {id:null, result}
- `POST /api/analyze/save` — same + persists (explicit save only) -> {id, result}
- `POST /api/followup` — {question, context?, analysisId?} -> {answer}
- `POST /api/upload` — multipart field `screenshot` (png/jpg/webp, 5MB) -> {screenshotUrl}
- `GET /api/history`, `GET /api/history/:id`

Types: `fix_error | review_ui | review_api | explain | improvement_plan`

## Libs

- `lib/rules.js` — 10 static checks (onClick, null-guard, missing await, ==, key, fixed-width, labels, alt, SQLi, status)
- `lib/secrets.js` — detect + redact API keys/tokens
- `lib/analyzer.js` — AI-first, rule fallback, structured result per plan.md §4
- `lib/prompts.js` — per-type templates, strict JSON
- `lib/store.js` — in-memory (swap with Prisma in Phase 3)

Prisma schema for Phase 3: `prisma/schema.prisma`.
