```
  ╔══════════════════════════════════════════════════════════════════════╗
  ║                                                                      ║
  ║   ██████╗ ███████╗██╗   ██╗███████╗██╗██╗  ██╗                      ║
  ║   ██╔══██╗██╔════╝██║   ██║██╔════╝██║╚██╗██╔╝                      ║
  ║   ██║  ██║█████╗  ██║   ██║█████╗  ██║ ╚███╔╝                       ║
  ║   ██║  ██║██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║ ██╔██╗                       ║
  ║   ██████╔╝███████╗ ╚████╔╝ ██║     ██║██╔╝ ██╗                      ║
  ║   ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝     ╚═╝╚═╝  ╚═╝                      ║
  ║                                                                      ║
  ║   █████╗ ██╗    ██████╗ ██████╗  █████╗ ██╗███╗   ██╗               ║
  ║  ██╔══██╗██║    ██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║               ║
  ║  ███████║██║    ██████╔╝██████╔╝███████║██║██╔██╗ ██║               ║
  ║  ██╔══██║██║    ██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║               ║
  ║  ██║  ██║██║    ██║  ██║██║  ██║██║  ██║██║██║ ╚████║               ║
  ║  ╚═╝  ╚═╝╚═╝    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝               ║
  ║                                                                      ║
  ╚══════════════════════════════════════════════════════════════════════╝
```

<p align="center">
  <strong>Find bugs. Improve design. Build faster.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-brain">Brain</a> •
  <a href="#-logscope">LogScope</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

---

## 🧠 What is DevFix AI?

**DevFix AI** is an intelligent developer-support platform that doesn't just tell you *what's wrong* — it shows you *why* it's wrong and *how* to fix it. Think of it as a senior developer sitting next to you, reviewing your code, your UI, and your logs — but at machine speed.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Your Code ──►  ┌─────────────┐  ──►  Fixed Code              │
│                   │             │                               │
│   Your UI   ──►  │  DevFix AI  │  ──►  Better Design            │
│                   │             │                               │
│   Your Logs ──►  │   🧠 Brain  │  ──►  Root Cause               │
│                   │             │                               │
│   Your API   ──►  │             │  ──►  Optimized Backend       │
│                   └─────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🔍 Bug Diagnosis & Fix
```
Before:  const total = items.reduce((a, b) => a + b.price);  // NaN when price is undefined
After:   const total = items.reduce((a, b) => a + (b.price ?? 0), 0);
Why:     Nullish coalescing prevents NaN propagation when price is missing.
```
- **Root-cause analysis** — not just the symptom, but the disease
- **One-click fixes** with explanations you can actually learn from
- **Multi-language support** — TypeScript, JavaScript, Python, Go, Rust, and more

### 🎨 UI / Frontend Review
- Layout & responsive design audits
- Accessibility (a11y) scoring with actionable fixes
- Contrast & color analysis
- Component structure suggestions

### ⚙️ Backend Guidance
- API design review
- Database schema optimization
- Authentication & validation patterns
- Performance bottleneck detection

### 📊 Log Analysis (LogScope)
```
$ logscope analyze ./logs/production.log

  🔴 CRITICAL  12 occurrences  Database connection pool exhausted
  🟡 WARNING   47 occurrences  Slow query detected (>2000ms)
  🟢 INFO     891 occurrences  Request completed successfully

  📄 Report exported: ./out-csv/report.csv
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DevFix AI Platform                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Next.js    │  │   Monaco     │  │  shadcn/ui   │              │
│  │   Frontend   │  │   Editor     │  │  Components  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│         └────────────┬────┘                 │                        │
│                      ▼                      │                        │
│              ┌───────────────┐              │                        │
│              │  API Routes   │◄─────────────┘                        │
│              │  (Auth.js)    │                                       │
│              └───────┬───────┘                                       │
│                      │                                               │
│         ┌────────────┼────────────┐                                  │
│         ▼            ▼            ▼                                  │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐                           │
│  │  Prisma    │ │  AI API  │ │  Brain   │                           │
│  │  + Postgres│ │  Router  │ │  Engine  │                           │
│  └────────────┘ └──────────┘ └────┬─────┘                           │
│                                    │                                  │
│                    ┌───────────────┼───────────────┐                 │
│                    ▼               ▼               ▼                 │
│             ┌──────────┐   ┌──────────┐   ┌──────────┐              │
│             │  Coding  │   │  Debug   │   │  Review  │              │
│             │  Brain   │   │  Brain   │   │  Brain   │              │
│             └──────────┘   └──────────┘   └──────────┘              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- An AI provider API key (OpenAI, Anthropic, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/greeks-for-greeks-competition.git
cd greeks-for-greeks-competition

# Install dependencies
npm install

# Set up environment variables
cp brain/.env.example brain/.env
# Edit brain/.env with your API keys

# Run database migrations
npx prisma migrate dev

# Start the development server
npm run dev
```

### Environment Variables

```env
# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/devfix

# Auth
AUTH_SECRET=your-secret-here
AUTH_URL=http://localhost:3000

# Brain Configuration
BRAIN_MAX_TOKENS=4096
BRAIN_TEMPERATURE=0.3
BRAIN_ENABLE_CACHE=true
```

---

## 🧠 Brain

