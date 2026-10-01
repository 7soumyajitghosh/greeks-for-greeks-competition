// Regex-based secret detector. Returns findings; caller redacts before saving.
const PATTERNS = [
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9-_]{10,}\b/ },
  { name: "GitHub token", re: /\bghp_[A-Za-z0-9_]{10,}\b/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ },
  { name: "MongoDB SRV with credentials", re: /mongodb\+srv:\/\/[^/\s:]+:[^/\s@]+@/ },
  { name: "Generic password assignment", re: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/i },
  { name: "Generic api_key assignment", re: /(api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{6,}["']/i },
];

function detectSecrets(text = "") {
  const hits = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) hits.push(p.name);
  }
  return hits;
}

function redactSecrets(text = "") {
  return text
    .replace(/\bsk-[A-Za-z0-9-_]{10,}\b/g, "sk-***REDACTED***")
    .replace(/\bghp_[A-Za-z0-9_]{10,}\b/g, "ghp_***REDACTED***")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "AKIA***REDACTED***")
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "-----BEGIN PRIVATE KEY----- ***REDACTED***");
}

module.exports = { detectSecrets, redactSecrets };
