import { describe, expect, it } from "vitest";
import { leadIngestSchema } from "./ingest";
import { signRequest, verifyRequest } from "./internal-auth";
import {
  findUnverifiedQuotes,
  meetsQualifiedRule,
  qualificationJsonSchema,
  qualificationOutputSchema,
  recencyScore,
  totalScore,
  type QualificationOutput,
} from "./qualification";

const ingest = {
  idempotencyKey: "rss:abc12345",
  sourceType: "rss",
  sourceConfigId: null,
  sourceRecordId: "abc",
  sourceUrl: "https://example.test/post",
  authorHandle: null,
  organisationName: null,
  countryCode: "ZW",
  contactChannel: null,
  contactValue: null,
  originalContent: "We need help automating our invoice process.",
  publishedAt: "2026-11-01T10:00:00+01:00",
};

const output: QualificationOutput = {
  isBusinessOpportunity: true,
  leadSummary: "Firm wants invoice automation",
  problemSummary: "Manual invoicing",
  organisationName: null,
  fitAssessment: "good",
  buyingIntent: "high",
  urgency: "unknown",
  serviceMatches: [
    {
      serviceId: "aaaaaaaa-0000-4000-8000-000000000001",
      evidence: [{ claim: "Needs automation", quote: "automating our invoice" }],
    },
  ],
  requirements: [],
  evidence: [{ claim: "Asks for help", quote: "We need   help" }],
  missingInformation: ["Budget"],
  budget: { min: null, max: null, currency: null, evidenceQuote: null },
  confidence: 0.8,
  scores: {
    serviceRelevance: 22,
    buyingIntent: 23,
    projectClarity: 12,
    capabilityMatch: 17,
    budgetEvidence: 0,
  },
  disqualifier: null,
  recommendedAction: "review",
};

describe("lead ingest", () => {
  it("accepts a valid lead", () => {
    expect(leadIngestSchema.safeParse(ingest).success).toBe(true);
  });

  it.each([
    ["an unknown field", { ...ingest, status: "won" }],
    ["empty content", { ...ingest, originalContent: "   " }],
    ["a lowercase country code", { ...ingest, countryCode: "zw" }],
    ["a non-web URL", { ...ingest, sourceUrl: "javascript:alert(1)" }],
    ["a date without an offset", { ...ingest, publishedAt: "2026-11-01" }],
  ])("rejects %s", (_name, value) => {
    expect(leadIngestSchema.safeParse(value).success).toBe(false);
  });
});

describe("qualification output", () => {
  it("accepts a valid result", () => {
    expect(qualificationOutputSchema.safeParse(output).success).toBe(true);
  });

  it.each([
    ["a score over its limit", { scores: { ...output.scores, buyingIntent: 26 } }],
    ["an unknown action", { recommendedAction: "send_now" }],
    ["a model-supplied total", { totalScore: 100 }],
    ["an invented level", { buyingIntent: "certain" }],
  ])("rejects %s", (_name, change) => {
    expect(
      qualificationOutputSchema.safeParse({ ...output, ...change }).success,
    ).toBe(false);
  });

  it("calculates the total, including recency", () => {
    expect(totalScore(output.scores, 4)).toBe(78);
  });

  it("applies the qualified rule", () => {
    expect(meetsQualifiedRule(60, null)).toBe(true);
    expect(meetsQualifiedRule(59, null)).toBe(false);
    expect(meetsQualifiedRule(90, "Request is closed")).toBe(false);
  });

  it("scores recency from the date, with unknown dates scoring nothing", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(recencyScore("2026-11-01T00:00:00Z", now)).toBe(5);
    expect(recencyScore("2026-10-10T00:00:00Z", now)).toBe(3);
    expect(recencyScore("2026-08-20T00:00:00Z", now)).toBe(1);
    expect(recencyScore("2026-01-01T00:00:00Z", now)).toBe(0);
    expect(recencyScore(null, now)).toBe(0);
  });

  it("finds quotes that are not in the source", () => {
    const source = "We need help automating our invoice process.";
    expect(findUnverifiedQuotes(source, output)).toEqual([]);
    const invented = {
      ...output,
      budget: { ...output.budget, evidenceQuote: "budget of $50,000" },
    };
    expect(findUnverifiedQuotes(source, invented)).toEqual(["budget of $50,000"]);
  });

  it("produces a schema Claude's structured outputs can accept", () => {
    const json = JSON.stringify(qualificationJsonSchema());
    for (const key of ["minimum", "maximum", "pattern", "format", "$schema"]) {
      expect(json).not.toContain(`"${key}"`);
    }
    expect(json).toContain('"additionalProperties":false');
  });
});

describe("internal request signing", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const timestamp = Math.floor(now.getTime() / 1000);
  const body = '{"a":1}';
  const signature = signRequest("secret", timestamp, body);
  const request = {
    secret: "secret",
    timestamp: String(timestamp),
    signature,
    rawBody: body,
    now,
  };

  it("accepts a correct signature", () => {
    expect(verifyRequest(request)).toBe(true);
  });

  it.each([
    ["a changed body", { rawBody: '{"a":2}' }],
    ["the wrong secret", { secret: "other" }],
    ["a missing signature", { signature: null }],
    ["a malformed timestamp", { timestamp: "soon" }],
    ["an empty secret", { secret: "" }],
    ["a request too far in the past", { now: new Date(now.getTime() + 301_000) }],
  ])("rejects %s", (_name, change) => {
    expect(verifyRequest({ ...request, ...change })).toBe(false);
  });
});
