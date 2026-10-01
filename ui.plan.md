# DevFix AI — Project Plan

**Tagline:** Find bugs, improve design, and build faster.
**Goal:** A fully animated, web-based developer assistant. Paste code, an error, or a screenshot, and get a structured fix, a UI review, and a plain-language explanation.

---

## 1. Product scope

| Area | What it does |
|---|---|
| Error debugger | Reads error + code, finds likely cause, proposes fix |
| Code fixer | Corrected code with before/after diff |
| UI reviewer | Screenshot or code review: spacing, contrast, responsiveness, hierarchy |
| Backend assistant | API routes, auth, DB queries, status codes, missing `await` |
| Security check | Exposed keys, weak validation, SQL injection risks |
| Code explainer | Line-by-line explanation for learning |
| History and reports | Save analyses per project, export as report |
| Follow-up chat | Ask "why does this happen?" on any result |

## 2. MVP (build first)

1. Paste code + paste error message
2. Send to analysis service
3. Show: explanation, probable cause, fixed code, short learning note
4. Copy-code button
5. Save to history

Everything else comes after this works end to end.

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Motion (Framer Motion), GSAP + ScrollTrigger, Lenis |
| 3D / hero visuals | React Three Fiber (optional) |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Diff view | Monaco diff editor or `react-diff-viewer` |
| Backend | Next.js API routes (or Express) |
| Database | PostgreSQL + Prisma (or Supabase) |
| Auth | Auth.js or Clerk (add after MVP) |
| Storage | Supabase Storage / S3 / Cloudinary |
| AI | LLM API + rule-based checks |
| Deploy | Vercel (+ Supabase/Railway/Render) |

## 4. Animation and UI direction

**Visual style:** dark, developer-native "terminal meets aurora" look.
- Near-black background, one neon accent (electric violet or cyan), soft glow
- Monospace for code and labels, clean sans-serif (Inter / Geist) for body
- Glassmorphism cards with subtle borders, gradient mesh or grid background

### Animation map (per page)

| Page | Animation ideas |
|---|---|
| Landing hero | Animated gradient/aurora background, typewriter headline, floating code snippets with parallax, glowing CTA buttons |
| Landing features | Scroll-triggered card reveals (stagger), bento grid with hover spotlight |
| Before/after demo | Code "fixing itself": red buggy line morphs into green fixed line with a typing effect |
| Dashboard | Count-up stats, animated chart draw-in, skeleton loaders, list items sliding in |
| New analysis | Animated "Analyze" button (pulse → spinner → checkmark), editor focus glow |
| Analysis in progress | Scanning-line over the code, step-by-step progress ("Reading → Finding cause → Writing fix") |
| Results | Cards stagger in, severity badge pulses, diff highlights fade in line by line |
| UI review | Score ring animates to value, problem hotspots pulse on the screenshot |
| Global | Smooth scroll (Lenis), page transitions, cursor glow, micro-interactions on every button |

### Animation rules
- Respect `prefers-reduced-motion`
- Animate `transform` and `opacity` only, for 60fps
- Keep durations 200–600 ms for UI, longer only for hero effects
- Lazy-load heavy effects (3D, particles) and disable on low-end mobile

## 5. Repository and library suggestions

### Animation libraries
| Repo | Use for |
|---|---|
| `motiondivision/motion` (Motion / Framer Motion) | Component animations, page transitions, layout animations |
| `greensock/GSAP` | Timeline animations, ScrollTrigger scroll storytelling |
| `darkroomengineering/lenis` | Buttery smooth scrolling |
| `formkit/auto-animate` | Zero-config list/add/remove animations |
| `tsparticles/tsparticles` | Particle / starfield backgrounds |
| `pmndrs/react-three-fiber` + `pmndrs/drei` | 3D hero scenes |
| `airbnb/lottie-web` / `LottieFiles/lottie-react` | Lottie micro-animations (success, loading) |
| `rive-app/rive-react` | Interactive vector animations |

### Animated UI component collections
| Repo / site | What you get |
|---|---|
| `magicuidesign/magicui` | Animated components: shimmer buttons, marquee, bento grid, beams, number tickers |
| `DavidHDev/react-bits` | Large set of animated backgrounds, text effects, cursors |
| Aceternity UI (ui.aceternity.com) | Spotlight, aurora background, 3D cards, text effects |
| `shadcn-ui/ui` | Accessible base components to build on |

### Developer-tool pieces
| Repo | Use for |
|---|---|
| `microsoft/monaco-editor` / `suren-atoyan/monaco-react` | Code editor |
| `shikijs/shiki` | Beautiful syntax highlighting in results |
| `recharts/recharts` | Dashboard charts |

> Check each repo's license and README before using, and install via npm rather than copying code blindly.

## 6. Pages

1. **Landing** — hero, feature bento grid, animated before/after demo, CTA
2. **Dashboard** — recent projects, issue counts, quick tools
3. **New analysis** — language/framework selectors, editor, error field, screenshot upload
4. **Results** — issue summary, severity, cause, fix, diff, explanation, follow-up chat
5. **UI review** — screenshot upload, score ring, hotspots, suggestions
6. **History / reports** — saved analyses, export

## 7. Roadmap

| Phase | Deliverables |
|---|---|
| 1. Animated frontend | Landing, dashboard, editor page, results page with dummy data, responsive layout, all core animations |
| 2. Debugging core | API route, input validation, AI response, syntax highlighting, copy button |
| 3. Accounts and history | Auth, database, projects, saved reports |
| 4. UI/screenshot analysis | Upload, storage, UI score, accessibility suggestions |
| 5. Advanced | GitHub repo connection, PR review, team features, security scanning, auto-generated tickets |

## 8. Data model

```text
User     (id, name, email, passwordHash, createdAt)
Project  (id, userId, name, framework, createdAt)
Analysis (id, projectId, type, language, codeInput, errorMessage,
          screenshotUrl, result, score, createdAt)
SavedFix (id, analysisId, originalCode, suggestedCode, userNotes, createdAt)
```

## 9. Safety and privacy

- Don't store code unless the user clicks **Save**
- Never expose one user's code or screenshots to another
- Detect and warn about secrets (API keys, tokens) in pasted code; never echo them in reports
- Limit file size and types; add rate limiting
- State clearly that fixes must be reviewed and tested before production

## 10. Pitch

> DevFix AI is a web-based developer-support platform that helps programmers find bugs, improve frontend design, review backend logic, and understand code fixes. Users paste code, errors, or UI screenshots and receive structured, explainable suggestions, teaching developers why an issue occurred and how to avoid it next time.

## 11. Immediate next steps

1. `npx create-next-app@latest` with TypeScript + Tailwind
2. Add shadcn/ui, Motion, GSAP, Lenis
3. Build the landing hero with animated background and the before/after code demo
4. Build dashboard and results pages with dummy data
5. Wire the MVP: paste code + error → analysis API → animated results
