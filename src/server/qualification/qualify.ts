import {
  findUnverifiedQuotes,
  meetsQualifiedRule,
  qualificationJsonSchema,
  qualificationOutputSchema,
  recencyScore,
  totalScore,
  type QualificationOutput,
} from "@/contracts/qualification";
import { buildSystemPrompt, buildUserMessage, PROMPT_VERSION } from "./prompt";
import type { ModelClient, QualificationStore, QualifyResult } from "./types";

class QualificationFailure extends Error {}

export function scoringSchema(serviceIds: string[]): unknown {
  const schema = qualificationJsonSchema() as {
    properties: {
      serviceMatches: { items: { properties: { serviceId: Record<string, unknown> } } };
    };
  };
  // Claude can only choose from services the team actually lists.
  schema.properties.serviceMatches.items.properties.serviceId = {
    type: "string",
    enum: serviceIds.length > 0 ? serviceIds : ["none"],
  };
  return schema;
}

export function parseReply(
  reply: { stopReason: string | null; text: string },
  source: string,
  serviceIds: string[],
): QualificationOutput {
  if (reply.stopReason === "refusal") {
    throw new QualificationFailure("Claude declined to assess this lead.");
  }
  if (reply.stopReason === "max_tokens") {
    throw new QualificationFailure("Claude's reply was cut off before it finished.");
  }

  let json: unknown;
  try {
    json = JSON.parse(reply.text);
  } catch {
    throw new QualificationFailure("Claude's reply wasn't valid JSON.");
  }
  const parsed = qualificationOutputSchema.safeParse(json);
  if (!parsed.success) {
    throw new QualificationFailure("Claude's reply didn't match the expected format.");
  }

  const known = new Set(serviceIds);
  if (parsed.data.serviceMatches.some((match) => !known.has(match.serviceId))) {
    throw new QualificationFailure("Claude matched a service that isn't in the catalogue.");
  }
  const invented = findUnverifiedQuotes(source, parsed.data);
  if (invented.length > 0) {
    throw new QualificationFailure(
      `Claude quoted ${invented.length === 1 ? "text" : `${invented.length} passages`} not found in the source.`,
    );
  }
  return parsed.data;
}

export function statusFor(output: QualificationOutput, total: number) {
  if (
    !output.isBusinessOpportunity ||
    output.recommendedAction === "reject" ||
    output.disqualifier !== null
  ) {
    return {
      to: "disqualified" as const,
      reason: output.disqualifier ?? "Not a business opportunity for us",
    };
  }
  if (
    output.recommendedAction === "research" &&
    (output.fitAssessment === "good" || output.fitAssessment === "possible")
  ) {
    return { to: "research" as const, reason: "Good fit with no buying signal yet" };
  }
  if (!meetsQualifiedRule(total, output.disqualifier)) {
    return { to: "disqualified" as const, reason: `Score ${total} is below 60` };
  }
  return { to: "qualified" as const, reason: null };
}

export async function qualifyLead(
  leadId: string,
  deps: { store: QualificationStore; model: ModelClient; now: () => Date },
): Promise<QualifyResult> {
  const { store, model, now } = deps;
  try {
    const lead = await store.loadLead(leadId);
    if (!lead) throw new QualificationFailure("The lead no longer exists.");

    const [services, profile] = await Promise.all([
      store.loadServices(lead.workspace_id),
      store.loadProfile(lead.workspace_id),
    ]);
    const serviceIds = services.map((service) => service.id);
    const reply = await model.complete({
      system: buildSystemPrompt(services, profile),
      user: buildUserMessage(lead),
      schema: scoringSchema(serviceIds),
      serviceIds,
    });

    const output = parseReply(reply, lead.original_content, serviceIds);
    const recency = recencyScore(lead.published_at, now());
    const total = totalScore(output.scores, recency);

    await store.saveAnalysis({
      lead,
      output,
      recency,
      provider: model.provider,
      modelName: model.modelName,
      promptVersion: PROMPT_VERSION,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
    });
    const { to, reason } = statusFor(output, total);
    await store.transition(leadId, to, reason);
    return { leadId, outcome: to, score: total, action: output.recommendedAction };
  } catch (error) {
    const known = error instanceof QualificationFailure;
    const message = known ? error.message : "Scoring failed because of a service error.";
    if (!known) console.error(error instanceof Error ? error.message : "Scoring failed");
    try {
      await store.recordFailure(leadId, message);
    } catch (recordError) {
      console.error(recordError instanceof Error ? recordError.message : "Could not record failure");
    }
    return { leadId, outcome: "failed", error: message };
  }
}
