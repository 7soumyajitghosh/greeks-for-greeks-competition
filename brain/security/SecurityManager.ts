// Defense in depth: input sanitization, prompt-injection heuristics, tool gating, audit log.
export interface AuditEntry { at: number; actor: string; action: string; detail: string; allowed: boolean; }

const INJECTION_PATTERNS = [
  /ignore (all |all previous |previous )?instructions/i,
  /disregard.*system prompt/i,
  /reveal.*(system prompt|api key|secret)/i,
  /\[system\]/i,
  /jailbreak|dan mode/i,
  /exfiltrate|send.*to.*http/i,
];

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{10,}/g,
  /xox[bpas]-[a-zA-Z0-9-]+/g,
  /AIza[0-9A-Za-z-_]{20,}/g,
  /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/g,
];

export class SecurityManager {
  private audit: AuditEntry[] = [];
  private toolPolicy = new Map<string, "allow" | "deny" | "approve">();
  private rateWindow = new Map<string, number[]>();

  setToolPolicy(tool: string, policy: "allow" | "deny" | "approve"): void {
    this.toolPolicy.set(tool, policy);
  }

  sanitizeInput(text: string): { clean: string; flagged: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let clean = text;
    for (const re of SECRET_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(clean)) { reasons.push("secret-redacted"); re.lastIndex = 0; clean = clean.replace(re, "[REDACTED]"); }
    }
    for (const re of INJECTION_PATTERNS) {
      if (re.test(clean)) { reasons.push(`possible-prompt-injection: ${re.source.slice(0, 40)}`); break; }
    }
    // neutralize tool-output masquerading as system messages
    clean = clean.replace(/<\s*system\s*>/gi, "[blocked-tag]");
    const flagged = reasons.length > 0;
    this.log("user", "input.sanitize", reasons.join(",") || "clean", true);
    return { clean, flagged, reasons };
  }

  sanitizeToolOutput(output: string): string {
    let clean = output;
    for (const re of SECRET_PATTERNS) clean = clean.replace(re, "[REDACTED]");
    return clean.slice(0, 8000);
  }

  canUseTool(tool: string, riskLevel: "low" | "medium" | "high"): { allowed: boolean; reason: string } {
    const policy = this.toolPolicy.get(tool);
    if (policy === "deny") { this.log("agent", `tool.${tool}`, "denied by policy", false); return { allowed: false, reason: "denied by policy" }; }
    if (policy === "approve" || riskLevel === "high") {
      this.log("agent", `tool.${tool}`, "requires approval", false);
      return { allowed: false, reason: "requires explicit approval (high-risk tool)" };
    }
    this.log("agent", `tool.${tool}`, "allowed", true);
    return { allowed: true, reason: "allowed" };
  }

  checkRateLimit(actor: string, maxPerMinute = 30): boolean {
    const now = Date.now();
    const window = (this.rateWindow.get(actor) ?? []).filter((t) => now - t < 60_000);
    window.push(now);
    this.rateWindow.set(actor, window);
    const ok = window.length <= maxPerMinute;
    if (!ok) this.log(actor, "rate-limit", `exceeded ${maxPerMinute}/min`, false);
    return ok;
  }

  stripSensitiveFromLogs(payload: unknown): unknown {
    try {
      const s = JSON.stringify(payload);
      let clean = s;
      for (const re of SECRET_PATTERNS) clean = clean.replace(re, "[REDACTED]");
      return JSON.parse(clean);
    } catch { return "[unserializable]"; }
  }

  private log(actor: string, action: string, detail: string, allowed: boolean): void {
    this.audit.push({ at: Date.now(), actor, action, detail: detail.slice(0, 300), allowed });
    if (this.audit.length > 500) this.audit.shift();
  }

  getAudit(): AuditEntry[] { return [...this.audit]; }
}
