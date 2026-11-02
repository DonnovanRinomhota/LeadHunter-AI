import { z } from "zod";
import { QUALIFIED_MINIMUM_SCORE, RECOMMENDED_ACTIONS } from "./lead-state";

const level = z.enum(["low", "medium", "high", "unknown"]);

const evidence = z.strictObject({
  claim: z.string().min(1),
  quote: z.string().min(1),
});

// What Claude returns. Unknown facts are null, never guessed.
// Recency and the total are left out because code calculates them.
export const qualificationOutputSchema = z.strictObject({
  isBusinessOpportunity: z.boolean(),
  leadSummary: z.string().min(1),
  problemSummary: z.string().nullable(),
  organisationName: z.string().nullable(),
  fitAssessment: z.enum(["good", "possible", "poor", "unknown"]),
  buyingIntent: level,
  urgency: level,
  serviceMatches: z.array(
    z.strictObject({ serviceId: z.uuid(), evidence: z.array(evidence) }),
  ),
  requirements: z.array(z.string()),
  evidence: z.array(evidence),
  missingInformation: z.array(z.string()),
  budget: z.strictObject({
    min: z.number().nonnegative().nullable(),
    max: z.number().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    evidenceQuote: z.string().nullable(),
  }),
  confidence: z.number().min(0).max(1),
  scores: z.strictObject({
    serviceRelevance: z.number().int().min(0).max(25),
    buyingIntent: z.number().int().min(0).max(25),
    projectClarity: z.number().int().min(0).max(15),
    capabilityMatch: z.number().int().min(0).max(20),
    budgetEvidence: z.number().int().min(0).max(10),
  }),
  disqualifier: z.string().nullable(),
  recommendedAction: z.enum(RECOMMENDED_ACTIONS),
});
export type QualificationOutput = z.infer<typeof qualificationOutputSchema>;

const UNSUPPORTED_BY_STRUCTURED_OUTPUTS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "pattern",
  "format",
]);

function stripUnsupported(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnsupported);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !UNSUPPORTED_BY_STRUCTURED_OUTPUTS.has(key))
      .map(([key, child]) => [key, stripUnsupported(child)]),
  );
}

// The schema to send to Claude. Ranges are removed here because structured outputs
// do not accept them, so always validate the reply with qualificationOutputSchema.
export function qualificationJsonSchema(): unknown {
  return stripUnsupported(z.toJSONSchema(qualificationOutputSchema));
}

const DAY_IN_MS = 86_400_000;

export function recencyScore(publishedAt: string | null, now: Date): number {
  if (publishedAt === null) return 0;
  const ageInDays = (now.getTime() - Date.parse(publishedAt)) / DAY_IN_MS;
  if (ageInDays <= 7) return 5;
  if (ageInDays <= 30) return 3;
  if (ageInDays <= 90) return 1;
  return 0;
}

export function totalScore(
  scores: QualificationOutput["scores"],
  recency: number,
): number {
  return (
    scores.serviceRelevance +
    scores.buyingIntent +
    scores.projectClarity +
    scores.capabilityMatch +
    scores.budgetEvidence +
    recency
  );
}

export function meetsQualifiedRule(total: number, disqualifier: string | null) {
  return total >= QUALIFIED_MINIMUM_SCORE && disqualifier === null;
}

const normalise = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLowerCase();

// Returns every quote that does not appear in the source, so invented evidence can be rejected.
export function findUnverifiedQuotes(
  source: string,
  output: QualificationOutput,
): string[] {
  const haystack = normalise(source);
  const quotes = [
    ...output.evidence.map((item) => item.quote),
    ...output.serviceMatches.flatMap((match) =>
      match.evidence.map((item) => item.quote),
    ),
    ...(output.budget.evidenceQuote ? [output.budget.evidenceQuote] : []),
  ];
  return quotes.filter((quote) => !haystack.includes(normalise(quote)));
}