The **Unified AI Brain** is the intelligence engine powering DevFix AI. It's a modular, composable system that thinks like a developer.

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified AI Brain                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Perception ──► Cognition ──► Memory ──► Action            │
│      │              │           │          │                │
│      ▼              ▼           ▼          ▼                │
│  ┌────────┐  ┌──────────┐ ┌────────┐ ┌──────────┐         │
│  │  Code  │  │ Reasoning│ │Short-  │ │  Coding  │         │
│  │  Input │  │ Planning │ │term    │ │  Loop    │         │
│  │  Repo  │  │ Decision │ │Semantic│ │  Build   │         │
│  │  Logs  │  │Hypothesis│ │Episodic│ │  Test    │         │
│  │  UI    │  │          │ │Codebase│ │  Debug   │         │
│  └────────┘  └──────────┘ └────────┘ │  Review  │         │
│                                       │  Refactor │         │
│                                       └──────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Brain Capabilities

| Module | Description |
|--------|-------------|
| **Coding Brain** | READ → INTENT → ARCHITECTURE → MODEL → PLAN → WRITE → RUN → DEBUG → TEST → REVIEW → REFACTOR → VERIFY |
| **Animation Brain** | SEE → DETECT → TRACK → RECONSTRUCT → RENDER |
| **Memory** | Short-term, semantic, episodic, and codebase memory |
| **Model Router** | Smart routing across AI providers with fallback |
| **Security** | Prompt injection detection, sandboxing, validation |
| **Observability** | Tracing, metrics, and diagnostics |

### Brain Loops

```
  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
  │  BUILD  │────►│  TEST   │────►│  DEBUG  │────►│IMPROVE  │
  └─────────┘     └─────────┘     └─────────┘     └────┬────┘
       ▲                                               │
       └───────────────────────────────────────────────┘
```

---

## 📊 LogScope

A standalone CLI tool for intelligent log analysis.

### Installation

```bash
cd logscope
npm install
npm run build
```

### Usage

```bash
# Analyze a log file
logscope analyze ./logs/app.log

# Parse with specific format
logscope parse ./logs/app.log --format json

# List available templates
logscope templates

# Export to CSV
logscope analyze ./logs/app.log --export csv
```

### Supported Formats

| Format | Description |
|--------|-------------|
| `auto` | Auto-detect format |
| `json` | JSON-structured logs |
| `iso` | ISO 8601 timestamped |
| `syslog` | Standard syslog format |
| `nginx` | Nginx access logs |
| `plain` | Plain text logs |

---

## 🗺️ Roadmap

```
  Phase 1          Phase 2          Phase 3          Phase 4
  ─────────        ─────────        ─────────        ─────────
  ✅ Brain Core    🔄 DevFix UI     ⬜ Team Collab   ⬜ Marketplace
  ✅ LogScope      🔄 AI Routing    ⬜ CI/CD Plugin  ⬜ Custom Models
  ✅ API Skeleton  ⬜ Auth System   ⬜ Mobile App    ⬜ Enterprise
  ✅ CLI Tools     ⬜ DB + Prisma   ⬜ Analytics    ⬜ Plugin SDK
```

- [x] Unified Brain architecture
- [x] LogScope CLI tool
- [x] Multi-format log parser
- [x] Drain-style template extraction
- [x] Sentry-style issue grouping
- [ ] DevFix AI web interface
- [ ] AI provider integration
- [ ] User authentication
- [ ] Database persistence
- [ ] Real-time collaboration
- [ ] CI/CD integration
- [ ] Plugin system

---

## 📁 Repository Structure

```
greeks-for-greeks-competition/
├── brain/                    # 🧠 Unified AI Brain
│   ├── agents/               # Agent implementations
│   ├── animation/            # Animation understanding
│   ├── api/                  # Brain API entry point
│   ├── codebase/             # Code indexing & parsing
│   ├── coding/               # Human-like coding pipeline
│   ├── cognition/            # Reasoning & planning
│   ├── config/               # Brain configuration
│   ├── context/              # Context management
│   ├── core/                 # UnifiedBrain orchestrator
│   ├── debugging/            # Debugging modules
│   ├── loops/                # Autonomous loops
│   ├── memory/               # Memory systems
│   ├── models/               # Model routing & providers
│   ├── observability/        # Tracing & metrics
│   ├── perception/           # Input processing
│   ├── performance/          # Resource management
│   ├── planner/              # Task planning
│   ├── rag/                  # Retrieval-Augmented Generation
│   ├── reasoning/            # Reasoning modules
│   ├── review/               # Code review
│   ├── security/             # Security & validation
│   ├── testing/              # Testing modules
│   ├── tools/                # Tool implementations
│   ├── understanding/        # Code & intent understanding
│   ├── ARCHITECTURE.md       # Architecture documentation
│   └── README.md             # Brain documentation
│
├── logscope/                 # 📊 Log Analysis CLI
│   ├── src/
│   │   ├── cli.ts            # CLI entry point
│   │   ├── analyze.ts        # Analysis orchestration
│   │   ├── drain.ts          # Drain-style template extraction
│   │   ├── grouper.ts        # Sentry-style issue grouping
│   │   ├── parser.ts         # Multi-format log parser
│   │   ├── report.ts         # Report generation
│   │   └── types.ts          # Type definitions
│   ├── dist/                 # Compiled output
│   └── package.json
│
├── plan.md                   # 📋 DevFix AI build plan
├── opencode.json             # 🔧 Opencode configuration
└── README.md                 # 📖 This file
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get involved:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and descriptive

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [GeeksforGeeks](https://www.geeksforgeeks.org/) for the competition
- [Next.js](https://nextjs.org/) for the amazing framework
- [Prisma](https://www.prisma.io/) for database excellence
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the code editor

---

<p align="center">
  <sub>Built with ❤️ by the DevFix AI Team</sub>
</p>

<p align="center">
  <sub>⭐ Star this repo if you find it useful!</sub>
</p>
