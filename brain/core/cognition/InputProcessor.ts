import type { ContextItem, InputType, TaskContext } from "../types";
import { estimateTokens } from "../../context/tokenizer";

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

const CODE_HINTS = [/function\s+\w+\s*\(/, /const\s+\w+\s*=/, /import\s+.+\s+from\s+/, /def\s+\w+\s*\(/, /class\s+\w+/, /<\w+[^>]*>/, /\{\s*".*":/, /npm\s|pip\s|git\s/];
const URL_RE = /https?:\/\/[^\s"')\]]+/g;
const TOOL_KEYWORDS: Record<string, string[]> = {
  web_search: ["search", "latest", "news", "docs", "documentation", "lookup", "find online"],
  browser: ["browse", "open url", "visit", "website", "page"],
  filesystem: ["file", "read", "write", "folder", "directory", "codebase", "repo"],
  terminal: ["run", "execute", "command", "test", "build", "deploy", "install"],
  code_execution: ["calculate", "compute", "run code", "python", "script"],
  github: ["github", "repo", "pull request", "issue", "commit"],
  image_generation: ["generate image", "draw", "create image", "illustration"],
  document_processing: ["pdf", "document", "summarize doc", "parse"],
};

export interface RawInput {
  message: string;
  attachments?: Array<{ type: InputType; content: string; name?: string }>;
  history?: ContextItem[];
  constraints?: string[];
}

function detectInputType(message: string, attachments?: RawInput["attachments"]): InputType {
  if (attachments?.length) return attachments[0].type;
  URL_RE.lastIndex = 0;
  if (URL_RE.test(message)) return "url";
  if (CODE_HINTS.some((re) => re.test(message))) return "code";
  if (/^\s*\{[\s\S]*\}\s*$/.test(message) || /^\s*\[[\s\S]*\]\s*$/.test(message)) return "structured";
  return "text";
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  URL_RE.lastIndex = 0;
  for (const m of text.matchAll(URL_RE)) entities.add(m[0].slice(0, 120));
  for (const m of text.matchAll(/`([^`]{1,60})`/g)) entities.add(m[1]);
  for (const m of text.matchAll(/\b([A-Z][a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+)\b/g)) entities.add(m[1]);
  for (const m of text.matchAll(/#(\w[\w-]{1,40})/g)) entities.add(m[1]);
  return [...entities].slice(0, 20);
}

function detectIntent(text: string): string {
  const t = text.toLowerCase();
  if (/build|create|implement|scaffold|generate.*app|website/.test(t)) return "build";
  if (/debug|fix|error|failing|bug|stack trace/.test(t)) return "debug";
  if (/explain|what is|why|how does|teach|compare|difference/.test(t)) return "explain";
  if (/plan|design|architect|roadmap|steps/.test(t)) return "plan";
  if (/refactor|optimiz|improve|review/.test(t)) return "refactor";
  if (/test|verify|check/.test(t)) return "verify";
  if (/summar/.test(t)) return "summarize";
  if (/search|find|lookup|latest/.test(t)) return "research";
  return "general";
}

function detectComplexity(text: string, toolsRequired: string[]): TaskContext["complexity"] {
  const words = text.split(/\s+/).length;
  const steps = (text.match(/\b(and|then|also|plus|with)\b/gi) ?? []).length;
  const score = words / 40 + steps * 0.7 + toolsRequired.length * 0.8;
  if (score >= 3) return "complex";
  if (score >= 1.2) return "medium";
  return "simple";
}

function detectTools(text: string, attachments?: RawInput["attachments"]): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const [tool, keywords] of Object.entries(TOOL_KEYWORDS)) {
    if (keywords.some((k) => t.includes(k))) found.add(tool);
  }
  for (const a of attachments ?? []) {
    if (a.type === "url") { found.add("browser"); found.add("web_search"); }
    if (a.type === "document") found.add("document_processing");
    if (a.type === "image") found.add("browser");
    if (a.type === "code") { found.add("filesystem"); found.add("code_execution"); }
  }
  if (/https?:\/\//.test(text)) found.add("browser");
  return [...found];
}

function requiredCapabilities(intent: string, inputType: InputType): string[] {
  const caps = new Set<string>();
  if (intent === "build" || intent === "debug" || intent === "refactor") caps.add("coding");
  if (intent === "plan" || intent === "general") caps.add("reasoning");
  if (inputType === "image") caps.add("vision");
  if (inputType === "document") caps.add("longContext");
  if (intent === "research") caps.add("tools");
  return [...caps];
}

export class InputProcessor {
  process(raw: RawInput): TaskContext {
    const inputType = detectInputType(raw.message, raw.attachments);
    const toolsRequired = detectTools(raw.message, raw.attachments);
    const intent = detectIntent(raw.message);
    const complexity = detectComplexity(raw.message, toolsRequired);
    const entities = extractEntities(raw.message + " " + (raw.attachments ?? []).map((a) => a.content.slice(0, 2000)).join(" "));
    URL_RE.lastIndex = 0;
    const urls = raw.message.match(URL_RE) ?? [];
    const constraints = [...(raw.constraints ?? [])];
    if (urls.length) constraints.push(`Must consider external URL(s): ${urls.slice(0, 3).join(", ")}`);
    if (raw.attachments?.length) constraints.push(`Has ${raw.attachments.length} attachment(s)`);

    const context: ContextItem[] = [
      ...(raw.history ?? []).slice(-20),
      ...(raw.attachments ?? []).map((a) => ({
        id: uid("att"),
        role: "user" as const,
        content: `[${a.type}${a.name ? `:${a.name}` : ""}] ${a.content.slice(0, 4000)}`,
        tokens: estimateTokens(a.content.slice(0, 4000)),
        timestamp: Date.now(),
        importance: 0.7,
        source: "attachment",
      })),
    ];

    return {
      id: uid("task"),
      userInput: raw.message,
      normalizedInput: raw.message.trim().replace(/\s+/g, " "),
      inputType,
      intent,
      complexity,
      constraints,
      requiredCapabilities: requiredCapabilities(intent, inputType),
      context,
      toolsRequired,
      entities,
      language: "en",
      createdAt: Date.now(),
    };
  }
}
