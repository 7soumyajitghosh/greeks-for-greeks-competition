const { z } = require("zod");

const AnalysisType = z.enum([
  "fix_error",
  "review_ui",
  "review_api",
  "explain",
  "improvement_plan",
]);

const analyzeSchema = z.object({
  type: AnalysisType,
  language: z.string().max(50).optional().default("javascript"),
  framework: z.string().max(50).optional().default("react"),
  code: z.string().max(50_000).optional().default(""),
  error: z.string().max(20_000).optional().default(""),
  screenshotUrl: z.string().max(2048).optional().nullable().default(null),
}).refine((d) => d.code || d.error || d.screenshotUrl, {
  message: "Provide at least one of: code, error, screenshotUrl",
});

const followupSchema = z.object({
  analysisId: z.string().optional(),
  question: z.string().min(1).max(5000),
  context: z.object({
    issueSummary: z.string().optional(),
    likelyCause: z.string().optional(),
    suggestedFix: z.string().optional(),
    improvedCode: z.string().optional(),
  }).optional(),
});

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.validated = parsed.data;
    next();
  };
}

module.exports = { analyzeSchema, followupSchema, validate, AnalysisType };
