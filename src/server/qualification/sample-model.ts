import type { QualificationOutput } from "@/contracts/qualification";
import type { ModelClient } from "./types";

// A free stand-in for testing the flow. It looks for keywords, makes no API call,
// and says nothing about how good Claude's judgement will be.
const NEED = /\b(need|needs|looking for|want|wants|help|quote|proposal|recommend)\b/i;
const TOPIC = /\b(automat\w*|integrat\w*|connect\w*|workflow\w*|report\w*|knowledge|crm|manual|repetitive|copying)\b/i;
const CLOSED = /\b(closed|filled|spam|no longer|do not contact)\b/i;

export function createSampleModel(): ModelClient {
  return {
    provider: "sample",
    modelName: "sample-keywords-v1",
    async complete({ user, serviceIds }) {
      const lead = JSON.parse(user) as { originalContent: string; organisationName: string | null };
      const content = lead.originalContent;
      const quote = content.split(/(?<=[.!?])\s/)[0].slice(0, 200);
      const need = NEED.test(content);
      const topic = TOPIC.test(content);
      const closed = CLOSED.test(content);

      const output: QualificationOutput = {
        isBusinessOpportunity: !closed && (need || topic),
        leadSummary: `Sample assessment: ${quote}`,
        problemSummary: topic ? quote : null,
        organisationName: null,
        fitAssessment: topic ? "good" : "unknown",
        buyingIntent: need ? "high" : "low",
        urgency: "unknown",
        serviceMatches:
          topic && serviceIds[0]
            ? [{ serviceId: serviceIds[0], evidence: [{ claim: "Mentions a related need", quote }] }]
            : [],
        requirements: [],
        evidence: [{ claim: need ? "Asks for help" : "Describes the situation", quote }],
        missingInformation: ["Budget", "Timeline", "Decision maker"],
        budget: { min: null, max: null, currency: null, evidenceQuote: null },
        confidence: 0.5,
        scores: {
          serviceRelevance: topic ? 20 : 5,
          buyingIntent: need ? 22 : 3,
          projectClarity: topic ? 10 : 3,
          capabilityMatch: topic ? 15 : 5,
          budgetEvidence: 0,
        },
        disqualifier: closed ? "The request appears closed" : null,
        recommendedAction: closed ? "reject" : topic && !need ? "research" : need && topic ? "review" : "needs_information",
      };
      return { stopReason: "end_turn", text: JSON.stringify(output), inputTokens: 0, outputTokens: 0 };
    },
  };
}
